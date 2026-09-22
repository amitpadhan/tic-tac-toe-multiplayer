/**
 * Unified Multiplayer Network Manager
 * Supports:
 * 1. Primary: Socket.IO (instant, 100% reliable across all devices, Wi-Fi, LAN, and cloud servers)
 * 2. Fallback: WebRTC P2P via PeerJS (for static hosting such as GitHub Pages)
 */

(function () {
  'use strict';

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

  class NetworkManager {
    constructor() {
      this.socket = null;
      this.peer = null;
      this.peerConn = null;
      this.mode = 'idle'; // 'socketio' | 'peerjs' | 'idle'
      this.currentRoom = null;
      this.mySymbol = null;
      this.myName = 'Player';
      this.isHost = false;
      this.gameType = 'tictactoe'; // 'tictactoe' | 'dots'
      this.handlers = {};
      this.serverIps = [];

      this.fetchServerInfo();
      this.initSocket();
    }

    on(event, callback) {
      if (!this.handlers[event]) this.handlers[event] = [];
      this.handlers[event].push(callback);
    }

    emitEvent(event, data) {
      if (this.handlers[event]) {
        this.handlers[event].forEach(cb => {
          try { cb(data); } catch (e) { console.error('Handler error for', event, e); }
        });
      }
    }

    async fetchServerInfo() {
      if (window.location.protocol.startsWith('http')) {
        try {
          const res = await fetch('/api/server-info');
          if (res.ok) {
            const data = await res.json();
            if (data.ips && Array.isArray(data.ips)) {
              this.serverIps = data.ips;
            }
          }
        } catch (_) {
          // Running on static hosting or offline
        }
      }
    }

    initSocket() {
      if (typeof io !== 'undefined' && window.location.protocol.startsWith('http')) {
        try {
          this.socket = io({
            transports: ['websocket', 'polling'],
            timeout: 5000,
            reconnectionAttempts: 10
          });

          this.socket.on('connect', () => {
            console.log('⚡ Connected to Game Server via Socket.IO:', this.socket.id);
          });

          this.socket.on('room-created', (data) => {
            this.mode = 'socketio';
            this.currentRoom = data.roomCode;
            this.mySymbol = data.playerSymbol;
            this.isHost = true;
            this.gameType = data.gameType;
            this.emitEvent('room-created', data);
          });

          this.socket.on('room-joined', (data) => {
            this.mode = 'socketio';
            this.currentRoom = data.roomCode;
            this.mySymbol = data.playerSymbol;
            this.isHost = false;
            this.gameType = data.gameType;
            this.emitEvent('room-joined', data);
          });

          this.socket.on('game-started', (data) => {
            this.emitEvent('game-started', data);
          });

          this.socket.on('move-made', (data) => {
            this.emitEvent('move-made', data);
          });

          this.socket.on('game-over', (data) => {
            this.emitEvent('game-over', data);
          });

          this.socket.on('dots-move-made', (data) => {
            this.emitEvent('dots-move-made', data);
          });

          this.socket.on('dots-game-over', (data) => {
            this.emitEvent('dots-game-over', data);
          });

          this.socket.on('rematch-requested', (data) => {
            this.emitEvent('rematch-requested', data);
          });

          this.socket.on('rematch-pending', () => {
            this.emitEvent('rematch-pending');
          });

          this.socket.on('rematch-start', (data) => {
            this.emitEvent('rematch-start', data);
          });

          this.socket.on('new-reaction', (data) => {
            this.emitEvent('new-reaction', data);
          });

          this.socket.on('player-left', (data) => {
            this.emitEvent('player-left', data);
          });

          this.socket.on('player-promoted', (data) => {
            this.emitEvent('player-promoted', data);
          });

          this.socket.on('spectator-update', (data) => {
            this.emitEvent('spectator-update', data);
          });

          this.socket.on('error-message', (data) => {
            this.emitEvent('error-message', data);
          });

          this.socket.on('disconnect', (reason) => {
            console.log('Socket disconnected:', reason);
          });
        } catch (e) {
          console.warn('Socket.IO initialization fallback to P2P:', e);
          this.socket = null;
        }
      }
    }

    cleanCode(rawCode) {
      if (!rawCode) return '';
      return rawCode.toString().replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    }

    createRoom({ playerName, gameType = 'tictactoe', config = {} }) {
      this.myName = (playerName || 'Player 1').trim().slice(0, 15) || 'Player 1';
      this.gameType = gameType;

      // Prefer Socket.IO if connected to server
      if (this.socket && this.socket.connected) {
        this.mode = 'socketio';
        this.socket.emit('create-room', {
          playerName: this.myName,
          gameType,
          config
        });
        return;
      }

      // Fallback: PeerJS P2P (for GitHub Pages / serverless)
      this.createRoomPeerJS({ playerName: this.myName, gameType, config });
    }

    joinRoom({ roomCode, playerName }) {
      const code = this.cleanCode(roomCode);
      if (!code || code.length < 4) {
        this.emitEvent('error-message', { message: 'Please enter a valid room code (4-6 characters).' });
        return;
      }

      this.myName = (playerName || 'Player 2').trim().slice(0, 15) || 'Player 2';

      // Prefer Socket.IO if connected
      if (this.socket && this.socket.connected) {
        this.mode = 'socketio';
        this.socket.emit('join-room', {
          roomCode: code,
          playerName: this.myName
        });
        return;
      }

      // Fallback: PeerJS P2P
      this.joinRoomPeerJS({ roomCode: code, playerName: this.myName });
    }

    /* ---------------- PeerJS P2P Engine ---------------- */
    generateRandomCode() {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    }

    createRoomPeerJS({ playerName, gameType, config }) {
      this.mode = 'peerjs';
      this.isHost = true;
      const code = this.generateRandomCode();
      this.currentRoom = code;
      const defaultSymbol = gameType === 'dots' ? 'P1' : 'X';
      this.mySymbol = defaultSymbol;

      if (typeof Peer === 'undefined') {
        this.emitEvent('error-message', { message: 'Multiplayer library loading... please check internet connection.' });
        return;
      }

      if (this.peer) this.peer.destroy();

      const peerId = `dual-arcade-${gameType}-${code.toLowerCase()}`;
      this.peer = new Peer(peerId, PEER_CONFIG);

      this.emitEvent('room-created', {
        roomCode: code,
        gameType,
        playerSymbol: defaultSymbol,
        playerName,
        roomState: {
          code,
          gameType,
          players: [{ name: playerName, symbol: defaultSymbol, score: 0 }],
          currentTurn: defaultSymbol,
          status: 'waiting',
          scores: gameType === 'dots' ? { P1: 0, P2: 0 } : { X: 0, O: 0, draws: 0 },
          config
        }
      });

      this.peer.on('connection', (conn) => {
        if (this.peerConn && this.peerConn.open) {
          conn.on('open', () => {
            conn.send({ type: 'room-full', message: 'Room is already full.' });
            setTimeout(() => conn.close(), 500);
          });
          return;
        }

        this.peerConn = conn;
        this.setupPeerDataListener();

        const onOpen = () => {
          conn.send({
            type: 'init-game',
            hostName: this.myName,
            gameType: this.gameType,
            config
          });
        };

        if (conn.open) onOpen();
        else conn.on('open', onOpen);
      });

      this.peer.on('error', (err) => {
        console.error('PeerJS Host error:', err);
        if (err.type === 'unavailable-id') {
          // ID collision on public broker -> generate fresh code
          this.createRoomPeerJS({ playerName, gameType, config });
        } else {
          this.emitEvent('error-message', { message: `Connection error: ${err.message || err.type}` });
        }
      });
    }

    joinRoomPeerJS({ roomCode, playerName }) {
      this.mode = 'peerjs';
      this.isHost = false;
      this.currentRoom = roomCode;

      if (typeof Peer === 'undefined') {
        this.emitEvent('error-message', { message: 'Multiplayer library loading... please wait.' });
        return;
      }

      if (this.peer) this.peer.destroy();
      this.peer = new Peer(PEER_CONFIG);

      let connectionTimeout = setTimeout(() => {
        this.emitEvent('error-message', { message: 'Connection timed out. Check that host room is still open and code is correct.' });
      }, 10000);

      this.peer.on('open', () => {
        // Try guessing gameType based on current active game, or try both
        const targetId = `dual-arcade-${this.gameType}-${roomCode.toLowerCase()}`;
        this.peerConn = this.peer.connect(targetId, { reliable: true });

        this.setupPeerDataListener();

        this.peerConn.on('open', () => {
          clearTimeout(connectionTimeout);
          this.peerConn.send({
            type: 'join-request',
            playerName
          });
        });
      });

      this.peer.on('error', (err) => {
        clearTimeout(connectionTimeout);
        console.error('PeerJS Join error:', err);
        if (err.type === 'peer-unavailable') {
          this.emitEvent('error-message', { message: `Room "${roomCode}" not found or host disconnected.` });
        } else {
          this.emitEvent('error-message', { message: `Unable to join room: ${err.message || err.type}` });
        }
      });
    }

    setupPeerDataListener() {
      if (!this.peerConn) return;

      this.peerConn.on('data', (data) => {
        if (!data || !data.type) return;

        switch (data.type) {
          case 'init-game':
            this.gameType = data.gameType;
            const guestSymbol = this.gameType === 'dots' ? 'P2' : 'O';
            this.mySymbol = guestSymbol;

            this.emitEvent('room-joined', {
              roomCode: this.currentRoom,
              gameType: this.gameType,
              playerSymbol: guestSymbol,
              playerName: this.myName,
              isSpectator: false,
              roomState: {
                code: this.currentRoom,
                gameType: this.gameType,
                players: [
                  { name: data.hostName, symbol: this.gameType === 'dots' ? 'P1' : 'X', score: 0 },
                  { name: this.myName, symbol: guestSymbol, score: 0 }
                ],
                currentTurn: this.gameType === 'dots' ? 'P1' : 'X',
                status: 'playing',
                config: data.config
              }
            });

            this.emitEvent('game-started', {
              message: `Connected with ${data.hostName}! Match started.`,
              gameType: this.gameType
            });
            break;

          case 'join-request':
            const oppSymbol = this.gameType === 'dots' ? 'P2' : 'O';
            this.emitEvent('game-started', {
              message: `${data.playerName} joined! Match started.`,
              gameType: this.gameType,
              opponentName: data.playerName,
              opponentSymbol: oppSymbol
            });
            break;

          case 'ttt-move':
            this.emitEvent('move-made', data);
            break;

          case 'dots-move':
            this.emitEvent('dots-move-made', data);
            break;

          case 'rematch-request':
            this.emitEvent('rematch-requested', { playerName: data.playerName });
            break;

          case 'rematch-start':
            this.emitEvent('rematch-start', data);
            break;

          case 'reaction':
            this.emitEvent('new-reaction', data);
            break;

          case 'room-full':
            this.emitEvent('error-message', { message: 'Room is already full.' });
            break;
        }
      });

      this.peerConn.on('close', () => {
        this.emitEvent('player-left', {
          message: 'Opponent disconnected.'
        });
      });

      this.peerConn.on('error', (err) => {
        this.emitEvent('error-message', { message: `Peer connection error: ${err.message || ''}` });
      });
    }

    sendMove(data) {
      if (this.mode === 'socketio' && this.socket && this.socket.connected) {
        if (this.gameType === 'tictactoe') {
          this.socket.emit('make-move', { index: data.index });
        } else if (this.gameType === 'dots') {
          this.socket.emit('dots-move-line', { lineId: data.lineId });
        }
        return;
      }

      if (this.mode === 'peerjs' && this.peerConn && this.peerConn.open) {
        if (this.gameType === 'tictactoe') {
          this.peerConn.send({ type: 'ttt-move', ...data });
        } else if (this.gameType === 'dots') {
          this.peerConn.send({ type: 'dots-move', ...data });
        }
      }
    }

    sendRematch() {
      if (this.mode === 'socketio' && this.socket && this.socket.connected) {
        this.socket.emit('request-rematch');
        return;
      }

      if (this.mode === 'peerjs' && this.peerConn && this.peerConn.open) {
        this.peerConn.send({ type: 'rematch-request', playerName: this.myName });
        this.emitEvent('rematch-pending');
      }
    }

    sendRematchStart() {
      if (this.mode === 'peerjs' && this.peerConn && this.peerConn.open) {
        this.peerConn.send({
          type: 'rematch-start',
          message: 'Rematch accepted! Starting new round...'
        });
      }
    }

    sendReaction(emoji) {
      if (this.mode === 'socketio' && this.socket && this.socket.connected) {
        this.socket.emit('send-reaction', { emoji });
        return;
      }

      if (this.mode === 'peerjs' && this.peerConn && this.peerConn.open) {
        this.peerConn.send({
          type: 'reaction',
          senderName: this.myName,
          emoji
        });
      }
    }

    getShareableLink(roomCode, gameType) {
      const code = roomCode || this.currentRoom;
      const game = gameType || this.gameType || 'tictactoe';
      if (!code) return '';

      let baseOrigin = window.location.origin;

      // If running on localhost and we know the host computer's local network IP, suggest it!
      if ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') && this.serverIps.length > 0) {
        baseOrigin = `http://${this.serverIps[0]}:${window.location.port || 3000}`;
      }

      return `${baseOrigin}${window.location.pathname}?game=${game}&room=${code}`;
    }

    disconnect() {
      if (this.peerConn) {
        this.peerConn.close();
        this.peerConn = null;
      }
      if (this.peer) {
        this.peer.destroy();
        this.peer = null;
      }
      this.currentRoom = null;
      this.mySymbol = null;
      this.mode = 'idle';
    }
  }

  window.networkManager = new NetworkManager();
})();
