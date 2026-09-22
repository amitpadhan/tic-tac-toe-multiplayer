const { io } = require('socket.io-client');
const assert = require('assert');

const SERVER_URL = 'http://localhost:3000';

async function runTests() {
  console.log('🧪 Starting Multiplayer Connection & Game Tests...\n');

  // ----------------------------------------------------
  // TEST 1: Tic-Tac-Toe Cross-Device Connection with Code
  // ----------------------------------------------------
  console.log('--- TEST 1: Tic-Tac-Toe Device A (Host) & Device B (Guest) ---');
  await new Promise((resolve, reject) => {
    const deviceA = io(SERVER_URL);
    const deviceB = io(SERVER_URL);
    let sharedRoomCode = null;

    deviceA.on('connect', () => {
      console.log('Device A connected. Creating Tic-Tac-Toe room...');
      deviceA.emit('create-room', { playerName: 'DeviceA_Host', gameType: 'tictactoe' });
    });

    deviceA.on('room-created', ({ roomCode, playerSymbol, gameType }) => {
      console.log(`✓ Device A created room: ${roomCode}, Symbol: ${playerSymbol}, Game: ${gameType}`);
      assert.strictEqual(playerSymbol, 'X');
      assert.strictEqual(gameType, 'tictactoe');
      sharedRoomCode = roomCode;

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
        // Device A makes first move
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
        // Step 1: P1 draws h-0-0
        deviceA.emit('dots-move-line', { lineId: 'h-0-0' });
      }
    };

    deviceA.on('game-started', checkGameStarted);
    deviceB.on('game-started', checkGameStarted);

    deviceB.on('dots-move-made', ({ lineId, symbol, nextTurn, gotExtraTurn }) => {
      if (lineId === 'h-0-0') {
        console.log(`✓ Line ${lineId} drawn by ${symbol}. Next turn: ${nextTurn}, Extra turn: ${gotExtraTurn}`);
        assert.strictEqual(symbol, 'P1');
        assert.strictEqual(nextTurn, 'P2');
        assert.strictEqual(gotExtraTurn, false);

        // Step 2: P2 draws v-0-0
        deviceB.emit('dots-move-line', { lineId: 'v-0-0' });
      } else if (lineId === 'v-0-0') {
        console.log(`✓ Line ${lineId} drawn by ${symbol}. Next turn: ${nextTurn}`);
        assert.strictEqual(symbol, 'P2');
        assert.strictEqual(nextTurn, 'P1');

        // Step 3: P1 draws h-1-0
        deviceA.emit('dots-move-line', { lineId: 'h-1-0' });
      } else if (lineId === 'h-1-0') {
        console.log(`✓ Line ${lineId} drawn by ${symbol}. Next turn: ${nextTurn}`);
        assert.strictEqual(symbol, 'P1');
        assert.strictEqual(nextTurn, 'P2');

        // Step 4: P2 draws v-0-1 -> Completes Box b-0-0!
        deviceB.emit('dots-move-line', { lineId: 'v-0-1' });
      } else if (lineId === 'v-0-1') {
        console.log(`✓ Line ${lineId} drawn by ${symbol}. Box completed:`, nextTurn, 'gotExtraTurn:', gotExtraTurn);
        assert.strictEqual(symbol, 'P2');
        assert.strictEqual(gotExtraTurn, true);
        assert.strictEqual(nextTurn, 'P2'); // P2 gets BONUS TURN!
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
  // TEST 3: Invalid Room Code & Error Handling
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

  console.log('🎉 ALL MULTIPLAYER & GAME INTEGRATION TESTS PASSED SUCCESSFULLY!');
}

runTests().then(() => {
  process.exit(0);
}).catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
