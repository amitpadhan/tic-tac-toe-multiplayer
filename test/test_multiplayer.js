const { io } = require('socket.io-client');
const assert = require('assert');
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const PORT = 3000;
const SERVER_URL = `http://localhost:${PORT}`;

function isServerRunning() {
  return new Promise((resolve) => {
    const req = http.get(`${SERVER_URL}/health`, (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function delay(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function ensureServerRunning() {
  const running = await isServerRunning();
  if (running) {
    console.log('Server is already running on port', PORT);
    return null;
  }

  console.log('Starting local test server on port', PORT, '...');
  const serverProcess = spawn('node', [path.join(__dirname, '../server.js')], {
    stdio: 'ignore'
  });

  // Wait for server to respond
  for (let i = 0; i < 20; i++) {
    await delay(250);
    if (await isServerRunning()) {
      console.log('Test server is ready!\n');
      return serverProcess;
    }
  }

  throw new Error('Failed to start test server within 5 seconds.');
}

async function runTests() {
  const spawnedServer = await ensureServerRunning();

  try {
    console.log('🧪 Starting Multiplayer Connection & Game Tests...\n');

    // ----------------------------------------------------
    // TEST 1: Tic-Tac-Toe Cross-Device Connection with Code
    // ----------------------------------------------------
    console.log('--- TEST 1: Tic-Tac-Toe Device A (Host) & Device B (Guest) ---');
    await new Promise((resolve, reject) => {
      const deviceA = io(SERVER_URL);
      const deviceB = io(SERVER_URL);

      deviceA.on('connect', () => {
        console.log('Device A connected. Creating Tic-Tac-Toe room...');
        deviceA.emit('create-room', { playerName: 'DeviceA_Host', gameType: 'tictactoe' });
      });

      deviceA.on('room-created', ({ roomCode, playerSymbol, gameType }) => {
        console.log(`✓ Device A created room: ${roomCode}, Symbol: ${playerSymbol}, Game: ${gameType}`);
        assert.strictEqual(playerSymbol, 'X');
        assert.strictEqual(gameType, 'tictactoe');

        // Device B joins with lowercase and spacing to test sanitization
        console.log(`Device B joining with formatted code " ${roomCode.toLowerCase()} "...`);
        deviceB.emit('join-room', {
          roomCode: ` ${roomCode.toLowerCase()} `,
          playerName: 'DeviceB_Guest'
        });
      });

      deviceB.on('room-joined', ({ roomCode, playerSymbol, gameType }) => {
        console.log(`✓ Device B joined room: ${roomCode}, Symbol: ${playerSymbol}, Game: ${gameType}`);
        assert.strictEqual(playerSymbol, 'O');
        assert.strictEqual(gameType, 'tictactoe');
      });

      let gameStartedCount = 0;
      const checkGameStarted = () => {
        gameStartedCount++;
        if (gameStartedCount === 2) {
          console.log('✓ Both devices received game-started event!');
          deviceA.emit('make-move', { index: 4 }); // Center
        }
      };

      deviceA.on('game-started', checkGameStarted);
      deviceB.on('game-started', checkGameStarted);

      deviceB.on('move-made', ({ index, symbol, nextTurn, board }) => {
        console.log(`✓ Device B received Device A's move: index ${index}, symbol ${symbol}, nextTurn ${nextTurn}`);
        assert.strictEqual(index, 4);
        assert.strictEqual(symbol, 'X');
        assert.strictEqual(nextTurn, 'O');
        assert.strictEqual(board[4], 'X');

        deviceA.disconnect();
        deviceB.disconnect();
        console.log('✓ TEST 1 PASSED!\n');
        resolve();
      });

      setTimeout(() => reject(new Error('Test 1 timed out')), 6000);
    });

    // ----------------------------------------------------
    // TEST 2: Dots & Boxes Cross-Device Connection with Code
    // ----------------------------------------------------
    console.log('--- TEST 2: Dots & Boxes Device A (Host) & Device B (Guest) ---');
    await new Promise((resolve, reject) => {
      const deviceA = io(SERVER_URL);
      const deviceB = io(SERVER_URL);

      deviceA.on('connect', () => {
        console.log('Device A connected. Creating Dots & Boxes room (3x3)...');
        deviceA.emit('create-room', {
          playerName: 'Dots_Host',
          gameType: 'dots',
          config: { rows: 3, cols: 3 }
        });
      });

      deviceA.on('room-created', ({ roomCode, playerSymbol, gameType, roomState }) => {
        console.log(`✓ Device A created Dots room: ${roomCode}, Symbol: ${playerSymbol}`);
        assert.strictEqual(playerSymbol, 'P1');
        assert.strictEqual(gameType, 'dots');
        assert.strictEqual(roomState.rows, 3);
        assert.strictEqual(roomState.cols, 3);

        deviceB.emit('join-room', {
          roomCode,
          playerName: 'Dots_Guest'
        });
      });

      deviceB.on('room-joined', ({ playerSymbol, gameType }) => {
        console.log(`✓ Device B joined Dots room. Symbol: ${playerSymbol}`);
        assert.strictEqual(playerSymbol, 'P2');
        assert.strictEqual(gameType, 'dots');
      });

      let gameStartedCount = 0;
      const checkGameStarted = () => {
        gameStartedCount++;
        if (gameStartedCount === 2) {
          console.log('✓ Both devices ready for Dots & Boxes!');
          deviceA.emit('dots-move-line', { lineId: 'h-0-0' });
        }
      };

      deviceA.on('game-started', checkGameStarted);
      deviceB.on('game-started', checkGameStarted);

      deviceB.on('dots-move-made', ({ lineId, symbol, nextTurn, gotExtraTurn }) => {
        if (lineId === 'h-0-0') {
          console.log(`✓ Line ${lineId} drawn by ${symbol}. Next turn: ${nextTurn}`);
          assert.strictEqual(symbol, 'P1');
          assert.strictEqual(nextTurn, 'P2');
          assert.strictEqual(gotExtraTurn, false);

          deviceB.emit('dots-move-line', { lineId: 'v-0-0' });
        } else if (lineId === 'v-0-0') {
          console.log(`✓ Line ${lineId} drawn by ${symbol}. Next turn: ${nextTurn}`);
          assert.strictEqual(symbol, 'P2');
          assert.strictEqual(nextTurn, 'P1');

          deviceA.emit('dots-move-line', { lineId: 'h-1-0' });
        } else if (lineId === 'h-1-0') {
          console.log(`✓ Line ${lineId} drawn by ${symbol}. Next turn: ${nextTurn}`);
          assert.strictEqual(symbol, 'P1');
          assert.strictEqual(nextTurn, 'P2');

          deviceB.emit('dots-move-line', { lineId: 'v-0-1' });
        } else if (lineId === 'v-0-1') {
          console.log(`✓ Line ${lineId} drawn by ${symbol}. Box completed:`, nextTurn, 'gotExtraTurn:', gotExtraTurn);
          assert.strictEqual(symbol, 'P2');
          assert.strictEqual(gotExtraTurn, true);
          assert.strictEqual(nextTurn, 'P2'); // Extra turn awarded!
          console.log('✓ Bonus turn correctly awarded to completing player!');

          deviceA.disconnect();
          deviceB.disconnect();
          console.log('✓ TEST 2 PASSED!\n');
          resolve();
        }
      });

      setTimeout(() => reject(new Error('Test 2 timed out')), 6000);
    });

    // ----------------------------------------------------
    // TEST 3: Invalid Room Code Error Handling
    // ----------------------------------------------------
    console.log('--- TEST 3: Invalid Room Code Error Handling ---');
    await new Promise((resolve, reject) => {
      const client = io(SERVER_URL);
      client.on('connect', () => {
        client.emit('join-room', { roomCode: 'FAKEXX', playerName: 'LostPlayer' });
      });

      client.on('error-message', ({ message }) => {
        console.log(`✓ Received expected error message: "${message}"`);
        assert(message.includes('not found'));
        client.disconnect();
        console.log('✓ TEST 3 PASSED!\n');
        resolve();
      });

      setTimeout(() => reject(new Error('Test 3 timed out')), 4000);
    });

    // ----------------------------------------------------
    // TEST 4: Explicit Leave-Room & Opponent Notification
    // ----------------------------------------------------
    console.log('--- TEST 4: Leave-Room Handling ---');
    await new Promise((resolve, reject) => {
      const host = io(SERVER_URL);
      const guest = io(SERVER_URL);

      host.on('connect', () => {
        host.emit('create-room', { playerName: 'HostPlayer', gameType: 'tictactoe' });
      });

      host.on('room-created', ({ roomCode }) => {
        guest.emit('join-room', { roomCode, playerName: 'GuestPlayer' });
      });

      guest.on('game-started', () => {
        // Host leaves the room
        console.log('Host emitting leave-room...');
        host.emit('leave-room');
      });

      guest.on('player-left', ({ playerName, roomState }) => {
        console.log(`✓ Guest received player-left for ${playerName}, room status: ${roomState.status}`);
        assert.strictEqual(playerName, 'HostPlayer');
        assert.strictEqual(roomState.status, 'waiting');
        host.disconnect();
        guest.disconnect();
        console.log('✓ TEST 4 PASSED!\n');
        resolve();
      });

      setTimeout(() => reject(new Error('Test 4 timed out')), 5000);
    });

    // ----------------------------------------------------
    // TEST 5: Spectator Join & Spectator Promotion
    // ----------------------------------------------------
    console.log('--- TEST 5: Spectator Join & Promotion ---');
    await new Promise((resolve, reject) => {
      const p1 = io(SERVER_URL);
      const p2 = io(SERVER_URL);
      const spectator = io(SERVER_URL);

      p1.on('connect', () => {
        p1.emit('create-room', { playerName: 'PlayerOne', gameType: 'tictactoe' });
      });

      p1.on('room-created', ({ roomCode }) => {
        p2.emit('join-room', { roomCode, playerName: 'PlayerTwo' });
      });

      p2.on('game-started', ({ roomState }) => {
        spectator.emit('join-room', { roomCode: roomState.code, playerName: 'Watcher' });
      });

      spectator.on('room-joined', ({ isSpectator }) => {
        console.log(`✓ Watcher joined as spectator: isSpectator=${isSpectator}`);
        assert.strictEqual(isSpectator, true);

        // Player 2 leaves the room -> Watcher should be promoted!
        p2.emit('leave-room');
      });

      spectator.on('player-promoted', ({ promotedPlayerName, symbol, roomState }) => {
        console.log(`✓ Watcher received player-promoted: name=${promotedPlayerName}, symbol=${symbol}`);
        assert.strictEqual(promotedPlayerName, 'Watcher');
        assert.strictEqual(symbol, 'O');
        assert.strictEqual(roomState.status, 'playing');

        p1.disconnect();
        p2.disconnect();
        spectator.disconnect();
        console.log('✓ TEST 5 PASSED!\n');
        resolve();
      });

      setTimeout(() => reject(new Error('Test 5 timed out')), 6000);
    });

    // ----------------------------------------------------
    // TEST 6: Dots Rematch Score Reset & Turn Swapping
    // ----------------------------------------------------
    console.log('--- TEST 6: Dots Rematch Score Reset ---');
    await new Promise((resolve, reject) => {
      const p1 = io(SERVER_URL);
      const p2 = io(SERVER_URL);

      p1.on('connect', () => {
        p1.emit('create-room', { playerName: 'Dots1', gameType: 'dots', config: { rows: 2, cols: 2 } });
      });

      p1.on('room-created', ({ roomCode }) => {
        p2.emit('join-room', { roomCode, playerName: 'Dots2' });
      });

      p2.on('game-started', () => {
        // Both players request rematch
        p1.emit('request-rematch');
        p2.emit('request-rematch');
      });

      let rematchCount = 0;
      const onRematch = ({ roomState }) => {
        rematchCount++;
        if (rematchCount === 2) {
          console.log(`✓ Rematch started! Scores: P1=${roomState.scores.P1}, P2=${roomState.scores.P2}, startingTurn=${roomState.currentTurn}`);
          assert.strictEqual(roomState.scores.P1, 0);
          assert.strictEqual(roomState.scores.P2, 0);
          assert.strictEqual(roomState.currentTurn, 'P2'); // Swapped starting turn
          p1.disconnect();
          p2.disconnect();
          console.log('✓ TEST 6 PASSED!\n');
          resolve();
        }
      };

      p1.on('rematch-start', onRematch);
      p2.on('rematch-start', onRematch);

      setTimeout(() => reject(new Error('Test 6 timed out')), 6000);
    });

    // ----------------------------------------------------
    // TEST 7: Move Validation & Error Security
    // ----------------------------------------------------
    console.log('--- TEST 7: Move Validation & Out-of-Bounds Rejection ---');
    await new Promise((resolve, reject) => {
      const p1 = io(SERVER_URL);
      const p2 = io(SERVER_URL);
      let errorCount = 0;

      p1.on('connect', () => {
        p1.emit('create-room', { playerName: 'TttValidator', gameType: 'tictactoe' });
      });

      p1.on('room-created', ({ roomCode }) => {
        p2.emit('join-room', { roomCode, playerName: 'TttGuest' });
      });

      p1.on('game-started', () => {
        // Send invalid non-integer move
        p1.emit('make-move', { index: 1.5 });
      });

      p1.on('error-message', ({ message }) => {
        console.log(`✓ Received expected error for invalid move: "${message}"`);
        assert.strictEqual(message, 'Invalid move!');
        p1.disconnect();
        p2.disconnect();
        console.log('✓ TEST 7 PASSED!\n');
        resolve();
      });

      setTimeout(() => reject(new Error('Test 7 timed out')), 5000);
    });

    // ----------------------------------------------------
    // TEST 8: Dots 5x5 Grid Room Creation & Boundary Validation
    // ----------------------------------------------------
    console.log('--- TEST 8: Dots 5x5 Grid Room Creation & Boundary Validation ---');
    await new Promise((resolve, reject) => {
      const p1 = io(SERVER_URL);
      const p2 = io(SERVER_URL);

      p1.on('connect', () => {
        p1.emit('create-room', { playerName: 'DotsHost5x5', gameType: 'dots', config: { rows: 5, cols: 5 } });
      });

      p1.on('room-created', ({ roomCode }) => {
        p2.emit('join-room', { roomCode, playerName: 'DotsGuest5x5' });
      });

      p2.on('game-started', ({ roomState }) => {
        console.log(`✓ 5x5 Game started. Rows=${roomState.rows}, Cols=${roomState.cols}`);
        assert.strictEqual(roomState.rows, 5);
        assert.strictEqual(roomState.cols, 5);

        // Draw valid edge line on 5x5 grid (h-5-4 is bottom edge row 5, col 4)
        p1.emit('dots-move-line', { lineId: 'h-5-4' });
      });

      p2.on('dots-move-made', ({ lineId, symbol }) => {
        console.log(`✓ Received move on 5x5 grid: ${lineId} by ${symbol}`);
        assert.strictEqual(lineId, 'h-5-4');
        assert.strictEqual(symbol, 'P1');

        // Now test out of bounds line on row 6: h-6-0
        p2.emit('dots-move-line', { lineId: 'h-6-0' });
      });

      p2.on('error-message', ({ message }) => {
        console.log(`✓ Received expected out-of-bounds error for row 6: "${message}"`);
        assert.strictEqual(message, 'Line coordinates out of bounds!');
        p1.disconnect();
        p2.disconnect();
        console.log('✓ TEST 8 PASSED!\n');
        resolve();
      });

      setTimeout(() => reject(new Error('Test 8 timed out')), 6000);
    });

    // ----------------------------------------------------
    // TEST 9: Tic-Tac-Toe Rematch Turn Alternation & Round 2 Move Execution
    // ----------------------------------------------------
    console.log('--- TEST 9: Tic-Tac-Toe Rematch Turn Alternation & Round 2 ---');
    await new Promise((resolve, reject) => {
      const p1 = io(SERVER_URL);
      const p2 = io(SERVER_URL);

      p1.on('connect', () => {
        p1.emit('create-room', { playerName: 'Alice_X', gameType: 'tictactoe' });
      });

      p1.on('room-created', ({ roomCode }) => {
        p2.emit('join-room', { roomCode, playerName: 'Bob_O' });
      });

      p2.on('game-started', ({ roomState }) => {
        assert.strictEqual(roomState.currentTurn, 'X');
        // Round 1 over: both request rematch
        p1.emit('request-rematch');
        p2.emit('request-rematch');
      });

      let rematchCount = 0;
      const onRematch = ({ roomState }) => {
        rematchCount++;
        if (rematchCount === 2) {
          console.log(`✓ Rematch started! Starting turn switched to: ${roomState.currentTurn}`);
          assert.strictEqual(roomState.currentTurn, 'O');
          assert.strictEqual(roomState.startingTurn, 'O');
          assert.deepStrictEqual(roomState.board, Array(9).fill(null));

          // Bob_O starts round 2
          p2.emit('make-move', { index: 0 });
        }
      };

      p1.on('rematch-start', onRematch);
      p2.on('rematch-start', onRematch);

      p1.on('move-made', ({ index, symbol, nextTurn }) => {
        if (index === 0 && symbol === 'O') {
          console.log(`✓ Round 2 move 1 (Bob_O) accepted: index=${index}, nextTurn=${nextTurn}`);
          assert.strictEqual(nextTurn, 'X');
          // Alice_X takes next turn
          p1.emit('make-move', { index: 4 });
        } else if (index === 4 && symbol === 'X') {
          console.log(`✓ Round 2 move 2 (Alice_X) accepted: index=${index}, nextTurn=${nextTurn}`);
          assert.strictEqual(nextTurn, 'O');
          p1.disconnect();
          p2.disconnect();
          console.log('✓ TEST 9 PASSED!\n');
          resolve();
        }
      });

      setTimeout(() => reject(new Error('Test 9 timed out')), 6000);
    });

    console.log('🎉 ALL MULTIPLAYER & GAME INTEGRATION TESTS PASSED SUCCESSFULLY!');
  } finally {
    if (spawnedServer) {
      console.log('Stopping test server...');
      spawnedServer.kill('SIGTERM');
    }
  }
}

runTests().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
