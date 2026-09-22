const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// Serve static files from the public folder and repository root
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', activeRooms: rooms.size, timestamp: new Date().toISOString() });
});

// Room storage
const rooms = new Map();

// Helper to generate unique 6-character alphanumeric room codes
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid easily confused chars (I, O, 0, 1)
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

// Winning combinations for Tic-Tac-Toe
const WINNING_COMBOS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
  [0, 4, 8], [2, 4, 6]             // Diagonals
];

function checkWinner(board) {
  for (const combo of WINNING_COMBOS) {
    const [a, b, c] = combo;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line: combo };
    }
  }
  if (board.every(cell => cell !== null && cell !== '')) {
    return { winner: 'draw', line: null };
  }
  return null;
}

io.on('connection', (socket) => {
  let currentRoomCode = null;

  // Create Room
  socket.on('create-room', ({ playerName }) => {
    const cleanName = (playerName || 'Player 1').trim().slice(0, 15) || 'Player 1';
    const roomCode = generateRoomCode();
    currentRoomCode = roomCode;

    const room = {
      code: roomCode,
      players: [
        { id: socket.id, name: cleanName, symbol: 'X', score: 0 }
      ],
      spectators: [],
      board: Array(9).fill(null),
      currentTurn: 'X',
      status: 'waiting',
      winner: null,
      winningLine: null,
      rematchVotes: new Set(),
      scores: { X: 0, O: 0, draws: 0 },
      startingTurn: 'X'
    };

    rooms.set(roomCode, room);
    socket.join(roomCode);

    socket.emit('room-created', {
      roomCode,
      playerSymbol: 'X',
      playerName: cleanName,
      roomState: getPublicRoomState(room)
    });
  });

  // Join Room
  socket.on('join-room', ({ roomCode, playerName }) => {
    const code = (roomCode || '').trim().toUpperCase();
    const room = rooms.get(code);

    if (!room) {
      socket.emit('error-message', { message: 'Room not found. Please verify the code.' });
      return;
    }

    currentRoomCode = code;
    socket.join(code);

    if (room.players.length === 1) {
      // Join as Player 2 (O)
      const cleanName = (playerName || 'Player 2').trim().slice(0, 15) || 'Player 2';
      const player2 = { id: socket.id, name: cleanName, symbol: 'O', score: 0 };
      room.players.push(player2);
      room.status = 'playing';

      socket.emit('room-joined', {
        roomCode: code,
        playerSymbol: 'O',
        playerName: cleanName,
        isSpectator: false,
        roomState: getPublicRoomState(room)
      });

      // Notify entire room that game has started
      io.to(code).emit('game-started', {
        message: `${player2.name} joined! Game started.`,
        roomState: getPublicRoomState(room)
      });
    } else {
      // Room is already full with 2 players -> Join as spectator
      const spectatorName = (playerName || `Spectator ${room.spectators.length + 1}`).trim().slice(0, 15);
      room.spectators.push({ id: socket.id, name: spectatorName });

      socket.emit('room-joined', {
        roomCode: code,
        playerSymbol: null,
        playerName: spectatorName,
        isSpectator: true,
        roomState: getPublicRoomState(room)
      });

      io.to(code).emit('spectator-update', {
        spectatorCount: room.spectators.length,
        message: `${spectatorName} joined as spectator.`
      });
    }
  });

  // Make Move
  socket.on('make-move', ({ index }) => {
    if (!currentRoomCode) return;
    const room = rooms.get(currentRoomCode);
    if (!room || room.status !== 'playing') return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    // Must be this player's turn
    if (player.symbol !== room.currentTurn) {
      socket.emit('error-message', { message: "It's not your turn!" });
      return;
    }

    // Must be valid cell and empty
    if (index < 0 || index > 8 || room.board[index] !== null) {
      socket.emit('error-message', { message: 'Invalid move!' });
      return;
    }

    // Place symbol
    room.board[index] = player.symbol;

    // Check for win/draw
    const result = checkWinner(room.board);

    if (result) {
      room.status = 'ended';
      room.winner = result.winner;
      room.winningLine = result.line;

      if (result.winner === 'draw') {
        room.scores.draws++;
      } else {
        room.scores[result.winner]++;
        const winnerPlayer = room.players.find(p => p.symbol === result.winner);
        if (winnerPlayer) winnerPlayer.score++;
      }

      io.to(currentRoomCode).emit('game-over', {
        board: room.board,
        winner: result.winner,
        winningLine: result.line,
        scores: room.scores,
        roomState: getPublicRoomState(room)
      });
    } else {
      // Toggle turn
      room.currentTurn = room.currentTurn === 'X' ? 'O' : 'X';

      io.to(currentRoomCode).emit('move-made', {
        index,
        symbol: player.symbol,
        nextTurn: room.currentTurn,
        board: room.board
      });
    }
  });

  // Request Rematch
  socket.on('request-rematch', () => {
    if (!currentRoomCode) return;
    const room = rooms.get(currentRoomCode);
    if (!room) return;

    const player = room.players.find(p => p.id === socket.id);
    if (!player) return;

    room.rematchVotes.add(socket.id);

    // If both players have voted for rematch
    if (room.rematchVotes.size >= 2) {
      room.board = Array(9).fill(null);
      room.status = 'playing';
      room.winner = null;
      room.winningLine = null;
      room.rematchVotes.clear();
      // Alternate starting player each round
      room.startingTurn = room.startingTurn === 'X' ? 'O' : 'X';
      room.currentTurn = room.startingTurn;

      io.to(currentRoomCode).emit('rematch-start', {
        message: 'Rematch accepted! Starting new round...',
        roomState: getPublicRoomState(room)
      });
    } else {
      // Notify opponent that rematch was requested
      socket.to(currentRoomCode).emit('rematch-requested', {
        playerName: player.name
      });
      socket.emit('rematch-pending');
    }
  });

  // Live reactions / Quick Chat
  socket.on('send-reaction', ({ emoji, text }) => {
    if (!currentRoomCode) return;
    const room = rooms.get(currentRoomCode);
    if (!room) return;

    const sender = room.players.find(p => p.id === socket.id) || 
                   room.spectators.find(s => s.id === socket.id);
    const senderName = sender ? sender.name : 'Someone';

    io.to(currentRoomCode).emit('new-reaction', {
      senderName,
      senderId: socket.id,
      emoji: emoji || null,
      text: (text || '').trim().slice(0, 80)
    });
  });

  // Handle Disconnect
  socket.on('disconnect', () => {
    if (!currentRoomCode) return;
    const room = rooms.get(currentRoomCode);
    if (!room) return;

    const playerIndex = room.players.findIndex(p => p.id === socket.id);

    if (playerIndex !== -1) {
      const leavingPlayer = room.players[playerIndex];
      // Remove player
      room.players.splice(playerIndex, 1);

      // If spectators exist, promote first spectator to player
      if (room.spectators.length > 0) {
        const nextPlayer = room.spectators.shift();
        room.players.push({
          id: nextPlayer.id,
          name: nextPlayer.name,
          symbol: leavingPlayer.symbol,
          score: 0
        });

        io.to(currentRoomCode).emit('player-promoted', {
          promotedPlayerName: nextPlayer.name,
          symbol: leavingPlayer.symbol,
          roomState: getPublicRoomState(room)
        });
      } else {
        // No players left or only 1 player remaining
        if (room.players.length === 0) {
          rooms.delete(currentRoomCode);
        } else {
          room.status = 'waiting';
          room.board = Array(9).fill(null);
          room.winner = null;
          room.winningLine = null;
          room.rematchVotes.clear();

          io.to(currentRoomCode).emit('player-left', {
            playerName: leavingPlayer.name,
            message: `${leavingPlayer.name} has disconnected. Waiting for opponent...`,
            roomState: getPublicRoomState(room)
          });
        }
      }
    } else {
      // Check if spectator disconnected
      const specIndex = room.spectators.findIndex(s => s.id === socket.id);
      if (specIndex !== -1) {
        room.spectators.splice(specIndex, 1);
        io.to(currentRoomCode).emit('spectator-update', {
          spectatorCount: room.spectators.length
        });
      }
    }
  });
});

function getPublicRoomState(room) {
  return {
    code: room.code,
    players: room.players.map(p => ({ name: p.name, symbol: p.symbol, score: p.score })),
    spectatorsCount: room.spectators.length,
    board: room.board,
    currentTurn: room.currentTurn,
    status: room.status,
    winner: room.winner,
    winningLine: room.winningLine,
    scores: room.scores
  };
}

server.listen(PORT, () => {
  console.log(`⚡ Tic-Tac-Toe Server running at http://localhost:${PORT}`);
});
