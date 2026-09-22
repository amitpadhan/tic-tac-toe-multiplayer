# ⚡ Next-Gen Tic-Tac-Toe Online (Multiplayer)

> A modern, real-time multiplayer Tic-Tac-Toe web game featuring PeerJS WebRTC P2P (for serverless GitHub Pages hosting) + Node.js Socket.IO fallback, unbeatable Minimax AI, procedural sound effects, animated strike-throughs, and a sleek neon cyberpunk glassmorphism UI.

[![Play Live Demo](https://img.shields.io/badge/🎮%20Play%20Live-GitHub%20Pages-00f0ff?style=for-the-badge)](https://amitpadhan.github.io/tic-tac-toe-multiplayer/)

![License](https://img.shields.io/badge/License-MIT-blue.svg)
![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-Active-success.svg)
![Node](https://img.shields.io/badge/Node.js-v18%2B-green.svg)
![Socket.IO](https://img.shields.io/badge/Socket.IO-v4.7.5-black.svg)
![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-brightgreen.svg)

🌐 **Live Demo on GitHub Pages**: [https://amitpadhan.github.io/tic-tac-toe-multiplayer/](https://amitpadhan.github.io/tic-tac-toe-multiplayer/)

---

## 🎮 Game Modes

### 1. 🌐 Real-Time Online Multiplayer
- **Instant Rooms**: Create private rooms with a 6-character code.
- **One-Click Share Link**: Copy the room URL and invite friends directly (`?room=CODE`).
- **Real-Time Sync**: Low-latency moves synced using Socket.IO WebSockets.
- **Spectator Mode**: If more than 2 players join, additional players watch as live spectators!
- **Live Reactions**: Send quick floating emoji reactions (`🔥`, `👏`, `😂`, `😮`, `💀`, `GG`) during matches.
- **Rematch System**: Both players can vote to immediately start a rematch without re-sharing codes.

### 2. 🤖 Solo vs AI (Minimax Algorithm)
- **Easy**: Random casual moves.
- **Medium**: Blocks your winning lines and seizes immediate winning opportunities.
- **Master (Unbeatable)**: Full **Minimax algorithm** with depth scoring and alpha-beta pruning. It is mathematically impossible to beat!
- **Play as X or O**: Choose whether you play first (X) or let the AI make the opening move (O).

### 3. 👥 Local Pass & Play
- Two players on the same computer, tablet, or phone.
- Turn-by-turn indicator with animated score tracker.

---

## ✨ Features

- 🔊 **Zero-Dependency Sound Effects**: Procedurally synthesized retro-modern audio using the browser's native **Web Audio API** (moves, clicks, fanfare on win, tie cadence, reactions). No bulky MP3 downloads required!
- 🎊 **Confetti Cannon**: Interactive Canvas-based particle explosion whenever a player wins.
- ⚡ **Neon Cyberpunk Aesthetic**: Glowing neon cyan & hot pink palette, glassmorphism cards, and animated ambient orbs.
- 🌗 **Theme Switcher**: Switch between **Dark Neon** and **Clean Slate** light theme with one click.
- 📱 **Mobile & Desktop Responsive**: Fluid touch-friendly layout tailored for iPhones, Android devices, tablets, laptops, and ultra-wide screens.
- 🎯 **SVG Winning Strike Line**: Smooth drawing line animation connecting the 3 winning cells.
- 🔄 **Live Scoreboard**: Tracks player X wins, player O wins, and draws across rounds.

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- [npm](https://www.npmjs.com/)

### 1. Clone the repository
```bash
git clone https://github.com/amitpadhan/tic-tac-toe-multiplayer.git
cd tic-tac-toe-multiplayer
```

### 2. Install dependencies
```bash
npm install
```

### 3. Start the application
```bash
npm start
```

Open your browser and navigate to:
```
http://localhost:3000
```

For live reload during development:
```bash
npm run dev
```

---

## 🐳 Run with Docker

You can build and run the game inside a Docker container:

```bash
# Build the Docker image
docker build -t tic-tac-toe-multiplayer .

# Run container on port 3000
docker run -p 3000:3000 tic-tac-toe-multiplayer
```

---

## 📁 Project Architecture

```
tic-tac-toe-multiplayer/
├── Dockerfile                  # Container definition
├── LICENSE                     # MIT License
├── README.md                   # Documentation
├── package.json                # Project manifest and scripts
├── server.js                   # Node.js + Express + Socket.IO server
└── public/                     # Static client files
    ├── index.html              # Semantic HTML5 frontend
    ├── style.css               # Neon Cyberpunk glassmorphism styles
    ├── assets/
    │   └── favicon.svg         # SVG vector app icon
    └── js/
        ├── app.js              # Core game loop, minimax AI & Socket.io client
        ├── confetti.js         # Canvas particle explosion engine
        └── sound.js            # Web Audio API sound synthesizer
```

---

## 🌐 Deploying to Production

This app can be deployed anywhere Node.js is supported:

### Deploy to Render
1. Create a new Web Service on [Render](https://render.com/).
2. Connect your GitHub repository.
3. Set **Build Command** to `npm install`.
4. Set **Start Command** to `npm start`.

### Deploy to Railway
1. Click **New Project** on [Railway](https://railway.app/).
2. Select **Deploy from GitHub repo**.
3. Railway automatically detects Node.js and deploys!

---

## 📄 License

This project is licensed under the [MIT License](LICENSE) &copy; 2026 Amit Padhan.
