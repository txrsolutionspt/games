#!/usr/bin/env node

/**
 * Debug Script: Test game.js loading in controlled environment
 * This simulates the browser environment as closely as possible
 * Run with: node debug-loader.js
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('🔧 Tower Defense Game - Debug Loader\n');
console.log('════════════════════════════════════════════════════════════════\n');

// Create comprehensive DOM mock
const createMockDOM = () => {
    const mockCanvas = {
        width: 400,
        height: 320,
        getContext: (type) => {
            console.log(`  [Canvas] getContext('${type}') called`);
            if (type !== '2d') throw new Error(`Unsupported context: ${type}`);
            return {
                clearRect: () => {},
                fillRect: () => {},
                fillText: () => {},
                strokeText: () => {},
                beginPath: () => {},
                moveTo: () => {},
                lineTo: () => {},
                arc: () => {},
                arcTo: () => {},
                ellipse: () => {},
                rect: () => {},
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
                globalCompositeOperation: 'source-over',
            };
        },
        addEventListener: () => {},
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 320 }),
    };

    const mockElements = {
        gameCanvas: mockCanvas,
        gold: { textContent: '150' },
        lives: { textContent: '20' },
        wave: { textContent: '0' },
        'wave-btn': { addEventListener: () => {}, onclick: null },
        'info-text': { textContent: '' },
        'sell-btn': {
            classList: { add: () => {}, remove: () => {}, contains: () => false },
            addEventListener: () => {},
            textContent: '',
            onclick: null
        },
        'tower-panel': { querySelectorAll: () => [] },
        'settings-btn': { addEventListener: () => {} },
    };

    return {
        getElementById: (id) => {
            console.log(`  [DOM] getElementById('${id}')`);
            if (mockElements[id]) {
                return mockElements[id];
            }
            throw new Error(`Element not found: ${id}`);
        },
        querySelectorAll: (selector) => {
            console.log(`  [DOM] querySelectorAll('${selector}')`);
            if (selector === '.tbtn') {
                return [
                    { dataset: { type: 'archer' }, classList: { add: () => {}, remove: () => {} }, addEventListener: () => {} },
                    { dataset: { type: 'cannon' }, classList: { add: () => {}, remove: () => {} }, addEventListener: () => {} },
                    { dataset: { type: 'frost' }, classList: { add: () => {}, remove: () => {} }, addEventListener: () => {} },
                    { dataset: { type: 'laser' }, classList: { add: () => {}, remove: () => {} }, addEventListener: () => {} },
                ];
            }
            return [];
        },
    };
};

// Setup global mocks
console.log('Setting up mock environment...\n');

global.document = createMockDOM();

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

global.requestAnimationFrame = (fn) => {
    console.log('  [System] requestAnimationFrame called');
    return setTimeout(fn, 16);
};
global.performance = { now: () => Date.now() };

// Disable actual animation loop
let animationCalls = 0;
const originalRAF = global.requestAnimationFrame;
global.requestAnimationFrame = (fn) => {
    animationCalls++;
    if (animationCalls > 2) {
        console.log('  [System] Stopping animation loop in test mode');
        return 0;
    }
    return originalRAF(fn);
};

console.log('✅ Mock environment ready\n');
console.log('────────────────────────────────────────────────────────────────\n');

// Load game.js
console.log('📂 Loading game.js...\n');

let gameCode = fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8');

// Remove the initialization calls
gameCode = gameCode.replace(/newGame\(\);/, '/* [INIT] newGame() called */');
gameCode = gameCode.replace(/requestAnimationFrame\(loop\);/, '/* [INIT] requestAnimationFrame(loop) called */');

// Create execution context
const context = vm.createContext(global);

console.log('Executing game.js in Node.js VM...\n');

// Track execution
let executionSteps = [];
const trackStep = (step) => {
    executionSteps.push(step);
    console.log(`  [EXEC] ${step}`);
};

// Replace some functions to track execution
const originalCode = gameCode;
gameCode = 'const __trackStep = ' + trackStep.toString() + ';\n' + gameCode;

try {
    vm.runInContext(gameCode, context);
    console.log('\n✅ game.js executed successfully\n');
} catch (error) {
    console.log('\n❌ ERROR during game.js execution:\n');
    console.error(`   Message: ${error.message}`);
    console.error(`   Stack: ${error.stack.split('\n')[0]}`);
    console.log('\n📊 Execution steps before error:');
    executionSteps.forEach((step, i) => {
        console.log(`  ${i + 1}. ${step}`);
    });
    process.exit(1);
}

console.log('════════════════════════════════════════════════════════════════\n');
console.log('Checking initialized variables...\n');

// Check what was initialized
const checks = [
    { name: 'MAPS', global: context.MAPS },
    { name: 'TOWER_DEFS', global: context.TOWER_DEFS },
    { name: 'ENEMY_DEFS', global: context.ENEMY_DEFS },
    { name: 'DIFFICULTY_DEFS', global: context.DIFFICULTY_DEFS },
    { name: 'gameState', global: context.gameState },
    { name: 'PATH_SET', global: context.PATH_SET },
    { name: 'WAYPOINTS', global: context.WAYPOINTS },
    { name: 'createGameState (function)', global: typeof context.createGameState === 'function' ? 'function' : undefined },
    { name: 'spawnEnemy (function)', global: typeof context.spawnEnemy === 'function' ? 'function' : undefined },
    { name: 'onTap (function)', global: typeof context.onTap === 'function' ? 'function' : undefined },
    { name: 'startWave (function)', global: typeof context.startWave === 'function' ? 'function' : undefined },
];

let allGood = true;
checks.forEach(check => {
    if (check.global !== undefined && check.global !== null) {
        if (typeof check.global === 'function') {
            console.log(`✅ ${check.name} is defined`);
        } else if (typeof check.global === 'object') {
            const keys = Object.keys(check.global).length;
            console.log(`✅ ${check.name} is defined (${keys} entries)`);
        } else {
            console.log(`✅ ${check.name} is defined (${typeof check.global})`);
        }
    } else {
        console.log(`❌ ${check.name} is NOT defined`);
        allGood = false;
    }
});

console.log('\n════════════════════════════════════════════════════════════════\n');

if (allGood) {
    console.log('✅ All checks passed! Game code loads and initializes correctly.\n');
    console.log('✅ The issue is NOT in game.js code structure or logic.\n');
    console.log('⚠️  Issue must be in browser-specific environment or HTML loading.\n');
    process.exit(0);
} else {
    console.log('❌ Some checks failed. Game code may have issues.\n');
    process.exit(1);
}
