/**
 * Tower Defense Game - Node.js Runtime Tests
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
        fillText: () => {},
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        arc: () => {},
        arcTo: () => {},
        ellipse: () => {},
        stroke: () => {},
        fill: () => {},
        closePath: () => {},
        save: () => {},
        restore: () => {},
        translate: () => {},
        rotate: () => {},
        scale: () => {},
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
    }),
    addEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 320 }),
};

const mockDOM = {
    gameCanvas: mockCanvas,
    gold: { textContent: '150' },
    lives: { textContent: '20' },
    wave: { textContent: '0' },
    'wave-btn': { addEventListener: () => {} },
    'info-text': { textContent: '' },
    'sell-btn': { classList: { add: () => {}, remove: () => {}, contains: () => false }, addEventListener: () => {} },
};

global.document = {
    getElementById: (id) => mockDOM[id] || {
        classList: { add: () => {}, remove: () => {}, contains: () => false },
        addEventListener: () => {},
        querySelectorAll: () => [],
        textContent: '',
        onclick: null,
        disabled: false,
    },
    querySelectorAll: (selector) => {
        if (selector === '.tbtn') {
            return [
                { dataset: { type: 'archer' }, classList: { add: () => {}, remove: () => {}, contains: () => false }, addEventListener: () => {} },
                { dataset: { type: 'cannon' }, classList: { add: () => {}, remove: () => {}, contains: () => false }, addEventListener: () => {} },
                { dataset: { type: 'frost' }, classList: { add: () => {}, remove: () => {}, contains: () => false }, addEventListener: () => {} },
                { dataset: { type: 'laser' }, classList: { add: () => {}, remove: () => {}, contains: () => false }, addEventListener: () => {} },
            ];
        }
        return [];
    },
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

// ════════════════════════════════════════════════════════════════════════════════
// LOAD GAME CODE
// ════════════════════════════════════════════════════════════════════════════════

console.log('Loading game.js...\n');
let gameCode = fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8');

// Remove the final initialization and animation loop since we're in test mode
gameCode = gameCode.replace(/newGame\(\);[\s\n]*requestAnimationFrame\(loop\);/, '/* Test mode - skipping initialization */');

// Create a context with our mocks
const context = vm.createContext(global);

// Run the game code in the context
try {
    vm.runInContext(gameCode, context);
    console.log('✅ Game code loaded successfully.\n');
} catch (e) {
    console.error('❌ Failed to load game code:');
    console.error(e.message);
    console.error(e.stack);
    process.exit(1);
}

console.log('════════════════════════════════════════════════════════════════\n');
console.log('Running Unit Tests...\n');

// --- Data Structure Tests ---
test('MAPS object is defined', () => {
    const MAPS = context.MAPS;
    assertExists(MAPS, 'MAPS is not defined');
});

test('MAPS has classic map', () => {
    assertExists(context.MAPS['classic']);
});

test('TOWER_DEFS object is defined', () => {
    assertExists(context.TOWER_DEFS);
});

test('ENEMY_DEFS object is defined', () => {
    assertExists(context.ENEMY_DEFS);
});

test('DIFFICULTY_DEFS object is defined', () => {
    assertExists(context.DIFFICULTY_DEFS);
});

test('createGameState is a function', () => {
    assertEqual(typeof context.createGameState, 'function');
});

test('createGameState creates valid state', () => {
    const state = context.createGameState();
    assertExists(state);
    assertExists(state.gold);
    assertExists(state.lives);
    assertExists(state.towers);
    assert(Array.isArray(state.towers));
});

test('createMapWaypoints is a function', () => {
    assertEqual(typeof context.createMapWaypoints, 'function');
});

test('createMapWaypoints generates waypoints', () => {
    const waypoints = context.createMapWaypoints('classic');
    assertExists(waypoints);
    assert(Array.isArray(waypoints));
    assert(waypoints.length > 0);
});

test('createMapPathSet is a function', () => {
    assertEqual(typeof context.createMapPathSet, 'function');
});

test('createMapPathSet generates path set', () => {
    const pathSet = context.createMapPathSet('classic');
    assertExists(pathSet);
    assert(pathSet instanceof Set);
    assert(pathSet.size > 0);
});

test('spawnEnemy is a function', () => {
    assertEqual(typeof context.spawnEnemy, 'function');
});

test('startWave is a function', () => {
    assertEqual(typeof context.startWave, 'function');
});

test('onTap is a function', () => {
    assertEqual(typeof context.onTap, 'function');
});

test('buildQueue is a function', () => {
    assertEqual(typeof context.buildQueue, 'function');
});

test('buildQueue generates enemies for wave', () => {
    const queue = context.buildQueue(1);
    assert(Array.isArray(queue));
    assert(queue.length > 0);
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
    console.log('Game logic appears to be working correctly in Node.js.');
    console.log('Any issues are likely in browser-specific DOM interaction.\n');
    process.exit(0);
}
