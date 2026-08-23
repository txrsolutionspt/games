#!/usr/bin/env node

/**
 * Unit tests for farm-rules.js — the DOM-free farming-rule functions
 * (crop growth/watering/yield, animal happiness/production, recipe
 * processing, plot unlocking). Run with: node test-farm-rules.js
 */

const assert = require('assert');
const FarmRules = require('./js/farm-rules.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log('  ✅ ' + name);
    passed++;
  } catch (e) {
    console.log('  ❌ ' + name);
    console.log('     ' + e.message);
    failed++;
  }
}

// ---- Fixtures --------------------------------------------------------------

const wheat = {
  id: 'wheat', growthStages: 4, growTimeSec: 40, waterRequired: 2,
  season: ['spring', 'summer'], harvestYield: { item: 'wheat_grain', qty: 3 }
};

const chicken = {
  id: 'chicken',
  needs: { feedItemId: 'wheat_grain', feedPerCycleSec: 40, waterPerCycleSec: 40 },
  produces: { item: 'egg', qty: 1, cycleSec: 40 }
};

const flourRecipe = { id: 'flour', inputs: [{ item: 'wheat_grain', qty: 3 }], timeSec: 20, output: { item: 'flour', qty: 1 } };

function makePlot(overrides) {
  return Object.assign({ index: 0, unlocked: true, occupant: null }, overrides);
}

// ---- Plots ------------------------------------------------------------------

test('canPlaceOnPlot: unlocked + empty is placeable', function () {
  assert.strictEqual(FarmRules.canPlaceOnPlot(makePlot()), true);
});

test('canPlaceOnPlot: locked plot is not placeable', function () {
  assert.strictEqual(FarmRules.canPlaceOnPlot(makePlot({ unlocked: false })), false);
});

test('canPlaceOnPlot: occupied plot is not placeable', function () {
  assert.strictEqual(FarmRules.canPlaceOnPlot(makePlot({ occupant: { kind: 'crop' } })), false);
});

test('canUnlockPlot: enough coins allows unlocking a locked plot', function () {
  assert.strictEqual(FarmRules.canUnlockPlot(makePlot({ unlocked: false }), 50, 30), true);
});

test('canUnlockPlot: not enough coins blocks unlocking', function () {
  assert.strictEqual(FarmRules.canUnlockPlot(makePlot({ unlocked: false }), 10, 30), false);
});

test('canUnlockPlot: already-unlocked plot cannot be "unlocked" again', function () {
  assert.strictEqual(FarmRules.canUnlockPlot(makePlot({ unlocked: true }), 999, 30), false);
});

// ---- Crops --------------------------------------------------------------------

test('isCropInSeason: true when season listed, false otherwise', function () {
  assert.strictEqual(FarmRules.isCropInSeason(wheat, 'spring'), true);
  assert.strictEqual(FarmRules.isCropInSeason(wheat, 'winter'), false);
});

test('cropProgress: halfway through growth time is ~50%, not matured', function () {
  const occ = { plantedAt: 0, waterGiven: 0, state: 'growing' };
  const progress = FarmRules.cropProgress(occ, wheat, wheat.growTimeSec / 2);
  assert.strictEqual(progress.matured, false);
  assert.ok(Math.abs(progress.frac - 0.5) < 1e-9);
});

test('cropProgress: at/after growTimeSec is matured with frac capped at 1', function () {
  const occ = { plantedAt: 0, waterGiven: 0, state: 'growing' };
  const progress = FarmRules.cropProgress(occ, wheat, wheat.growTimeSec * 3);
  assert.strictEqual(progress.matured, true);
  assert.strictEqual(progress.frac, 1);
});

test('canWaterCrop: allowed while growing and under waterRequired', function () {
  const plot = makePlot({ occupant: { kind: 'crop', waterGiven: 0, state: 'growing' } });
  assert.strictEqual(FarmRules.canWaterCrop(plot, wheat, 5), true);
});

test('canWaterCrop: blocked once waterRequired is already met', function () {
  const plot = makePlot({ occupant: { kind: 'crop', waterGiven: 2, state: 'growing' } });
  assert.strictEqual(FarmRules.canWaterCrop(plot, wheat, 5), false);
});

test('canWaterCrop: blocked once the crop is ready to harvest', function () {
  const plot = makePlot({ occupant: { kind: 'crop', waterGiven: 0, state: 'ready' } });
  assert.strictEqual(FarmRules.canWaterCrop(plot, wheat, 5), false);
});

test('canHarvestCrop: only true once state is ready', function () {
  assert.strictEqual(FarmRules.canHarvestCrop(makePlot({ occupant: { kind: 'crop', state: 'growing' } })), false);
  assert.strictEqual(FarmRules.canHarvestCrop(makePlot({ occupant: { kind: 'crop', state: 'ready' } })), true);
});

test('cropYield: fully watered + in season gives full yield', function () {
  const result = FarmRules.cropYield({ waterGiven: 2 }, wheat, true);
  assert.strictEqual(result.qty, 3);
  assert.strictEqual(result.full, true);
});

test('cropYield: under-watered still yields something, just less (never zero)', function () {
  const result = FarmRules.cropYield({ waterGiven: 0 }, wheat, true);
  assert.ok(result.qty >= 1);
  assert.ok(result.qty < 3);
});

test('cropYield: out of season also reduces yield without stacking with under-watering', function () {
  const underWateredOutOfSeason = FarmRules.cropYield({ waterGiven: 0 }, wheat, false);
  const wellWateredOutOfSeason = FarmRules.cropYield({ waterGiven: 2 }, wheat, false);
  assert.strictEqual(underWateredOutOfSeason.qty, wellWateredOutOfSeason.qty);
});

// ---- Animals --------------------------------------------------------------------

test('animalHappiness: freshly fed/watered animal is fully happy', function () {
  const occ = { lastFedAt: 0, lastWateredAt: 0 };
  assert.strictEqual(FarmRules.animalHappiness(occ, chicken, 5), 1);
});

test('animalHappiness: overdue on one need lowers happiness but does not zero it', function () {
  const occ = { lastFedAt: 0, lastWateredAt: 100 };
  const happiness = FarmRules.animalHappiness(occ, chicken, 100);
  assert.ok(happiness > 0 && happiness < 1);
});

test('animalHappiness: overdue on both needs still returns a positive floor, never 0', function () {
  const occ = { lastFedAt: 0, lastWateredAt: 0 };
  const happiness = FarmRules.animalHappiness(occ, chicken, 1000);
  assert.ok(happiness > 0);
});

test('animalProgress: an unhappy animal still becomes ready eventually (never stuck forever)', function () {
  const occ = { lastFedAt: 0, lastWateredAt: 0, lastCollectedAt: 0 };
  const cycle = FarmRules.animalEffectiveCycleSec(occ, chicken, 1000);
  const progress = FarmRules.animalProgress(occ, chicken, Math.ceil(cycle) + 1);
  assert.strictEqual(progress.ready, true);
});

test('canFeedAnimal: requires the feed item in inventory', function () {
  const plot = makePlot({ occupant: { kind: 'animal' } });
  assert.strictEqual(FarmRules.canFeedAnimal(plot, { wheat_grain: 0 }, chicken), false);
  assert.strictEqual(FarmRules.canFeedAnimal(plot, { wheat_grain: 1 }, chicken), true);
});

test('canCollectAnimal: false until its cycle completes', function () {
  const plot = makePlot({ occupant: { kind: 'animal', lastFedAt: 0, lastWateredAt: 0, lastCollectedAt: 0 } });
  assert.strictEqual(FarmRules.canCollectAnimal(plot, chicken, 1), false);
  assert.strictEqual(FarmRules.canCollectAnimal(plot, chicken, chicken.produces.cycleSec + 1), true);
});

// ---- Processing (recipes/buildings) ------------------------------------------------

test('canStartRecipe: requires enough of every input item', function () {
  const plot = makePlot({ occupant: { kind: 'building', job: null } });
  assert.strictEqual(FarmRules.canStartRecipe(plot, flourRecipe, { wheat_grain: 2 }), false);
  assert.strictEqual(FarmRules.canStartRecipe(plot, flourRecipe, { wheat_grain: 3 }), true);
});

test('canStartRecipe: blocked while a job is already running', function () {
  const plot = makePlot({ occupant: { kind: 'building', job: { recipeId: 'flour', startedAt: 0 } } });
  assert.strictEqual(FarmRules.canStartRecipe(plot, flourRecipe, { wheat_grain: 10 }), false);
});

test('recipeProgress: ready once timeSec has elapsed', function () {
  const job = { recipeId: 'flour', startedAt: 0 };
  assert.strictEqual(FarmRules.recipeProgress(job, flourRecipe, 10).ready, false);
  assert.strictEqual(FarmRules.recipeProgress(job, flourRecipe, flourRecipe.timeSec).ready, true);
});

test('canCollectRecipe: false with no job, true once the job is ready', function () {
  const idlePlot = makePlot({ occupant: { kind: 'building', job: null } });
  assert.strictEqual(FarmRules.canCollectRecipe(idlePlot, flourRecipe, 100), false);

  const workingPlot = makePlot({ occupant: { kind: 'building', job: { recipeId: 'flour', startedAt: 0 } } });
  assert.strictEqual(FarmRules.canCollectRecipe(workingPlot, flourRecipe, flourRecipe.timeSec), true);
});

// ---- Device orientation -------------------------------------------------------------

test('shouldLockLandscape: touch device in portrait is locked to landscape', function () {
  assert.strictEqual(FarmRules.shouldLockLandscape(390, 844, true), true);
});

test('shouldLockLandscape: touch device already in landscape is not locked', function () {
  assert.strictEqual(FarmRules.shouldLockLandscape(844, 390, true), false);
});

test('shouldLockLandscape: a square touch viewport is not locked (no strict portrait)', function () {
  assert.strictEqual(FarmRules.shouldLockLandscape(500, 500, true), false);
});

test('shouldLockLandscape: non-touch (mouse) windows are never locked', function () {
  assert.strictEqual(FarmRules.shouldLockLandscape(400, 900, false), false);
});

// ---- Summary ----------------------------------------------------------------------

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
