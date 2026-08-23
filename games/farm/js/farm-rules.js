/**
 * Pure farming-rule functions for Little Farm School.
 *
 * No DOM/canvas/timer dependencies, so this file can be loaded either as a
 * browser <script> (attaches to window.FarmRules) or with require() from
 * plain Node for unit testing (see test-farm-rules.js) — same pattern as
 * games/last-little-farm/farm-logic.js.
 *
 * Every function here takes plain data (plot/occupant objects, crop/animal/
 * recipe definitions, the current simulation tick) and returns plain data.
 * Nothing here mutates its arguments or reads global state, so simulation.js
 * and input.js can both call the exact same checks without drifting apart.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FarmRules = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // ---- Plots -------------------------------------------------------------

  function canPlaceOnPlot(plot) {
    return !!plot && plot.unlocked && !plot.occupant;
  }

  function canUnlockPlot(plot, coins, cost) {
    return !!plot && !plot.unlocked && coins >= cost;
  }

  // ---- Crops ---------------------------------------------------------------

  function isCropInSeason(cropDef, season) {
    return cropDef.season.indexOf(season) !== -1;
  }

  // Growth is purely a function of elapsed ticks since planting, so it never
  // needs a per-tick loop to "catch up" — advancing the clock is enough.
  function cropProgress(occupant, cropDef, currentTick) {
    var elapsed = Math.max(0, currentTick - occupant.plantedAt);
    var frac = Math.min(1, elapsed / cropDef.growTimeSec);
    var stage = Math.min(cropDef.growthStages - 1, Math.floor(frac * cropDef.growthStages));
    return { frac: frac, stage: stage, matured: frac >= 1 };
  }

  function canWaterCrop(plot, cropDef, currentTick) {
    if (!plot || !plot.occupant || plot.occupant.kind !== 'crop') return false;
    if (plot.occupant.state === 'ready') return false;
    if (plot.occupant.waterGiven >= cropDef.waterRequired) return false;
    return true;
  }

  function canHarvestCrop(plot) {
    return !!plot && !!plot.occupant && plot.occupant.kind === 'crop' && plot.occupant.state === 'ready';
  }

  // Watering enough times before maturity yields a full harvest; watering
  // less (or growing it out of season) still yields something smaller —
  // neglect/poor timing degrades yield, it never destroys the crop. Both
  // conditions together still only halve it once, not stack penalties.
  function cropYield(occupant, cropDef, inSeason) {
    var wellWatered = occupant.waterGiven >= cropDef.waterRequired;
    var full = wellWatered && inSeason !== false;
    var qty = full ? cropDef.harvestYield.qty : Math.max(1, Math.floor(cropDef.harvestYield.qty / 2));
    return { item: cropDef.harvestYield.item, qty: qty, wellWatered: wellWatered, full: full };
  }

  // ---- Animals ---------------------------------------------------------------

  // Happiness only ever slows production down (see animalEffectiveCycleSec);
  // an unhappy animal is never removed and never stops producing outright.
  function animalHappiness(occupant, animalDef, currentTick) {
    var feedOverdue = (currentTick - occupant.lastFedAt) > animalDef.needs.feedPerCycleSec * 1.5;
    var waterOverdue = (currentTick - occupant.lastWateredAt) > animalDef.needs.waterPerCycleSec * 1.5;
    if (feedOverdue && waterOverdue) return 0.4;
    if (feedOverdue || waterOverdue) return 0.7;
    return 1;
  }

  function animalEffectiveCycleSec(occupant, animalDef, currentTick) {
    var happiness = animalHappiness(occupant, animalDef, currentTick);
    return animalDef.produces.cycleSec / (0.5 + 0.5 * happiness);
  }

  function animalProgress(occupant, animalDef, currentTick) {
    var cycle = animalEffectiveCycleSec(occupant, animalDef, currentTick);
    var elapsed = Math.max(0, currentTick - occupant.lastCollectedAt);
    var frac = Math.min(1, elapsed / cycle);
    return { frac: frac, ready: frac >= 1, happiness: animalHappiness(occupant, animalDef, currentTick) };
  }

  function canFeedAnimal(plot, inventory, animalDef) {
    if (!plot || !plot.occupant || plot.occupant.kind !== 'animal') return false;
    var have = inventory[animalDef.needs.feedItemId] || 0;
    return have > 0;
  }

  function canWaterAnimal(plot) {
    return !!plot && !!plot.occupant && plot.occupant.kind === 'animal';
  }

  function canCollectAnimal(plot, animalDef, currentTick) {
    if (!plot || !plot.occupant || plot.occupant.kind !== 'animal') return false;
    return animalProgress(plot.occupant, animalDef, currentTick).ready;
  }

  // ---- Processing (recipes/buildings) ---------------------------------------

  function canStartRecipe(plot, recipeDef, inventory) {
    if (!plot || !plot.occupant || plot.occupant.kind !== 'building') return false;
    if (plot.occupant.job) return false;
    return recipeDef.inputs.every(function (input) {
      return (inventory[input.item] || 0) >= input.qty;
    });
  }

  function recipeProgress(job, recipeDef, currentTick) {
    if (!job) return { frac: 0, ready: false };
    var elapsed = Math.max(0, currentTick - job.startedAt);
    var frac = Math.min(1, elapsed / recipeDef.timeSec);
    return { frac: frac, ready: frac >= 1 };
  }

  function canCollectRecipe(plot, recipeDef, currentTick) {
    if (!plot || !plot.occupant || plot.occupant.kind !== 'building' || !plot.occupant.job) return false;
    return recipeProgress(plot.occupant.job, recipeDef, currentTick).ready;
  }

  // ---- Device orientation ----------------------------------------------------

  // The farm grid and tool belt are laid out for landscape (see PLAN.md
  // §11); on touch devices we require it and show a rotate prompt. Desktop/
  // mouse windows are left alone since there's nothing to "rotate" — the
  // same rule games/last-little-farm/farm-logic.js uses.
  function shouldLockLandscape(width, height, isTouch) {
    return !!(isTouch && height > width);
  }

  return {
    canPlaceOnPlot: canPlaceOnPlot,
    canUnlockPlot: canUnlockPlot,
    isCropInSeason: isCropInSeason,
    cropProgress: cropProgress,
    canWaterCrop: canWaterCrop,
    canHarvestCrop: canHarvestCrop,
    cropYield: cropYield,
    animalHappiness: animalHappiness,
    animalEffectiveCycleSec: animalEffectiveCycleSec,
    animalProgress: animalProgress,
    canFeedAnimal: canFeedAnimal,
    canWaterAnimal: canWaterAnimal,
    canCollectAnimal: canCollectAnimal,
    canStartRecipe: canStartRecipe,
    recipeProgress: recipeProgress,
    canCollectRecipe: canCollectRecipe,
    shouldLockLandscape: shouldLockLandscape
  };
});
