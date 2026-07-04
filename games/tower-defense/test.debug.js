#!/usr/bin/env node

/**
 * Debug Test: Complete game.js loading test
 * Run with: node test.debug.js
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('🔧 Tower Defense - Complete Debug Test\n');

// Create complete DOM mock
const mockClassList = {
    add: () => {},
    remove: () => {},
    contains: () => false,
    toggle: () => {},
};

const mockElement = {
    textContent: '',
    innerHTML: '',
    value: '',
    disabled: false,
    onclick: null,
    className: '',
    classList: { ...mockClassList },
    addEventListener: () => {},
    removeEventListener: () => {},
    appendChild: () => {},
    removeChild: () => {},
    querySelector: () => null,
    querySelectorAll: () => [],
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }),
};

const mockCanvas = {
    ...mockElement,
    width: 400,
    height: 320,
    getContext: (type) => ({
        clearRect: () => {},
        fillRect: () => {},
        strokeRect: () => {},
        fillText: () => {},
        strokeText: () => {},
        measureText: () => ({ width: 0 }),
        beginPath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        arc: () => {},
        arcTo: () => {},
        bezierCurveTo: () => {},
        quadraticCurveTo: () => {},
        ellipse: () => {},
        rect: () => {},
        fill: () => {},
        stroke: () => {},
        closePath: () => {},
        save: () => {},
        restore: () => {},
        translate: () => {},
        rotate: () => {},
        scale: () => {},
        transform: () => {},
        setTransform: () => {},
        resetTransform: () => {},
        createLinearGradient: () => ({ addColorStop: () => {} }),
        createRadialGradient: () => ({ addColorStop: () => {} }),
        createPattern: () => {},
        setLineDash: () => {},
        getLineDash: () => [],
        lineDashOffset: 0,
        globalAlpha: 1,
        globalCompositeOperation: 'source-over',
        fillStyle: '',
        strokeStyle: '',
        lineWidth: 1,
        lineCap: 'butt',
        lineJoin: 'miter',
        miterLimit: 10,
        font: '',
        textAlign: 'start',
        textBaseline: 'alphabetic',
        direction: 'ltr',
        shadowColor: 'rgba(0,0,0,0)',
        shadowBlur: 0,
        shadowOffsetX: 0,
        shadowOffsetY: 0,
    }),
};

// Setup global mocks
global.document = {
    getElementById: (id) => {
        const elementMap = {
            'gameCanvas': mockCanvas,
            'gold': { ...mockElement, textContent: '150' },
            'lives': { ...mockElement, textContent: '20' },
            'wave': { ...mockElement, textContent: '0' },
            'wave-btn': { ...mockElement, textContent: 'START WAVE' },
            'info-text': { ...mockElement, textContent: '' },
            'sell-btn': { ...mockElement, textContent: 'Sell' },
            'tower-panel': { ...mockElement },
            'settings-btn': { ...mockElement },
            'hud': { ...mockElement },
            'action-bar': { ...mockElement },
            'container': { ...mockElement },
        };
        return elementMap[id] || { ...mockElement };
    },
    querySelectorAll: (selector) => {
        if (selector === '.tbtn') {
            return [
                { ...mockElement, dataset: { type: 'archer' } },
                { ...mockElement, dataset: { type: 'cannon' } },
                { ...mockElement, dataset: { type: 'frost' } },
                { ...mockElement, dataset: { type: 'laser' } },
            ];
        }
        return [];
    },
    addEventListener: () => {},
};

global.window = {
    AudioContext: class AudioContext { destination = {}; createGain() { return { gain: { value: 0 }, connect: () => {} }; } },
    webkitAudioContext: class AudioContext { destination = {}; createGain() { return { gain: { value: 0 }, connect: () => {} }; } },
};

global.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
};

global.requestAnimationFrame = (fn) => {
    // Return without calling to prevent infinite loop
    return 0;
};

global.cancelAnimationFrame = () => {};
global.performance = { now: () => Date.now() };
global.console = console;

// Load game.js
let gameCode = fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8');

// Modify to skip animation calls
gameCode = gameCode.replace(/newGame\(\);/, '/* [TEST] newGame() skipped */');
gameCode = gameCode.replace(/requestAnimationFrame\(loop\);/, '/* [TEST] Animation loop skipped */');

// Run in VM
const context = vm.createContext(global);

console.log('Executing game.js...\n');

let loadSuccess = false;
let loadError = null;

try {
    vm.runInContext(gameCode, context);
    loadSuccess = true;
    console.log('✅ game.js executed successfully\n');
} catch (error) {
    loadError = error;
    console.log('❌ Error executing game.js:\n');
    console.log(`Error: ${error.message}`);
    console.log(`Stack: ${error.stack.split('\n')[0]}\n`);
}

console.log('════════════════════════════════════════════════════════════════\n');
console.log('Checking Variables...\n');

const checks = [
    { name: 'MAPS', type: 'object', check: () => typeof context.MAPS === 'object' },
    { name: 'TOWER_DEFS', type: 'object', check: () => typeof context.TOWER_DEFS === 'object' },
    { name: 'ENEMY_DEFS', type: 'object', check: () => typeof context.ENEMY_DEFS === 'object' },
    { name: 'DIFFICULTY_DEFS', type: 'object', check: () => typeof context.DIFFICULTY_DEFS === 'object' },
    { name: 'gameState', type: 'object', check: () => typeof context.gameState === 'object' },
    { name: 'PATH_SET', type: 'object', check: () => context.PATH_SET instanceof Set },
    { name: 'WAYPOINTS', type: 'array', check: () => Array.isArray(context.WAYPOINTS) },
    { name: 'createGameState', type: 'function', check: () => typeof context.createGameState === 'function' },
    { name: 'spawnEnemy', type: 'function', check: () => typeof context.spawnEnemy === 'function' },
    { name: 'onTap', type: 'function', check: () => typeof context.onTap === 'function' },
    { name: 'startWave', type: 'function', check: () => typeof context.startWave === 'function' },
    { name: 'GameStorage', type: 'object', check: () => typeof context.GameStorage === 'object' },
];

let passCount = 0;
let failCount = 0;

checks.forEach(check => {
    try {
        if (check.check()) {
            console.log(`✅ ${check.name.padEnd(20)} (${check.type})`);
            passCount++;
        } else {
            console.log(`❌ ${check.name.padEnd(20)} (${check.type}) - FAILED`);
            failCount++;
        }
    } catch (e) {
        console.log(`❌ ${check.name.padEnd(20)} - ERROR: ${e.message}`);
        failCount++;
    }
});

console.log('\n════════════════════════════════════════════════════════════════\n');
console.log(`Results: ${passCount}/${passCount + failCount} checks passed\n`);

if (!loadSuccess) {
    console.log('❌ game.js failed to load. Error details above.\n');
    process.exit(1);
} else if (failCount === 0) {
    console.log('✅ ALL CHECKS PASSED!\n');
    console.log('game.js loads and initializes correctly in Node.js.\n');
    console.log('If the game still doesn\'t work in the browser, the issue is:');
    console.log('  1. Browser environment differences (event handling, timing)');
    console.log('  2. HTML/CSS loading issues');
    console.log('  3. File serving/caching problems\n');
    process.exit(0);
} else {
    console.log(`❌ ${failCount} checks failed.\n`);
    process.exit(1);
}
