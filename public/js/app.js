/**
 * Tic-Tac-Toe Game Controller
 * Supports: Online Multiplayer (Socket.IO), Solo vs AI (Minimax), Local Pass & Play
 */

(function () {
  'use strict';

  // Winning combinations and SVG strike line mapping (based on 300x300 viewBox)
  const WINNING_COMBOS = [
    { combo: [0, 1, 2], line: { x1: 20, y1: 50, x2: 280, y2: 50 } },      // Row 1
    { combo: [3, 4, 5], line: { x1: 20, y1: 150, x2: 280, y2: 150 } },   // Row 2
    { combo: [6, 7, 8], line: { x1: 20, y1: 250, x2: 280, y2: 250 } },   // Row 3
    { combo: [0, 3, 6], line: { x1: 50, y1: 20, x2: 50, y2: 280 } },      // Col 1
    { combo: [1, 4, 7], line: { x1: 150, y1: 20, x2: 150, y2: 280 } },   // Col 2
    { combo: [2, 5, 8], line: { x1: 250, y1: 20, x2: 250, y2: 280 } },   // Col 3
    { combo: [0, 4, 8], line: { x1: 30, y1: 30, x2: 270, y2: 270 } },    // Diag 1
    { combo: [2, 4, 6], line: { x1: 270, y1: 30, x2: 30, y2: 270 } }     // Diag 2
  ];

  // DOM Elements
  const views = {
    menu: document.getElementById('view-menu'),
    game: document.getElementById('view-game')
  };

  const modals = {
    online: document.getElementById('modal-online'),
    ai: document.getElementById('modal-ai')
  };

  const cells = Array.from(document.querySelectorAll('.board-cell'));
  const strikeLine = document.getElementById('strike-line');
  const statusBanner = document.getElementById('status-banner');
  const statusText = document.getElementById('status-text');
  const turnIcon = document.getElementById('turn-icon');

  const nameX = document.getElementById('name-x');
  const nameO = document.getElementById('name-o');
  const roleX = document.getElementById('role-x');
  const roleO = document.getElementById('role-o');
  const scoreXVal = document.getElementById('score-x-val');
  const scoreOVal = document.getElementById('score-o-val');
  const scoreDrawsVal = document.getElementById('score-draws-val');
  const cardX = document.getElementById('player-x-card');
  const cardO = document.getElementById('player-o-card');

  const gameModeTag = document.getElementById('game-mode-tag');
  const roomCodeBadge = document.getElementById('room-code-badge');
  const displayRoomCode = document.getElementById('display-room-code');
  const waitingLobby = document.getElementById('waiting-lobby');
  const lobbyCodeDisplay = document.getElementById('lobby-code-display');
  const scoreboardSection = document.getElementById('scoreboard-section');
  const boardGrid = document.getElementById('board-grid');
  const reactionsBar = document.getElementById('reactions-bar');
  const reactionStream = document.getElementById('reaction-stream');
  const toastContainer = document.getElementById('toast-container');

  const btnRematch = document.getElementById('btn-rematch');
  const btnResetScores = document.getElementById('btn-reset-scores');
  const btnBackMenu = document.getElementById('btn-back-menu');
  const btnSoundToggle = document.getElementById('btn-sound-toggle');
  const soundIcon = document.getElementById('sound-icon');
  const btnThemeToggle = document.getElementById('btn-theme-toggle');
  const themeIcon = document.getElementById('theme-icon');

  // Game State
  let gameMode = 'local'; // 'local' | 'ai' | 'online'
  let board = Array(9).fill(null);
  let currentTurn = 'X';
  let gameActive = false;
  let scores = { X: 0, O: 0, draws: 0 };

  // AI Configuration
  let aiConfig = {
    difficulty: 'unbeatable',
    playerSymbol: 'X',
    aiSymbol: 'O'
  };

  // Online Multiplayer State
  let socket = null;
  let onlineState = {
    roomCode: null,
    mySymbol: null,
    myName: 'Player',
    isSpectator: false,
    rematchRequested: false
  };

  /* =========================================================
     INITIALIZATION & EVENT LISTENERS
     ========================================================= */

  function init() {
    setupUIEvents();
    setupSoundTheme();
    checkUrlForRoom();
  }

  function setupSoundTheme() {
    // Sound icon state
    if (window.soundFX && window.soundFX.isMuted()) {
      soundIcon.textContent = '🔇';
    }

    btnSoundToggle.addEventListener('click', () => {
      const isMuted = window.soundFX.toggleMute();
      soundIcon.textContent = isMuted ? '🔇' : '🔊';
      if (!isMuted) window.soundFX.playClick();
    });

    // Theme state
    const savedTheme = localStorage.getItem('ttt_theme') || 'neon';
    if (savedTheme === 'light') {
      document.body.classList.add('theme-light');
      themeIcon.textContent = '☀️';
    }

    btnThemeToggle.addEventListener('click', () => {
      window.soundFX.playClick();
      const isLight = document.body.classList.toggle('theme-light');
      themeIcon.textContent = isLight ? '☀️' : '🌙';
      localStorage.setItem('ttt_theme', isLight ? 'light' : 'neon');
    });
  }

  function setupUIEvents() {
    // Modal Toggles
    document.getElementById('btn-open-online-modal').addEventListener('click', () => {
      window.soundFX.playClick();
      openModal('online');
    });

    document.getElementById('btn-open-ai-modal').addEventListener('click', () => {
      window.soundFX.playClick();
      openModal('ai');
    });

    document.getElementById('btn-start-local').addEventListener('click', () => {
      window.soundFX.playClick();
      startLocalGame();
    });

    // Close Modals
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', (e) => {
        closeModal(e.target.dataset.close);
      });
    });

    // Online Modal Tabs
    const tabCreate = document.getElementById('tab-create-room');
    const tabJoin = document.getElementById('tab-join-room');
    const panelCreate = document.getElementById('panel-create-room');
    const panelJoin = document.getElementById('panel-join-room');

    tabCreate.addEventListener('click', () => {
      tabCreate.classList.add('active');
      tabJoin.classList.remove('active');
      panelCreate.classList.remove('hidden');
      panelJoin.classList.add('hidden');
    });

    tabJoin.addEventListener('click', () => {
      tabJoin.classList.add('active');
      tabCreate.classList.remove('active');
      panelJoin.classList.remove('hidden');
      panelCreate.classList.add('hidden');
    });

    // Online Room Actions
    document.getElementById('btn-create-room-submit').addEventListener('click', () => {
      const name = document.getElementById('online-player-name').value.trim() || 'Player 1';
      createOnlineRoom(name);
    });

    document.getElementById('btn-join-room-submit').addEventListener('click', () => {
      const name = document.getElementById('online-player-name').value.trim() || 'Player 2';
      const code = document.getElementById('join-room-code').value.trim().toUpperCase();
      if (!code || code.length < 4) {
        showToast('Please enter a valid room code.');
        return;
      }
      joinOnlineRoom(code, name);
    });

    // AI Modal Options
    document.querySelectorAll('#ai-difficulty-control .segment-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('#ai-difficulty-control .segment-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        aiConfig.difficulty = e.target.dataset.diff;
      });
    });

    document.querySelectorAll('#ai-symbol-control .segment-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('#ai-symbol-control .segment-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        aiConfig.playerSymbol = e.target.dataset.symbol;
        aiConfig.aiSymbol = aiConfig.playerSymbol === 'X' ? 'O' : 'X';
      });
    });

    document.getElementById('btn-start-ai-game').addEventListener('click', () => {
      closeModal('ai');
      startAIGame();
    });

    // Board cell clicks
    cells.forEach(cell => {
      cell.addEventListener('click', () => {
        const index = parseInt(cell.dataset.index, 10);
        handleCellClick(index);
      });
    });

    // Rematch & Action buttons
    btnRematch.addEventListener('click', () => {
      window.soundFX.playClick();
      handleRematchClick();
    });

    btnResetScores.addEventListener('click', () => {
      window.soundFX.playClick();
      scores = { X: 0, O: 0, draws: 0 };
      updateScoreboardUI();
      showToast('Scores reset.');
    });

    btnBackMenu.addEventListener('click', () => {
      window.soundFX.playClick();
      returnToMenu();
    });

    // Share & Copy buttons
    document.getElementById('btn-copy-code').addEventListener('click', copyRoomCode);
    document.getElementById('btn-copy-link').addEventListener('click', copyRoomLink);
    roomCodeBadge.addEventListener('click', copyRoomLink);

    // Emoji reactions
    document.querySelectorAll('.emoji-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const emoji = btn.dataset.emoji;
        sendReaction(emoji);
      });
    });
  }

  function openModal(id) {
    modals[id].classList.remove('hidden');
  }

  function closeModal(id) {
    const modalEl = typeof id === 'string' ? document.getElementById(id) || modals[id] : id;
    if (modalEl) modalEl.classList.add('hidden');
  }

  function switchView(viewName) {
    Object.keys(views).forEach(k => {
      if (k === viewName) {
        views[k].classList.remove('hidden');
        views[k].classList.add('active');
      } else {
        views[k].classList.add('hidden');
        views[k].classList.remove('active');
      }
    });
  }

  /* =========================================================
     MODE 1: LOCAL PASS & PLAY
     ========================================================= */

  function startLocalGame() {
    gameMode = 'local';
    gameModeTag.textContent = 'Pass & Play';
    roomCodeBadge.classList.add('hidden');
    waitingLobby.classList.add('hidden');
    reactionsBar.classList.add('hidden');

    nameX.textContent = 'Player 1 (X)';
    nameO.textContent = 'Player 2 (O)';
    roleX.textContent = 'Local';
    roleO.textContent = 'Local';

    resetBoardState();
    switchView('game');
  }

  /* =========================================================
     MODE 2: PLAY VS AI (EASY, MEDIUM, MINIMAX UNBEATABLE)
     ========================================================= */

  function startAIGame() {
    gameMode = 'ai';
    const diffLabel = aiConfig.difficulty.charAt(0).toUpperCase() + aiConfig.difficulty.slice(1);
    gameModeTag.textContent = `VS AI (${diffLabel})`;
    roomCodeBadge.classList.add('hidden');
    waitingLobby.classList.add('hidden');
    reactionsBar.classList.add('hidden');

    if (aiConfig.playerSymbol === 'X') {
      nameX.textContent = 'You (X)';
      nameO.textContent = `Bot AI [${diffLabel}]`;
      roleX.textContent = 'Human';
      roleO.textContent = 'AI';
    } else {
      nameX.textContent = `Bot AI [${diffLabel}]`;
      nameO.textContent = 'You (O)';
      roleX.textContent = 'AI';
      roleO.textContent = 'Human';
    }

    resetBoardState();
    switchView('game');

    // If AI is X, AI plays first!
    if (aiConfig.aiSymbol === 'X') {
      triggerAIMove();
    }
  }

  function triggerAIMove() {
    if (!gameActive) return;
    setStatusMessage('AI is thinking...', aiConfig.aiSymbol);
    boardGrid.style.pointerEvents = 'none';

    setTimeout(() => {
      if (!gameActive) return;
      const moveIndex = getBestAIMove();
      if (moveIndex !== null && moveIndex !== undefined) {
        executeMove(moveIndex, aiConfig.aiSymbol);
      }
      boardGrid.style.pointerEvents = 'auto';
    }, 450);
  }

  function getBestAIMove() {
    const emptyIndices = board
      .map((val, idx) => (val === null ? idx : null))
      .filter(val => val !== null);

    if (emptyIndices.length === 0) return null;

    if (aiConfig.difficulty === 'easy') {
      // Pure random move
      return emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
    }

    if (aiConfig.difficulty === 'medium') {
      // 60% smart, 40% random
      if (Math.random() < 0.4) {
        return emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
      }
      // Check if AI can win immediately
      for (const idx of emptyIndices) {
        board[idx] = aiConfig.aiSymbol;
        if (checkWinCondition(board, aiConfig.aiSymbol)) {
          board[idx] = null;
          return idx;
        }
        board[idx] = null;
      }
      // Check if Player is about to win, block them
      for (const idx of emptyIndices) {
        board[idx] = aiConfig.playerSymbol;
        if (checkWinCondition(board, aiConfig.playerSymbol)) {
          board[idx] = null;
          return idx;
        }
        board[idx] = null;
      }
      return emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
    }

    // Unbeatable Minimax Algorithm
    return getMinimaxBestMove();
  }

  function getMinimaxBestMove() {
    let bestScore = -Infinity;
    let bestMove = null;

    const available = board
      .map((val, idx) => (val === null ? idx : null))
      .filter(val => val !== null);

    // Opening optimization: if empty board, pick center or corner
    if (available.length === 9) return 4;

    for (const idx of available) {
      board[idx] = aiConfig.aiSymbol;
      const score = minimax(board, 0, false, -Infinity, Infinity);
      board[idx] = null;

      if (score > bestScore) {
        bestScore = score;
        bestMove = idx;
      }
    }

    return bestMove !== null ? bestMove : available[0];
  }

  function minimax(currentBoard, depth, isMaximizing, alpha, beta) {
    if (checkWinCondition(currentBoard, aiConfig.aiSymbol)) return 10 - depth;
    if (checkWinCondition(currentBoard, aiConfig.playerSymbol)) return depth - 10;
    if (currentBoard.every(c => c !== null)) return 0;

    const available = currentBoard
      .map((val, idx) => (val === null ? idx : null))
      .filter(val => val !== null);

    if (isMaximizing) {
      let maxEval = -Infinity;
      for (const idx of available) {
        currentBoard[idx] = aiConfig.aiSymbol;
        const evaluation = minimax(currentBoard, depth + 1, false, alpha, beta);
        currentBoard[idx] = null;
        maxEval = Math.max(maxEval, evaluation);
        alpha = Math.max(alpha, evaluation);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const idx of available) {
        currentBoard[idx] = aiConfig.playerSymbol;
        const evaluation = minimax(currentBoard, depth + 1, true, alpha, beta);
        currentBoard[idx] = null;
        minEval = Math.min(minEval, evaluation);
        beta = Math.min(beta, evaluation);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }

  function checkWinCondition(testBoard, symbol) {
    return WINNING_COMBOS.some(({ combo }) =>
      combo.every(idx => testBoard[idx] === symbol)
    );
  }

  /* =========================================================
     MODE 3: ONLINE MULTIPLAYER (SOCKET.IO)
     ========================================================= */

  function connectSocket(callback) {
    if (socket && socket.connected) {
      if (callback) callback();
      return;
    }

    if (typeof io === 'undefined') {
      showToast('Multiplayer server connection unavailable.');
      return;
    }

    socket = io();

    socket.on('connect', () => {
      console.log('Connected to server with ID:', socket.id);
      if (callback) callback();
    });

    socket.on('room-created', ({ roomCode, playerSymbol, playerName, roomState }) => {
      closeModal('online');
      onlineState.roomCode = roomCode;
      onlineState.mySymbol = playerSymbol;
      onlineState.myName = playerName;
      onlineState.isSpectator = false;

      setupOnlineGameUI(roomCode, 'X');
      waitingLobby.classList.remove('hidden');
      lobbyCodeDisplay.textContent = roomCode;
      displayRoomCode.textContent = roomCode;

      nameX.textContent = `${playerName} (You)`;
      nameO.textContent = 'Waiting for opponent...';
      roleX.textContent = 'Host';
      roleO.textContent = 'Empty';

      setStatusMessage('Waiting for Player 2 to join...', 'X');
      switchView('game');
    });

    socket.on('room-joined', ({ roomCode, playerSymbol, playerName, isSpectator, roomState }) => {
      closeModal('online');
      onlineState.roomCode = roomCode;
      onlineState.mySymbol = playerSymbol;
      onlineState.myName = playerName;
      onlineState.isSpectator = isSpectator;

      setupOnlineGameUI(roomCode, playerSymbol);
      displayRoomCode.textContent = roomCode;

      if (isSpectator) {
        showToast('Joined as Spectator');
        gameModeTag.textContent = 'Spectating';
      }

      syncOnlineRoomState(roomState);
      switchView('game');
    });

    socket.on('game-started', ({ message, roomState }) => {
      waitingLobby.classList.add('hidden');
      showToast(message);
      syncOnlineRoomState(roomState);
      window.soundFX.playWin();
    });

    socket.on('move-made', ({ index, symbol, nextTurn, board: newBoard }) => {
      board = newBoard;
      renderBoard();
      currentTurn = nextTurn;
      updateTurnUI();

      if (symbol === 'X') window.soundFX.playMoveX();
      else window.soundFX.playMoveO();
    });

    socket.on('game-over', ({ board: finalBoard, winner, winningLine, scores: newScores, roomState }) => {
      board = finalBoard;
      renderBoard();
      scores = newScores;
      updateScoreboardUI();
      handleGameOver(winner, winningLine);
    });

    socket.on('rematch-requested', ({ playerName }) => {
      showToast(`${playerName} wants a rematch! Click "Play Again" to accept.`);
      btnRematch.classList.add('pulse-highlight');
    });

    socket.on('rematch-pending', () => {
      showToast('Rematch request sent! Waiting for opponent...');
    });

    socket.on('rematch-start', ({ message, roomState }) => {
      btnRematch.classList.remove('pulse-highlight');
      showToast(message);
      syncOnlineRoomState(roomState);
      window.soundFX.playClick();
    });

    socket.on('player-left', ({ playerName, message, roomState }) => {
      showToast(message);
      syncOnlineRoomState(roomState);
      waitingLobby.classList.remove('hidden');
      lobbyCodeDisplay.textContent = onlineState.roomCode;
      setStatusMessage('Opponent disconnected. Waiting...', 'X');
    });

    socket.on('new-reaction', ({ senderName, senderId, emoji, text }) => {
      triggerFloatingReaction(senderName, emoji, senderId === socket.id);
    });

    socket.on('error-message', ({ message }) => {
      showToast(message);
    });
  }

  function createOnlineRoom(name) {
    connectSocket(() => {
      socket.emit('create-room', { playerName: name });
    });
  }

  function joinOnlineRoom(code, name) {
    connectSocket(() => {
      socket.emit('join-room', { roomCode: code, playerName: name });
    });
  }

  function setupOnlineGameUI(code, symbol) {
    gameMode = 'online';
    gameModeTag.textContent = 'Online Match';
    roomCodeBadge.classList.remove('hidden');
    displayRoomCode.textContent = code;
    reactionsBar.classList.remove('hidden');
  }

  function syncOnlineRoomState(state) {
    board = state.board || Array(9).fill(null);
    currentTurn = state.currentTurn;
    scores = state.scores || { X: 0, O: 0, draws: 0 };
    gameActive = state.status === 'playing';

    if (state.players && state.players[0]) {
      const p1 = state.players[0];
      nameX.textContent = `${p1.name} ${onlineState.mySymbol === 'X' ? '(You)' : ''}`;
      roleX.textContent = 'Player 1';
    }
    if (state.players && state.players[1]) {
      const p2 = state.players[1];
      nameO.textContent = `${p2.name} ${onlineState.mySymbol === 'O' ? '(You)' : ''}`;
      roleO.textContent = 'Player 2';
    }

    updateScoreboardUI();
    renderBoard();

    if (state.status === 'playing') {
      waitingLobby.classList.add('hidden');
      updateTurnUI();
    } else if (state.status === 'ended') {
      handleGameOver(state.winner, state.winningLine);
    }
  }

  function checkUrlForRoom() {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room && room.length === 6) {
      openModal('online');
      const tabJoin = document.getElementById('tab-join-room');
      if (tabJoin) tabJoin.click();
      const codeInput = document.getElementById('join-room-code');
      if (codeInput) codeInput.value = room.toUpperCase();
    }
  }

  /* =========================================================
     CORE BOARD ACTIONS & GAME LOOP
     ========================================================= */

  function handleCellClick(index) {
    if (!gameActive || board[index] !== null) return;

    if (gameMode === 'online') {
      if (onlineState.isSpectator) {
        showToast("Spectators can't make moves.");
        return;
      }
      if (currentTurn !== onlineState.mySymbol) {
        showToast("Wait for your turn!");
        return;
      }
      // Send move to server
      socket.emit('make-move', { index });
      return;
    }

    if (gameMode === 'ai') {
      if (currentTurn !== aiConfig.playerSymbol) return;
      executeMove(index, aiConfig.playerSymbol);

      if (gameActive && currentTurn === aiConfig.aiSymbol) {
        triggerAIMove();
      }
      return;
    }

    // Local 2-Player Pass & Play
    executeMove(index, currentTurn);
  }

  function executeMove(index, symbol) {
    board[index] = symbol;

    if (symbol === 'X') window.soundFX.playMoveX();
    else window.soundFX.playMoveO();

    renderBoard();

    // Check for win or draw
    const winResult = checkWinnerLocally();
    if (winResult) {
      if (winResult.winner === 'draw') {
        scores.draws++;
      } else {
        scores[winResult.winner]++;
      }
      updateScoreboardUI();
      handleGameOver(winResult.winner, winResult.line);
      return;
    }

    // Switch turn
    currentTurn = currentTurn === 'X' ? 'O' : 'X';
    updateTurnUI();
  }

  function checkWinnerLocally() {
    for (const { combo, line } of WINNING_COMBOS) {
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

  function handleGameOver(winner, winningLine) {
    gameActive = false;

    if (winner === 'draw') {
      setStatusMessage("It's a Draw!", 'draw');
      window.soundFX.playDraw();
    } else {
      const winnerName = winner === 'X' ? nameX.textContent : nameO.textContent;
      setStatusMessage(`${winnerName} Wins! 🎉`, winner);
      window.soundFX.playWin();
      window.confetti.burst(150);

      // Highlight winning cells
      if (winningLine && Array.isArray(winningLine)) {
        winningLine.forEach(idx => {
          cells[idx].classList.add('cell-win');
        });
        drawWinningStrike(winningLine);
      }
    }
  }

  function drawWinningStrike(lineCombo) {
    const match = WINNING_COMBOS.find(({ combo }) =>
      combo.every((val, i) => val === lineCombo[i])
    );

    if (match && match.line) {
      strikeLine.setAttribute('x1', match.line.x1);
      strikeLine.setAttribute('y1', match.line.y1);
      strikeLine.setAttribute('x2', match.line.x2);
      strikeLine.setAttribute('y2', match.line.y2);
      strikeLine.style.display = 'block';
    }
  }

  function hideWinningStrike() {
    strikeLine.style.display = 'none';
  }

  function renderBoard() {
    cells.forEach((cell, idx) => {
      const val = board[idx];
      cell.textContent = val || '';
      cell.className = 'board-cell';

      if (val === 'X') {
        cell.classList.add('occupied', 'cell-x');
      } else if (val === 'O') {
        cell.classList.add('occupied', 'cell-o');
      }
    });
  }

  function resetBoardState() {
    board = Array(9).fill(null);
    currentTurn = 'X';
    gameActive = true;
    hideWinningStrike();
    renderBoard();
    updateTurnUI();
  }

  function handleRematchClick() {
    if (gameMode === 'online') {
      if (socket) {
        socket.emit('request-rematch');
      }
      return;
    }

    // Local or AI mode
    resetBoardState();
    if (gameMode === 'ai' && aiConfig.aiSymbol === 'X') {
      triggerAIMove();
    }
  }

  function returnToMenu() {
    if (gameMode === 'online' && socket) {
      socket.disconnect();
      socket = null;
    }
    gameActive = false;
    switchView('menu');
  }

  /* =========================================================
     UI STATUS & HELPERS
     ========================================================= */

  function updateTurnUI() {
    if (currentTurn === 'X') {
      cardX.classList.add('active-turn');
      cardO.classList.remove('active-turn');
      setStatusMessage(`${nameX.textContent}'s Turn`, 'X');
    } else {
      cardO.classList.add('active-turn');
      cardX.classList.remove('active-turn');
      setStatusMessage(`${nameO.textContent}'s Turn`, 'O');
    }
  }

  function setStatusMessage(msg, symbol) {
    statusText.textContent = msg;
    if (symbol === 'X') {
      turnIcon.textContent = 'X';
      turnIcon.className = 'status-icon x-mark';
      turnIcon.style.display = 'inline';
    } else if (symbol === 'O') {
      turnIcon.textContent = 'O';
      turnIcon.className = 'status-icon o-mark';
      turnIcon.style.display = 'inline';
    } else {
      turnIcon.style.display = 'none';
    }
  }

  function updateScoreboardUI() {
    scoreXVal.textContent = scores.X;
    scoreOVal.textContent = scores.O;
    scoreDrawsVal.textContent = scores.draws;
  }

  function copyRoomCode() {
    if (!onlineState.roomCode) return;
    navigator.clipboard.writeText(onlineState.roomCode).then(() => {
      showToast(`Room code copied: ${onlineState.roomCode}`);
      window.soundFX.playClick();
    });
  }

  function copyRoomLink() {
    if (!onlineState.roomCode) return;
    const url = `${window.location.origin}${window.location.pathname}?room=${onlineState.roomCode}`;
    navigator.clipboard.writeText(url).then(() => {
      showToast('Invite link copied to clipboard!');
      window.soundFX.playClick();
    });
  }

  function sendReaction(emoji) {
    window.soundFX.playReaction();
    if (gameMode === 'online' && socket) {
      socket.emit('send-reaction', { emoji });
    } else {
      // Local preview
      triggerFloatingReaction('You', emoji, true);
    }
  }

  function triggerFloatingReaction(sender, emoji, isSelf) {
    const toast = document.createElement('div');
    toast.className = 'reaction-toast';
    toast.innerHTML = `<span>${emoji}</span> <span>${isSelf ? 'You' : sender}</span>`;
    reactionStream.appendChild(toast);
    window.soundFX.playReaction();

    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 3000);
  }

  function showToast(text) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = text;
    toastContainer.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 2800);
  }

  // Start app
  document.addEventListener('DOMContentLoaded', init);
})();
