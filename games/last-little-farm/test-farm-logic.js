#!/usr/bin/env node

/**
 * Unit tests for farm-logic.js — the DOM-free game-rule functions
 * (crop cycle, tree chopping/regrowth, chicken feeding, and the
 * landscape-lock decision). Run with: node test-farm-logic.js
 */

const assert = require('assert');
const FarmLogic = require('./farm-logic.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`  ✅ ${name}`);
        passed++;
    } catch (e) {
        console.log(`  ❌ ${name}`);
        console.log(`     ${e.message}`);
        failed++;
    }
}

function freshResources(overrides) {
    return Object.assign({ wood: 0, water: 0, waterMax: 5, seeds: 3, crops: 0, eggs: 0, day: 1 }, overrides);
}

console.log('🌾 Testing farm-logic.js\n');

console.log('Crop cycle (till → plant → water → grow → harvest):');

test('a fresh plot starts empty', () => {
    const plot = FarmLogic.createPlot(100);
    assert.strictEqual(plot.state, 'empty');
});

test('tilling an empty plot succeeds and sets state to tilled', () => {
    const plot = FarmLogic.createPlot(100);
    const ok = FarmLogic.tillPlot(plot);
    assert.strictEqual(ok, true);
    assert.strictEqual(plot.state, 'tilled');
});

test('tilling a non-empty plot is a no-op', () => {
    const plot = FarmLogic.createPlot(100);
    FarmLogic.tillPlot(plot);
    const ok = FarmLogic.tillPlot(plot);
    assert.strictEqual(ok, false);
    assert.strictEqual(plot.state, 'tilled');
});

test('planting consumes a seed and requires tilled soil', () => {
    const plot = FarmLogic.createPlot(100);
    const resources = freshResources({ seeds: 3 });
    assert.strictEqual(FarmLogic.plantSeed(plot, resources), false, 'cannot plant on empty soil');
    assert.strictEqual(resources.seeds, 3);

    FarmLogic.tillPlot(plot);
    assert.strictEqual(FarmLogic.plantSeed(plot, resources), true);
    assert.strictEqual(plot.state, 'planted');
    assert.strictEqual(resources.seeds, 2);
});

test('planting fails with no seeds available', () => {
    const plot = FarmLogic.createPlot(100);
    FarmLogic.tillPlot(plot);
    const resources = freshResources({ seeds: 0 });
    assert.strictEqual(FarmLogic.plantSeed(plot, resources), false);
    assert.strictEqual(plot.state, 'tilled');
});

test('watering consumes water and starts growth', () => {
    const plot = FarmLogic.createPlot(100);
    FarmLogic.tillPlot(plot);
    const resources = freshResources({ water: 2 });
    FarmLogic.plantSeed(plot, resources);
    const ok = FarmLogic.waterPlot(plot, resources);
    assert.strictEqual(ok, true);
    assert.strictEqual(plot.state, 'growing');
    assert.strictEqual(plot.watered, true);
    assert.strictEqual(resources.water, 1);
});

test('watering fails with no water available', () => {
    const plot = FarmLogic.createPlot(100);
    FarmLogic.tillPlot(plot);
    const resources = freshResources({ water: 0 });
    FarmLogic.plantSeed(plot, resources);
    assert.strictEqual(FarmLogic.waterPlot(plot, resources), false);
    assert.strictEqual(plot.state, 'planted');
});

test('growPlot advances growth over time and reaches ready at the threshold', () => {
    const plot = FarmLogic.createPlot(100);
    plot.state = 'growing';
    plot.growth = 0;
    const growTime = 10;

    let becameReady = FarmLogic.growPlot(plot, 4, growTime);
    assert.strictEqual(becameReady, false);
    assert.strictEqual(plot.state, 'growing');
    assert.ok(Math.abs(plot.growth - 0.4) < 1e-9);

    becameReady = FarmLogic.growPlot(plot, 5, growTime);
    assert.strictEqual(becameReady, false);
    assert.strictEqual(plot.state, 'growing');

    becameReady = FarmLogic.growPlot(plot, 1, growTime);
    assert.strictEqual(becameReady, true, 'should flip to ready exactly when growth reaches 1');
    assert.strictEqual(plot.state, 'ready');
    assert.strictEqual(plot.growth, 1, 'growth should clamp at 1');
});

test('growPlot is a no-op on plots that are not growing', () => {
    const plot = FarmLogic.createPlot(100);
    assert.strictEqual(FarmLogic.growPlot(plot, 100, 10), false);
    assert.strictEqual(plot.state, 'empty');
});

test('harvesting a ready plot resets it and always grants a crop', () => {
    const plot = FarmLogic.createPlot(100);
    plot.state = 'ready';
    plot.growth = 1;
    const resources = freshResources({ crops: 0, seeds: 0 });

    const ok = FarmLogic.harvestPlot(plot, resources, () => 1); // rng=1 -> no bonus seed
    assert.strictEqual(ok, true);
    assert.strictEqual(resources.crops, 1);
    assert.strictEqual(resources.seeds, 0, 'rng roll above the bonus threshold grants no seed');
    assert.strictEqual(plot.state, 'empty');
    assert.strictEqual(plot.watered, false);
});

test('harvesting grants a bonus seed on a favourable rng roll', () => {
    const plot = FarmLogic.createPlot(100);
    plot.state = 'ready';
    const resources = freshResources({ seeds: 0 });
    FarmLogic.harvestPlot(plot, resources, () => 0); // rng=0 -> always below threshold
    assert.strictEqual(resources.seeds, 1);
});

test('harvesting a plot that is not ready is a no-op', () => {
    const plot = FarmLogic.createPlot(100);
    plot.state = 'growing';
    const resources = freshResources();
    assert.strictEqual(FarmLogic.harvestPlot(plot, resources), false);
    assert.strictEqual(resources.crops, 0);
});

console.log('\nWell:');

test('fillWater tops up to the max exactly once', () => {
    const resources = freshResources({ water: 1, waterMax: 5 });
    assert.strictEqual(FarmLogic.fillWater(resources), true);
    assert.strictEqual(resources.water, 5);
    assert.strictEqual(FarmLogic.fillWater(resources), false, 'already full');
    assert.strictEqual(resources.water, 5);
});

console.log('\nTrees (chop → regrow):');

test('a tree takes 3 hits to fell and grants wood only on the felling hit', () => {
    const tree = FarmLogic.createTree(200);
    const resources = freshResources({ wood: 0 });
    FarmLogic.chopTree(tree, resources, 40);
    assert.strictEqual(resources.wood, 0);
    FarmLogic.chopTree(tree, resources, 40);
    assert.strictEqual(resources.wood, 0);
    FarmLogic.chopTree(tree, resources, 40);
    assert.strictEqual(tree.hp, 0);
    assert.strictEqual(resources.wood, 2);
    assert.strictEqual(tree.stumpTimer, 40);
});

test('chopping a stump is a no-op', () => {
    const tree = FarmLogic.createTree(200);
    tree.hp = 0;
    tree.stumpTimer = 10;
    const resources = freshResources({ wood: 0 });
    const ok = FarmLogic.chopTree(tree, resources, 40);
    assert.strictEqual(ok, false);
    assert.strictEqual(resources.wood, 0);
});

test('a felled tree regrows to full hp once its stump timer elapses', () => {
    const tree = FarmLogic.createTree(200);
    tree.hp = 0;
    tree.stumpTimer = 10;
    assert.strictEqual(FarmLogic.regrowTree(tree, 6), false);
    assert.strictEqual(tree.hp, 0);
    assert.ok(Math.abs(tree.stumpTimer - 4) < 1e-9);
    assert.strictEqual(FarmLogic.regrowTree(tree, 10), true);
    assert.strictEqual(tree.hp, 3);
});

test('regrowTree is a no-op on a healthy tree', () => {
    const tree = FarmLogic.createTree(200);
    assert.strictEqual(FarmLogic.regrowTree(tree, 100), false);
    assert.strictEqual(tree.hp, 3);
});

console.log('\nBushes (gather → respawn):');

test('gathering a bush with a seed grants a seed and empties it', () => {
    const bush = FarmLogic.createBush(300);
    const resources = freshResources({ seeds: 0 });
    const ok = FarmLogic.gatherBush(bush, resources, 25, 1);
    assert.strictEqual(ok, true);
    assert.strictEqual(resources.seeds, 1);
    assert.strictEqual(bush.hasSeed, false);
    assert.strictEqual(bush.respawnTimer, 25);
});

test('gathering an empty bush is a no-op', () => {
    const bush = FarmLogic.createBush(300);
    bush.hasSeed = false;
    bush.respawnTimer = 10;
    const resources = freshResources({ seeds: 0 });
    const ok = FarmLogic.gatherBush(bush, resources, 25, 1);
    assert.strictEqual(ok, false);
    assert.strictEqual(resources.seeds, 0);
});

test('a gathered bush regrows its seed once the respawn timer elapses', () => {
    const bush = FarmLogic.createBush(300);
    const resources = freshResources({ seeds: 0 });
    FarmLogic.gatherBush(bush, resources, 10, 1);
    assert.strictEqual(FarmLogic.regrowBush(bush, 6), false);
    assert.strictEqual(bush.hasSeed, false);
    assert.ok(Math.abs(bush.respawnTimer - 4) < 1e-9);
    assert.strictEqual(FarmLogic.regrowBush(bush, 10), true);
    assert.strictEqual(bush.hasSeed, true);
});

test('regrowBush is a no-op on a bush that already has a seed', () => {
    const bush = FarmLogic.createBush(300);
    assert.strictEqual(FarmLogic.regrowBush(bush, 100), false);
    assert.strictEqual(bush.hasSeed, true);
});

console.log('\nSeed stand (buy seeds with wood):');

test('buying a seed spends wood and grants exactly one seed', () => {
    const resources = freshResources({ wood: 5, seeds: 0 });
    const ok = FarmLogic.buySeed(resources, 2);
    assert.strictEqual(ok, true);
    assert.strictEqual(resources.wood, 3);
    assert.strictEqual(resources.seeds, 1);
});

test('buying a seed fails without enough wood', () => {
    const resources = freshResources({ wood: 1, seeds: 0 });
    const ok = FarmLogic.buySeed(resources, 2);
    assert.strictEqual(ok, false);
    assert.strictEqual(resources.wood, 1);
    assert.strictEqual(resources.seeds, 0);
});

test('buying repeatedly drains wood exactly at the boundary', () => {
    const resources = freshResources({ wood: 4, seeds: 0 });
    assert.strictEqual(FarmLogic.buySeed(resources, 2), true);
    assert.strictEqual(FarmLogic.buySeed(resources, 2), true);
    assert.strictEqual(resources.wood, 0);
    assert.strictEqual(resources.seeds, 2);
    assert.strictEqual(FarmLogic.buySeed(resources, 2), false, 'no wood left');
});

console.log('\nChicken (feed → egg timer → egg):');

function freshChicken() {
    return { x: 0, dir: 1, idleTimer: 1, targetX: 0, eggTimer: -1, hopTimer: 0, fedFlash: 0 };
}

test('feeding the chicken consumes a crop and starts the egg timer', () => {
    const chicken = freshChicken();
    const resources = freshResources({ crops: 1 });
    const ok = FarmLogic.feedChicken(chicken, resources, 12);
    assert.strictEqual(ok, true);
    assert.strictEqual(resources.crops, 0);
    assert.strictEqual(chicken.eggTimer, 12);
});

test('feeding fails without a crop to give', () => {
    const chicken = freshChicken();
    const resources = freshResources({ crops: 0 });
    const ok = FarmLogic.feedChicken(chicken, resources, 12);
    assert.strictEqual(ok, false);
    assert.strictEqual(chicken.eggTimer, -1);
});

test('feeding again while already incubating an egg is rejected', () => {
    const chicken = freshChicken();
    const resources = freshResources({ crops: 2 });
    FarmLogic.feedChicken(chicken, resources, 12);
    const ok = FarmLogic.feedChicken(chicken, resources, 12);
    assert.strictEqual(ok, false, 'should not double-feed while an egg is incubating');
    assert.strictEqual(resources.crops, 1, 'second crop should not be consumed');
});

test('the egg timer produces exactly one egg and then stops', () => {
    const chicken = freshChicken();
    const resources = freshResources({ crops: 1, eggs: 0 });
    FarmLogic.feedChicken(chicken, resources, 10);

    assert.strictEqual(FarmLogic.updateChickenEgg(chicken, resources, 6), false);
    assert.strictEqual(resources.eggs, 0);

    assert.strictEqual(FarmLogic.updateChickenEgg(chicken, resources, 4), true);
    assert.strictEqual(resources.eggs, 1);
    assert.strictEqual(chicken.eggTimer, -1);

    // timer is off now; further ticks must not grant more eggs
    assert.strictEqual(FarmLogic.updateChickenEgg(chicken, resources, 100), false);
    assert.strictEqual(resources.eggs, 1);
});

console.log('\nLandscape lock (mobile view requirement):');

test('touch device in portrait is locked to landscape', () => {
    assert.strictEqual(FarmLogic.shouldLockLandscape(390, 844, true), true);
});

test('touch device in landscape is not locked', () => {
    assert.strictEqual(FarmLogic.shouldLockLandscape(844, 390, true), false);
});

test('a perfectly square touch viewport is not locked (height must exceed width)', () => {
    assert.strictEqual(FarmLogic.shouldLockLandscape(500, 500, true), false);
});

test('desktop/mouse windows are never locked, even when tall and narrow', () => {
    assert.strictEqual(FarmLogic.shouldLockLandscape(400, 900, false), false);
});

test('short landscape phones (small height, wide) are not locked', () => {
    assert.strictEqual(FarmLogic.shouldLockLandscape(667, 320, true), false);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
