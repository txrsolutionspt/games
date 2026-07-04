#!/usr/bin/env node

/**
 * Tower Defense Game - Simple Unit Tests
 * Run with: node test.simple.js
 */

const fs = require('fs');
const path = require('path');

// Simple test framework
let testCount = 0, passCount = 0, failCount = 0;
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
        console.error(`❌ ${name}: ${error.message}`);
    }
}

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function assertEqual(a, b, message) {
    if (a !== b) throw new Error(message || `Expected ${b}, got ${a}`);
}

function assertExists(val, message) {
    if (val === undefined || val === null) throw new Error(message);
}

function assertArrayIncludesAll(arr, items, message) {
    items.forEach(item => {
        if (!arr.includes(item)) throw new Error(message || `Array does not include ${item}`);
    });
}

console.log('🧪 Tower Defense Game - Unit Tests\n');
console.log('════════════════════════════════════════════════════════════════\n');

// ════════════════════════════════════════════════════════════════════════════════
// Extract and test game data from game.js
// ════════════════════════════════════════════════════════════════════════════════

const gameCode = fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8');

// Extract game data using regex
const mapsMatch = gameCode.match(/const MAPS = \{([\s\S]*?)\n\};/);
const towerMatch = gameCode.match(/const TOWER_DEFS = \{([\s\S]*?)\n\};/);
const enemyMatch = gameCode.match(/const ENEMY_DEFS = \{([\s\S]*?)\n\};/);
const diffMatch = gameCode.match(/const DIFFICULTY_DEFS = \{([\s\S]*?)\n\};/);

console.log('Testing Game Data Structures\n');

// Test 1: Maps exist in code
test('MAPS definition found in game.js', () => {
    assertExists(mapsMatch, 'MAPS not found in game.js');
});

// Test 2: Tower definitions exist
test('TOWER_DEFS definition found in game.js', () => {
    assertExists(towerMatch, 'TOWER_DEFS not found in game.js');
});

// Test 3: Enemy definitions exist
test('ENEMY_DEFS definition found in game.js', () => {
    assertExists(enemyMatch, 'ENEMY_DEFS not found in game.js');
});

// Test 4: Difficulty definitions exist
test('DIFFICULTY_DEFS definition found in game.js', () => {
    assertExists(diffMatch, 'DIFFICULTY_DEFS not found in game.js');
});

// ════════════════════════════════════════════════════════════════════════════════
// Test critical functions exist and are defined
// ════════════════════════════════════════════════════════════════════════════════

console.log('\nTesting Critical Functions\n');

const requiredFunctions = [
    'createGameState',
    'createMapWaypoints',
    'createMapPathSet',
    'buildQueue',
    'spawnEnemy',
    'updateEnemies',
    'updateTowers',
    'updateProjectiles',
    'updateParticles',
    'draw',
    'onTap',
    'startWave',
    'newGame',
];

requiredFunctions.forEach(funcName => {
    test(`Function '${funcName}' is defined`, () => {
        const regex = new RegExp(`function ${funcName}\\(`);
        assert(regex.test(gameCode), `Function ${funcName} not found in game.js`);
    });
});

// ════════════════════════════════════════════════════════════════════════════════
// Test code patterns for common issues
// ════════════════════════════════════════════════════════════════════════════════

console.log('\nTesting Code Patterns & Logic\n');

test('GameState is properly initialized', () => {
    assert(gameCode.includes('let gameState = createGameState()'), 'gameState initialization missing');
});

test('PATH_SET is properly initialized', () => {
    assert(gameCode.includes('let PATH_SET = createMapPathSet(gameState.mapId)'), 'PATH_SET initialization missing');
});

test('WAYPOINTS is properly initialized', () => {
    assert(gameCode.includes('let WAYPOINTS = createMapWaypoints(gameState.mapId)'), 'WAYPOINTS initialization missing');
});

test('Tower buttons event listeners are attached', () => {
    assert(gameCode.includes("document.querySelectorAll('.tbtn')"), 'Tower button listeners not found');
});

test('Canvas click event listener exists', () => {
    assert(gameCode.includes("canvas.addEventListener('click'"), 'Canvas click listener not found');
});

test('Wave button event listener exists', () => {
    assert(gameCode.includes("waveBtn.addEventListener('click'"), 'Wave button listener not found');
});

test('onTap function checks gameState.selectedType', () => {
    const onTapSection = gameCode.substring(
        gameCode.indexOf('function onTap(px, py)'),
        gameCode.indexOf('function onTap(px, py)') + 3000
    );
    assert(onTapSection.includes('gameState.selectedType'), 'onTap does not check selectedType');
});

test('onTap function pushes towers to gameState.towers', () => {
    const onTapSection = gameCode.substring(
        gameCode.indexOf('function onTap(px, py)'),
        gameCode.indexOf('function onTap(px, py)') + 3000
    );
    assert(onTapSection.includes('gameState.towers.push'), 'onTap does not push towers to gameState');
});

test('newGame function resets gameState', () => {
    const newGameSection = gameCode.substring(
        gameCode.indexOf('function newGame()'),
        gameCode.indexOf('function newGame()') + 500
    );
    assert(newGameSection.includes('createGameState'), 'newGame does not reset gameState');
});

test('Maps are accessible from MAPS object', () => {
    assert(gameCode.includes("MAPS['classic']"), 'Map access pattern not found');
    assert(gameCode.includes("pathTiles"), 'Map properties not found');
});

test('Game initializes with newGame call', () => {
    assert(gameCode.includes('newGame();'), 'newGame call missing at end of file');
});

test('Game has requestAnimationFrame loop', () => {
    assert(gameCode.includes('requestAnimationFrame(loop)'), 'Animation loop not found');
});

// ════════════════════════════════════════════════════════════════════════════════
// Test index.html for required elements
// ════════════════════════════════════════════════════════════════════════════════

console.log('\nTesting HTML Structure\n');

const htmlCode = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

const requiredElements = [
    { id: 'gameCanvas', desc: 'Canvas element' },
    { id: 'wave-btn', desc: 'Wave button' },
    { id: 'gold', desc: 'Gold display' },
    { id: 'lives', desc: 'Lives display' },
    { id: 'wave', desc: 'Wave display' },
    { id: 'tower-panel', desc: 'Tower panel' },
];

requiredElements.forEach(({ id, desc }) => {
    test(`HTML has '${desc}' (id='${id}')`, () => {
        assert(htmlCode.includes(`id="${id}"`), `Element ${id} not found in index.html`);
    });
});

test('HTML links game.js script', () => {
    assert(htmlCode.includes('src="game.js"'), 'game.js script not linked');
});

test('HTML has tower buttons with data-type attributes', () => {
    assert(htmlCode.includes('data-type="archer"'), 'Archer button not found');
    assert(htmlCode.includes('data-type="cannon"'), 'Cannon button not found');
    assert(htmlCode.includes('data-type="frost"'), 'Frost button not found');
    assert(htmlCode.includes('data-type="laser"'), 'Laser button not found');
});

test('Script is loaded at bottom of body (for DOM ready)', () => {
    const scriptPos = htmlCode.indexOf('src="game.js"');
    const bodyEnd = htmlCode.indexOf('</body>');
    assert(scriptPos > htmlCode.indexOf('<body>') && scriptPos < bodyEnd, 'Script should be at bottom of body');
});

// ════════════════════════════════════════════════════════════════════════════════
// Test CSS for required styles
// ════════════════════════════════════════════════════════════════════════════════

console.log('\nTesting CSS Styles\n');

const cssCode = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8');

test('CSS has canvas styles', () => {
    assert(cssCode.includes('#gameCanvas') || cssCode.includes('canvas'), 'Canvas styles not found');
});

test('CSS has tower panel styles', () => {
    assert(cssCode.includes('#tower-panel') || cssCode.includes('.tbtn'), 'Tower panel styles not found');
});

test('CSS has HUD styles', () => {
    assert(cssCode.includes('#hud'), 'HUD styles not found');
});

// ════════════════════════════════════════════════════════════════════════════════
// RESULTS
// ════════════════════════════════════════════════════════════════════════════════

console.log('\n════════════════════════════════════════════════════════════════');
console.log(`TEST RESULTS: ${passCount}/${testCount} passed`);
console.log('════════════════════════════════════════════════════════════════\n');

if (failCount > 0) {
    console.log(`❌ ${failCount} tests FAILED:\n`);
    failures.forEach(f => console.log(`  • ${f.name}`));
    console.log('\n⚠️  Issues to fix:\n');

    // Provide helpful guidance
    if (failures.some(f => f.name.includes('function'))) {
        console.log('  → Some critical functions are missing from game.js');
    }
    if (failures.some(f => f.name.includes('event listener'))) {
        console.log('  → Event listeners are not properly attached');
        console.log('  → This could explain why buttons and canvas clicks don\'t work');
    }
    if (failures.some(f => f.name.includes('selectedType'))) {
        console.log('  → Tower selection logic may not be properly implemented');
    }
    if (failures.some(f => f.name.includes('push towers'))) {
        console.log('  → Tower placement logic is broken');
    }

    process.exit(1);
} else {
    console.log('✅ ALL TESTS PASSED!\n');
    console.log('All code structures and patterns are correct.');
    console.log('Issue is likely in DOM interaction or browser execution.\n');
    process.exit(0);
}
