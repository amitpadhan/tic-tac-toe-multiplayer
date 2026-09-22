/**
 * Tic-Tac-Toe Game Controller
 * Supports:
 * - Online Multiplayer (WebRTC Peer-to-Peer via PeerJS for GitHub Pages + Socket.IO fallback for Node server)
 * - Solo vs AI (Easy, Medium, Unbeatable Minimax)
 * - Local Pass & Play
 */

(function () {
  'use strict';

  // Winning combinations and SVG strike line mapping (based on 300x300 viewBox)
  const WINNING_COMBOS = [
    { combo: [0, 1, 2], line: { x1: 20, y1: 50, x2: 280, y2: 50 } },    // Row 1
    { combo: [3, 4, 5], line: { x1: 20, y1: 150, x2: 280, y2: 150 } },  // Row 2
    { combo: [6, 7, 8], line: { x1: 20, y1: 250, x2: 280, y2: 250 } },  // Row 3
    { combo: [0, 3, 6], line: { x1: 50, y1: 20, x2: 50, y2: 280 } },    // Col 1
    { combo: [1, 4, 7], line: { x1: 150, y1: 20, x2: 150, y2: 280 } },  // Col 2
    { combo: [2, 5, 8], line: { x1: 250, y1: 20, x2: 250, y2: 280 } },  // Col 3
    { combo: [0, 4, 8], line: { x1: 30, y1: 30, x2: 270, y2: 270 } },   // Diag 1
    { combo: [2, 4, 6], line: { x1: 270, y1: 30, x2: 30, y2: 270 } }    // Diag 2
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
  let peer = null;
  let peerConn = null;
  let socket = null;
  let onlineState = {
    transport: 'peerjs', // 'peerjs' or 'socketio'
    roomCode: null,
    mySymbol: null,
    myName: 'Player',
    opponentName: 'Opponent',
    isHost: false,
    connected: false,
    rematchRequested: false,
    opponentWantsRematch: false
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
    if (window.soundFX && window.soundFX.isMuted()) {
      soundIcon.textContent = '🔇';
    }

    btnSoundToggle.addEventListener('click', () => {
      const isMuted = window.soundFX.toggleMute();
      soundIcon.textContent = isMuted ? '🔇' : '🔊';
      if (!isMuted) window.soundFX.playClick();
    });

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

    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', (e) => {
        closeModal(e.target.dataset.close);
      });
    });

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

    const btnCreateSubmit = document.getElementById('btn-create-room-submit');
    const btnJoinSubmit = document.getElementById('btn-join-room-submit');
    const inputPlayerName = document.getElementById('online-player-name');
    const inputJoinCode = document.getElementById('join-room-code');

    btnCreateSubmit.addEventListener('click', () => {
      const name = inputPlayerName.value.trim() || 'Player 1';
      createOnlineRoom(name);
    });

    btnJoinSubmit.addEventListener('click', () => {
      const name = inputPlayerName.value.trim() || 'Player 2';
      const code = inputJoinCode.value.trim().toUpperCase();
      if (!code || code.length < 4) {
        showToast('Please enter a valid room code.');
        return;
      }
      joinOnlineRoom(code, name);
    });

    // Enter key shortcuts
    inputJoinCode.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        btnJoinSubmit.click();
      }
    });

    inputPlayerName.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        if (!panelCreate.classList.contains('hidden')) {
          btnCreateSubmit.click();
        } else {
          btnJoinSubmit.click();
        }
      }
    });

    // Close modal on clicking outside
    document.querySelectorAll('.modal-overlay').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.add('hidden');
        }
      });
    });

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

    cells.forEach(cell => {
      cell.addEventListener('click', () => {
        const index = parseInt(cell.dataset.index, 10);
        handleCellClick(index);
      });
    });

    btnRematch.addEventListener('click', () => {
      window.soundFX.playClick();
      handleRematchClick();
    });

    btnResetScores.addEventListener('click', () => {
      window.soundFX.playClick();
      scores = { X: 0, O: 0, draws: 0 };
      updateScoreboardUI();
      showToast('Scores reset.');
      if (gameMode === 'online' && peerConn && peerConn.open) {
        peerConn.send({ type: 'reset-scores' });
      }
    });

    btnBackMenu.addEventListener('click', () => {
      window.soundFX.playClick();
      returnToMenu();
    });

    document.getElementById('btn-copy-code').addEventListener('click', copyRoomCode);
    document.getElementById('btn-copy-link').addEventListener('click', copyRoomLink);
    roomCodeBadge.addEventListener('click', copyRoomLink);

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
      return emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
    }

    if (aiConfig.difficulty === 'medium') {
      if (Math.random() < 0.35) {
        return emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
      }
      for (const idx of emptyIndices) {
        board[idx] = aiConfig.aiSymbol;
        if (checkWinCondition(board, aiConfig.aiSymbol)) {
          board[idx] = null;
          return idx;
        }
        board[idx] = null;
      }
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

    // Unbeatable Minimax
    return getMinimaxBestMove();
  }

  function getMinimaxBestMove() {
    let bestScore = -Infinity;
    let bestMove = null;

    const available = board
      .map((val, idx) => (val === null ? idx : null))
      .filter(val => val !== null);

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
     MODE 3: ONLINE MULTIPLAYER (WEBRTC PEERJS + SOCKET.IO)
     ========================================================= */

  function generateRandomRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  function createOnlineRoom(playerName) {
    closeModal('online');
    const roomCode = generateRandomRoomCode();
    onlineState.roomCode = roomCode;
    onlineState.myName = playerName;
    onlineState.mySymbol = 'X';
    onlineState.isHost = true;
    onlineState.rematchRequested = false;
    onlineState.opponentWantsRematch = false;

    // Try PeerJS WebRTC P2P first (works anywhere including GitHub Pages)
    if (typeof Peer !== 'undefined') {
      onlineState.transport = 'peerjs';
      setupPeerJSHost(roomCode, playerName);
    } else {
      showToast('Multiplayer library loading... please wait.');
    }
  }

  function joinOnlineRoom(roomCode, playerName) {
    closeModal('online');
    const code = roomCode.toUpperCase();
    onlineState.roomCode = code;
    onlineState.myName = playerName;
    onlineState.mySymbol = 'O';
    onlineState.isHost = false;
    onlineState.rematchRequested = false;
    onlineState.opponentWantsRematch = false;

    if (typeof Peer !== 'undefined') {
      onlineState.transport = 'peerjs';
      setupPeerJSJoin(code, playerName);
    } else {
      showToast('Multiplayer library loading... please wait.');
    }
  }

  const PEER_CONFIG = {
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' }
      ]
    }
  };

  function setupPeerJSHost(roomCode, hostName) {
    if (peer) peer.destroy();

    const peerId = 'ttt-mp-' + roomCode.toLowerCase();
    peer = new Peer(peerId, PEER_CONFIG);

    showWaitingLobby(roomCode);
    nameX.textContent = `${hostName} (You)`;
    nameO.textContent = 'Waiting for opponent...';
    roleX.textContent = 'Host (X)';
    roleO.textContent = 'Guest (O)';

    peer.on('open', () => {
      console.log('PeerJS Host opened with ID:', peerId);
    });

    peer.on('connection', (conn) => {
      if (peerConn && peerConn.open && onlineState.connected) {
        conn.on('open', () => {
          conn.send({ type: 'room-full', message: 'Room is already full.' });
          setTimeout(() => conn.close(), 500);
        });
        return;
      }

      peerConn = conn;
      setupPeerEvents();

      const sendInit = () => {
        conn.send({
          type: 'init',
          hostName: onlineState.myName
        });
      };

      if (conn.open) {
        sendInit();
      } else {
        conn.on('open', sendInit);
      }
    });

    peer.on('error', (err) => {
      console.error('PeerJS error:', err);
      if (err.type === 'unavailable-id') {
        // ID taken, retry with new code
        createOnlineRoom(hostName);
      } else {
        showToast(`Multiplayer error: ${err.message || err.type}`);
      }
    });
  }

  function setupPeerJSJoin(roomCode, clientName) {
    if (peer) peer.destroy();

    peer = new Peer(PEER_CONFIG);

    showToast('Connecting to room...');
    showWaitingLobby(roomCode);
    nameX.textContent = 'Host (X)';
    nameO.textContent = `${clientName} (You)`;
    roleX.textContent = 'Host (X)';
    roleO.textContent = 'Guest (O)';

    peer.on('open', () => {
      const targetPeerId = 'ttt-mp-' + roomCode.toLowerCase();
      peerConn = peer.connect(targetPeerId, { reliable: true });
      setupPeerEvents();

      const sendJoin = () => {
        peerConn.send({
          type: 'join',
          playerName: clientName
        });
      };

      if (peerConn.open) {
        sendJoin();
      } else {
        peerConn.on('open', sendJoin);
      }
    });

    peer.on('error', (err) => {
      console.error('PeerJS join error:', err);
      if (err.type === 'peer-unavailable') {
        showToast('Room not found or host has disconnected.');
      } else {
        showToast('Unable to connect to that room. Check the code!');
      }
    });
  }

  function setupPeerEvents() {
    if (!peerConn) return;

    peerConn.on('data', (data) => {
      handlePeerMessage(data);
    });

    peerConn.on('close', () => {
      showToast('Opponent disconnected.');
      gameActive = false;
      onlineState.connected = false;
      waitingLobby.classList.remove('hidden');
      setStatusMessage('Opponent left match.', 'X');
    });

    peerConn.on('error', (err) => {
      console.error('Peer connection error:', err);
      showToast('Connection issue with opponent.');
    });
  }

  function handlePeerMessage(data) {
    if (!data || !data.type) return;

    switch (data.type) {
      case 'init':
        // Guest receives host info
        onlineState.opponentName = data.hostName || 'Player 1';
        nameX.textContent = onlineState.opponentName;
        nameO.textContent = `${onlineState.myName} (You)`;
        waitingLobby.classList.add('hidden');
        if (!onlineState.connected) {
          onlineState.connected = true;
          resetBoardState();
          showToast(`Connected with ${onlineState.opponentName}! Game starting!`);
          window.soundFX.playWin();
        }
        break;

      case 'join':
        // Host receives guest join
        onlineState.opponentName = data.playerName || 'Player 2';
        nameO.textContent = onlineState.opponentName;
        waitingLobby.classList.add('hidden');
        if (!onlineState.connected) {
          onlineState.connected = true;
          resetBoardState();
          showToast(`${onlineState.opponentName} joined! Game starting!`);
          window.soundFX.playWin();
        }
        // Send init ack to guest
        if (peerConn && peerConn.open) {
          peerConn.send({
            type: 'init',
            hostName: onlineState.myName
          });
        }
        break;

      case 'move':
        // Opponent made a move
        if (typeof data.index === 'number' && data.index >= 0 && data.index <= 8 && board[data.index] === null) {
          const oppSymbol = onlineState.mySymbol === 'X' ? 'O' : 'X';
          executeMove(data.index, oppSymbol);
        }
        break;

      case 'reaction':
        triggerFloatingReaction(data.sender || onlineState.opponentName || 'Opponent', data.emoji, false);
        break;

      case 'rematch-request':
        onlineState.opponentWantsRematch = true;
        if (onlineState.rematchRequested) {
          if (peerConn && peerConn.open) {
            peerConn.send({ type: 'rematch-start' });
          }
          startRematchRound();
        } else {
          showToast(`${onlineState.opponentName} wants a rematch! Click "Play Again" to accept.`);
          btnRematch.classList.add('pulse-highlight');
        }
        break;

      case 'rematch-start':
        startRematchRound();
        break;

      case 'reset-scores':
        scores = { X: 0, O: 0, draws: 0 };
        updateScoreboardUI();
        showToast('Opponent reset scores.');
        break;

      case 'room-full':
        showToast('Room is full (already 2 players).');
        break;
    }
  }

  function showWaitingLobby(code) {
    gameMode = 'online';
    gameModeTag.textContent = 'Online Match';
    roomCodeBadge.classList.remove('hidden');
    displayRoomCode.textContent = code;
    lobbyCodeDisplay.textContent = code;
    waitingLobby.classList.remove('hidden');
    reactionsBar.classList.remove('hidden');

    resetBoardState();
    gameActive = false;
    setStatusMessage('Waiting for opponent to connect...', 'X');
    switchView('game');
  }

  function startRematchRound() {
    btnRematch.classList.remove('pulse-highlight');
    onlineState.rematchRequested = false;
    onlineState.opponentWantsRematch = false;
    resetBoardState();
    showToast('Rematch started! Good luck!');
    window.soundFX.playClick();
  }

  function checkUrlForRoom() {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    if (room && room.trim().length >= 4) {
      openModal('online');
      const tabJoin = document.getElementById('tab-join-room');
      if (tabJoin) tabJoin.click();
      const codeInput = document.getElementById('join-room-code');
      if (codeInput) {
        codeInput.value = room.trim().toUpperCase();
        codeInput.focus();
      }
    }
  }

  /* =========================================================
     CORE BOARD ACTIONS & GAME LOOP
     ========================================================= */

  function handleCellClick(index) {
    if (!gameActive || board[index] !== null) return;

    if (gameMode === 'online') {
      if (currentTurn !== onlineState.mySymbol) {
        showToast("Wait for your turn!");
        return;
      }

      // Execute locally
      executeMove(index, onlineState.mySymbol);

      // Send to opponent
      if (peerConn && peerConn.open) {
        peerConn.send({
          type: 'move',
          index: index
        });
      }
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
      onlineState.rematchRequested = true;
      if (onlineState.opponentWantsRematch) {
        if (peerConn && peerConn.open) {
          peerConn.send({ type: 'rematch-start' });
        }
        startRematchRound();
      } else {
        if (peerConn && peerConn.open) {
          peerConn.send({ type: 'rematch-request' });
        }
        showToast('Rematch request sent! Waiting for opponent...');
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
    if (peerConn) {
      peerConn.close();
      peerConn = null;
    }
    if (peer) {
      peer.destroy();
      peer = null;
    }
    if (socket) {
      socket.disconnect();
      socket = null;
    }
    gameActive = false;
    onlineState.connected = false;
    onlineState.roomCode = null;
    onlineState.rematchRequested = false;
    onlineState.opponentWantsRematch = false;
    btnRematch.classList.remove('pulse-highlight');
    hideWinningStrike();
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
    if (gameMode === 'online') {
      if (peerConn && peerConn.open) {
        peerConn.send({
          type: 'reaction',
          emoji: emoji,
          sender: onlineState.myName
        });
      }
      triggerFloatingReaction(onlineState.myName, emoji, true);
    } else {
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

  document.addEventListener('DOMContentLoaded', init);
})();
