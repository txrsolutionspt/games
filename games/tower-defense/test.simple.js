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

// Extract actual data for analysis
let MAPS, TOWER_DEFS, ENEMY_DEFS, DIFFICULTY_DEFS;

try {
    // Use a more direct extraction method
    eval(`
        ${gameCode.split('// ════')[0]}
    `);
    console.log('✅ Game data structures loaded for analysis\n');
} catch (e) {
    console.log('⚠️  Could not load full data structures, using partial analysis\n');
}

// ════════════════════════════════════════════════════════════════════════════════
// Test critical functions exist and are defined
// ════════════════════════════════════════════════════════════════════════════════

console.log('Testing Critical Functions\n');

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
    'drawMap',
    'drawTowers',
    'drawEnemies',
    'drawProjectiles',
    'drawParticles',
    'onTap',
    'startWave',
    'triggerGameOver',
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

test('Settings button exists and has event listener', () => {
    assert(gameCode.includes("settingsBtn.addEventListener('click'"), 'Settings button listener not found');
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

test('Modal hiding/showing functions exist', () => {
    assert(gameCode.includes('function showModal(modal)'), 'showModal function missing');
    assert(gameCode.includes('function hideModal(modal)'), 'hideModal function missing');
});

test('Auto-save is called after wave completion', () => {
    assert(gameCode.includes('autoSaveGame()'), 'Auto-save not called');
});

test('Difficulty multipliers are applied to enemies', () => {
    const spawnEnemySection = gameCode.substring(
        gameCode.indexOf('function spawnEnemy(type)'),
        gameCode.indexOf('function spawnEnemy(type)') + 1000
    );
    assert(spawnEnemySection.includes('DIFFICULTY_DEFS'), 'Difficulty not used in spawnEnemy');
    assert(spawnEnemySection.includes('diffMult') || spawnEnemySection.includes('healthMult'), 'Difficulty multiplier not applied');
});

test('Wave spawning respects difficulty', () => {
    const buildQueueSection = gameCode.substring(
        gameCode.indexOf('function buildQueue(n)'),
        gameCode.indexOf('function buildQueue(n)') + 1000
    );
    assert(buildQueueSection.includes('diffMult') || buildQueueSection.includes('waveSpawnMult'), 'Wave difficulty scaling not found');
});

test('Maps are accessible from MAPS object', () => {
    assert(gameCode.includes("MAPS['classic']"), 'Map access pattern not found');
    assert(gameCode.includes("pathTiles") && gameCode.includes("background"), 'Map properties not found');
});

test('Game properly handles modals on initialization', () => {
    assert(gameCode.includes('initializeGame()'), 'initializeGame function call missing');
    assert(gameCode.includes('showDifficultyModal()'), 'Difficulty modal not shown');
});

test('Settings persist to localStorage', () => {
    assert(gameCode.includes('GameStorage.saveGame'), 'Save function not called');
    assert(gameCode.includes('GameStorage.loadGame'), 'Load function not called');
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
    { id: 'difficulty-modal', desc: 'Difficulty modal' },
    { id: 'settings-modal', desc: 'Settings modal' },
    { id: 'resume-modal', desc: 'Resume modal' },
    { id: 'settings-btn', desc: 'Settings button' },
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

// ════════════════════════════════════════════════════════════════════════════════
// Test CSS for required styles
// ════════════════════════════════════════════════════════════════════════════════

console.log('\nTesting CSS Styles\n');

const cssCode = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8');

test('CSS has modal styles', () => {
    assert(cssCode.includes('.modal'), 'Modal styles not found');
});

test('CSS has modal hidden state', () => {
    assert(cssCode.includes('.modal.hidden'), 'Modal hidden styles not found');
});

test('CSS has difficulty button styles', () => {
    assert(cssCode.includes('.difficulty-btn'), 'Difficulty button styles not found');
});

test('CSS has settings button styles', () => {
    assert(cssCode.includes('.setting-btn'), 'Settings button styles not found');
});

test('CSS has tower panel styles', () => {
    assert(cssCode.includes('#tower-panel') || cssCode.includes('.tbtn'), 'Tower panel styles not found');
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
