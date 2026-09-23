/**
 * Tic-Tac-Toe Game Controller
 * Features:
 * - Online Multiplayer (via unified NetworkManager)
 * - Solo vs AI (Easy, Medium, Unbeatable Minimax)
 * - Local Pass & Play
 */

(function () {
  'use strict';

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

  const SVG_MARK_X = `<svg class="mark-svg mark-x-svg" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="X">
    <line class="path-x-1" x1="16" y1="16" x2="48" y2="48" stroke="currentColor" stroke-width="6.5" stroke-linecap="round"/>
    <line class="path-x-2" x1="48" y1="16" x2="16" y2="48" stroke="currentColor" stroke-width="6.5" stroke-linecap="round"/>
  </svg>`;

  const SVG_MARK_O = `<svg class="mark-svg mark-o-svg" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="O">
    <circle class="path-o" cx="32" cy="32" r="17" stroke="currentColor" stroke-width="6.5" stroke-linecap="round"/>
  </svg>`;

  class TicTacToeController {
    constructor() {
      this.gameMode = 'local'; // 'local' | 'ai' | 'online'
      this.board = Array(9).fill(null);
      this.currentTurn = 'X';
      this.startingTurn = 'X';
      this.gameActive = false;
      this.scores = { X: 0, O: 0, draws: 0 };

      this.aiConfig = {
        difficulty: 'unbeatable',
        playerSymbol: 'X',
        aiSymbol: 'O'
      };

      this.onlineState = {
        roomCode: null,
        mySymbol: null,
        myName: 'Player 1',
        opponentName: 'Player 2',
        isHost: false,
        connected: false,
        rematchRequested: false,
        opponentWantsRematch: false
      };

      this.dom = {};
    }

    init() {
      this.cacheDom();
      this.bindEvents();
      this.setupNetworkListeners();
    }

    cacheDom() {
      this.dom.viewMenu = document.getElementById('view-ttt-menu');
      this.dom.viewGame = document.getElementById('view-ttt-game');
      this.dom.modalOnline = document.getElementById('modal-ttt-online');
      this.dom.modalAi = document.getElementById('modal-ttt-ai');

      this.dom.cells = Array.from(document.querySelectorAll('#ttt-board-grid .board-cell'));
      this.dom.strikeLine = document.getElementById('ttt-strike-line');
      this.dom.statusBanner = document.getElementById('ttt-status-banner');
      this.dom.statusText = document.getElementById('ttt-status-text');
      this.dom.turnIcon = document.getElementById('ttt-turn-icon');

      this.dom.nameX = document.getElementById('ttt-name-x');
      this.dom.nameO = document.getElementById('ttt-name-o');
      this.dom.roleX = document.getElementById('ttt-role-x');
      this.dom.roleO = document.getElementById('ttt-role-o');
      this.dom.scoreXVal = document.getElementById('ttt-score-x-val');
      this.dom.scoreOVal = document.getElementById('ttt-score-o-val');
      this.dom.scoreDrawsVal = document.getElementById('ttt-score-draws-val');
      this.dom.cardX = document.getElementById('ttt-player-x-card');
      this.dom.cardO = document.getElementById('ttt-player-o-card');

      this.dom.gameModeTag = document.getElementById('ttt-game-mode-tag');
      this.dom.roomCodeBadge = document.getElementById('ttt-room-code-badge');
      this.dom.displayRoomCode = document.getElementById('ttt-display-room-code');
      this.dom.waitingLobby = document.getElementById('ttt-waiting-lobby');
      this.dom.lobbyCodeDisplay = document.getElementById('ttt-lobby-code-display');
      this.dom.boardGrid = document.getElementById('ttt-board-grid');
      this.dom.reactionsBar = document.getElementById('ttt-reactions-bar');

      this.dom.btnRematch = document.getElementById('ttt-btn-rematch');
      this.dom.btnResetScores = document.getElementById('ttt-btn-reset-scores');
      this.dom.btnBackMenu = document.getElementById('ttt-btn-back-menu');

      this.dom.tabCreate = document.getElementById('ttt-tab-create-room');
      this.dom.tabJoin = document.getElementById('ttt-tab-join-room');
      this.dom.panelCreate = document.getElementById('ttt-panel-create-room');
      this.dom.panelJoin = document.getElementById('ttt-panel-join-room');

      this.dom.inputPlayerName = document.getElementById('ttt-online-player-name');
      this.dom.inputJoinCode = document.getElementById('ttt-join-room-code');
      this.dom.btnCreateSubmit = document.getElementById('ttt-btn-create-room-submit');
      this.dom.btnJoinSubmit = document.getElementById('ttt-btn-join-room-submit');
    }

    bindEvents() {
      // Menu Mode Selectors
      const btnOpenOnline = document.getElementById('btn-ttt-open-online');
      if (btnOpenOnline) {
        btnOpenOnline.addEventListener('click', () => {
          window.soundFX.playClick();
          this.openModal('online');
        });
      }

      const btnOpenAi = document.getElementById('btn-ttt-open-ai');
      if (btnOpenAi) {
        btnOpenAi.addEventListener('click', () => {
          window.soundFX.playClick();
          this.openModal('ai');
        });
      }

      const btnStartLocal = document.getElementById('btn-ttt-start-local');
      if (btnStartLocal) {
        btnStartLocal.addEventListener('click', () => {
          window.soundFX.playClick();
          this.startLocalGame();
        });
      }

      // Online Tabs
      if (this.dom.tabCreate && this.dom.tabJoin) {
        this.dom.tabCreate.addEventListener('click', () => {
          this.dom.tabCreate.classList.add('active');
          this.dom.tabJoin.classList.remove('active');
          this.dom.panelCreate.classList.remove('hidden');
          this.dom.panelJoin.classList.add('hidden');
        });

        this.dom.tabJoin.addEventListener('click', () => {
          this.dom.tabJoin.classList.add('active');
          this.dom.tabCreate.classList.remove('active');
          this.dom.panelJoin.classList.remove('hidden');
          this.dom.panelCreate.classList.add('hidden');
        });
      }

      // Load saved name
      const savedName = localStorage.getItem('arcade_player_name');
      if (savedName && this.dom.inputPlayerName) {
        this.dom.inputPlayerName.value = savedName;
      }

      // Online Submits
      if (this.dom.btnCreateSubmit) {
        this.dom.btnCreateSubmit.addEventListener('click', () => {
          const name = this.dom.inputPlayerName.value.trim() || 'Player 1';
          localStorage.setItem('arcade_player_name', name);
          this.createOnlineRoom(name);
        });
      }

      if (this.dom.btnJoinSubmit) {
        this.dom.btnJoinSubmit.addEventListener('click', () => {
          const name = this.dom.inputPlayerName.value.trim() || 'Player 2';
          localStorage.setItem('arcade_player_name', name);
          const code = this.dom.inputJoinCode.value.trim().toUpperCase();
          if (!code || code.length < 4) {
            window.showAppToast('Please enter a valid 6-character room code.');
            return;
          }
          this.joinOnlineRoom(code, name);
        });
      }

      // Keyboard Accessibility
      if (this.dom.inputJoinCode) {
        this.dom.inputJoinCode.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (this.dom.btnJoinSubmit) this.dom.btnJoinSubmit.click();
          }
        });
      }

      if (this.dom.inputPlayerName) {
        this.dom.inputPlayerName.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            if (this.dom.tabCreate && this.dom.tabCreate.classList.contains('active')) {
              if (this.dom.btnCreateSubmit) this.dom.btnCreateSubmit.click();
            } else if (this.dom.inputJoinCode) {
              this.dom.inputJoinCode.focus();
            }
          }
        });
      }

      // AI Settings
      document.querySelectorAll('#ttt-ai-difficulty-control .segment-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          document.querySelectorAll('#ttt-ai-difficulty-control .segment-btn').forEach(b => b.classList.remove('active'));
          e.target.classList.add('active');
          this.aiConfig.difficulty = e.target.dataset.diff;
        });
      });

      document.querySelectorAll('#ttt-ai-symbol-control .segment-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          document.querySelectorAll('#ttt-ai-symbol-control .segment-btn').forEach(b => b.classList.remove('active'));
          e.target.classList.add('active');
          this.aiConfig.playerSymbol = e.target.dataset.symbol;
          this.aiConfig.aiSymbol = this.aiConfig.playerSymbol === 'X' ? 'O' : 'X';
        });
      });

      const btnStartAi = document.getElementById('ttt-btn-start-ai-game');
      if (btnStartAi) {
        btnStartAi.addEventListener('click', () => {
          this.closeModal('ai');
          this.startAIGame();
        });
      }

      // Board Cells
      this.dom.cells.forEach(cell => {
        cell.addEventListener('click', () => {
          const index = parseInt(cell.dataset.index, 10);
          this.handleCellClick(index);
        });
      });

      // Actions
      if (this.dom.btnRematch) {
        this.dom.btnRematch.addEventListener('click', () => {
          window.soundFX.playClick();
          this.handleRematchClick();
        });
      }

      if (this.dom.btnResetScores) {
        this.dom.btnResetScores.addEventListener('click', () => {
          window.soundFX.playClick();
          this.scores = { X: 0, O: 0, draws: 0 };
          this.updateScoreboardUI();
          window.showAppToast('Scores reset.');
        });
      }

      if (this.dom.btnBackMenu) {
        this.dom.btnBackMenu.addEventListener('click', () => {
          window.soundFX.playClick();
          this.returnToMenu();
        });
      }

      const btnCopyCode = document.getElementById('ttt-btn-copy-code');
      if (btnCopyCode) {
        btnCopyCode.addEventListener('click', () => this.copyRoomCode());
      }

      const btnCopyLink = document.getElementById('ttt-btn-copy-link');
      if (btnCopyLink) {
        btnCopyLink.addEventListener('click', () => this.copyRoomLink());
      }

      if (this.dom.roomCodeBadge) {
        this.dom.roomCodeBadge.addEventListener('click', () => this.copyRoomLink());
      }

      // Reactions
      document.querySelectorAll('#ttt-reactions-bar .emoji-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const emoji = btn.dataset.emoji;
          this.sendReaction(emoji);
        });
      });
    }

    setupNetworkListeners() {
      const net = window.networkManager;
      if (!net) return;

      net.on('error-message', (data) => {
        window.showAppToast(data.message || 'An error occurred.');
      });

      net.on('room-created', (data) => {
        if (data.gameType !== 'tictactoe') return;
        this.closeModal('online');
        this.onlineState.roomCode = data.roomCode;
        this.onlineState.mySymbol = data.playerSymbol;
        this.onlineState.myName = data.playerName;
        this.onlineState.isHost = true;
        this.onlineState.isSpectator = false;
        this.onlineState.connected = false;

        this.dom.btnRematch.style.display = '';
        this.showWaitingLobby(data.roomCode);
        this.dom.nameX.textContent = `${data.playerName} (You)`;
        this.dom.nameO.textContent = 'Waiting for opponent...';
        this.dom.roleX.textContent = 'Host (X)';
        this.dom.roleO.textContent = 'Guest (O)';
      });

      net.on('room-joined', (data) => {
        if (data.gameType !== 'tictactoe') return;
        this.closeModal('online');
        this.onlineState.roomCode = data.roomCode;
        this.onlineState.mySymbol = data.playerSymbol;
        this.onlineState.myName = data.playerName;
        this.onlineState.isHost = false;
        this.onlineState.isSpectator = !!data.isSpectator;

        this.gameMode = 'online';
        this.dom.roomCodeBadge.classList.remove('hidden');
        this.dom.displayRoomCode.textContent = data.roomCode;
        this.dom.waitingLobby.classList.add('hidden');
        this.dom.reactionsBar.classList.remove('hidden');

        if (data.isSpectator) {
          this.dom.gameModeTag.textContent = 'Spectating';
          this.dom.btnRematch.style.display = 'none';
          this.onlineState.connected = true;

          if (data.roomState && data.roomState.players) {
            const p1 = data.roomState.players[0];
            const p2 = data.roomState.players[1];
            this.dom.nameX.textContent = p1 ? p1.name : 'Player 1';
            this.dom.nameO.textContent = p2 ? p2.name : 'Player 2';
            this.dom.roleX.textContent = 'Player (X)';
            this.dom.roleO.textContent = 'Player (O)';
          }

          if (data.roomState) {
            if (data.roomState.scores) {
              this.scores = data.roomState.scores;
              this.updateScoreboardUI();
            }
            if (data.roomState.board) {
              this.board = data.roomState.board;
              this.renderBoard();
            }
            if (data.roomState.currentTurn) {
              this.currentTurn = data.roomState.currentTurn;
              this.updateTurnUI();
            }
            this.gameActive = data.roomState.status === 'playing';
          }
          this.switchView('game');
          return;
        }

        this.dom.gameModeTag.textContent = 'Online Match';
        this.dom.btnRematch.style.display = '';

        if (data.roomState && data.roomState.players && data.roomState.players[0]) {
          this.onlineState.opponentName = data.roomState.players[0].name;
          this.dom.nameX.textContent = data.roomState.players[0].name;
          this.dom.nameO.textContent = `${data.playerName} (You)`;
          this.dom.roleX.textContent = 'Host (X)';
          this.dom.roleO.textContent = 'Guest (O)';
        }

        this.switchView('game');
        this.resetBoardState();
      });

      net.on('player-promoted', (data) => {
        if (this.gameMode !== 'online') return;
        if (data.promotedPlayerName === this.onlineState.myName) {
          this.onlineState.isSpectator = false;
          this.onlineState.mySymbol = data.symbol;
          this.dom.gameModeTag.textContent = 'Online Match';
          this.dom.btnRematch.style.display = '';
          window.showAppToast("You have been promoted to Player! Match starting...");
        } else {
          window.showAppToast(`${data.promotedPlayerName} joined as your new opponent!`);
        }

        this.onlineState.connected = true;
        this.dom.waitingLobby.classList.add('hidden');

        if (data.roomState && data.roomState.players) {
          const px = data.roomState.players.find(p => p.symbol === 'X');
          const po = data.roomState.players.find(p => p.symbol === 'O');
          if (px && po) {
            this.dom.nameX.textContent = px.name + (this.onlineState.mySymbol === 'X' ? ' (You)' : '');
            this.dom.nameO.textContent = po.name + (this.onlineState.mySymbol === 'O' ? ' (You)' : '');
            this.onlineState.opponentName = this.onlineState.mySymbol === 'X' ? po.name : px.name;
          }
        }
        this.resetBoardState();
      });

      net.on('game-started', (data) => {
        if (data.gameType && data.gameType !== 'tictactoe') return;
        this.dom.waitingLobby.classList.add('hidden');
        this.onlineState.connected = true;

        if (data.roomState && data.roomState.players) {
          const px = data.roomState.players.find(p => p.symbol === 'X');
          const po = data.roomState.players.find(p => p.symbol === 'O');
          if (px && po) {
            this.dom.nameX.textContent = px.name + (this.onlineState.mySymbol === 'X' ? ' (You)' : '');
            this.dom.nameO.textContent = po.name + (this.onlineState.mySymbol === 'O' ? ' (You)' : '');
            this.onlineState.opponentName = this.onlineState.mySymbol === 'X' ? po.name : px.name;
            this.dom.roleX.textContent = 'Host (X)';
            this.dom.roleO.textContent = 'Guest (O)';
          }
        }

        window.showAppToast(data.message || 'Opponent connected! Game started!');
        window.soundFX.playWin();
        this.resetBoardState();
      });

      net.on('move-made', (data) => {
        if (this.gameMode !== 'online') return;

        // In PeerJS P2P mode, execute the move received from opponent
        if (window.networkManager && window.networkManager.mode === 'peerjs') {
          if (data.symbol && data.symbol !== this.onlineState.mySymbol && typeof data.index === 'number') {
            this.executeMove(data.index, data.symbol);
            return;
          }
        }

        if (data.board) {
          this.board = data.board;
          this.renderBoard();
        } else if (typeof data.index === 'number') {
          this.board[data.index] = data.symbol;
          this.renderBoard();
        }

        if (data.symbol === 'X') window.soundFX.playMoveX();
        else window.soundFX.playMoveO();

        if (data.nextTurn) {
          this.currentTurn = data.nextTurn;
        } else {
          this.currentTurn = this.currentTurn === 'X' ? 'O' : 'X';
        }
        this.updateTurnUI();
      });

      net.on('game-over', (data) => {
        if (this.gameMode !== 'online') return;
        if (data.board) {
          this.board = data.board;
          this.renderBoard();
        }
        if (data.scores) {
          this.scores = data.scores;
          this.updateScoreboardUI();
        }
        this.handleGameOver(data.winner, data.winningLine);
      });

      net.on('rematch-requested', (data) => {
        if (this.gameMode !== 'online' || this.onlineState.isSpectator) return;
        this.onlineState.opponentWantsRematch = true;
        if (this.onlineState.rematchRequested) {
          window.networkManager.sendRematchStart();
          this.startRematchRound();
        } else {
          window.showAppToast(`${data.playerName || 'Opponent'} requested a rematch!`);
          this.dom.btnRematch.classList.add('pulse-highlight');
        }
      });

      net.on('rematch-pending', () => {
        window.showAppToast('Rematch request sent! Waiting for opponent...');
      });

      net.on('rematch-start', (data) => {
        if (this.gameMode !== 'online') return;
        if (data && data.roomState) {
          if (data.roomState.scores) {
            this.scores = data.roomState.scores;
            this.updateScoreboardUI();
          }
          if (data.roomState.currentTurn) {
            this.startingTurn = data.roomState.currentTurn;
          }
        }
        this.startRematchRound();
      });

      net.on('player-left', (data) => {
        if (this.gameMode !== 'online') return;
        this.gameActive = false;
        this.onlineState.connected = false;
        this.dom.waitingLobby.classList.remove('hidden');
        window.showAppToast(data.message || 'Opponent left the room.');
        this.setStatusMessage('Waiting for opponent...', 'X');
      });
    }

    openModal(id) {
      if (id === 'online' && this.dom.modalOnline) this.dom.modalOnline.classList.remove('hidden');
      if (id === 'ai' && this.dom.modalAi) this.dom.modalAi.classList.remove('hidden');
    }

    closeModal(id) {
      if (id === 'online' && this.dom.modalOnline) this.dom.modalOnline.classList.add('hidden');
      if (id === 'ai' && this.dom.modalAi) this.dom.modalAi.classList.add('hidden');
    }

    switchView(viewName) {
      if (viewName === 'menu') {
        this.dom.viewMenu.classList.remove('hidden');
        this.dom.viewMenu.classList.add('active');
        this.dom.viewGame.classList.add('hidden');
        this.dom.viewGame.classList.remove('active');
      } else {
        this.dom.viewMenu.classList.add('hidden');
        this.dom.viewMenu.classList.remove('active');
        this.dom.viewGame.classList.remove('hidden');
        this.dom.viewGame.classList.add('active');
      }
    }

    /* ---------------- Mode 1: Local Pass & Play ---------------- */
    startLocalGame() {
      this.gameMode = 'local';
      this.dom.gameModeTag.textContent = 'Pass & Play';
      this.dom.roomCodeBadge.classList.add('hidden');
      this.dom.waitingLobby.classList.add('hidden');
      this.dom.reactionsBar.classList.add('hidden');
      if (this.dom.btnRematch) this.dom.btnRematch.style.display = '';
      if (this.dom.boardGrid) this.dom.boardGrid.style.pointerEvents = 'auto';

      this.dom.nameX.textContent = 'Player 1 (X)';
      this.dom.nameO.textContent = 'Player 2 (O)';
      this.dom.roleX.textContent = 'Local';
      this.dom.roleO.textContent = 'Local';

      this.resetBoardState();
      this.switchView('game');
    }

    /* ---------------- Mode 2: Play vs AI ---------------- */
    startAIGame() {
      this.gameMode = 'ai';
      const diffLabel = this.aiConfig.difficulty.charAt(0).toUpperCase() + this.aiConfig.difficulty.slice(1);
      this.dom.gameModeTag.textContent = `VS AI (${diffLabel})`;
      this.dom.roomCodeBadge.classList.add('hidden');
      this.dom.waitingLobby.classList.add('hidden');
      this.dom.reactionsBar.classList.add('hidden');
      if (this.dom.btnRematch) this.dom.btnRematch.style.display = '';
      if (this.dom.boardGrid) this.dom.boardGrid.style.pointerEvents = 'auto';

      if (this.aiConfig.playerSymbol === 'X') {
        this.dom.nameX.textContent = 'You (X)';
        this.dom.nameO.textContent = `Bot AI [${diffLabel}]`;
        this.dom.roleX.textContent = 'Human';
        this.dom.roleO.textContent = 'AI';
      } else {
        this.dom.nameX.textContent = `Bot AI [${diffLabel}]`;
        this.dom.nameO.textContent = 'You (O)';
        this.dom.roleX.textContent = 'AI';
        this.dom.roleO.textContent = 'Human';
      }

      this.resetBoardState();
      this.switchView('game');

      if (this.aiConfig.aiSymbol === 'X') {
        this.triggerAIMove();
      }
    }

    triggerAIMove() {
      if (!this.gameActive) return;
      this.setStatusMessage('AI is thinking...', this.aiConfig.aiSymbol);
      this.dom.boardGrid.style.pointerEvents = 'none';

      setTimeout(() => {
        if (!this.gameActive) return;
        const moveIndex = this.getBestAIMove();
        this.dom.boardGrid.style.pointerEvents = 'auto';
        if (moveIndex !== null && moveIndex !== undefined) {
          this.executeMove(moveIndex, this.aiConfig.aiSymbol);
        }
      }, 420);
    }

    getBestAIMove() {
      const emptyIndices = this.board
        .map((val, idx) => (val === null ? idx : null))
        .filter(val => val !== null);

      if (emptyIndices.length === 0) return null;

      if (this.aiConfig.difficulty === 'easy') {
        return emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
      }

      if (this.aiConfig.difficulty === 'medium') {
        if (Math.random() < 0.35) {
          return emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
        }
        for (const idx of emptyIndices) {
          this.board[idx] = this.aiConfig.aiSymbol;
          if (this.checkWinCondition(this.board, this.aiConfig.aiSymbol)) {
            this.board[idx] = null;
            return idx;
          }
          this.board[idx] = null;
        }
        for (const idx of emptyIndices) {
          this.board[idx] = this.aiConfig.playerSymbol;
          if (this.checkWinCondition(this.board, this.aiConfig.playerSymbol)) {
            this.board[idx] = null;
            return idx;
          }
          this.board[idx] = null;
        }
        return emptyIndices[Math.floor(Math.random() * emptyIndices.length)];
      }

      // Unbeatable Minimax
      return this.getMinimaxBestMove();
    }

    getMinimaxBestMove() {
      let bestScore = -Infinity;
      let bestMove = null;

      const available = this.board
        .map((val, idx) => (val === null ? idx : null))
        .filter(val => val !== null);

      if (available.length === 9) return 4;

      for (const idx of available) {
        this.board[idx] = this.aiConfig.aiSymbol;
        const score = this.minimax(this.board, 0, false, -Infinity, Infinity);
        this.board[idx] = null;

        if (score > bestScore) {
          bestScore = score;
          bestMove = idx;
        }
      }

      return bestMove !== null ? bestMove : available[0];
    }

    minimax(currentBoard, depth, isMaximizing, alpha, beta) {
      if (this.checkWinCondition(currentBoard, this.aiConfig.aiSymbol)) return 10 - depth;
      if (this.checkWinCondition(currentBoard, this.aiConfig.playerSymbol)) return depth - 10;
      if (currentBoard.every(c => c !== null)) return 0;

      const available = currentBoard
        .map((val, idx) => (val === null ? idx : null))
        .filter(val => val !== null);

      if (isMaximizing) {
        let maxEval = -Infinity;
        for (const idx of available) {
          currentBoard[idx] = this.aiConfig.aiSymbol;
          const evaluation = this.minimax(currentBoard, depth + 1, false, alpha, beta);
          currentBoard[idx] = null;
          maxEval = Math.max(maxEval, evaluation);
          alpha = Math.max(alpha, evaluation);
          if (beta <= alpha) break;
        }
        return maxEval;
      } else {
        let minEval = Infinity;
        for (const idx of available) {
          currentBoard[idx] = this.aiConfig.playerSymbol;
          const evaluation = this.minimax(currentBoard, depth + 1, true, alpha, beta);
          currentBoard[idx] = null;
          minEval = Math.min(minEval, evaluation);
          beta = Math.min(beta, evaluation);
          if (beta <= alpha) break;
        }
        return minEval;
      }
    }

    checkWinCondition(testBoard, symbol) {
      return WINNING_COMBOS.some(({ combo }) =>
        combo.every(idx => testBoard[idx] === symbol)
      );
    }

    /* ---------------- Mode 3: Online Multiplayer ---------------- */
    createOnlineRoom(playerName) {
      window.networkManager.createRoom({
        playerName,
        gameType: 'tictactoe'
      });
    }

    joinOnlineRoom(roomCode, playerName) {
      window.networkManager.joinRoom({
        roomCode,
        playerName
      });
    }

    showWaitingLobby(code) {
      this.gameMode = 'online';
      this.dom.gameModeTag.textContent = 'Online Match';
      this.dom.roomCodeBadge.classList.remove('hidden');
      this.dom.displayRoomCode.textContent = code;
      this.dom.lobbyCodeDisplay.textContent = code;
      this.dom.waitingLobby.classList.remove('hidden');
      this.dom.reactionsBar.classList.remove('hidden');

      this.resetBoardState();
      this.gameActive = false;
      this.setStatusMessage('Waiting for opponent to connect...', 'X');
      this.switchView('game');
    }

    /* ---------------- Core Board Logic ---------------- */
    handleCellClick(index) {
      if (!this.gameActive || this.board[index] !== null) return;

      if (this.gameMode === 'online') {
        if (this.onlineState.isSpectator) {
          window.showAppToast("Spectators cannot make moves.");
          return;
        }
        if (!this.onlineState.connected || this.currentTurn !== this.onlineState.mySymbol) {
          window.showAppToast("Wait for your turn!");
          return;
        }

        if (window.networkManager && window.networkManager.mode === 'peerjs') {
          this.executeMove(index, this.onlineState.mySymbol);
          window.networkManager.sendMove({ index, symbol: this.onlineState.mySymbol });
        } else {
          window.networkManager.sendMove({ index, symbol: this.onlineState.mySymbol });
        }
        return;
      }

      if (this.gameMode === 'ai') {
        if (this.currentTurn !== this.aiConfig.playerSymbol) return;
        this.executeMove(index, this.aiConfig.playerSymbol);

        if (this.gameActive && this.currentTurn === this.aiConfig.aiSymbol) {
          this.triggerAIMove();
        }
        return;
      }

      // Local 2-Player Pass & Play
      this.executeMove(index, this.currentTurn);
    }

    executeMove(index, symbol) {
      this.board[index] = symbol;

      if (symbol === 'X') window.soundFX.playMoveX();
      else window.soundFX.playMoveO();

      this.renderBoard();

      const winResult = this.checkWinnerLocally();
      if (winResult) {
        if (winResult.winner === 'draw') {
          this.scores.draws++;
        } else {
          this.scores[winResult.winner]++;
        }
        this.updateScoreboardUI();
        this.handleGameOver(winResult.winner, winResult.line);
        return;
      }

      // Switch turn
      this.currentTurn = this.currentTurn === 'X' ? 'O' : 'X';
      this.updateTurnUI();
    }

    checkWinnerLocally() {
      for (const { combo, line } of WINNING_COMBOS) {
        const [a, b, c] = combo;
        if (this.board[a] && this.board[a] === this.board[b] && this.board[a] === this.board[c]) {
          return { winner: this.board[a], line: combo };
        }
      }
      if (this.board.every(cell => cell !== null && cell !== '')) {
        return { winner: 'draw', line: null };
      }
      return null;
    }

    handleGameOver(winner, winningLine) {
      this.gameActive = false;

      if (winner === 'draw') {
        this.setStatusMessage("It's a Draw!", 'draw');
        window.soundFX.playDraw();
      } else {
        const winnerName = winner === 'X' ? this.dom.nameX.textContent : this.dom.nameO.textContent;
        this.setStatusMessage(`${winnerName} Wins! 🎉`, winner);
        window.soundFX.playWin();
        window.confetti.burst(150);

        if (winningLine && Array.isArray(winningLine)) {
          winningLine.forEach(idx => {
            this.dom.cells[idx].classList.add('cell-win');
          });
          this.drawWinningStrike(winningLine, winner);
        }
      }
    }

    drawWinningStrike(lineCombo, winner) {
      const match = WINNING_COMBOS.find(({ combo }) =>
        combo.every((val, i) => val === lineCombo[i])
      );

      if (match && match.line) {
        this.dom.strikeLine.setAttribute('x1', match.line.x1);
        this.dom.strikeLine.setAttribute('y1', match.line.y1);
        this.dom.strikeLine.setAttribute('x2', match.line.x2);
        this.dom.strikeLine.setAttribute('y2', match.line.y2);
        if (winner === 'X') {
          this.dom.strikeLine.style.stroke = 'var(--x-color)';
          this.dom.strikeLine.style.filter = 'drop-shadow(0 0 10px rgba(var(--x-color-rgb), 0.7))';
        } else if (winner === 'O') {
          this.dom.strikeLine.style.stroke = 'var(--o-color)';
          this.dom.strikeLine.style.filter = 'drop-shadow(0 0 10px rgba(var(--o-color-rgb), 0.7))';
        }
        this.dom.strikeLine.style.display = 'block';
        this.dom.strikeLine.classList.remove('animate-strike');
        void this.dom.strikeLine.offsetWidth;
        this.dom.strikeLine.classList.add('animate-strike');
      }
    }

    hideWinningStrike() {
      this.dom.strikeLine.style.display = 'none';
      this.dom.strikeLine.classList.remove('animate-strike');
    }

    renderBoard() {
      this.dom.cells.forEach((cell, idx) => {
        const val = this.board[idx];
        if (cell.dataset.rendered === val) return;
        cell.dataset.rendered = val || '';
        cell.className = 'board-cell';

        if (val === 'X') {
          cell.innerHTML = SVG_MARK_X;
          cell.classList.add('occupied', 'cell-x');
        } else if (val === 'O') {
          cell.innerHTML = SVG_MARK_O;
          cell.classList.add('occupied', 'cell-o');
        } else {
          cell.innerHTML = '';
        }
      });
    }

    resetBoardState() {
      this.board = Array(9).fill(null);
      this.currentTurn = this.startingTurn;
      this.gameActive = true;
      if (this.dom.boardGrid) this.dom.boardGrid.style.pointerEvents = 'auto';
      this.hideWinningStrike();
      this.dom.cells.forEach(cell => {
        delete cell.dataset.rendered;
        cell.className = 'board-cell';
        cell.innerHTML = '';
      });
      this.renderBoard();
      this.updateTurnUI();
    }

    handleRematchClick() {
      if (this.gameMode === 'online') {
        this.onlineState.rematchRequested = true;
        if (this.onlineState.opponentWantsRematch) {
          window.networkManager.sendRematchStart();
          this.startRematchRound();
        } else {
          window.networkManager.sendRematch();
        }
        return;
      }

      this.startRematchRound();
    }

    startRematchRound() {
      this.dom.btnRematch.classList.remove('pulse-highlight');
      if (this.dom.boardGrid) this.dom.boardGrid.style.pointerEvents = 'auto';
      this.onlineState.rematchRequested = false;
      this.onlineState.opponentWantsRematch = false;
      this.startingTurn = this.startingTurn === 'X' ? 'O' : 'X';
      this.resetBoardState();
      window.showAppToast('Rematch started! Good luck!');
      window.soundFX.playClick();

      if (this.gameMode === 'ai' && this.currentTurn === this.aiConfig.aiSymbol) {
        this.triggerAIMove();
      }
    }

    returnToMenu() {
      if (this.gameMode === 'online') {
        window.networkManager.disconnect();
      }
      this.gameActive = false;
      this.onlineState.connected = false;
      this.onlineState.roomCode = null;
      this.onlineState.isSpectator = false;
      this.onlineState.rematchRequested = false;
      this.onlineState.opponentWantsRematch = false;
      this.dom.btnRematch.classList.remove('pulse-highlight');
      if (this.dom.btnRematch) this.dom.btnRematch.style.display = '';
      if (this.dom.boardGrid) this.dom.boardGrid.style.pointerEvents = 'auto';
      this.hideWinningStrike();
      this.switchView('menu');
    }

    /* ---------------- UI Helpers ---------------- */
    updateTurnUI() {
      if (this.currentTurn === 'X') {
        this.dom.cardX.classList.add('active-turn');
        this.dom.cardO.classList.remove('active-turn');
        this.setStatusMessage(`${this.dom.nameX.textContent}'s Turn`, 'X');
      } else {
        this.dom.cardO.classList.add('active-turn');
        this.dom.cardX.classList.remove('active-turn');
        this.setStatusMessage(`${this.dom.nameO.textContent}'s Turn`, 'O');
      }
    }

    setStatusMessage(msg, symbol) {
      this.dom.statusText.textContent = msg;
      if (symbol === 'X') {
        this.dom.turnIcon.innerHTML = `<svg class="status-mark-svg" viewBox="0 0 24 24" fill="none"><line x1="6" y1="6" x2="18" y2="18" stroke="var(--x-color)" stroke-width="2.8" stroke-linecap="round"/><line x1="18" y1="6" x2="6" y2="18" stroke="var(--x-color)" stroke-width="2.8" stroke-linecap="round"/></svg>`;
        this.dom.turnIcon.style.display = 'inline-flex';
      } else if (symbol === 'O') {
        this.dom.turnIcon.innerHTML = `<svg class="status-mark-svg" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="6" stroke="var(--o-color)" stroke-width="2.8"/></svg>`;
        this.dom.turnIcon.style.display = 'inline-flex';
      } else {
        this.dom.turnIcon.innerHTML = '';
        this.dom.turnIcon.style.display = 'none';
      }
    }

    updateScoreboardUI() {
      this.dom.scoreXVal.textContent = this.scores.X;
      this.dom.scoreOVal.textContent = this.scores.O;
      this.dom.scoreDrawsVal.textContent = this.scores.draws;
    }

    copyRoomCode() {
      if (!this.onlineState.roomCode) return;
      navigator.clipboard.writeText(this.onlineState.roomCode).then(() => {
        window.showAppToast(`Room code copied: ${this.onlineState.roomCode}`);
        window.soundFX.playClick();
      });
    }

    copyRoomLink() {
      if (!this.onlineState.roomCode) return;
      const url = window.networkManager.getShareableLink(this.onlineState.roomCode, 'tictactoe');
      navigator.clipboard.writeText(url).then(() => {
        window.showAppToast('Invite link copied to clipboard!');
        window.soundFX.playClick();
      });
    }

    sendReaction(emoji) {
      window.soundFX.playReaction();
      if (this.gameMode === 'online') {
        window.networkManager.sendReaction(emoji);
        window.triggerFloatingReaction(this.onlineState.myName, emoji, true);
      } else {
        window.triggerFloatingReaction('You', emoji, true);
      }
    }
  }

  window.tttController = new TicTacToeController();
})();
