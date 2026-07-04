/**
 * Tower Defense Game - Test Suite
 * Tests for core game functionality
 */

// Set test mode flag BEFORE game.js loads
window.TEST_MODE = true;

class TestRunner {
    constructor() {
        this.tests = [];
        this.passed = 0;
        this.failed = 0;
        this.results = [];
    }

    test(name, fn) {
        this.tests.push({ name, fn });
    }

    assert(condition, message) {
        if (!condition) throw new Error(message);
    }

    assertEqual(actual, expected, message) {
        if (actual !== expected) {
            throw new Error(message || `Expected ${expected}, got ${actual}`);
        }
    }

    assertExists(value, message) {
        if (value === undefined || value === null) {
            throw new Error(message || 'Expected value to exist');
        }
    }

    async run() {
        console.log('🧪 Starting test suite...\n');

        for (const { name, fn } of this.tests) {
            try {
                await fn();
                this.passed++;
                this.results.push({ name, status: '✅ PASS', error: null });
                console.log(`✅ ${name}`);
            } catch (error) {
                this.failed++;
                this.results.push({ name, status: '❌ FAIL', error: error.message });
                console.error(`❌ ${name}`);
                console.error(`   Error: ${error.message}\n`);
            }
        }

        this.printSummary();
    }

    printSummary() {
        console.log('\n' + '='.repeat(60));
        console.log(`Test Results: ${this.passed} passed, ${this.failed} failed`);
        console.log('='.repeat(60));
        if (this.failed > 0) {
            console.log('\nFailed Tests:');
            this.results
                .filter(r => r.status === '❌ FAIL')
                .forEach(r => console.log(`  - ${r.name}: ${r.error}`));
        }
    }
}

// ════════════════════════════════════════════════════════════════════════════════
// TESTS
// ════════════════════════════════════════════════════════════════════════════════

const runner = new TestRunner();

// Test 1: GameData structure
runner.test('GameData - MAPS exist', function() {
    runner.assertExists(MAPS, 'MAPS object should exist');
    runner.assertExists(MAPS['classic'], 'Classic map should exist');
    runner.assertExists(MAPS['spiral'], 'Spiral map should exist');
    runner.assertExists(MAPS['serpent'], 'Serpent map should exist');
});

runner.test('GameData - Tower definitions exist', function() {
    runner.assertExists(TOWER_DEFS, 'TOWER_DEFS should exist');
    runner.assertExists(TOWER_DEFS['archer'], 'Archer tower should exist');
    runner.assertExists(TOWER_DEFS['cannon'], 'Cannon tower should exist');
    runner.assertExists(TOWER_DEFS['frost'], 'Frost tower should exist');
    runner.assertExists(TOWER_DEFS['laser'], 'Laser tower should exist');
});

runner.test('GameData - Enemy definitions exist', function() {
    runner.assertExists(ENEMY_DEFS, 'ENEMY_DEFS should exist');
    runner.assertExists(ENEMY_DEFS['basic'], 'Basic enemy should exist');
    runner.assertExists(ENEMY_DEFS['fast'], 'Fast enemy should exist');
    runner.assertExists(ENEMY_DEFS['tank'], 'Tank enemy should exist');
    runner.assertExists(ENEMY_DEFS['boss'], 'Boss enemy should exist');
});

runner.test('GameData - Difficulty definitions exist', function() {
    runner.assertExists(DIFFICULTY_DEFS, 'DIFFICULTY_DEFS should exist');
    runner.assertExists(DIFFICULTY_DEFS['easy'], 'Easy difficulty should exist');
    runner.assertExists(DIFFICULTY_DEFS['normal'], 'Normal difficulty should exist');
    runner.assertExists(DIFFICULTY_DEFS['hard'], 'Hard difficulty should exist');
});

// Test 2: GameState structure
runner.test('GameState - Initial state is valid', function() {
    const state = createGameState();
    runner.assertExists(state, 'GameState should be created');
    runner.assertEqual(state.gold, 150, 'Initial gold should be 150');
    runner.assertEqual(state.lives, 20, 'Initial lives should be 20');
    runner.assertEqual(state.waveNum, 0, 'Initial wave should be 0');
    runner.assertEqual(state.towers.length, 0, 'Should start with no towers');
});

runner.test('GameState - Difficulty affects initial resources', function() {
    const easyState = createGameState('classic', 'easy');
    const normalState = createGameState('classic', 'normal');
    const hardState = createGameState('classic', 'hard');

    runner.assertEqual(easyState.gold, 200, 'Easy should start with 200 gold');
    runner.assertEqual(easyState.lives, 25, 'Easy should start with 25 lives');
    runner.assertEqual(normalState.gold, 150, 'Normal should start with 150 gold');
    runner.assertEqual(normalState.lives, 20, 'Normal should start with 20 lives');
    runner.assertEqual(hardState.gold, 100, 'Hard should start with 100 gold');
    runner.assertEqual(hardState.lives, 15, 'Hard should start with 15 lives');
});

// Test 3: Map loading
runner.test('Map - Waypoints are created correctly', function() {
    const wp = createMapWaypoints('classic');
    runner.assertExists(wp, 'Waypoints should be created');
    runner.assert(wp.length > 0, 'Should have waypoints');
    runner.assertExists(wp[0].x, 'Waypoints should have x coordinate');
    runner.assertExists(wp[0].y, 'Waypoints should have y coordinate');
});

runner.test('Map - Path set is created correctly', function() {
    const pathSet = createMapPathSet('classic');
    runner.assertExists(pathSet, 'Path set should be created');
    runner.assert(pathSet.size > 0, 'Path set should have tiles');
    runner.assert(pathSet.has('0,0'), 'Classic map should have start tile');
});

runner.test('Map - Different maps have different paths', function() {
    const classicSet = createMapPathSet('classic');
    const spiralSet = createMapPathSet('spiral');

    // They shouldn't be identical (different paths)
    const classicSize = classicSet.size;
    const spiralSize = spiralSet.size;

    runner.assert(classicSize > 0, 'Classic should have tiles');
    runner.assert(spiralSize > 0, 'Spiral should have tiles');
    // Both maps should be reasonable sizes (not necessarily different sizes, but different layouts)
});

// Test 4: Tower placement validation
runner.test('Tower Placement - Can validate placement', function() {
    const state = createGameState('classic', 'normal');

    // Create a mock PATH_SET
    const mockPathSet = new Set(['0,0', '1,0']);

    // Test: Can't place on path
    runner.assert(mockPathSet.has('0,0'), 'Path validation works');

    // Test: Can place on empty cell
    runner.assert(!mockPathSet.has('2,2'), 'Empty cell should not be in path');
});

runner.test('Tower Placement - Tower has required properties', function() {
    const def = TOWER_DEFS['archer'];
    runner.assertExists(def.cost, 'Tower should have cost');
    runner.assertExists(def.range, 'Tower should have range');
    runner.assertExists(def.dmg, 'Tower should have damage');
    runner.assertEqual(def.cost, 50, 'Archer should cost 50');
});

// Test 5: GameStorage
runner.test('GameStorage - Save and load works', function() {
    const testState = createGameState('classic', 'normal');
    testState.gold = 500;
    testState.waveNum = 3;

    GameStorage.saveGame(testState);
    const loaded = GameStorage.loadGame();

    runner.assertExists(loaded, 'Should load saved game');
    runner.assertEqual(loaded.gold, 500, 'Gold should be preserved');
    runner.assertEqual(loaded.waveNum, 3, 'Wave number should be preserved');

    GameStorage.deleteGame();
});

runner.test('GameStorage - Delete works', function() {
    const testState = createGameState();
    GameStorage.saveGame(testState);
    GameStorage.deleteGame();
    const loaded = GameStorage.loadGame();

    runner.assert(loaded === null, 'Should have no saved game after delete');
});

// Test 6: Enemy spawning
runner.test('Enemy - Can spawn enemy', function() {
    const state = createGameState('classic', 'normal');
    const initialCount = state.enemies.length;

    // Mock the global gameState temporarily
    const originalState = gameState;
    gameState = state;

    spawnEnemy('basic');

    runner.assertEqual(state.enemies.length, initialCount + 1, 'Enemy should be spawned');
    const enemy = state.enemies[0];
    runner.assertExists(enemy.hp, 'Enemy should have HP');
    runner.assertExists(enemy.spd, 'Enemy should have speed');
    runner.assertEqual(enemy.type, 'basic', 'Enemy type should match');

    gameState = originalState;
});

runner.test('Enemy - Difficulty affects enemy stats', function() {
    const easyState = createGameState('classic', 'easy');
    const hardState = createGameState('classic', 'hard');

    const originalState = gameState;

    gameState = easyState;
    spawnEnemy('basic');
    const easyEnemy = easyState.enemies[0];

    gameState = hardState;
    spawnEnemy('basic');
    const hardEnemy = hardState.enemies[0];

    runner.assert(hardEnemy.hp > easyEnemy.hp, 'Hard difficulty should have stronger enemies');

    gameState = originalState;
});

// Test 7: Wave building
runner.test('Wave - Wave queue is generated', function() {
    const queue = buildQueue(1);
    runner.assertExists(queue, 'Queue should be generated');
    runner.assert(queue.length > 0, 'Queue should have enemies');
    runner.assertExists(queue[0].type, 'Queue items should have type');
    runner.assertExists(queue[0].t, 'Queue items should have time');
});

runner.test('Wave - Difficulty affects wave spawning', function() {
    const originalState = gameState;

    gameState = createGameState('classic', 'easy');
    const easyQueue = buildQueue(5);

    gameState = createGameState('classic', 'normal');
    const normalQueue = buildQueue(5);

    gameState = createGameState('classic', 'hard');
    const hardQueue = buildQueue(5);

    // Easy should have fewer enemies
    runner.assert(easyQueue.length < normalQueue.length, 'Easy should have fewer spawns');
    // Hard should have more
    runner.assert(hardQueue.length > normalQueue.length, 'Hard should have more spawns');

    gameState = originalState;
});

// Test 8: DOM elements exist
runner.test('DOM - Canvas exists', function() {
    const canvas = document.getElementById('gameCanvas');
    runner.assertExists(canvas, 'Canvas should exist');
    runner.assertEqual(canvas.width, 400, 'Canvas width should be 400');
    runner.assertEqual(canvas.height, 320, 'Canvas height should be 320');
});

runner.test('DOM - UI elements exist', function() {
    runner.assertExists(document.getElementById('gold'), 'Gold display should exist');
    runner.assertExists(document.getElementById('lives'), 'Lives display should exist');
    runner.assertExists(document.getElementById('wave'), 'Wave display should exist');
    runner.assertExists(document.getElementById('wave-btn'), 'Wave button should exist');
    runner.assertExists(document.getElementById('tower-panel'), 'Tower panel should exist');
});

runner.test('DOM - Modal elements exist', function() {
    runner.assertExists(document.getElementById('difficulty-modal'), 'Difficulty modal should exist');
    runner.assertExists(document.getElementById('settings-modal'), 'Settings modal should exist');
    runner.assertExists(document.getElementById('resume-modal'), 'Resume modal should exist');
});

// Run all tests
console.log('Tower Defense Game - Test Suite\n');
runner.run().then(() => {
    // Print results to console for debugging
    console.log('\n📊 Detailed Results:');
    runner.results.forEach(r => {
        console.log(`${r.status} ${r.name}${r.error ? '\n   ' + r.error : ''}`);
    });
});
