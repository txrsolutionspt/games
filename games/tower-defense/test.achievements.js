/**
 * Tower Defense - Achievement System Tests
 * Tests for achievements and progression milestones
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

const localStorageMock = (() => {
    let store = {};
    return {
        setItem: (key, value) => { store[key] = value; },
        getItem: (key) => store[key] || null,
        removeItem: (key) => { delete store[key]; },
        clear: () => { store = {}; }
    };
})();
global.localStorage = localStorageMock;
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

    async run() {
        console.log('\n🏆 Achievement System Tests\n');

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
// ACHIEVEMENT TESTS
// ════════════════════════════════════════════════════════════════════════════════

runner.test('AchievementManager initializes with empty achievements', function() {
    global.localStorage.clear();
    const mgr = new global.AchievementManager();
    runner.assertEqual(mgr.unlockedAchievements.size, 0, 'Should start with no unlocked achievements');
});

runner.test('Achievement definitions exist for all achievement IDs', function() {
    runner.assert(global.ACHIEVEMENTS['first_wave'], 'first_wave achievement should exist');
    runner.assert(global.ACHIEVEMENTS['tower_master'], 'tower_master achievement should exist');
    runner.assert(global.ACHIEVEMENTS['endless'], 'endless achievement should exist');
    runner.assert(global.ACHIEVEMENTS['speedrun'], 'speedrun achievement should exist');
    runner.assert(global.ACHIEVEMENTS['minimalist'], 'minimalist achievement should exist');
});

runner.test('All achievements have required fields', function() {
    Object.values(global.ACHIEVEMENTS).forEach(achievement => {
        runner.assert(achievement.id, 'Achievement must have id');
        runner.assert(achievement.name, 'Achievement must have name');
        runner.assert(achievement.desc, 'Achievement must have desc');
        runner.assert(achievement.icon, 'Achievement must have icon');
        runner.assert(typeof achievement.condition === 'function', 'Achievement must have condition function');
    });
});

runner.test('First Wave achievement unlocks when wave 1 is cleared', function() {
    global.localStorage.clear();
    const mgr = new global.AchievementManager();
    const stats = { waveNum: 1, towersPlaced: 0, gameTime: 10000, lives: 20 };
    const achievement = mgr.checkAndUnlock('first_wave', stats);
    runner.assert(achievement !== null, 'First Wave should unlock when waveNum >= 1');
    runner.assert(mgr.isUnlocked('first_wave'), 'Achievement should be marked as unlocked');
});

runner.test('Tower Master achievement unlocks at 50 towers', function() {
    global.localStorage.clear();
    const mgr = new global.AchievementManager();
    const stats = { waveNum: 10, towersPlaced: 50, gameTime: 300000, lives: 20 };
    const achievement = mgr.checkAndUnlock('tower_master', stats);
    runner.assert(achievement !== null, 'Tower Master should unlock at 50 towers');
});

runner.test('Tower Master achievement does not unlock below 50 towers', function() {
    global.localStorage.clear();
    const mgr = new global.AchievementManager();
    const stats = { waveNum: 10, towersPlaced: 49, gameTime: 300000, lives: 20 };
    const achievement = mgr.checkAndUnlock('tower_master', stats);
    runner.assert(achievement === null, 'Tower Master should not unlock below 50 towers');
});

runner.test('Endless achievement unlocks at 20 waves', function() {
    global.localStorage.clear();
    const mgr = new global.AchievementManager();
    const stats = { waveNum: 20, towersPlaced: 30, gameTime: 600000, lives: 5 };
    const achievement = mgr.checkAndUnlock('endless', stats);
    runner.assert(achievement !== null, 'Endless should unlock at 20 waves');
});

runner.test('Speedrun achievement requires wave 5 and <5 min', function() {
    global.localStorage.clear();
    const mgr = new global.AchievementManager();
    const stats = { waveNum: 5, towersPlaced: 20, gameTime: 250000, lives: 18 };
    const achievement = mgr.checkAndUnlock('speedrun', stats);
    runner.assert(achievement !== null, 'Speedrun should unlock at wave 5 with <300000ms');
});

runner.test('Speedrun achievement does not unlock if time exceeds 5 min', function() {
    global.localStorage.clear();
    const mgr = new global.AchievementManager();
    const stats = { waveNum: 5, towersPlaced: 20, gameTime: 350000, lives: 18 };
    const achievement = mgr.checkAndUnlock('speedrun', stats);
    runner.assert(achievement === null, 'Speedrun should not unlock if time exceeds 300000ms');
});

runner.test('Minimalist achievement requires wave 5 with <10 towers', function() {
    global.localStorage.clear();
    const mgr = new global.AchievementManager();
    const stats = { waveNum: 5, towersPlaced: 9, gameTime: 120000, lives: 20 };
    const achievement = mgr.checkAndUnlock('minimalist', stats);
    runner.assert(achievement !== null, 'Minimalist should unlock at wave 5 with <10 towers');
});

runner.test('Minimalist achievement does not unlock with 10+ towers', function() {
    global.localStorage.clear();
    const mgr = new global.AchievementManager();
    const stats = { waveNum: 5, towersPlaced: 10, gameTime: 120000, lives: 20 };
    const achievement = mgr.checkAndUnlock('minimalist', stats);
    runner.assert(achievement === null, 'Minimalist should not unlock with 10+ towers');
});

runner.test('Achievement cannot be unlocked twice', function() {
    global.localStorage.clear();
    const mgr = new global.AchievementManager();
    const stats = { waveNum: 1, towersPlaced: 0, gameTime: 10000, lives: 20 };
    const first = mgr.checkAndUnlock('first_wave', stats);
    const second = mgr.checkAndUnlock('first_wave', stats);
    runner.assert(first !== null, 'First unlock should succeed');
    runner.assert(second === null, 'Second unlock should return null');
    runner.assertEqual(mgr.unlockedAchievements.size, 1, 'Should only have 1 unlocked achievement');
});

runner.test('getProgress returns correct counts', function() {
    global.localStorage.clear();
    const mgr = new global.AchievementManager();
    const stats = { waveNum: 1, towersPlaced: 0, gameTime: 10000, lives: 20 };
    mgr.checkAndUnlock('first_wave', stats);

    const progress = mgr.getProgress();
    runner.assertEqual(progress.unlocked, 1, 'Should have 1 unlocked achievement');
    runner.assertEqual(progress.total, 5, 'Should have 5 total achievements');
    runner.assertEqual(progress.list.length, 5, 'Progress list should contain all achievements');
});

runner.test('Achievement state persists and restores', function() {
    global.localStorage.clear();
    const mgr1 = new global.AchievementManager();
    const stats = { waveNum: 1, towersPlaced: 0, gameTime: 10000, lives: 20 };
    mgr1.checkAndUnlock('first_wave', stats);
    mgr1.saveAchievements();

    const mgr2 = new global.AchievementManager();
    runner.assert(mgr2.isUnlocked('first_wave'), 'Loaded manager should have first_wave unlocked');
});

runner.test('Achievement reset clears all unlocked achievements', function() {
    global.localStorage.clear();
    const mgr = new global.AchievementManager();
    const stats = { waveNum: 50, towersPlaced: 100, gameTime: 1000000, lives: 20 };
    mgr.checkAndUnlock('first_wave', stats);
    mgr.checkAndUnlock('tower_master', stats);
    mgr.reset();

    runner.assertEqual(mgr.unlockedAchievements.size, 0, 'Reset should clear all achievements');
});

// ════════════════════════════════════════════════════════════════════════════════
// RUN TESTS
// ════════════════════════════════════════════════════════════════════════════════

runner.run();
