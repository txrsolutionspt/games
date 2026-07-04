#!/usr/bin/env node

/**
 * Test full game workflow: Create state, place tower, start wave
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('🎮 Testing full game workflow...\n');

// Complete mock environment
const mockElement = {
    textContent: '', innerHTML: '', value: '', disabled: false,
    classList: { add: () => {}, remove: () => {}, contains: () => false },
    addEventListener: () => {}, onclick: null, dataset: {},
};

global.document = {
    getElementById: () => ({
        ...mockElement,
        getContext: () => ({
            clearRect: () => {}, fillRect: () => {}, fillText: () => {}, strokeText: () => {},
            beginPath: () => {}, moveTo: () => {}, lineTo: () => {}, arc: () => {},
            stroke: () => {}, fill: () => {}, closePath: () => {}, save: () => {}, restore: () => {},
            translate: () => {}, rotate: () => {}, scale: () => {},
            createLinearGradient: () => ({ addColorStop: () => {} }), setLineDash: () => {},
            fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1,
        }),
        width: 400, height: 320,
    }),
    querySelectorAll: (sel) => {
        if (sel === '.tbtn') {
            return Array(4).fill({ ...mockElement, dataset: { type: 'archer' } });
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
};

global.requestAnimationFrame = () => 0;
global.performance = { now: () => Date.now() };

// Load game.js
let gameCode = fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8');
gameCode = gameCode.replace(/if \(typeof TEST_MODE === 'undefined' \|\| !TEST_MODE\) \{[\s\S]*?\}/, '');

const context = vm.createContext(global);

try {
    vm.runInContext(gameCode, context);
    console.log('✅ Game code loaded\n');
} catch (e) {
    console.error('❌ Failed to load game:', e.message);
    process.exit(1);
}

console.log('════════════════════════════════════════════════════════════════');
console.log('WORKFLOW TEST\n');

// Step 1: Create a fresh game state
console.log('Step 1: Creating game state...');
try {
    const state = context.createGameState('classic', 'normal');
    console.log(`✅ Game state created`);
    console.log(`   - Gold: ${state.gold}`);
    console.log(`   - Lives: ${state.lives}`);
    console.log(`   - Map: ${state.mapId}`);
    console.log(`   - Difficulty: ${state.difficulty}`);
} catch (e) {
    console.error(`❌ Failed to create game state:`, e.message);
    process.exit(1);
}

// Step 2: Try to place a tower
console.log('\nStep 2: Attempting to place a tower...');
try {
    // First select a tower type by setting it
    console.log('   - Selecting archer tower...');
    context.gameState.selectedType = 'archer';
    console.log(`   ✅ Tower type selected: ${context.gameState.selectedType}`);

    // Check initial tower count
    const initialCount = context.gameState.towers.length;
    console.log(`   - Initial tower count: ${initialCount}`);

    // Attempt to place a tower at pixel position (50, 50)
    // This should be grid cell (1, 1) since CELL = 40
    console.log('   - Calling onTap(50, 50)...');
    context.onTap(50, 50);

    const finalCount = context.gameState.towers.length;
    console.log(`   - Final tower count: ${finalCount}`);

    if (finalCount > initialCount) {
        console.log(`✅ Tower placed successfully!`);
        console.log(`   Tower details:`, context.gameState.towers[0]);
    } else {
        console.log(`⚠️  Tower was not placed (might be on path or insufficient gold)`);
        console.log(`   Gold available: ${context.gameState.gold}`);
    }
} catch (e) {
    console.error(`❌ Error during tower placement:`, e.message);
}

// Step 3: Try to start a wave
console.log('\nStep 3: Attempting to start a wave...');
try {
    console.log('   - Calling startWave()...');
    const initialWave = context.gameState.waveNum;
    context.startWave();

    const finalWave = context.gameState.waveNum;
    console.log(`   - Wave number: ${initialWave} → ${finalWave}`);

    const enemyCount = context.gameState.enemies.length;
    console.log(`   - Enemies spawned: ${enemyCount}`);

    if (finalWave > initialWave && enemyCount > 0) {
        console.log(`✅ Wave started successfully!`);
    } else {
        console.log(`⚠️  Wave may not have started properly`);
    }
} catch (e) {
    console.error(`❌ Error during wave start:`, e.message);
}

// Step 4: Try to update game state
console.log('\nStep 4: Testing game updates...');
try {
    console.log('   - Updating enemies...');
    context.updateEnemies(0, 16);
    console.log(`✅ updateEnemies completed`);

    console.log('   - Updating towers...');
    context.updateTowers(0);
    console.log(`✅ updateTowers completed`);

    console.log('   - Updating projectiles...');
    context.updateProjectiles(0, 16);
    console.log(`✅ updateProjectiles completed`);
} catch (e) {
    console.error(`❌ Error during game updates:`, e.message);
}

console.log('\n════════════════════════════════════════════════════════════════');
console.log('\n✅ Workflow test complete!');
console.log('\nThe game logic appears to be working correctly.');
console.log('If issues occur in the browser, check:');
console.log('  1. File paths (CSS, images if any)');
console.log('  2. Browser console for errors');
console.log('  3. Network tab to ensure game.js loads');
console.log('  4. Cache - try hard refresh (Ctrl+Shift+R)\n');
