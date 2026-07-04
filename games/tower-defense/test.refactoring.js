/**
 * Tower Defense - Refactoring Validation Tests
 * Tests that architecture refactoring didn't break game functionality
 */

const fs = require('fs');
const path = require('path');

// Mock canvas context
const mockCanvasContext = {
    fillStyle: '',
    fillRect: () => null,
    clearRect: () => null,
    beginPath: () => null,
    arc: () => null,
    fill: () => null,
    stroke: () => null,
    strokeRect: () => null,
    moveTo: () => null,
    lineTo: () => null,
    drawImage: () => null,
    globalAlpha: 1,
    globalCompositeOperation: '',
    textAlign: '',
    font: '',
    fillText: () => null,
    save: () => null,
    restore: () => null,
    translate: () => null,
    rotate: () => null,
    scale: () => null,
    transform: () => null
};

// Create minimal DOM mock element helper
const mockElement = {
    classList: { add: () => null, remove: () => null, toggle: () => null },
    addEventListener: () => null,
    removeEventListener: () => null,
    textContent: '',
    disabled: false
};

// Create minimal DOM mock
global.document = {
    getElementById: (id) => {
        if (id === 'gameCanvas') {
            return {
                getContext: () => mockCanvasContext,
                width: 400,
                height: 320,
                addEventListener: () => null,
                removeEventListener: () => null
            };
        }
        return { ...mockElement };
    },
    addEventListener: () => null,
    querySelectorAll: () => [],
    querySelector: () => ({ ...mockElement }),
    createElement: () => ({ ...mockElement })
};

// Mock localStorage globally
global.localStorage = {
    setItem: () => null,
    getItem: () => null,
    removeItem: () => null
};

global.window = {
    addEventListener: () => null,
    localStorage: global.localStorage
};

// Mock requestAnimationFrame
global.requestAnimationFrame = (cb) => null;

// Load version.js first and expose globally
const versionModule = require('./version.js');
global.VERSION_INFO = versionModule || (typeof VERSION_INFO !== 'undefined' ? VERSION_INFO : null);

// Now load game.js (this will define all functions and classes)
require('./game.js');

// ════════════════════════════════════════════════════════════════════════════════
// TEST RUNNER
// ════════════════════════════════════════════════════════════════════════════════

class TestRunner {
    constructor() {
        this.tests = [];
        this.passed = 0;
        this.failed = 0;
    }

    test(name, fn) {
        this.tests.push({ name, fn });
    }

    assert(condition, message) {
        if (!condition) throw new Error(message);
    }

    assertEqual(actual, expected, message) {
        if (actual !== expected) {
            throw new Error(`${message || 'Assertion failed'} - Expected ${expected}, got ${actual}`);
        }
    }

    assertGreater(actual, expected, message) {
        if (actual <= expected) {
            throw new Error(`${message || 'Assertion failed'} - Expected ${actual} > ${expected}`);
        }
    }

    async run() {
        console.log('\n🧪 Refactoring Validation Tests\n');

        for (const { name, fn } of this.tests) {
            try {
                await fn();
                this.passed++;
                console.log(`✅ ${name}`);
            } catch (error) {
                this.failed++;
                console.error(`❌ ${name}`);
                console.error(`   Error: ${error.message}\n`);
            }
        }

        this.printSummary();
    }

    printSummary() {
        console.log('\n' + '='.repeat(70));
        console.log(`Test Results: ${this.passed} passed, ${this.failed} failed`);
        console.log('='.repeat(70) + '\n');

        if (this.failed > 0) {
            process.exit(1);
        }
    }
}

const runner = new TestRunner();

// ════════════════════════════════════════════════════════════════════════════════
// MANAGER TESTS
// ════════════════════════════════════════════════════════════════════════════════

runner.test('EnemyManager - Class exists', function() {
    runner.assert(typeof EnemyManager === 'function', 'EnemyManager should be a class');
});

runner.test('EnemyManager - Constructor initializes arrays', function() {
    const mgr = new EnemyManager();
    runner.assertEqual(mgr.enemies.length, 0, 'enemies should be empty');
    runner.assertEqual(mgr.enemyMap.size, 0, 'enemyMap should be empty');
    runner.assertEqual(mgr.spatialGrid.size, 0, 'spatialGrid should be empty');
});

runner.test('EnemyManager - spawn() creates enemy', function() {
    const mgr = new EnemyManager();
    const entityIds = { eid: 0, pid: 0, tid: 0 };
    const enemy = mgr.spawn('basic', entityIds, 'normal', 1);

    runner.assert(enemy, 'spawn should return enemy object');
    runner.assertEqual(enemy.type, 'basic', 'enemy type should be basic');
    runner.assertEqual(mgr.enemies.length, 1, 'enemies array should have 1 item');
    runner.assertEqual(mgr.enemyMap.size, 1, 'enemyMap should have 1 item');
});

runner.test('EnemyManager - getById() returns enemy', function() {
    const mgr = new EnemyManager();
    const entityIds = { eid: 0, pid: 0, tid: 0 };
    const spawned = mgr.spawn('basic', entityIds, 'normal', 1);
    const retrieved = mgr.getById(spawned.id);

    runner.assert(retrieved === spawned, 'getById should return same enemy');
});

runner.test('EnemyManager - getByIdIfAlive() checks state', function() {
    const mgr = new EnemyManager();
    const entityIds = { eid: 0, pid: 0, tid: 0 };
    const enemy = mgr.spawn('basic', entityIds, 'normal', 1);

    let alive = mgr.getByIdIfAlive(enemy.id);
    runner.assert(alive, 'getByIdIfAlive should return enemy when alive');

    enemy.dead = true;
    alive = mgr.getByIdIfAlive(enemy.id);
    runner.assert(!alive, 'getByIdIfAlive should return null when dead');
});

runner.test('TowerManager - Class exists', function() {
    runner.assert(typeof TowerManager === 'function', 'TowerManager should be a class');
});

runner.test('TowerManager - add() creates tower', function() {
    const mgr = new TowerManager();
    const entityIds = { eid: 0, pid: 0, tid: 0 };
    const tower = mgr.add('archer', 2, 3, entityIds);

    runner.assert(tower, 'add should return tower object');
    runner.assertEqual(tower.type, 'archer', 'tower type should be archer');
    runner.assertEqual(mgr.towers.length, 1, 'towers array should have 1 item');
});

runner.test('ProjectileManager - Class exists', function() {
    runner.assert(typeof ProjectileManager === 'function', 'ProjectileManager should be a class');
});

runner.test('ProjectileManager - fire() creates projectile', function() {
    const mgr = new ProjectileManager();
    const entityIds = { eid: 0, pid: 0, tid: 0 };
    const proj = mgr.fire(50, 50, 100, 100, 1, 'archer', entityIds);

    runner.assert(proj, 'fire should return projectile object');
    runner.assertEqual(proj.spd, TOWER_DEFS['archer'].pSpd, 'projectile should have archer speed');
    runner.assertEqual(mgr.projectiles.length, 1, 'projectiles array should have 1 item');
});

runner.test('ParticleManager - Class exists', function() {
    runner.assert(typeof ParticleManager === 'function', 'ParticleManager should be a class');
});

runner.test('ParticleManager - burst() creates particles', function() {
    const mgr = new ParticleManager();
    const particles = mgr.burst(50, 50, '#ff0000', 8, 3);

    runner.assertGreater(particles.length, 0, 'burst should create particles');
    runner.assertEqual(mgr.particles.length, 8, 'particle manager should have 8 particles');
});

// ════════════════════════════════════════════════════════════════════════════════
// GAMESTATE TESTS
// ════════════════════════════════════════════════════════════════════════════════

runner.test('createGameState - Creates with managers', function() {
    const state = createGameState('classic', 'normal');

    runner.assert(state.enemyMgr instanceof EnemyManager, 'should have EnemyManager');
    runner.assert(state.towerMgr instanceof TowerManager, 'should have TowerManager');
    runner.assert(state.projectileMgr instanceof ProjectileManager, 'should have ProjectileManager');
    runner.assert(state.particleMgr instanceof ParticleManager, 'should have ParticleManager');
});

runner.test('createGameState - References point to managers', function() {
    const state = createGameState('classic', 'normal');

    runner.assert(state.enemies === state.enemyMgr.enemies, 'enemies should reference manager');
    runner.assert(state.towers === state.towerMgr.towers, 'towers should reference manager');
    runner.assert(state.projectiles === state.projectileMgr.projectiles, 'projectiles should reference manager');
    runner.assert(state.particles === state.particleMgr.particles, 'particles should reference manager');
});

runner.test('createGameState - Initializes with correct values', function() {
    const state = createGameState('classic', 'normal');

    runner.assertEqual(state.gold, 150, 'normal should start with 150 gold');
    runner.assertEqual(state.lives, 20, 'normal should start with 20 lives');
    runner.assertEqual(state.waveNum, 0, 'should start at wave 0');
});

// ════════════════════════════════════════════════════════════════════════════════
// INTEGRATION TESTS
// ════════════════════════════════════════════════════════════════════════════════

runner.test('spawnEnemy - Uses manager', function() {
    const state = createGameState('classic', 'normal');
    global.gameState = state;
    global.WAYPOINTS = createMapWaypoints('classic');

    spawnEnemy('basic');

    runner.assertEqual(state.enemies.length, 1, 'enemy should be in array');
    runner.assertEqual(state.enemyMap.size, 1, 'enemy should be in map');
    runner.assertGreater(state.enemies[0].id, 0, 'enemy should have valid id');
});

runner.test('Multiple enemies tracked correctly', function() {
    const state = createGameState('classic', 'normal');
    global.gameState = state;
    global.WAYPOINTS = createMapWaypoints('classic');

    for (let i = 0; i < 10; i++) {
        spawnEnemy('basic');
    }

    runner.assertEqual(state.enemies.length, 10, 'should have 10 enemies');
    runner.assertEqual(state.enemyMap.size, 10, 'all should be in map');
});

runner.test('Enemy map lookups are O(1)', function() {
    const state = createGameState('classic', 'normal');
    global.gameState = state;
    global.WAYPOINTS = createMapWaypoints('classic');

    // Spawn 100 enemies
    for (let i = 0; i < 100; i++) {
        spawnEnemy('basic');
    }

    // Time lookups
    const startTime = process.hrtime.bigint();
    for (let i = 1; i <= 100; i++) {
        const e = state.enemyMap.get(i);
        runner.assert(e, `Enemy ${i} should be found`);
    }
    const endTime = process.hrtime.bigint();

    const duration = Number(endTime - startTime) / 1000000; // Convert to ms
    runner.assertGreater(10, duration, `100 lookups should be very fast (${duration.toFixed(3)}ms)`);
});

runner.test('Spatial grid updates', function() {
    const state = createGameState('classic', 'normal');
    global.gameState = state;
    global.WAYPOINTS = createMapWaypoints('classic');

    spawnEnemy('basic');
    state.enemyMgr.updateSpatialGrid();

    runner.assertGreater(state.spatialGrid.size, 0, 'grid should have cells after update');
});

runner.test('getNearbyInRange works', function() {
    const state = createGameState('classic', 'normal');
    global.gameState = state;
    global.WAYPOINTS = createMapWaypoints('classic');

    spawnEnemy('basic');
    state.enemyMgr.updateSpatialGrid();

    const nearby = state.enemyMgr.getNearbyInRange(100, 100, 150);
    runner.assertGreater(nearby.length, 0, 'should find nearby enemies');
});

runner.test('removeDeadAndEscaped works', function() {
    const state = createGameState('classic', 'normal');
    global.gameState = state;
    global.WAYPOINTS = createMapWaypoints('classic');

    spawnEnemy('basic');
    spawnEnemy('basic');

    state.enemies[0].dead = true;
    state.enemyMgr.removeDeadAndEscaped();

    runner.assertEqual(state.enemies.length, 1, 'should remove dead enemy');
    runner.assertEqual(state.enemyMap.size, 1, 'map should be updated');
});

// ════════════════════════════════════════════════════════════════════════════════
// VERSION SYSTEM TESTS
// ════════════════════════════════════════════════════════════════════════════════

runner.test('VERSION_INFO exists', function() {
    runner.assert(typeof VERSION_INFO === 'object', 'VERSION_INFO should exist');
});

runner.test('VERSION_INFO has required fields', function() {
    runner.assert(VERSION_INFO.version, 'should have version');
    runner.assert(VERSION_INFO.gitHash, 'should have gitHash');
    runner.assert(VERSION_INFO.releaseDate, 'should have releaseDate');
});

runner.test('VERSION_INFO version format', function() {
    runner.assert(/^\d+\.\d+\.\d+$/.test(VERSION_INFO.version), 'version should be semantic (X.Y.Z)');
});

runner.test('VERSION_INFO methods work', function() {
    const versionStr = VERSION_INFO.getVersionString();
    runner.assert(versionStr.startsWith('v'), 'getVersionString should start with v');

    const fullStr = VERSION_INFO.getFullInfo();
    runner.assert(fullStr.includes(VERSION_INFO.version), 'getFullInfo should include version');
    runner.assert(fullStr.includes(VERSION_INFO.gitHash), 'getFullInfo should include hash');
});

// ════════════════════════════════════════════════════════════════════════════════
// RUN TESTS
// ════════════════════════════════════════════════════════════════════════════════

runner.run();
