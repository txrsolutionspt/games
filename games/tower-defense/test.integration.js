/**
 * Tower Defense Game - Integration Tests
 * Performance and optimization validation for Phase 2 optimizations
 * - Enemy ID map (O(1) lookups)
 * - Spatial grid (tower targeting optimization)
 */

// Set up mocks for Node.js environment if not already done
if (typeof global !== 'undefined' && !global.document) {
    const mockCanvasContext = {
        fillStyle: '', fillRect: () => null, clearRect: () => null, beginPath: () => null, arc: () => null, fill: () => null,
        stroke: () => null, strokeRect: () => null, moveTo: () => null, lineTo: () => null, drawImage: () => null,
        globalAlpha: 1, globalCompositeOperation: '', textAlign: '', font: '', fillText: () => null,
        save: () => null, restore: () => null, translate: () => null, rotate: () => null, scale: () => null, transform: () => null
    };

    const mockElement = {
        classList: { add: () => null, remove: () => null, toggle: () => null },
        addEventListener: () => null, removeEventListener: () => null, textContent: '', disabled: false
    };

    global.localStorage = { setItem: () => null, getItem: () => null, removeItem: () => null };
    global.document = {
        getElementById: (id) => {
            if (id === 'gameCanvas') return { getContext: () => mockCanvasContext, width: 400, height: 320, addEventListener: () => null, removeEventListener: () => null };
            return { ...mockElement };
        },
        addEventListener: () => null, querySelectorAll: () => [], querySelector: () => ({ ...mockElement }), createElement: () => ({ ...mockElement })
    };
    global.window = { addEventListener: () => null, localStorage: global.localStorage };
    global.requestAnimationFrame = (cb) => null;
    global.performance = { now: () => Date.now() };

    require('./version.js');
    require('./game.js');
}

global.TEST_MODE = true;

class IntegrationTestRunner {
    constructor() {
        this.tests = [];
        this.passed = 0;
        this.failed = 0;
        this.results = [];
        this.benchmarks = [];
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

    assertGreater(actual, expected, message) {
        if (actual <= expected) {
            throw new Error(message || `Expected ${actual} > ${expected}`);
        }
    }

    assertLess(actual, expected, message) {
        if (actual >= expected) {
            throw new Error(message || `Expected ${actual} < ${expected}`);
        }
    }

    benchmark(name, fn) {
        const start = performance.now();
        const result = fn();
        const duration = performance.now() - start;
        this.benchmarks.push({ name, duration, result });
        return { duration, result };
    }

    async run() {
        console.log('🧪 Starting integration test suite...\n');

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
        console.log('\n' + '='.repeat(70));
        console.log(`Integration Test Results: ${this.passed} passed, ${this.failed} failed`);
        console.log('='.repeat(70));

        if (this.benchmarks.length > 0) {
            console.log('\n📊 Performance Benchmarks:');
            console.log('-'.repeat(70));
            this.benchmarks.forEach(b => {
                console.log(`  ${b.name}: ${b.duration.toFixed(2)}ms`);
            });
        }

        if (this.failed > 0) {
            console.log('\nFailed Tests:');
            this.results
                .filter(r => r.status === '❌ FAIL')
                .forEach(r => console.log(`  - ${r.name}: ${r.error}`));
        }
    }
}

// ════════════════════════════════════════════════════════════════════════════════
// INTEGRATION TESTS
// ════════════════════════════════════════════════════════════════════════════════

const runner = new IntegrationTestRunner();

// ── Test 1: Enemy ID Map Optimization ──────────────────────────────────────────
runner.test('Enemy Map - Initialized with empty map', function() {
    const state = createGameState();
    runner.assertExists(state.enemyMap, 'enemyMap should exist');
    runner.assertEqual(state.enemyMap.size, 0, 'enemyMap should be empty initially');
});

runner.test('Enemy Map - Enemies added to map on spawn', function() {
    const state = createGameState();
    gameState = state;
    spawnEnemy('basic');
    runner.assertEqual(gameState.enemyMap.size, 1, 'Should have 1 enemy in map');
    const enemy = gameState.enemyMap.get(1);
    runner.assertExists(enemy, 'Should be able to retrieve enemy by ID');
    runner.assertEqual(enemy.type, 'basic', 'Enemy type should match');
});

runner.test('Enemy Map - Multiple enemies tracked correctly', function() {
    const state = createGameState();
    gameState = state;
    for (let i = 0; i < 10; i++) {
        spawnEnemy('basic');
    }
    runner.assertEqual(gameState.enemyMap.size, 10, 'Should have 10 enemies in map');
    for (let i = 1; i <= 10; i++) {
        const enemy = gameState.enemyMap.get(i);
        runner.assertExists(enemy, `Enemy ${i} should exist in map`);
    }
});

runner.test('Enemy Map - O(1) lookup performance', function() {
    const state = createGameState();
    gameState = state;
    for (let i = 0; i < 100; i++) {
        spawnEnemy('basic');
    }

    const { duration } = runner.benchmark('O(1) lookup 100 enemies', () => {
        for (let i = 1; i <= 100; i++) {
            const e = gameState.enemyMap.get(i);
            if (!e) throw new Error(`Enemy ${i} not found`);
        }
        return true;
    });

    runner.assertLess(duration, 5, 'O(1) lookup should be very fast (<5ms)');
});

// ── Test 2: Spatial Grid Optimization ──────────────────────────────────────────
runner.test('Spatial Grid - Initialized with empty grid', function() {
    const state = createGameState();
    runner.assertExists(state.spatialGrid, 'spatialGrid should exist');
    runner.assertEqual(state.spatialGrid.size, 0, 'spatialGrid should be empty initially');
});

runner.test('Spatial Grid - Grid updated on enemy spawn', function() {
    const state = createGameState();
    gameState = state;
    spawnEnemy('basic');
    updateSpatialGrid();
    runner.assert(gameState.spatialGrid.size > 0, 'Grid should have cells');
});

runner.test('Spatial Grid - Enemies in correct cells', function() {
    const state = createGameState();
    gameState = state;
    spawnEnemy('basic');
    const enemy = gameState.enemies[0];
    const cell = getGridCell(enemy.x, enemy.y);
    updateSpatialGrid();
    runner.assert(gameState.spatialGrid.has(cell), 'Enemy should be in its cell');
    const cellEnemies = gameState.spatialGrid.get(cell);
    runner.assertEqual(cellEnemies.length, 1, 'Cell should contain the enemy');
});

runner.test('Spatial Grid - getNearbyGridCells returns cells within range', function() {
    const cells = getNearbyGridCells(100, 100, 80);
    runner.assertExists(cells, 'Should return a set of cells');
    runner.assert(cells.size > 0, 'Should return at least one cell');
    runner.assert(cells.has('2,2'), 'Should include center cell');
});

runner.test('Spatial Grid - Grid cells stay within bounds', function() {
    const cells = getNearbyGridCells(50, 50, 150);
    cells.forEach(cellId => {
        const [col, row] = cellId.split(',').map(Number);
        runner.assert(col >= 0 && col < GRID_COLS, `Column ${col} should be in bounds`);
        runner.assert(row >= 0 && row < GRID_ROWS, `Row ${row} should be in bounds`);
    });
});

// ── Test 3: Large Wave Performance ────────────────────────────────────────────
runner.test('Large Wave - Spawn 100+ enemies', function() {
    const state = createGameState('classic', 'normal');
    gameState = state;

    const { duration } = runner.benchmark('Spawn 100 enemies', () => {
        for (let i = 0; i < 100; i++) {
            spawnEnemy('basic');
        }
        return true;
    });

    runner.assertEqual(gameState.enemies.length, 100, 'Should have 100 enemies');
    runner.assertEqual(gameState.enemyMap.size, 100, 'All enemies should be in map');
    runner.assertLess(duration, 50, 'Spawning 100 enemies should be fast (<50ms)');
});

runner.test('Large Wave - Update 100+ enemies', function() {
    const state = createGameState('classic', 'normal');
    gameState = state;
    for (let i = 0; i < 100; i++) {
        spawnEnemy('basic');
    }

    const { duration } = runner.benchmark('Update 100 enemies', () => {
        updateEnemies(0, 16); // 16ms frame
        return true;
    });

    runner.assertLess(duration, 100, 'Updating 100 enemies should be reasonable (<100ms)');
});

runner.test('Large Wave - Update spatial grid for 100 enemies', function() {
    const state = createGameState('classic', 'normal');
    gameState = state;
    for (let i = 0; i < 100; i++) {
        spawnEnemy('basic');
    }

    const { duration } = runner.benchmark('Update spatial grid 100 enemies', () => {
        updateSpatialGrid();
        return true;
    });

    runner.assertLess(duration, 20, 'Grid rebuild should be fast (<20ms)');
    runner.assert(gameState.spatialGrid.size > 0, 'Grid should have populated cells');
});

// ── Test 4: Many Towers Performance ──────────────────────────────────────────
runner.test('Many Towers - Place 30+ towers', function() {
    const state = createGameState('classic', 'normal');
    gameState = state;
    state.gold = 50000; // Enough gold for towers

    const { duration } = runner.benchmark('Place 30 towers', () => {
        for (let i = 0; i < 30; i++) {
            const col = (i % 10);
            const row = Math.floor(i / 10) + 2;
            if (!PATH_SET.has(`${col},${row}`)) {
                gameState.towers.push({
                    id: ++gameState.entityIds.tid,
                    type: 'archer',
                    col, row,
                    x: col * CELL + CELL / 2,
                    y: row * CELL + CELL / 2,
                    lastFired: 0
                });
            }
        }
        return true;
    });

    runner.assertGreater(gameState.towers.length, 20, 'Should have at least 20 towers placed');
    runner.assertLess(duration, 50, 'Placing towers should be fast (<50ms)');
});

runner.test('Many Towers - Target with spatial grid', function() {
    const state = createGameState('classic', 'normal');
    gameState = state;
    state.gold = 50000;

    // Place 30 towers
    for (let i = 0; i < 30; i++) {
        const col = (i % 10);
        const row = Math.floor(i / 10) + 2;
        if (!PATH_SET.has(`${col},${row}`)) {
            gameState.towers.push({
                id: ++gameState.entityIds.tid,
                type: 'archer',
                col, row,
                x: col * CELL + CELL / 2,
                y: row * CELL + CELL / 2,
                lastFired: 0
            });
        }
    }

    // Spawn 100 enemies
    for (let i = 0; i < 100; i++) {
        spawnEnemy('basic');
    }
    updateSpatialGrid();

    const { duration } = runner.benchmark('Target with 30 towers × 100 enemies', () => {
        updateTowers(0);
        return true;
    });

    // Should complete reasonably fast thanks to spatial grid
    runner.assertLess(duration, 100, 'Tower targeting should be fast (<100ms)');
});

runner.test('Many Towers - Targeting correctness', function() {
    const state = createGameState('classic', 'normal');
    gameState = state;

    // Place 1 tower
    gameState.towers.push({
        id: ++gameState.entityIds.tid,
        type: 'archer',
        col: 3, row: 3,
        x: 3 * CELL + CELL / 2,
        y: 3 * CELL + CELL / 2,
        lastFired: 0
    });

    // Spawn enemies at different distances
    spawnEnemy('basic');
    gameState.enemies[0].wpIdx = 5; // Further along path

    spawnEnemy('basic');
    gameState.enemies[1].wpIdx = 3; // Closer to start

    updateSpatialGrid();
    updateTowers(0);

    // Tower should target the one furthest along path
    runner.assertEqual(gameState.projectiles.length, 1, 'Tower should fire one projectile');
    runner.assertEqual(gameState.projectiles[0].targetId, gameState.enemies[0].id, 'Should target furthest enemy');
});

// ── Test 5: Projectile Targeting with Enemy Map ────────────────────────────────
runner.test('Projectile - Target with enemy map', function() {
    const state = createGameState('classic', 'normal');
    gameState = state;

    spawnEnemy('basic');
    const enemy = gameState.enemies[0];

    const projectile = {
        id: ++gameState.entityIds.pid,
        x: 100, y: 100,
        tx: 150, ty: 150,
        targetId: enemy.id,
        spd: 0.3,
        dmg: 10,
        splash: 0,
        slow: 0,
        done: false
    };
    gameState.projectiles.push(projectile);

    const { duration } = runner.benchmark('Update 100 projectiles', () => {
        for (let i = 0; i < 99; i++) {
            gameState.projectiles.push({ ...projectile, id: projectile.id + i });
        }
        updateProjectiles(0, 16);
        return true;
    });

    runner.assertLess(duration, 50, 'Projectile update should be fast (<50ms)');
});

// ── Test 6: Game Loop Full Cycle ──────────────────────────────────────────────
runner.test('Game Loop - Full cycle with 30 towers × 100 enemies', function() {
    const state = createGameState('classic', 'normal');
    gameState = state;
    state.gold = 50000;
    state.waveActive = true;

    // Setup
    for (let i = 0; i < 25; i++) {
        const col = (i % 10);
        const row = Math.floor(i / 10) + 2;
        if (!PATH_SET.has(`${col},${row}`)) {
            gameState.towers.push({
                id: ++gameState.entityIds.tid,
                type: ['archer', 'cannon', 'frost', 'laser'][i % 4],
                col, row,
                x: col * CELL + CELL / 2,
                y: row * CELL + CELL / 2,
                lastFired: 0
            });
        }
    }

    for (let i = 0; i < 100; i++) {
        spawnEnemy('basic');
    }

    const { duration } = runner.benchmark('Full game loop iteration', () => {
        updateEnemies(0, 16);
        updateTowers(0);
        updateProjectiles(0, 16);
        return true;
    });

    runner.assertLess(duration, 200, 'Full game loop should complete in reasonable time (<200ms)');
    runner.assert(gameState.enemies.length <= 100, 'Should have at most original enemies');
});

// ── Test 7: Memory and Data Structure Integrity ────────────────────────────────
runner.test('Data Integrity - Enemy map and array stay in sync', function() {
    const state = createGameState('classic', 'normal');
    gameState = state;

    for (let i = 0; i < 50; i++) {
        spawnEnemy('basic');
    }

    runner.assertEqual(gameState.enemies.length, 50, 'Should have 50 enemies in array');
    runner.assertEqual(gameState.enemyMap.size, 50, 'Should have 50 enemies in map');

    gameState.enemies.forEach(e => {
        const mapped = gameState.enemyMap.get(e.id);
        runner.assertExists(mapped, `Enemy ${e.id} should be in map`);
        runner.assertEqual(mapped.id, e.id, 'Mapped enemy should match array enemy');
    });
});

runner.test('Data Integrity - Spatial grid matches enemies', function() {
    const state = createGameState('classic', 'normal');
    gameState = state;

    for (let i = 0; i < 50; i++) {
        spawnEnemy('basic');
    }
    updateSpatialGrid();

    let gridCount = 0;
    gameState.spatialGrid.forEach(enemies => {
        gridCount += enemies.length;
    });

    runner.assertEqual(gridCount, 50, 'Grid should contain all 50 enemies');
});

// ════════════════════════════════════════════════════════════════════════════════

// Auto-run if in browser
if (typeof document !== 'undefined' && document.currentScript) {
    window.addEventListener('load', () => {
        setTimeout(() => runner.run(), 100);
    });
} else if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
    // Auto-run if in Node.js
    runner.run().catch(err => {
        console.error('Test runner error:', err);
        process.exit(1);
    });
}
