/**
 * Dots and Boxes Game Controller
 * Features:
 * - Online Multiplayer (via unified NetworkManager)
 * - Solo vs AI (Easy, Medium, Master Strategic AI with chain logic)
 * - Local 2-Player Pass & Play
 * - Configurable Grids: 2x2 (Quick), 3x3 (Classic), 4x4 (Pro)
 */

(function () {
  'use strict';

  class DotsGameController {
    constructor() {
      this.gameMode = 'local'; // 'local' | 'ai' | 'online'
      this.rows = 3; // 3x3 boxes (4x4 dots)
      this.cols = 3;
      this.lines = {}; // { [lineId]: 'P1' | 'P2' }
      this.boxes = {}; // { [boxId]: 'P1' | 'P2' }
      this.currentTurn = 'P1';
      this.startingTurn = 'P1';
      this.gameActive = false;
      this.scores = { P1: 0, P2: 0 };

      this.aiConfig = {
        difficulty: 'master',
        playerSymbol: 'P1',
        aiSymbol: 'P2'
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
      this.dom.viewMenu = document.getElementById('view-dots-menu');
      this.dom.viewGame = document.getElementById('view-dots-game');
      this.dom.modalOnline = document.getElementById('modal-dots-online');
      this.dom.modalAi = document.getElementById('modal-dots-ai');

      this.dom.boardContainer = document.getElementById('dots-board-container');
      this.dom.statusBanner = document.getElementById('dots-status-banner');
      this.dom.statusText = document.getElementById('dots-status-text');
      this.dom.turnIcon = document.getElementById('dots-turn-icon');

      this.dom.nameP1 = document.getElementById('dots-name-p1');
      this.dom.nameP2 = document.getElementById('dots-name-p2');
      this.dom.roleP1 = document.getElementById('dots-role-p1');
      this.dom.roleP2 = document.getElementById('dots-role-p2');
      this.dom.scoreP1Val = document.getElementById('dots-score-p1-val');
      this.dom.scoreP2Val = document.getElementById('dots-score-p2-val');
      this.dom.cardP1 = document.getElementById('dots-player-p1-card');
      this.dom.cardP2 = document.getElementById('dots-player-p2-card');

      this.dom.gameModeTag = document.getElementById('dots-game-mode-tag');
      this.dom.roomCodeBadge = document.getElementById('dots-room-code-badge');
      this.dom.displayRoomCode = document.getElementById('dots-display-room-code');
      this.dom.waitingLobby = document.getElementById('dots-waiting-lobby');
      this.dom.lobbyCodeDisplay = document.getElementById('dots-lobby-code-display');
      this.dom.reactionsBar = document.getElementById('dots-reactions-bar');

      this.dom.btnRematch = document.getElementById('dots-btn-rematch');
      this.dom.btnResetScores = document.getElementById('dots-btn-reset-scores');
      this.dom.btnBackMenu = document.getElementById('dots-btn-back-menu');

      this.dom.tabCreate = document.getElementById('dots-tab-create-room');
      this.dom.tabJoin = document.getElementById('dots-tab-join-room');
      this.dom.panelCreate = document.getElementById('dots-panel-create-room');
      this.dom.panelJoin = document.getElementById('dots-panel-join-room');

      this.dom.inputPlayerName = document.getElementById('dots-online-player-name');
      this.dom.inputJoinCode = document.getElementById('dots-join-room-code');
      this.dom.btnCreateSubmit = document.getElementById('dots-btn-create-room-submit');
      this.dom.btnJoinSubmit = document.getElementById('dots-btn-join-room-submit');
      this.dom.selectGridSize = document.getElementById('dots-create-grid-size');
    }

    bindEvents() {
      // Menu Mode Selectors
      const btnOpenOnline = document.getElementById('btn-dots-open-online');
      if (btnOpenOnline) {
        btnOpenOnline.addEventListener('click', () => {
          window.soundFX.playClick();
          this.openModal('online');
        });
      }

      const btnOpenAi = document.getElementById('btn-dots-open-ai');
      if (btnOpenAi) {
        btnOpenAi.addEventListener('click', () => {
          window.soundFX.playClick();
          this.openModal('ai');
        });
      }

      const btnStartLocal = document.getElementById('btn-dots-start-local');
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

      // Create / Join Room Submits
      if (this.dom.btnCreateSubmit) {
        this.dom.btnCreateSubmit.addEventListener('click', () => {
          const name = this.dom.inputPlayerName.value.trim() || 'Player 1';
          const sizeVal = this.dom.selectGridSize ? parseInt(this.dom.selectGridSize.value, 10) : 3;
          this.rows = sizeVal;
          this.cols = sizeVal;
          this.createOnlineRoom(name, sizeVal);
        });
      }

      if (this.dom.btnJoinSubmit) {
        this.dom.btnJoinSubmit.addEventListener('click', () => {
          const name = this.dom.inputPlayerName.value.trim() || 'Player 2';
          const code = this.dom.inputJoinCode.value.trim().toUpperCase();
          if (!code || code.length < 4) {
            window.showAppToast('Please enter a valid room code (4-6 chars).');
            return;
          }
          this.joinOnlineRoom(code, name);
        });
      }

      // AI Config
      document.querySelectorAll('#dots-ai-difficulty-control .segment-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          document.querySelectorAll('#dots-ai-difficulty-control .segment-btn').forEach(b => b.classList.remove('active'));
          e.target.classList.add('active');
          this.aiConfig.difficulty = e.target.dataset.diff;
        });
      });

      document.querySelectorAll('#dots-ai-symbol-control .segment-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          document.querySelectorAll('#dots-ai-symbol-control .segment-btn').forEach(b => b.classList.remove('active'));
          e.target.classList.add('active');
          this.aiConfig.playerSymbol = e.target.dataset.symbol;
          this.aiConfig.aiSymbol = this.aiConfig.playerSymbol === 'P1' ? 'P2' : 'P1';
        });
      });

      document.querySelectorAll('#dots-ai-grid-control .segment-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          document.querySelectorAll('#dots-ai-grid-control .segment-btn').forEach(b => b.classList.remove('active'));
          e.target.classList.add('active');
          const size = parseInt(e.target.dataset.size, 10) || 3;
          this.rows = size;
          this.cols = size;
        });
      });

      const btnStartAi = document.getElementById('dots-btn-start-ai-game');
      if (btnStartAi) {
        btnStartAi.addEventListener('click', () => {
          this.closeModal('ai');
          this.startAIGame();
        });
      }

      // In-Game Buttons
      if (this.dom.btnRematch) {
        this.dom.btnRematch.addEventListener('click', () => {
          window.soundFX.playClick();
          this.handleRematchClick();
        });
      }

      if (this.dom.btnResetScores) {
        this.dom.btnResetScores.addEventListener('click', () => {
          window.soundFX.playClick();
          this.scores = { P1: 0, P2: 0 };
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

      const btnCopyCode = document.getElementById('dots-btn-copy-code');
      if (btnCopyCode) {
        btnCopyCode.addEventListener('click', () => this.copyRoomCode());
      }

      const btnCopyLink = document.getElementById('dots-btn-copy-link');
      if (btnCopyLink) {
        btnCopyLink.addEventListener('click', () => this.copyRoomLink());
      }

      if (this.dom.roomCodeBadge) {
        this.dom.roomCodeBadge.addEventListener('click', () => this.copyRoomLink());
      }

      // Reactions
      document.querySelectorAll('#dots-reactions-bar .emoji-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const emoji = btn.dataset.emoji;
          this.sendReaction(emoji);
        });
      });
    }

    setupNetworkListeners() {
      const net = window.networkManager;
      if (!net) return;

      net.on('room-created', (data) => {
        if (data.gameType !== 'dots') return;
        this.closeModal('online');
        this.onlineState.roomCode = data.roomCode;
        this.onlineState.mySymbol = data.playerSymbol;
        this.onlineState.myName = data.playerName;
        this.onlineState.isHost = true;
        this.onlineState.connected = false;

        if (data.roomState && data.roomState.config && data.roomState.config.rows) {
          this.rows = data.roomState.config.rows;
          this.cols = data.roomState.config.cols;
        }

        this.showWaitingLobby(data.roomCode);
        this.dom.nameP1.textContent = `${data.playerName} (You)`;
        this.dom.nameP2.textContent = 'Waiting for opponent...';
        this.dom.roleP1.textContent = 'Host (P1)';
        this.dom.roleP2.textContent = 'Guest (P2)';
      });

      net.on('room-joined', (data) => {
        if (data.gameType !== 'dots') return;
        this.closeModal('online');
        this.onlineState.roomCode = data.roomCode;
        this.onlineState.mySymbol = data.playerSymbol;
        this.onlineState.myName = data.playerName;
        this.onlineState.isHost = false;

        if (data.roomState && data.roomState.rows) {
          this.rows = data.roomState.rows;
          this.cols = data.roomState.cols;
        }

        this.gameMode = 'online';
        this.dom.gameModeTag.textContent = 'Online Match';
        this.dom.roomCodeBadge.classList.remove('hidden');
        this.dom.displayRoomCode.textContent = data.roomCode;
        this.dom.waitingLobby.classList.add('hidden');
        this.dom.reactionsBar.classList.remove('hidden');

        if (data.roomState && data.roomState.players && data.roomState.players[0]) {
          this.onlineState.opponentName = data.roomState.players[0].name;
          this.dom.nameP1.textContent = data.roomState.players[0].name;
          this.dom.nameP2.textContent = `${data.playerName} (You)`;
        }

        this.switchView('game');
        this.buildBoardGrid();
      });

      net.on('game-started', (data) => {
        if (data.gameType && data.gameType !== 'dots') return;
        this.dom.waitingLobby.classList.add('hidden');
        this.onlineState.connected = true;

        if (data.roomState && data.roomState.players) {
          const p1 = data.roomState.players.find(p => p.symbol === 'P1');
          const p2 = data.roomState.players.find(p => p.symbol === 'P2');
          if (p1 && p2) {
            this.dom.nameP1.textContent = p1.name + (this.onlineState.mySymbol === 'P1' ? ' (You)' : '');
            this.dom.nameP2.textContent = p2.name + (this.onlineState.mySymbol === 'P2' ? ' (You)' : '');
            this.onlineState.opponentName = this.onlineState.mySymbol === 'P1' ? p2.name : p1.name;
          }
        }

        window.showAppToast(data.message || 'Opponent joined! Game started!');
        window.soundFX.playWin();
        this.resetBoardState();
      });

      net.on('dots-move-made', (data) => {
        if (this.gameMode !== 'online') return;
        this.applyMove(data.lineId, data.symbol, data.newBoxes, data.nextTurn, data.gotExtraTurn);
      });

      net.on('dots-game-over', (data) => {
        if (this.gameMode !== 'online') return;
        this.applyMove(data.lineId, data.symbol, data.newBoxes, null, false);
        this.handleGameOver(data.winner);
      });

      net.on('rematch-requested', (data) => {
        if (this.gameMode !== 'online') return;
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
        this.startRematchRound();
      });

      net.on('player-left', (data) => {
        if (this.gameMode !== 'online') return;
        this.gameActive = false;
        this.onlineState.connected = false;
        this.dom.waitingLobby.classList.remove('hidden');
        window.showAppToast(data.message || 'Opponent left the room.');
        this.setStatusMessage('Waiting for opponent...', 'P1');
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
    startLocalGame(gridSize = 3) {
      this.gameMode = 'local';
      this.rows = gridSize;
      this.cols = gridSize;

      this.dom.gameModeTag.textContent = `Pass & Play (${gridSize}x${gridSize})`;
      this.dom.roomCodeBadge.classList.add('hidden');
      this.dom.waitingLobby.classList.add('hidden');
      this.dom.reactionsBar.classList.add('hidden');

      this.dom.nameP1.textContent = 'Player 1 (Cyan)';
      this.dom.nameP2.textContent = 'Player 2 (Pink)';
      this.dom.roleP1.textContent = 'Local';
      this.dom.roleP2.textContent = 'Local';

      this.resetBoardState();
      this.switchView('game');
    }

    /* ---------------- Mode 2: Play vs AI ---------------- */
    startAIGame() {
      this.gameMode = 'ai';
      const diffLabel = this.aiConfig.difficulty.charAt(0).toUpperCase() + this.aiConfig.difficulty.slice(1);
      this.dom.gameModeTag.textContent = `VS AI (${diffLabel} - ${this.rows}x${this.cols})`;
      this.dom.roomCodeBadge.classList.add('hidden');
      this.dom.waitingLobby.classList.add('hidden');
      this.dom.reactionsBar.classList.add('hidden');

      if (this.aiConfig.playerSymbol === 'P1') {
        this.dom.nameP1.textContent = 'You (Cyan)';
        this.dom.nameP2.textContent = `Bot AI [${diffLabel}]`;
        this.dom.roleP1.textContent = 'Human';
        this.dom.roleP2.textContent = 'AI';
      } else {
        this.dom.nameP1.textContent = `Bot AI [${diffLabel}]`;
        this.dom.nameP2.textContent = 'You (Pink)';
        this.dom.roleP1.textContent = 'AI';
        this.dom.roleP2.textContent = 'Human';
      }

      this.resetBoardState();
      this.switchView('game');

      if (this.aiConfig.aiSymbol === 'P1') {
        this.triggerAIMove();
      }
    }

    /* ---------------- Mode 3: Online Multiplayer ---------------- */
    createOnlineRoom(playerName, gridSize = 3) {
      this.rows = gridSize;
      this.cols = gridSize;
      window.networkManager.createRoom({
        playerName,
        gameType: 'dots',
        config: { rows: gridSize, cols: gridSize }
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
      this.setStatusMessage('Waiting for opponent to connect...', 'P1');
      this.switchView('game');
    }

    /* ---------------- Board DOM Rendering ---------------- */
    buildBoardGrid() {
      this.dom.boardContainer.innerHTML = '';

      const boardEl = document.createElement('div');
      boardEl.className = 'dots-board';
      boardEl.style.setProperty('--dots-rows', this.rows);
      boardEl.style.setProperty('--dots-cols', this.cols);

      // Build alternating rows
      // Total row strips: rows * 2 + 1
      for (let r = 0; r <= this.rows; r++) {
        // Strip A: Dot Row (Dot, H-Line, Dot, H-Line, ... Dot)
        const dotRow = document.createElement('div');
        dotRow.className = 'dots-row dot-strip';

        for (let c = 0; c <= this.cols; c++) {
          const dot = document.createElement('div');
          dot.className = 'dot-node';
          dot.dataset.r = r;
          dot.dataset.c = c;
          dotRow.appendChild(dot);

          if (c < this.cols) {
            const hLine = document.createElement('button');
            hLine.className = 'dot-line line-horizontal';
            hLine.id = `line-h-${r}-${c}`;
            hLine.dataset.lineId = `h-${r}-${c}`;
            hLine.setAttribute('aria-label', `Horizontal line row ${r} col ${c}`);
            hLine.addEventListener('click', () => this.handleLineClick(`h-${r}-${c}`));
            dotRow.appendChild(hLine);
          }
        }
        boardEl.appendChild(dotRow);

        // Strip B: Box Row (V-Line, Box, V-Line, Box, ... V-Line)
        if (r < this.rows) {
          const boxRow = document.createElement('div');
          boxRow.className = 'dots-row box-strip';

          for (let c = 0; c <= this.cols; c++) {
            const vLine = document.createElement('button');
            vLine.className = 'dot-line line-vertical';
            vLine.id = `line-v-${r}-${c}`;
            vLine.dataset.lineId = `v-${r}-${c}`;
            vLine.setAttribute('aria-label', `Vertical line row ${r} col ${c}`);
            vLine.addEventListener('click', () => this.handleLineClick(`v-${r}-${c}`));
            boxRow.appendChild(vLine);

            if (c < this.cols) {
              const box = document.createElement('div');
              box.className = 'dot-box';
              box.id = `box-b-${r}-${c}`;
              box.dataset.boxId = `b-${r}-${c}`;
              boxRow.appendChild(box);
            }
          }
          boardEl.appendChild(boxRow);
        }
      }

      this.dom.boardContainer.appendChild(boardEl);
    }

    resetBoardState() {
      this.lines = {};
      this.boxes = {};
      this.currentTurn = this.startingTurn;
      this.gameActive = true;
      this.buildBoardGrid();
      this.updateScoreboardUI();
      this.updateTurnUI();
    }

    /* ---------------- Move & Line Logic ---------------- */
    handleLineClick(lineId) {
      if (!this.gameActive || this.lines[lineId]) return;

      if (this.gameMode === 'online') {
        if (!this.onlineState.connected || this.currentTurn !== this.onlineState.mySymbol) {
          window.showAppToast("Wait for your turn!");
          return;
        }

        // Send to server/peer
        window.networkManager.sendMove({ lineId, symbol: this.onlineState.mySymbol });
        return;
      }

      if (this.gameMode === 'ai') {
        if (this.currentTurn !== this.aiConfig.playerSymbol) return;
        this.executeMove(lineId, this.aiConfig.playerSymbol);
        return;
      }

      // Local 2-Player
      this.executeMove(lineId, this.currentTurn);
    }

    executeMove(lineId, symbol) {
      this.lines[lineId] = symbol;
      window.soundFX.playLineDraw();

      // Render line
      const lineEl = document.getElementById(`line-${lineId}`);
      if (lineEl) {
        lineEl.classList.add('drawn', symbol === 'P1' ? 'line-p1' : 'line-p2');
        lineEl.disabled = true;
      }

      // Check newly completed boxes
      const newBoxes = this.checkNewlyCompleted(lineId, symbol);
      newBoxes.forEach(boxId => {
        this.boxes[boxId] = symbol;
        this.scores[symbol]++;
        const boxEl = document.getElementById(`box-${boxId}`);
        if (boxEl) {
          boxEl.classList.add('claimed', symbol === 'P1' ? 'box-p1' : 'box-p2');
          boxEl.innerHTML = `<span class="box-badge">${symbol === 'P1' ? 'P1' : 'P2'}</span>`;
        }
      });

      this.updateScoreboardUI();

      const totalBoxes = this.rows * this.cols;
      const totalClaimed = Object.keys(this.boxes).length;

      if (totalClaimed === totalBoxes) {
        let winner = 'draw';
        if (this.scores.P1 > this.scores.P2) winner = 'P1';
        else if (this.scores.P2 > this.scores.P1) winner = 'P2';
        this.handleGameOver(winner);
        return;
      }

      // If at least one box was completed, player gets an extra turn!
      if (newBoxes.length > 0) {
        window.soundFX.playBoxComplete();
        window.soundFX.playBonusTurn();
        this.setStatusMessage(`${symbol === 'P1' ? this.dom.nameP1.textContent : this.dom.nameP2.textContent} Completed a Box! Bonus Turn! 🎉`, symbol);

        if (this.gameMode === 'ai' && this.currentTurn === this.aiConfig.aiSymbol) {
          this.triggerAIMove();
        }
      } else {
        // Toggle turn
        this.currentTurn = this.currentTurn === 'P1' ? 'P2' : 'P1';
        this.updateTurnUI();

        if (this.gameMode === 'ai' && this.currentTurn === this.aiConfig.aiSymbol) {
          this.triggerAIMove();
        }
      }
    }

    applyMove(lineId, symbol, newBoxes = [], nextTurn = null, gotExtraTurn = false) {
      this.lines[lineId] = symbol;
      window.soundFX.playLineDraw();

      const lineEl = document.getElementById(`line-${lineId}`);
      if (lineEl) {
        lineEl.classList.add('drawn', symbol === 'P1' ? 'line-p1' : 'line-p2');
        lineEl.disabled = true;
      }

      if (newBoxes && newBoxes.length > 0) {
        newBoxes.forEach(boxId => {
          this.boxes[boxId] = symbol;
          this.scores[symbol]++;
          const boxEl = document.getElementById(`box-${boxId}`);
          if (boxEl) {
            boxEl.classList.add('claimed', symbol === 'P1' ? 'box-p1' : 'box-p2');
            boxEl.innerHTML = `<span class="box-badge">${symbol === 'P1' ? 'P1' : 'P2'}</span>`;
          }
        });
        window.soundFX.playBoxComplete();
        this.updateScoreboardUI();
      }

      if (nextTurn) {
        this.currentTurn = nextTurn;
        this.updateTurnUI();
      } else if (gotExtraTurn) {
        this.setStatusMessage(`Bonus Turn! 🎉`, symbol);
      }
    }

    checkNewlyCompleted(lastLineId, symbol) {
      const parts = lastLineId.split('-');
      const type = parts[0];
      const r = parseInt(parts[1], 10);
      const c = parseInt(parts[2], 10);

      const candidateBoxes = [];

      if (type === 'h') {
        if (r > 0) candidateBoxes.push({ r: r - 1, c });
        if (r < this.rows) candidateBoxes.push({ r, c });
      } else if (type === 'v') {
        if (c > 0) candidateBoxes.push({ r, c: c - 1 });
        if (c < this.cols) candidateBoxes.push({ r, c });
      }

      const completed = [];
      candidateBoxes.forEach(({ r: br, c: bc }) => {
        const boxId = `b-${br}-${bc}`;
        if (!this.boxes[boxId]) {
          const top = `h-${br}-${bc}`;
          const bottom = `h-${br + 1}-${bc}`;
          const left = `v-${br}-${bc}`;
          const right = `v-${br}-${bc + 1}`;

          if (this.lines[top] && this.lines[bottom] && this.lines[left] && this.lines[right]) {
            completed.push(boxId);
          }
        }
      });

      return completed;
    }

    /* ---------------- Smart AI Engine ---------------- */
    triggerAIMove() {
      if (!this.gameActive) return;
      this.dom.boardContainer.style.pointerEvents = 'none';
      this.setStatusMessage('AI is thinking...', this.aiConfig.aiSymbol);

      setTimeout(() => {
        if (!this.gameActive) return;
        const bestLine = this.getBestAIMove();
        this.dom.boardContainer.style.pointerEvents = 'auto';
        if (bestLine) {
          this.executeMove(bestLine, this.aiConfig.aiSymbol);
        }
      }, 420);
    }

    getAllAvailableLines() {
      const available = [];
      // Horizontal lines
      for (let r = 0; r <= this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const id = `h-${r}-${c}`;
          if (!this.lines[id]) available.push(id);
        }
      }
      // Vertical lines
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c <= this.cols; c++) {
          const id = `v-${r}-${c}`;
          if (!this.lines[id]) available.push(id);
        }
      }
      return available;
    }

    countBoxSides(br, bc, testLines = this.lines) {
      const top = `h-${br}-${bc}`;
      const bottom = `h-${br + 1}-${bc}`;
      const left = `v-${br}-${bc}`;
      const right = `v-${br}-${bc + 1}`;
      let count = 0;
      if (testLines[top]) count++;
      if (testLines[bottom]) count++;
      if (testLines[left]) count++;
      if (testLines[right]) count++;
      return count;
    }

    getNeighborBoxes(lineId) {
      const parts = lineId.split('-');
      const type = parts[0];
      const r = parseInt(parts[1], 10);
      const c = parseInt(parts[2], 10);
      const boxes = [];

      if (type === 'h') {
        if (r > 0) boxes.push({ r: r - 1, c });
        if (r < this.rows) boxes.push({ r, c });
      } else {
        if (c > 0) boxes.push({ r, c: c - 1 });
        if (c < this.cols) boxes.push({ r, c });
      }
      return boxes;
    }

    getBestAIMove() {
      const available = this.getAllAvailableLines();
      if (available.length === 0) return null;

      // 1. Can we immediately capture a box? (A line completing the 4th side)
      for (const lineId of available) {
        const neighbors = this.getNeighborBoxes(lineId);
        for (const { r, c } of neighbors) {
          if (this.countBoxSides(r, c) === 3) {
            return lineId; // Immediate score!
          }
        }
      }

      if (this.aiConfig.difficulty === 'easy') {
        return available[Math.floor(Math.random() * available.length)];
      }

      // 2. Safe Moves: Moves that do NOT create a 3rd side for opponent
      const safeLines = [];
      const sacrificeLines = [];

      for (const lineId of available) {
        const neighbors = this.getNeighborBoxes(lineId);
        let givesThirdSide = false;

        for (const { r, c } of neighbors) {
          const sides = this.countBoxSides(r, c);
          if (sides === 2) {
            givesThirdSide = true;
            break;
          }
        }

        if (!givesThirdSide) {
          safeLines.push(lineId);
        } else {
          sacrificeLines.push(lineId);
        }
      }

      if (safeLines.length > 0) {
        if (this.aiConfig.difficulty === 'medium' && Math.random() < 0.25) {
          return available[Math.floor(Math.random() * available.length)];
        }
        // Master prefers lines on 0-sided boxes over 1-sided boxes
        safeLines.sort((a, b) => {
          const maxA = Math.max(...this.getNeighborBoxes(a).map(n => this.countBoxSides(n.r, n.c)));
          const maxB = Math.max(...this.getNeighborBoxes(b).map(n => this.countBoxSides(n.r, n.c)));
          return maxA - maxB;
        });
        return safeLines[0];
      }

      // 3. Forced sacrifice (no safe lines exist)
      if (this.aiConfig.difficulty === 'master' && sacrificeLines.length > 0) {
        // Pick sacrifice line that gives away the fewest consecutive boxes
        let minDamage = Infinity;
        let bestSacrifice = sacrificeLines[0];

        for (const lineId of sacrificeLines) {
          const damage = this.simulateChainDamage(lineId);
          if (damage < minDamage) {
            minDamage = damage;
            bestSacrifice = lineId;
          }
        }
        return bestSacrifice;
      }

      return available[Math.floor(Math.random() * available.length)];
    }

    simulateChainDamage(testLine) {
      // Simulate greedily how many boxes opponent gets
      const simulatedLines = { ...this.lines, [testLine]: 'AI' };
      let captured = 0;
      let changed = true;

      while (changed) {
        changed = false;
        for (let r = 0; r < this.rows; r++) {
          for (let c = 0; c < this.cols; c++) {
            const sides = this.countBoxSides(r, c, simulatedLines);
            if (sides === 3) {
              const top = `h-${r}-${c}`;
              const bottom = `h-${r + 1}-${c}`;
              const left = `v-${r}-${c}`;
              const right = `v-${r}-${c + 1}`;
              const missing = [top, bottom, left, right].find(l => !simulatedLines[l]);
              if (missing) {
                simulatedLines[missing] = 'OPP';
                captured++;
                changed = true;
              }
            }
          }
        }
      }
      return captured;
    }

    /* ---------------- Game Over & Rematch ---------------- */
    handleGameOver(winner) {
      this.gameActive = false;

      if (winner === 'draw') {
        this.setStatusMessage("It's a Draw!", 'draw');
        window.soundFX.playDraw();
      } else {
        const winnerName = winner === 'P1' ? this.dom.nameP1.textContent : this.dom.nameP2.textContent;
        this.setStatusMessage(`${winnerName} Wins the Territory! 🏆`, winner);
        window.soundFX.playWin();
        window.confetti.burst(160);
      }
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
      this.onlineState.rematchRequested = false;
      this.onlineState.opponentWantsRematch = false;

      // Swap starting turn
      this.startingTurn = this.startingTurn === 'P1' ? 'P2' : 'P1';
      this.resetBoardState();
      window.showAppToast('New round started! Good luck!');
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
      this.onlineState.rematchRequested = false;
      this.onlineState.opponentWantsRematch = false;
      this.dom.btnRematch.classList.remove('pulse-highlight');
      this.switchView('menu');
    }

    /* ---------------- UI Helpers ---------------- */
    updateTurnUI() {
      if (this.currentTurn === 'P1') {
        this.dom.cardP1.classList.add('active-turn');
        this.dom.cardP2.classList.remove('active-turn');
        this.setStatusMessage(`${this.dom.nameP1.textContent}'s Turn`, 'P1');
      } else {
        this.dom.cardP2.classList.add('active-turn');
        this.dom.cardP1.classList.remove('active-turn');
        this.setStatusMessage(`${this.dom.nameP2.textContent}'s Turn`, 'P2');
      }
    }

    setStatusMessage(msg, symbol) {
      this.dom.statusText.textContent = msg;
      if (symbol === 'P1') {
        this.dom.turnIcon.innerHTML = `<span class="dots-turn-pip pip-p1"></span>`;
        this.dom.turnIcon.style.display = 'inline-flex';
      } else if (symbol === 'P2') {
        this.dom.turnIcon.innerHTML = `<span class="dots-turn-pip pip-p2"></span>`;
        this.dom.turnIcon.style.display = 'inline-flex';
      } else {
        this.dom.turnIcon.innerHTML = '';
        this.dom.turnIcon.style.display = 'none';
      }
    }

    updateScoreboardUI() {
      this.dom.scoreP1Val.textContent = this.scores.P1;
      this.dom.scoreP2Val.textContent = this.scores.P2;
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
      const url = window.networkManager.getShareableLink(this.onlineState.roomCode, 'dots');
      navigator.clipboard.writeText(url).then(() => {
        window.showAppToast('Invite link copied! Send it to your friend.');
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

  window.dotsController = new DotsGameController();
})();
