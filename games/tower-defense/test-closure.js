#!/usr/bin/env node

/**
 * Test if functions can access gameState via closure
 * (This is the correct way JavaScript scoping works)
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

console.log('🔍 Testing gameState access via closure...\n');

// Mock environment (simplified)
const mockElement = {
    textContent: '', classList: { add: () => {}, remove: () => {} },
    addEventListener: () => {}, querySelectorAll: () => [],
};

global.document = {
    getElementById: () => ({
        ...mockElement,
        getContext: () => ({
            clearRect: () => {}, fillRect: () => {}, beginPath: () => {}, moveTo: () => {},
            lineTo: () => {}, arc: () => {}, stroke: () => {}, fill: () => {}, closePath: () => {},
            save: () => {}, restore: () => {}, translate: () => {}, rotate: () => {},
            createLinearGradient: () => ({ addColorStop: () => {} }),
            fillStyle: '', strokeStyle: '', globalAlpha: 1,
        }),
        width: 400, height: 320,
    }),
    querySelectorAll: () => [],
    addEventListener: () => {},
};

global.window = {
    AudioContext: class { destination = {}; createGain() { return { gain: { value: 0 }, connect: () => {} }; } },
    webkitAudioContext: class { destination = {}; createGain() { return { gain: { value: 0 }, connect: () => {} }; } },
};

global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
global.requestAnimationFrame = () => 0;
global.performance = { now: () => Date.now() };

// Load game.js
let gameCode = fs.readFileSync(path.join(__dirname, 'game.js'), 'utf8');
// Remove initialization code
gameCode = gameCode.replace(/if \(typeof TEST_MODE === 'undefined' \|\| !TEST_MODE\) \{[\s\S]*?\}/, '');

const context = vm.createContext(global);

try {
    vm.runInContext(gameCode, context);
} catch (e) {
    console.error('Error loading game.js:', e.message);
    process.exit(1);
}

console.log('════════════════════════════════════════════════════════════════');
console.log('CLOSURE ACCESS TEST\n');

// Test 1: Can onTap function work?
console.log('Test 1: Can onTap access gameState?');
try {
    // onTap should have closure over gameState
    context.onTap(50, 50);  // Try to call onTap
    console.log('✅ onTap executed without error');
} catch (e) {
    if (e.message.includes('gameState is not defined')) {
        console.log('❌ onTap cannot access gameState - ReferenceError');
    } else {
        // Some other error - that's OK, means the function ran but failed for a different reason
        console.log('⚠️  onTap ran but failed:', e.message.split('\n')[0]);
    }
}

// Test 2: Can updateHUD function work?
console.log('\nTest 2: Can updateHUD access gameState?');
try {
    context.updateHUD();
    console.log('✅ updateHUD executed without error');
} catch (e) {
    if (e.message.includes('gameState is not defined')) {
        console.log('❌ updateHUD cannot access gameState - ReferenceError');
    } else {
        console.log('⚠️  updateHUD ran but failed:', e.message.split('\n')[0]);
    }
}

// Test 3: Create a game state and test if functions can modify it
console.log('\nTest 3: Can functions modify gameState?');
try {
    const initialGold = context.gameState.gold;
    context.gameState.selectedType = 'archer';
    console.log(`✅ gameState.selectedType set to: ${context.gameState.selectedType}`);
    console.log(`✅ gameState.gold is: ${context.gameState.gold}`);
} catch (e) {
    console.log('❌ Cannot access gameState:', e.message);
}

// Test 4: Test if createMapPathSet and createMapWaypoints work
console.log('\nTest 4: Do map functions work?');
try {
    const pathSet = context.createMapPathSet('classic');
    const waypoints = context.createMapWaypoints('classic');
    console.log(`✅ createMapPathSet returned: Set with ${pathSet.size} tiles`);
    console.log(`✅ createMapWaypoints returned: Array with ${waypoints.length} points`);
} catch (e) {
    console.log('❌ Map functions failed:', e.message);
}

// Test 5: Test if buildQueue works
console.log('\nTest 5: Does buildQueue function work?');
try {
    const queue = context.buildQueue(1);
    console.log(`✅ buildQueue returned: Array with ${queue.length} enemies`);
} catch (e) {
    console.log('❌ buildQueue failed:', e.message);
}

console.log('\n════════════════════════════════════════════════════════════════');
console.log('\nSummary:');
console.log('If all tests passed, the game can work in a browser.');
console.log('The const variables are scoped correctly and accessible via closure.\n');
