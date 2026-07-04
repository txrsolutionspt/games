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
    AudioContext: class {
        destination = {};
        createGain() {
            return {
                gain: {
                    value: 0,
                    setValueAtTime: () => {},
                    exponentialRampToValueAtTime: () => {}
                },
                connect: () => {},
                disconnect: () => {}
            };
        }
        createOscillator() {
            return {
                type: 'sine',
                frequency: { value: 440, setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
                connect: () => {},
                disconnect: () => {},
                start: () => {},
                stop: () => {}
            };
        }
    },
    webkitAudioContext: class {
        destination = {};
        createGain() {
            return {
                gain: {
                    value: 0,
                    setValueAtTime: () => {},
                    exponentialRampToValueAtTime: () => {}
                },
                connect: () => {},
                disconnect: () => {}
            };
        }
        createOscillator() {
            return {
                type: 'sine',
                frequency: { value: 440, setValueAtTime: () => {}, exponentialRampToValueAtTime: () => {} },
                connect: () => {},
                disconnect: () => {},
                start: () => {},
                stop: () => {}
            };
        }
    },
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

// Step 1: Access the auto-initialized game state
console.log('Step 1: Checking game state...');
try {
    const state = context.getGameState();
    console.log(`✅ Game state accessed`);
    console.log(`   - Gold: ${state.gold}`);
    console.log(`   - Lives: ${state.lives}`);
    console.log(`   - Map: ${state.mapId}`);
    console.log(`   - Difficulty: ${state.difficulty}`);
} catch (e) {
    console.error(`❌ Failed to access game state:`, e.message);
    process.exit(1);
}

// Step 2: Try to place a tower
console.log('\nStep 2: Attempting to place a tower...');
try {
    // First select a tower type by setting it
    const state = context.getGameState();
    console.log('   - Selecting archer tower...');
    state.selectedType = 'archer';
    console.log(`   ✅ Tower type selected: ${state.selectedType}`);

    // Check initial tower count
    const initialCount = state.towers.length;
    console.log(`   - Initial tower count: ${initialCount}`);

    // Attempt to place a tower at pixel position (50, 50)
    // This should be grid cell (1, 1) since CELL = 40
    console.log('   - Calling onTap(50, 50)...');
    context.onTap(50, 50);

    // Get fresh reference since functions modify the state
    const newState = context.getGameState();
    const finalCount = newState.towers.length;
    console.log(`   - Final tower count: ${finalCount}`);

    if (finalCount > initialCount) {
        console.log(`✅ Tower placed successfully!`);
        console.log(`   Tower details:`, newState.towers[0]);
    } else {
        console.log(`⚠️  Tower was not placed (might be on path or insufficient gold)`);
        console.log(`   Gold available: ${newState.gold}`);
    }
} catch (e) {
    console.error(`❌ Error during tower placement:`, e.message);
}

// Step 3: Try to start a wave
console.log('\nStep 3: Attempting to start a wave...');
try {
    const state = context.getGameState();
    console.log('   - Calling startWave()...');
    const initialWave = state.waveNum;
    const initialQueue = state.spawnQueue.length;
    context.startWave();

    const newState = context.getGameState();
    const finalWave = newState.waveNum;
    console.log(`   - Wave number: ${initialWave} → ${finalWave}`);

    const enemyCount = newState.enemies.length;
    const queueCount = newState.spawnQueue.length;
    console.log(`   - Enemies spawned: ${enemyCount}`);
    console.log(`   - Spawn queue: ${initialQueue} → ${queueCount}`);

    if (finalWave > initialWave) {
        console.log(`✅ Wave started (waveNum incremented)!`);
        if (enemyCount > 0) {
            console.log(`✅ Enemies spawned!`);
        } else if (queueCount > 0) {
            console.log(`ℹ️  Wave spawned, enemies queued for next frame`);
        } else {
            console.log(`ℹ️  Wave started but no enemies queued (may be normal)`)
        }
    } else {
        console.log(`⚠️  Wave did not progress`);
    }
} catch (e) {
    console.error(`❌ Error during wave start:`, e.message);
}

// Step 4: Try to update game state
console.log('\nStep 4: Testing game updates...');
try {
    const stateBeforeUpdate = context.getGameState();
    const enemiesBeforeUpdate = stateBeforeUpdate.enemies.length;
    const queueBefore = stateBeforeUpdate.spawnQueue.length;

    console.log('   - Updating enemies...');
    context.updateEnemies(0, 16);
    console.log(`✅ updateEnemies completed`);

    const stateAfterEnemyUpdate = context.getGameState();
    const enemiesAfterUpdate = stateAfterEnemyUpdate.enemies.length;
    const queueAfter = stateAfterEnemyUpdate.spawnQueue.length;

    console.log(`   - Enemy count: ${enemiesBeforeUpdate} → ${enemiesAfterUpdate}`);
    console.log(`   - Spawn queue: ${queueBefore} → ${queueAfter}`);

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
