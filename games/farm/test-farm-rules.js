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

test('canPlaceOnPlot: unlocked + empty + matching terrain is placeable', function () {
  assert.strictEqual(FarmRules.canPlaceOnPlot(makePlot(), 'soil', 'crop'), true);
});

test('canPlaceOnPlot: locked plot is not placeable', function () {
  assert.strictEqual(FarmRules.canPlaceOnPlot(makePlot({ unlocked: false }), 'soil', 'crop'), false);
});

test('canPlaceOnPlot: occupied plot is not placeable', function () {
  assert.strictEqual(FarmRules.canPlaceOnPlot(makePlot({ occupant: { kind: 'crop' } }), 'soil', 'crop'), false);
});

test('canPlaceOnPlot: unlocked + empty but wrong terrain is not placeable', function () {
  assert.strictEqual(FarmRules.canPlaceOnPlot(makePlot(), 'lake', 'crop'), false);
  assert.strictEqual(FarmRules.canPlaceOnPlot(makePlot(), 'pasture', 'crop'), false);
  assert.strictEqual(FarmRules.canPlaceOnPlot(makePlot(), 'soil', 'animal'), false);
});

// ---- Terrain (PLAN.md §10) ---------------------------------------------------

test('terrainForPlot: deterministic — same (col,row) always gives the same terrain', function () {
  const a = FarmRules.terrainForPlot(23, 17, 4, 1);
  const b = FarmRules.terrainForPlot(23, 17, 4, 1);
  assert.strictEqual(a, b);
});

test('terrainForPlot: the starting cluster (row 0, col < safeCols) is always soil', function () {
  for (let col = 0; col < 8; col++) {
    assert.strictEqual(FarmRules.terrainForPlot(col, 0, 4, 8), 'soil');
  }
});

test('terrainForPlot: row 0 beyond the safe cluster is not forced soil — a real terrain type follows the hash', function () {
  const known = ['soil', 'pasture', 'lake', 'mountain'];
  for (let col = 8; col < 60; col++) {
    assert.ok(known.indexOf(FarmRules.terrainForPlot(col, 0, 4, 8)) !== -1);
  }
});

test('terrainForPlot: every plot in the same block gets the same terrain', function () {
  // blockSize 4: cols 8-11, row 8-11 are all one block.
  const terrains = [];
  for (let col = 8; col < 12; col++) {
    for (let row = 8; row < 12; row++) {
      terrains.push(FarmRules.terrainForPlot(col, row, 4, 0));
    }
  }
  assert.ok(terrains.every(function (t) { return t === terrains[0]; }));
});

test('terrainForPlot: only ever returns one of the four known terrain types', function () {
  const known = ['soil', 'pasture', 'lake', 'mountain'];
  for (let col = 0; col < 60; col += 3) {
    for (let row = 0; row < 60; row += 3) {
      assert.ok(known.indexOf(FarmRules.terrainForPlot(col, row, 4, 0)) !== -1);
    }
  }
});

test('terrainForPlot: a 60x60 field produces at least some of every terrain type beyond row 0', function () {
  const seen = {};
  for (let col = 0; col < 60; col++) {
    for (let row = 1; row < 60; row++) {
      seen[FarmRules.terrainForPlot(col, row, 4, 8)] = true;
    }
  }
  assert.ok(seen.soil && seen.pasture && seen.lake && seen.mountain, 'expected all 4 terrain types to appear, got: ' + JSON.stringify(seen));
});

test('canPlaceKindOnTerrain: crops and buildings need soil, animals need pasture', function () {
  assert.strictEqual(FarmRules.canPlaceKindOnTerrain('crop', 'soil'), true);
  assert.strictEqual(FarmRules.canPlaceKindOnTerrain('crop', 'pasture'), false);
  assert.strictEqual(FarmRules.canPlaceKindOnTerrain('building', 'soil'), true);
  assert.strictEqual(FarmRules.canPlaceKindOnTerrain('building', 'lake'), false);
  assert.strictEqual(FarmRules.canPlaceKindOnTerrain('animal', 'pasture'), true);
  assert.strictEqual(FarmRules.canPlaceKindOnTerrain('animal', 'soil'), false);
});

test('canPlaceKindOnTerrain: nothing can be placed on lake or mountain', function () {
  ['crop', 'building', 'animal'].forEach(function (kind) {
    assert.strictEqual(FarmRules.canPlaceKindOnTerrain(kind, 'lake'), false);
    assert.strictEqual(FarmRules.canPlaceKindOnTerrain(kind, 'mountain'), false);
  });
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

// ---- Quarries (mountain resource) --------------------------------------------------

const quarry = { icon: '⛏️', cycleSec: 60, produces: { item: 'stone', qty: 1, sellPrice: 4 } };

test('quarryProgress: not ready before cycleSec has elapsed', function () {
  const occ = { kind: 'quarry', lastCollectedAt: 0 };
  const progress = FarmRules.quarryProgress(occ, quarry, 30);
  assert.strictEqual(progress.ready, false);
  assert.ok(Math.abs(progress.frac - 0.5) < 1e-9);
});

test('quarryProgress: ready once cycleSec has elapsed, frac capped at 1', function () {
  const occ = { kind: 'quarry', lastCollectedAt: 0 };
  const progress = FarmRules.quarryProgress(occ, quarry, quarry.cycleSec * 2);
  assert.strictEqual(progress.ready, true);
  assert.strictEqual(progress.frac, 1);
});

test('canCollectQuarry: false for a non-quarry occupant or before ready', function () {
  assert.strictEqual(FarmRules.canCollectQuarry(null, quarry, 1000), false);
  assert.strictEqual(FarmRules.canCollectQuarry({ kind: 'crop' }, quarry, 1000), false);
  assert.strictEqual(FarmRules.canCollectQuarry({ kind: 'quarry', lastCollectedAt: 0 }, quarry, 1), false);
});

test('canCollectQuarry: true once the mining cycle completes', function () {
  const occ = { kind: 'quarry', lastCollectedAt: 0 };
  assert.strictEqual(FarmRules.canCollectQuarry(occ, quarry, quarry.cycleSec), true);
});

// ---- Lake irrigation ----------------------------------------------------------------

test('isNearLake: true when a lake tile is within radius', function () {
  let found = false;
  for (let col = 0; col < 60 && !found; col++) {
    for (let row = 1; row < 60 && !found; row++) {
      if (FarmRules.terrainForPlot(col, row, 4, 8) === 'lake') found = { col: col, row: row };
    }
  }
  assert.ok(found, 'expected to find at least one lake tile to test against');
  assert.strictEqual(FarmRules.isNearLake(found.col, found.row, 4, 8, 0), true);
});

test('isNearLake: false far away from any lake with radius 0', function () {
  // The safe starting cluster itself is always soil, and has no lake
  // within it, so radius 0 on one of its own tiles is never near a lake.
  assert.strictEqual(FarmRules.isNearLake(0, 0, 4, 8, 0), false);
});

test('isNearLake: a larger radius only ever finds lakes a smaller radius also would, or more', function () {
  for (let col = 0; col < 40; col += 5) {
    for (let row = 1; row < 40; row += 5) {
      const near0 = FarmRules.isNearLake(col, row, 4, 8, 0);
      const near2 = FarmRules.isNearLake(col, row, 4, 8, 2);
      if (near0) assert.strictEqual(near2, true);
    }
  }
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
