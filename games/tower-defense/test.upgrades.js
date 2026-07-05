/**
 * Tower Defense - Tower Upgrade System Tests
 * Tests for Level 1-3 tower upgrades with stat bonuses
 */

const fs = require('fs');
const path = require('path');

// Mock canvas context
const mockCanvasContext = {
    fillStyle: '', fillRect: () => null, clearRect: () => null, beginPath: () => null,
    arc: () => null, fill: () => null, stroke: () => null, strokeRect: () => null,
    moveTo: () => null, lineTo: () => null, drawImage: () => null, globalAlpha: 1,
    globalCompositeOperation: '', textAlign: '', font: '', fillText: () => null,
    save: () => null, restore: () => null, translate: () => null, rotate: () => null,
    scale: () => null, transform: () => null, setLineDash: () => null, lineWidth: 1,
    strokeStyle: '', ellipse: () => null, textBaseline: ''
};

const mockElement = {
    classList: { add: () => null, remove: () => null, toggle: () => null },
    addEventListener: () => null, removeEventListener: () => null, textContent: '', disabled: false,
    onclick: null, dataset: {}, innerHTML: ''
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
        console.log('\n🎯 Tower Upgrade System Tests\n');

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
// TOWER UPGRADE TESTS
// ════════════════════════════════════════════════════════════════════════════════

runner.test('Tower spawns at level 1', function() {
    const state = global.createGameState('classic', 'normal');
    const tower = state.towerMgr.add('archer', 2, 3, state.entityIds);
    runner.assertEqual(tower.level, 1, 'tower should spawn at level 1');
});

runner.test('getTowerStats returns base stats at level 1', function() {
    const state = global.createGameState('classic', 'normal');
    const tower = state.towerMgr.add('archer', 2, 3, state.entityIds);
    const stats = global.getTowerStats(tower);

    const baseDef = global.TOWER_DEFS['archer'];
    runner.assertEqual(stats.dmg, baseDef.dmg, 'damage should match base at level 1');
    runner.assertEqual(stats.range, baseDef.range, 'range should match base at level 1');
    runner.assertEqual(stats.cd, baseDef.cd, 'cooldown should match base at level 1');
});

runner.test('Upgrade cost is 1.5x base for level 2', function() {
    const state = global.createGameState('classic', 'normal');
    const tower = state.towerMgr.add('archer', 2, 3, state.entityIds);
    const baseCost = global.TOWER_DEFS['archer'].cost;
    const expectedCost = Math.ceil(baseCost * 1.5);

    const cost = state.towerMgr.getUpgradeCost(tower);
    runner.assertEqual(cost, expectedCost, `upgrade cost should be ${expectedCost} (1.5x base)`);
});

runner.test('Upgrade cost is 2x base for level 3', function() {
    const state = global.createGameState('classic', 'normal');
    const tower = state.towerMgr.add('archer', 2, 3, state.entityIds);
    state.towerMgr.upgrade(tower);
    const baseCost = global.TOWER_DEFS['archer'].cost;
    const expectedCost = Math.ceil(baseCost * 2.0);

    const cost = state.towerMgr.getUpgradeCost(tower);
    runner.assertEqual(cost, expectedCost, `upgrade cost should be ${expectedCost} (2x base)`);
});

runner.test('canUpgrade returns true for level < 3', function() {
    const state = global.createGameState('classic', 'normal');
    const tower = state.towerMgr.add('archer', 2, 3, state.entityIds);

    runner.assert(state.towerMgr.canUpgrade(tower), 'should be able to upgrade level 1');
    state.towerMgr.upgrade(tower);
    runner.assert(state.towerMgr.canUpgrade(tower), 'should be able to upgrade level 2');
});

runner.test('canUpgrade returns false for level 3', function() {
    const state = global.createGameState('classic', 'normal');
    const tower = state.towerMgr.add('archer', 2, 3, state.entityIds);

    state.towerMgr.upgrade(tower);
    state.towerMgr.upgrade(tower);
    runner.assert(!state.towerMgr.canUpgrade(tower), 'should not be able to upgrade level 3');
});

runner.test('Upgrade increments level', function() {
    const state = global.createGameState('classic', 'normal');
    const tower = state.towerMgr.add('archer', 2, 3, state.entityIds);

    runner.assertEqual(tower.level, 1, 'initial level should be 1');
    state.towerMgr.upgrade(tower);
    runner.assertEqual(tower.level, 2, 'level should be 2 after first upgrade');
    state.towerMgr.upgrade(tower);
    runner.assertEqual(tower.level, 3, 'level should be 3 after second upgrade');
});

runner.test('Level 2 archer has +25% damage', function() {
    const state = global.createGameState('classic', 'normal');
    const tower = state.towerMgr.add('archer', 2, 3, state.entityIds);
    state.towerMgr.upgrade(tower);

    const baseDef = global.TOWER_DEFS['archer'];
    const stats = global.getTowerStats(tower);
    const expectedDmg = Math.round(baseDef.dmg * 1.25);

    runner.assertEqual(stats.dmg, expectedDmg, `damage should be ${expectedDmg} at level 2`);
});

runner.test('Level 3 archer has +50% damage', function() {
    const state = global.createGameState('classic', 'normal');
    const tower = state.towerMgr.add('archer', 2, 3, state.entityIds);
    state.towerMgr.upgrade(tower);
    state.towerMgr.upgrade(tower);

    const baseDef = global.TOWER_DEFS['archer'];
    const stats = global.getTowerStats(tower);
    const expectedDmg = Math.round(baseDef.dmg * 1.5);

    runner.assertEqual(stats.dmg, expectedDmg, `damage should be ${expectedDmg} at level 3`);
});

runner.test('Level 2 archer has +10% range', function() {
    const state = global.createGameState('classic', 'normal');
    const tower = state.towerMgr.add('archer', 2, 3, state.entityIds);
    state.towerMgr.upgrade(tower);

    const baseDef = global.TOWER_DEFS['archer'];
    const stats = global.getTowerStats(tower);
    const expectedRange = Math.round(baseDef.range * 1.1);

    runner.assertEqual(stats.range, expectedRange, `range should be ${expectedRange} at level 2`);
});

runner.test('Level 3 archer has +20% range', function() {
    const state = global.createGameState('classic', 'normal');
    const tower = state.towerMgr.add('archer', 2, 3, state.entityIds);
    state.towerMgr.upgrade(tower);
    state.towerMgr.upgrade(tower);

    const baseDef = global.TOWER_DEFS['archer'];
    const stats = global.getTowerStats(tower);
    const expectedRange = Math.round(baseDef.range * 1.2);

    runner.assertEqual(stats.range, expectedRange, `range should be ${expectedRange} at level 3`);
});

runner.test('Level 2 archer has +20% fire rate (lower CD)', function() {
    const state = global.createGameState('classic', 'normal');
    const tower = state.towerMgr.add('archer', 2, 3, state.entityIds);
    state.towerMgr.upgrade(tower);

    const baseDef = global.TOWER_DEFS['archer'];
    const stats = global.getTowerStats(tower);
    const expectedCd = Math.round(baseDef.cd / 1.2);

    runner.assertEqual(stats.cd, expectedCd, `cooldown should be ${expectedCd} at level 2`);
});

runner.test('Level 3 archer has +40% fire rate (lower CD)', function() {
    const state = global.createGameState('classic', 'normal');
    const tower = state.towerMgr.add('archer', 2, 3, state.entityIds);
    state.towerMgr.upgrade(tower);
    state.towerMgr.upgrade(tower);

    const baseDef = global.TOWER_DEFS['archer'];
    const stats = global.getTowerStats(tower);
    const expectedCd = Math.round(baseDef.cd / 1.4);

    runner.assertEqual(stats.cd, expectedCd, `cooldown should be ${expectedCd} at level 3`);
});

runner.test('All tower types support upgrades', function() {
    const state = global.createGameState('classic', 'normal');
    const types = ['archer', 'cannon', 'frost', 'laser'];

    types.forEach(type => {
        const tower = state.towerMgr.add(type, 2, 3, state.entityIds);
        runner.assert(state.towerMgr.canUpgrade(tower), `${type} should be upgradeable`);
        state.towerMgr.upgrade(tower);
        runner.assertEqual(tower.level, 2, `${type} should be level 2 after upgrade`);
    });
});

runner.test('Tower upgrades persist in save/load', function() {
    const state = global.createGameState('classic', 'normal');
    const tower = state.towerMgr.add('archer', 2, 3, state.entityIds);
    state.towerMgr.upgrade(tower);
    state.towerMgr.upgrade(tower);

    // Simulate save
    const saved = JSON.stringify(state);
    const loaded = JSON.parse(saved);

    runner.assertEqual(loaded.towers[0].level, 3, 'tower level should persist through save/load');
});

runner.test('Upgrading multiple towers independently', function() {
    const state = global.createGameState('classic', 'normal');
    const tower1 = state.towerMgr.add('archer', 2, 3, state.entityIds);
    const tower2 = state.towerMgr.add('cannon', 3, 3, state.entityIds);

    state.towerMgr.upgrade(tower1);
    state.towerMgr.upgrade(tower1);
    state.towerMgr.upgrade(tower2);

    runner.assertEqual(tower1.level, 3, 'tower1 should be level 3');
    runner.assertEqual(tower2.level, 2, 'tower2 should be level 2');
});

// ════════════════════════════════════════════════════════════════════════════════
// RUN TESTS
// ════════════════════════════════════════════════════════════════════════════════

runner.run();
