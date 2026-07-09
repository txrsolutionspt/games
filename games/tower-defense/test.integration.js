/**
 * Tower Defense Game - Integration Tests
 * Performance and optimization validation for Phase 2 optimizations
 * - Enemy ID map (O(1) lookups)
 * - Spatial grid (tower targeting optimization)
 */

window.TEST_MODE = true;

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

// ── Test 8: Enemy Variants (B1 - Phase 3) ──────────────────────────────────────
runner.test('Armored - Takes half damage from hits', function() {
    const state = createGameState('classic', 'normal');
    gameState = state;
    spawnEnemy('armored');
    const e = gameState.enemies[0];
    const hpBefore = e.hp;
    hit(e, 20, 1000, 0);
    runner.assertEqual(hpBefore - e.hp, 10, 'Armored enemy should take half damage');
});

runner.test('Armored - Immune to slow effects', function() {
    const state = createGameState('classic', 'normal');
    gameState = state;
    spawnEnemy('armored');
    const e = gameState.enemies[0];
    hit(e, 5, 1000, 2000);
    runner.assertEqual(e.slowUntil, 0, 'Armored enemy should not be slowed');
});

runner.test('Splitter - Spawns 2 splitlings at death position on kill', function() {
    const state = createGameState('classic', 'normal');
    gameState = state;
    spawnEnemy('splitter');
    const splitter = gameState.enemies[0];
    splitter.x = 111; splitter.y = 77; splitter.wpIdx = 6;
    splitter.hp = 0; splitter.dead = true;

    updateEnemies(1000, 0);

    runner.assertEqual(gameState.enemies.length, 2, 'Splitter should leave 2 splitlings behind');
    gameState.enemies.forEach(child => {
        runner.assertEqual(child.type, 'splitling', 'Children should be splitlings');
        runner.assertEqual(child.x, 111, 'Child should spawn at parent x');
        runner.assertEqual(child.y, 77, 'Child should spawn at parent y');
        runner.assertEqual(child.wpIdx, 6, 'Child should continue from parent wpIdx');
        runner.assert(!child.splitsInto, 'Splitlings should not split again');
    });
});

runner.test('Flying - Moves in a straight line toward the exit, ignoring path waypoints', function() {
    const state = createGameState('classic', 'normal');
    gameState = state;
    spawnEnemy('flying');
    const e = gameState.enemies[0];
    const startX = e.x, startY = e.y;
    const exit = WAYPOINTS[WAYPOINTS.length - 1];

    updateEnemies(1000, 500);

    const expectedSlope = (exit.y - startY) / (exit.x - startX);
    const actualSlope = (e.y - startY) / (e.x - startX);
    runner.assertLess(Math.abs(actualSlope - expectedSlope), 0.01, 'Flying enemy should move in a straight line to the exit');
});

runner.test('Flying - Escapes (costs a life) on reaching the exit like ground enemies', function() {
    const state = createGameState('classic', 'normal');
    gameState = state;
    spawnEnemy('flying');
    const livesBefore = gameState.lives;

    let ts = 1000;
    for (let i = 0; i < 500 && gameState.enemies.length; i++) {
        ts += 16;
        updateEnemies(ts, 16);
    }

    runner.assertEqual(gameState.enemies.length, 0, 'Flying enemy should have left the map');
    runner.assertEqual(gameState.lives, livesBefore - 1, 'Reaching the exit should cost exactly one life');
});

// ── Test 9: Tower Replace ──────────────────────────────────────────────────────
runner.test('Replace - Swaps tower type in place and charges net cost', function() {
    const state = createGameState('classic', 'normal');
    gameState = state;
    gameState.gold = 1000;
    const oldTower = gameState.towerMgr.add('archer', 4, 3, gameState.entityIds);
    const goldBefore = gameState.gold;

    replaceTower(oldTower, 'cannon');

    runner.assertEqual(gameState.towers.length, 1, 'Should still have exactly 1 tower');
    const newTower = gameState.towers[0];
    runner.assertEqual(newTower.type, 'cannon', 'Tower should now be a cannon');
    runner.assertEqual(newTower.level, 1, 'Replacement tower should start at level 1');
    runner.assertEqual(newTower.col, 4, 'Replacement should stay in the same column');
    runner.assertEqual(newTower.row, 3, 'Replacement should stay in the same row');

    const refund = Math.floor(TOWER_DEFS['archer'].cost * 0.6);
    const expectedGold = goldBefore + refund - TOWER_DEFS['cannon'].cost;
    runner.assertEqual(gameState.gold, expectedGold, 'Gold should reflect refund minus new tower cost');
    runner.assertEqual(gameState.selectedTower, newTower, 'New tower should become the selected tower');
});

runner.test('Replace - Blocked when gold is insufficient, leaves original tower intact', function() {
    const state = createGameState('classic', 'normal');
    gameState = state;
    gameState.gold = 10;
    const oldTower = gameState.towerMgr.add('archer', 4, 3, gameState.entityIds);

    replaceTower(oldTower, 'laser');

    runner.assertEqual(gameState.towers.length, 1, 'Should still have exactly 1 tower');
    runner.assertEqual(gameState.towers[0].type, 'archer', 'Original tower should be unchanged');
    runner.assertEqual(gameState.gold, 10, 'Gold should be untouched on a blocked replace');
});

runner.test('Replace - Downgrading to a cheaper tower refunds the difference', function() {
    const state = createGameState('classic', 'normal');
    gameState = state;
    gameState.gold = 1000;
    const oldTower = gameState.towerMgr.add('laser', 5, 3, gameState.entityIds);

    replaceTower(oldTower, 'archer');

    const refund = Math.floor(TOWER_DEFS['laser'].cost * 0.6);
    const expectedGold = 1000 + refund - TOWER_DEFS['archer'].cost;
    runner.assertEqual(gameState.gold, expectedGold, 'Downgrading should net a gold gain when refund exceeds new cost');
    runner.assertEqual(gameState.towers[0].type, 'archer', 'Tower should now be an archer');
});

// ── Test 10: Resume Game Timestamp Re-baselining ───────────────────────────────
// performance.now() resets to ~0 on every page load, but a saved game's
// timing fields (lastFired, slowUntil, waveStartTime) are absolute values
// from the previous session's clock. Regression coverage for the bug where,
// after resuming, towers appeared as a solid white flash and never fired
// because those comparisons stayed "in the future" relative to the new clock.
runner.test('Resume - Re-baselines stale timestamps relative to the new clock', function() {
    const saved = createGameState('classic', 'normal');
    const staleNow = performance.now() + 50000;
    saved.lastTimestamp = staleNow;
    saved.waveStartTime = staleNow - 5000;
    const tower = saved.towerMgr.add('archer', 4, 3, saved.entityIds);
    tower.lastFired = staleNow - 10000;
    const enemy = saved.enemyMgr.spawn('basic', saved.entityIds, 'normal', 1);
    enemy.slowUntil = staleNow - 1000;

    resumeGame(saved);

    const freshNow = performance.now();
    runner.assert(Math.abs(gameState.lastTimestamp - freshNow) < 200, 'lastTimestamp should be re-baselined to the current clock');
    runner.assert(gameState.towers[0].lastFired < gameState.lastTimestamp, 'Tower cooldown should read as already elapsed after resume, not in the future');
    runner.assert(gameState.enemies[0].slowUntil < gameState.lastTimestamp, 'Expired slow effect should stay expired after resume');
    runner.assert(gameState.waveStartTime < gameState.lastTimestamp, 'Wave start time should be re-baselined too');
});

runner.test('Resume - Tower fires at an in-range enemy immediately after resuming', function() {
    const saved = createGameState('classic', 'normal');
    const staleNow = performance.now() + 60000;
    saved.lastTimestamp = staleNow;
    const tower = saved.towerMgr.add('archer', 4, 3, saved.entityIds);
    tower.lastFired = staleNow - 60000; // long idle before "saving" -- cooldown should read as elapsed
    const enemy = saved.enemyMgr.spawn('basic', saved.entityIds, 'normal', 1);
    enemy.x = tower.x; enemy.y = tower.y; // guaranteed in range

    resumeGame(saved);
    gameState.enemyMgr.updateSpatialGrid();

    const projectilesBefore = gameState.projectiles.length;
    updateTowers(performance.now());
    runner.assertEqual(gameState.projectiles.length, projectilesBefore + 1, 'Tower should fire at the in-range enemy right after resume, not stay stuck on a stale cooldown');
});

// ── Test 11: New Maps (Lava, Winter, Jungle) ───────────────────────────────────
// Broad candidate spread of grid cells; each map's PATH_SET filters out
// whichever of these happen to fall on its own path, so one list can cover
// every map without needing per-map tower placements.
const NEW_MAP_TOWER_CANDIDATES = [
    [1,1],[3,1],[6,1],[8,1],
    [2,3],[7,3],
    [1,5],[3,5],[5,5],[8,4],
    [2,6],[6,6],[1,6],
];

function testNewMap(mapId) {
    runner.test(`${mapId} map - Path is contiguous, in-bounds, and self-consistent`, function() {
        const pathTiles = MAPS[mapId].pathTiles;
        runner.assert(pathTiles.length > 0, `${mapId} map should have path tiles`);

        const seen = new Set();
        pathTiles.forEach(([c, r], i) => {
            runner.assert(c >= 0 && c < COLS && r >= 0 && r < ROWS, `Tile [${c},${r}] should be within the grid`);
            const key = `${c},${r}`;
            runner.assert(!seen.has(key), `Tile [${c},${r}] should not repeat (no self-intersection)`);
            seen.add(key);
            if (i > 0) {
                const [pc, pr] = pathTiles[i - 1];
                const dist = Math.abs(c - pc) + Math.abs(r - pr);
                runner.assertEqual(dist, 1, `Tile ${i} should be adjacent to the previous tile`);
            }
        });

        runner.assertEqual(pathTiles[0][1], 0, 'Path should start at row 0 to align with the entry waypoint');
        runner.assertEqual(pathTiles[pathTiles.length - 1][1], ROWS - 1, 'Path should end at the last row to align with the exit waypoint');
    });

    runner.test(`${mapId} map - Full wave completes with towers placed`, function() {
        const state = createGameState(mapId, 'normal');
        gameState = state;
        PATH_SET = createMapPathSet(mapId);
        WAYPOINTS = createMapWaypoints(mapId);
        gameState.gold = 5000;

        NEW_MAP_TOWER_CANDIDATES.forEach(([c, r]) => {
            if (!PATH_SET.has(`${c},${r}`)) {
                gameState.towerMgr.add('laser', c, r, gameState.entityIds);
            }
        });

        startWave();
        let ts = performance.now();
        let iters = 3000;
        while (gameState.waveActive && iters-- > 0) {
            ts += 16;
            loop(ts);
        }

        runner.assert(iters > 0, 'Wave should complete without hanging');
        runner.assertEqual(gameState.enemies.length, 0, 'All enemies should be cleared by wave end');
        runner.assertEqual(gameState.lives, 20, 'No enemies should have escaped with towers covering the path');

        // Restore the default map's globals so any tests added after this one
        // (or a re-run) aren't affected by this test having switched maps.
        PATH_SET = createMapPathSet('classic');
        WAYPOINTS = createMapWaypoints('classic');
    });
}

['lava', 'winter', 'jungle'].forEach(testNewMap);

// ════════════════════════════════════════════════════════════════════════════════

// Auto-run if in browser
if (typeof window !== 'undefined' && document.currentScript) {
    window.addEventListener('load', () => {
        setTimeout(() => runner.run(), 100);
    });
}
