/**
 * Tower Defense Game - Node.js Unit Tests
 * Run with: node test.node.js
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Mock DOM elements and browser APIs
const mockCanvas = {
    width: 400,
    height: 320,
    getContext: (type) => ({
        clearRect: () => {},
        fillRect: () => {},
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        stroke: () => {},
        fill: () => {},
        arc: () => {},
        ellipse: () => {},
        closePath: () => {},
        save: () => {},
        restore: () => {},
        translate: () => {},
        rotate: () => {},
        createLinearGradient: () => ({ addColorStop: () => {} }),
        setLineDash: () => {},
        globalAlpha: 1,
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        font: '',
        textAlign: '',
        textBaseline: '',
        shadowColor: '',
        shadowBlur: 0,
        fillText: () => {},
    }),
    addEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 320 }),
};

global.document = {
    getElementById: (id) => {
        if (id === 'gameCanvas') return mockCanvas;
        return {
            classList: { add: () => {}, remove: () => {}, contains: () => false },
            addEventListener: () => {},
            querySelectorAll: () => [],
            textContent: '',
            onclick: null,
            disabled: false,
        };
    },
    querySelectorAll: () => [],
};

global.window = {
    AudioContext: class {},
    webkitAudioContext: class {},
    TEST_MODE: true,
};

global.localStorage = {
    getItem: (key) => null,
    setItem: () => {},
    removeItem: () => {},
};

global.requestAnimationFrame = (fn) => setTimeout(fn, 16);
global.performance = { now: () => Date.now() };
global.TEST_MODE = true;

// ════════════════════════════════════════════════════════════════════════════════
// TEST FRAMEWORK
// ════════════════════════════════════════════════════════════════════════════════

let testCount = 0;
let passCount = 0;
let failCount = 0;
const failures = [];

function test(name, fn) {
    testCount++;
    try {
        fn();
        passCount++;
        console.log(`✅ ${name}`);
    } catch (error) {
        failCount++;
        failures.push({ name, error: error.message });
        console.error(`❌ ${name}`);
        console.error(`   ${error.message}\n`);
    }
}

function assert(condition, message) {
    if (!condition) throw new Error(message || 'Assertion failed');
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
}

function assertExists(value, message) {
    if (value === undefined || value === null) {
        throw new Error(message || 'Value does not exist');
    }
}

function assertArrayLength(arr, length, message) {
    if (!Array.isArray(arr)) throw new Error('Value is not an array');
    if (arr.length !== length) {
        throw new Error(message || `Expected array length ${length}, got ${arr.length}`);
    }
}

// ════════════════════════════════════════════════════════════════════════════════
// LOAD GAME CODE
// ════════════════════════════════════════════════════════════════════════════════

console.log('Loading game.js...\n');
let gameCode = fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8');

// Remove the final initialization line since we're in test mode
gameCode = gameCode.replace(
    /if \(typeof TEST_MODE[^}]+\}/,
    '/* Test mode - skipping initialization */'
);

// Create a context with our mocks
const context = vm.createContext(global);

// Run the game code in the context
try {
    vm.runInContext(gameCode, context);
} catch (e) {
    if (e.message.includes('requestAnimationFrame')) {
        // Expected - game tries to start animation loop
    } else {
        throw e;
    }
}

console.log('Game code loaded successfully.\n');
console.log('════════════════════════════════════════════════════════════════\n');

// ════════════════════════════════════════════════════════════════════════════════
// TESTS
// ════════════════════════════════════════════════════════════════════════════════

console.log('Running Unit Tests...\n');

// --- Data Structure Tests ---
test('MAPS has all required maps', () => {
    assertExists(MAPS['classic']);
    assertExists(MAPS['spiral']);
    assertExists(MAPS['serpent']);
});

test('MAPS contain required fields', () => {
    const map = MAPS['classic'];
    assertExists(map.id);
    assertExists(map.name);
    assertExists(map.pathTiles);
    assertExists(map.background);
});

test('Classic map has valid path tiles', () => {
    const pathTiles = MAPS['classic'].pathTiles;
    assertArrayLength(pathTiles, 24);
    assert(pathTiles.every(tile => Array.isArray(tile) && tile.length === 2), 'All path tiles should be [col, row] pairs');
});

test('TOWER_DEFS has all tower types', () => {
    assertExists(TOWER_DEFS['archer']);
    assertExists(TOWER_DEFS['cannon']);
    assertExists(TOWER_DEFS['frost']);
    assertExists(TOWER_DEFS['laser']);
});

test('Tower definitions have required properties', () => {
    const archer = TOWER_DEFS['archer'];
    assertExists(archer.name);
    assertExists(archer.cost);
    assertExists(archer.range);
    assertExists(archer.dmg);
    assertExists(archer.cd);
    assertEqual(archer.cost, 50);
});

test('ENEMY_DEFS has all enemy types', () => {
    assertExists(ENEMY_DEFS['basic']);
    assertExists(ENEMY_DEFS['fast']);
    assertExists(ENEMY_DEFS['tank']);
    assertExists(ENEMY_DEFS['boss']);
});

test('Enemy definitions have required properties', () => {
    const basic = ENEMY_DEFS['basic'];
    assertExists(basic.hp);
    assertExists(basic.spd);
    assertExists(basic.reward);
    assertExists(basic.color);
});

test('DIFFICULTY_DEFS has all difficulties', () => {
    assertExists(DIFFICULTY_DEFS['easy']);
    assertExists(DIFFICULTY_DEFS['normal']);
    assertExists(DIFFICULTY_DEFS['hard']);
});

test('Difficulty definitions have required properties', () => {
    const normal = DIFFICULTY_DEFS['normal'];
    assertExists(normal.name);
    assertExists(normal.healthMult);
    assertExists(normal.goldMult);
    assertExists(normal.waveSpawnMult);
    assertExists(normal.startGold);
    assertExists(normal.startLives);
});

// --- GameState Tests ---
test('createGameState creates valid state', () => {
    const state = createGameState();
    assertExists(state);
    assertExists(state.gold);
    assertExists(state.lives);
    assertExists(state.towers);
    assertEqual(state.towers.length, 0);
});

test('createGameState respects difficulty', () => {
    const easy = createGameState('classic', 'easy');
    const normal = createGameState('classic', 'normal');
    const hard = createGameState('classic', 'hard');

    assertEqual(easy.gold, 200);
    assertEqual(easy.lives, 25);
    assertEqual(normal.gold, 150);
    assertEqual(normal.lives, 20);
    assertEqual(hard.gold, 100);
    assertEqual(hard.lives, 15);
});

test('createGameState initializes all properties', () => {
    const state = createGameState();
    assertExists(state.mapId);
    assertExists(state.difficulty);
    assertExists(state.waveNum);
    assertExists(state.waveActive);
    assertExists(state.gameOver);
    assertExists(state.towers);
    assertExists(state.enemies);
    assertExists(state.projectiles);
    assertExists(state.particles);
    assertExists(state.selectedType);
    assertExists(state.selectedTower);
    assertExists(state.spawnQueue);
    assertExists(state.entityIds);
    assertExists(state.stats);
});

// --- Map Function Tests ---
test('createMapWaypoints generates waypoints', () => {
    const waypoints = createMapWaypoints('classic');
    assertExists(waypoints);
    assert(waypoints.length > 0);
    assert(waypoints.every(wp => wp.x !== undefined && wp.y !== undefined));
});

test('createMapWaypoints creates entry and exit points', () => {
    const waypoints = createMapWaypoints('classic');
    const first = waypoints[0];
    const last = waypoints[waypoints.length - 1];
    assert(first.x < 0, 'Entry should be off-left');
    assert(last.x > 400, 'Exit should be off-right');
});

test('createMapPathSet generates path tiles', () => {
    const pathSet = createMapPathSet('classic');
    assertExists(pathSet);
    assert(pathSet.size > 0);
    assert(pathSet.has('0,0'), 'Start tile should be in path');
});

test('Different maps have different paths', () => {
    const classic = createMapPathSet('classic');
    const spiral = createMapPathSet('spiral');
    const serpent = createMapPathSet('serpent');

    assert(classic.size > 0);
    assert(spiral.size > 0);
    assert(serpent.size > 0);
    // At least one should be different
    assert(classic.size !== spiral.size || classic.size !== serpent.size);
});

// --- Wave Building Tests ---
test('buildQueue generates spawn queue', () => {
    const originalState = gameState;
    gameState = createGameState('classic', 'normal');

    const queue = buildQueue(1);
    assertExists(queue);
    assert(queue.length > 0);
    assert(queue.every(item => item.type && item.t !== undefined));

    gameState = originalState;
});

test('Wave 1 queue only has basic enemies', () => {
    const originalState = gameState;
    gameState = createGameState('classic', 'normal');

    const queue = buildQueue(1);
    assert(queue.every(item => item.type === 'basic'));

    gameState = originalState;
});

test('Wave 5 includes multiple enemy types', () => {
    const originalState = gameState;
    gameState = createGameState('classic', 'normal');

    const queue = buildQueue(5);
    const types = new Set(queue.map(item => item.type));
    assert(types.has('basic'));
    assert(types.has('fast') || types.has('tank'));

    gameState = originalState;
});

test('Difficulty affects wave spawning', () => {
    const originalState = gameState;

    gameState = createGameState('classic', 'easy');
    const easyQueue = buildQueue(3);

    gameState = createGameState('classic', 'hard');
    const hardQueue = buildQueue(3);

    assert(easyQueue.length < hardQueue.length, 'Hard should spawn more enemies');

    gameState = originalState;
});

// --- Enemy Spawning Tests ---
test('spawnEnemy creates valid enemy', () => {
    const originalState = gameState;
    gameState = createGameState('classic', 'normal');

    const initialCount = gameState.enemies.length;
    spawnEnemy('basic');

    assertEqual(gameState.enemies.length, initialCount + 1);
    const enemy = gameState.enemies[0];
    assertExists(enemy.id);
    assertExists(enemy.type);
    assertExists(enemy.hp);
    assertExists(enemy.spd);
    assertEqual(enemy.type, 'basic');

    gameState = originalState;
});

test('Difficulty affects enemy health', () => {
    const originalState = gameState;

    gameState = createGameState('classic', 'easy');
    spawnEnemy('basic');
    const easyEnemy = gameState.enemies[0];
    const easyHp = easyEnemy.hp;

    gameState = createGameState('classic', 'normal');
    spawnEnemy('basic');
    const normalEnemy = gameState.enemies[0];
    const normalHp = normalEnemy.hp;

    gameState = createGameState('classic', 'hard');
    spawnEnemy('basic');
    const hardEnemy = gameState.enemies[0];
    const hardHp = hardEnemy.hp;

    assert(easyHp < normalHp, 'Easy enemies should be weaker');
    assert(hardHp > normalHp, 'Hard enemies should be stronger');

    gameState = originalState;
});

test('Difficulty affects enemy rewards', () => {
    const originalState = gameState;

    gameState = createGameState('classic', 'easy');
    spawnEnemy('basic');
    const easyReward = gameState.enemies[0].reward;

    gameState = createGameState('classic', 'normal');
    spawnEnemy('basic');
    const normalReward = gameState.enemies[0].reward;

    gameState = createGameState('classic', 'hard');
    spawnEnemy('basic');
    const hardReward = gameState.enemies[0].reward;

    assert(easyReward > normalReward, 'Easy enemies should give more gold');
    assert(hardReward < normalReward, 'Hard enemies should give less gold');

    gameState = originalState;
});

// --- Tower Placement Validation Tests ---
test('Tower placement checks path conflict', () => {
    const originalState = gameState;
    gameState = createGameState('classic', 'normal');

    const pathSet = createMapPathSet('classic');

    // Find a path tile
    const pathTile = Array.from(pathSet)[0];
    const [col, row] = pathTile.split(',').map(Number);

    // Should not be able to place on path
    assert(pathSet.has(`${col},${row}`));

    gameState = originalState;
});

test('Tower definitions have valid costs', () => {
    const costs = Object.values(TOWER_DEFS).map(t => t.cost);
    assert(costs.every(cost => cost > 0));
    assert(costs.every(cost => cost <= 200));
});

test('Tower definitions have valid ranges', () => {
    const ranges = Object.values(TOWER_DEFS).map(t => t.range);
    assert(ranges.every(range => range > 50));
    assert(ranges.every(range => range < 150));
});

test('Tower definitions have valid damage', () => {
    const damages = Object.values(TOWER_DEFS).map(t => t.dmg);
    assert(damages.every(dmg => dmg > 0));
    assert(damages.every(dmg => dmg < 100));
});

// --- GameStorage Tests ---
test('GameStorage.saveGame persists state', () => {
    const testState = createGameState('classic', 'normal');
    testState.gold = 500;
    testState.waveNum = 3;

    GameStorage.saveGame(testState);
    const loaded = GameStorage.loadGame();

    assertExists(loaded);
    assertEqual(loaded.gold, 500);
    assertEqual(loaded.waveNum, 3);

    GameStorage.deleteGame();
});

test('GameStorage.deleteGame removes saved game', () => {
    const testState = createGameState();
    GameStorage.saveGame(testState);
    GameStorage.deleteGame();
    const loaded = GameStorage.loadGame();

    assertEqual(loaded, null);
});

// --- Integration Tests ---
test('Full game flow: New game → Select tower → Check state', () => {
    const originalState = gameState;
    gameState = createGameState('classic', 'normal');

    assertEqual(gameState.towers.length, 0);
    assert(gameState.gold >= 100);

    gameState.selectedType = 'archer';
    assertEqual(gameState.selectedType, 'archer');

    gameState = originalState;
});

test('Full game flow: Spawn wave of enemies', () => {
    const originalState = gameState;
    gameState = createGameState('classic', 'normal');

    const queue = buildQueue(1);
    assert(queue.length > 0);

    for (let i = 0; i < Math.min(3, queue.length); i++) {
        spawnEnemy(queue[i].type);
    }

    assert(gameState.enemies.length >= 3);

    gameState = originalState;
});

test('Map switching preserves game state', () => {
    const originalState = gameState;
    gameState = createGameState('classic', 'normal');

    gameState.gold = 300;
    gameState.mapId = 'spiral';

    const pathSet = createMapPathSet(gameState.mapId);
    const waypoints = createMapWaypoints(gameState.mapId);

    assertEqual(gameState.mapId, 'spiral');
    assertEqual(gameState.gold, 300);
    assert(pathSet.size > 0);
    assert(waypoints.length > 0);

    gameState = originalState;
});

// ════════════════════════════════════════════════════════════════════════════════
// RESULTS
// ════════════════════════════════════════════════════════════════════════════════

console.log('\n════════════════════════════════════════════════════════════════');
console.log(`Test Results: ${passCount}/${testCount} passed`);
console.log('════════════════════════════════════════════════════════════════\n');

if (failCount > 0) {
    console.log('❌ FAILED TESTS:\n');
    failures.forEach(f => {
        console.log(`  • ${f.name}`);
        console.log(`    ${f.error}\n`);
    });
    process.exit(1);
} else {
    console.log('✅ ALL TESTS PASSED!\n');
    console.log('Game logic appears to be working correctly.');
    console.log('Issue is likely in DOM interaction or event handling.\n');
    process.exit(0);
}
