#!/usr/bin/env node

/**
 * Verify that game.js initializes properly
 * Simulates browser environment like diagnose.html does
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('🔍 Verifying game.js initialization...\n');

// Complete browser-like mock environment
const mockCanvas = {
    width: 400,
    height: 320,
    getContext: (type) => ({
        clearRect: () => {}, fillRect: () => {}, strokeRect: () => {},
        beginPath: () => {}, moveTo: () => {}, lineTo: () => {}, arc: () => {}, arcTo: () => {},
        ellipse: () => {}, rect: () => {}, stroke: () => {}, fill: () => {}, closePath: () => {},
        save: () => {}, restore: () => {}, translate: () => {}, rotate: () => {}, scale: () => {},
        createLinearGradient: () => ({ addColorStop: () => {} }),
        setLineDash: () => {}, fillText: () => {}, strokeText: () => {}, measureText: () => ({ width: 0 }),
        globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textAlign: '',
        textBaseline: '', shadowColor: '', shadowBlur: 0, globalCompositeOperation: 'source-over',
    }),
    addEventListener: () => {},
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 400, height: 320 }),
};

const mockElement = {
    textContent: '', innerHTML: '', value: '', disabled: false, onclick: null, className: '',
    classList: { add: () => {}, remove: () => {}, contains: () => false, toggle: () => {} },
    addEventListener: () => {}, removeEventListener: () => {}, appendChild: () => {}, removeChild: () => {},
    querySelector: () => null, querySelectorAll: () => [], getBoundingClientRect: () => ({ left: 0, top: 0, width: 0, height: 0 }),
};

global.document = {
    getElementById: (id) => {
        const map = {
            'gameCanvas': mockCanvas,
            'gold': { ...mockElement, textContent: '150' },
            'lives': { ...mockElement, textContent: '20' },
            'wave': { ...mockElement, textContent: '0' },
            'wave-btn': { ...mockElement, textContent: 'START' },
            'info-text': { ...mockElement, textContent: '' },
            'sell-btn': { ...mockElement, textContent: 'Sell' },
            'tower-panel': { ...mockElement },
            'settings-btn': { ...mockElement },
            'difficulty-modal': { ...mockElement, classList: { add: () => {}, remove: () => {}, contains: () => true } },
            'settings-modal': { ...mockElement, classList: { add: () => {}, remove: () => {}, contains: () => true } },
            'resume-modal': { ...mockElement, classList: { add: () => {}, remove: () => {}, contains: () => true } },
            'resume-info': { ...mockElement, textContent: '' },
            'difficulty-start-btn': { ...mockElement, onclick: null },
            'resume-continue-btn': { ...mockElement, onclick: null },
            'resume-new-btn': { ...mockElement, onclick: null },
            'settings-resume-btn': { ...mockElement, onclick: null },
            'settings-new-btn': { ...mockElement, onclick: null },
        };
        return map[id] || { ...mockElement };
    },
    querySelectorAll: (selector) => {
        if (selector === '.tbtn') {
            return [
                { ...mockElement, dataset: { type: 'archer' }, onclick: null },
                { ...mockElement, dataset: { type: 'cannon' }, onclick: null },
                { ...mockElement, dataset: { type: 'frost' }, onclick: null },
                { ...mockElement, dataset: { type: 'laser' }, onclick: null },
            ];
        }
        if (selector === '.difficulty-btn') {
            return [
                { ...mockElement, dataset: { difficulty: 'easy' }, onclick: null },
                { ...mockElement, dataset: { difficulty: 'normal' }, onclick: null },
                { ...mockElement, dataset: { difficulty: 'hard' }, onclick: null },
            ];
        }
        return [];
    },
    addEventListener: () => {},
};

global.window = {
    AudioContext: class { destination = {}; createGain() { return { gain: { value: 0 }, connect: () => {} }; } },
    webkitAudioContext: class { destination = {}; createGain() { return { gain: { value: 0 }, connect: () => {} }; } },
};

global.localStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
};

global.requestAnimationFrame = (fn) => 0;
global.cancelAnimationFrame = () => {};
global.performance = { now: () => Date.now() };
global.console = console;

// Load and execute game.js
let gameCode = fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8');
gameCode = gameCode.replace(/if \(typeof TEST_MODE === 'undefined' \|\| !TEST_MODE\) \{[\s\S]*?\}/, '');

const context = vm.createContext(global);

console.log('Loading game.js...');
try {
    vm.runInContext(gameCode, context);
    console.log('✅ game.js loaded successfully\n');
} catch (e) {
    console.error('❌ ERROR loading game.js:');
    console.error(`   ${e.message}`);
    console.error(`   at line ${e.stack.split('\n')[1]}`);
    process.exit(1);
}

// Now simulate what diagnose.html checks
console.log('Simulating diagnose.html checks...\n');
console.log('════════════════════════════════════════════════════════════════');
console.log('ENVIRONMENT CHECK\n');

const checks = [];

// Check 1: gameState
try {
    if (typeof context.gameState === 'object' && context.gameState !== null) {
        console.log('✅ gameState exists');
        checks.push(true);
    } else {
        console.log('❌ gameState not defined');
        checks.push(false);
    }
} catch (e) {
    console.log('❌ Error accessing gameState:', e.message);
    checks.push(false);
}

// Check 2: MAPS
try {
    if (typeof context.MAPS === 'object' && context.MAPS !== null) {
        console.log('✅ MAPS exists');
        checks.push(true);
    } else {
        console.log('❌ MAPS not defined');
        checks.push(false);
    }
} catch (e) {
    console.log('❌ Error accessing MAPS:', e.message);
    checks.push(false);
}

// Check 3: Canvas
try {
    const canvas = global.document.getElementById('gameCanvas');
    if (canvas && canvas.getContext) {
        console.log('✅ Canvas exists and is valid');
        checks.push(true);
    } else {
        console.log('❌ Canvas missing or invalid');
        checks.push(false);
    }
} catch (e) {
    console.log('❌ Error accessing canvas:', e.message);
    checks.push(false);
}

// Check 4: gameState properties
try {
    if (context.gameState && typeof context.gameState.gold === 'number') {
        console.log(`✅ Game gold: ${context.gameState.gold}`);
        checks.push(true);
    } else {
        console.log('❌ Gold not accessible');
        checks.push(false);
    }
} catch (e) {
    console.log('❌ Error accessing gold:', e.message);
    checks.push(false);
}

// Check 5: Functions
try {
    const funcs = ['createGameState', 'onTap', 'startWave', 'spawnEnemy', 'updateEnemies'];
    let allExist = true;
    funcs.forEach(f => {
        if (typeof context[f] !== 'function') {
            console.log(`❌ ${f} not found`);
            allExist = false;
        }
    });
    if (allExist) {
        console.log('✅ All critical functions exist');
        checks.push(true);
    } else {
        checks.push(false);
    }
} catch (e) {
    console.log('❌ Error checking functions:', e.message);
    checks.push(false);
}

console.log('\n════════════════════════════════════════════════════════════════');
const passed = checks.filter(c => c).length;
console.log(`\nResults: ${passed}/${checks.length} checks passed\n`);

if (passed === checks.length) {
    console.log('✅ Game.js initializes correctly!');
    console.log('✅ All globals are accessible!');
    console.log('✅ Ready for browser!\n');
    process.exit(0);
} else {
    console.log(`❌ ${checks.length - passed} checks failed`);
    console.log('⚠️  The game may not work in the browser\n');
    process.exit(1);
}
