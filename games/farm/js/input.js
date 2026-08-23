// Pointer/touch handling, tool selection, tile picking — PLAN.md §10.
// Pointer events (not separate touch/mouse handlers) so the same code path
// serves touch and mouse. Ground-tile hit-testing uses the exact
// screenToGrid math from render.js; this file only decides *what an action
// means* once a plot index is known.

const Input = (function () {
  function setupToolBelt(state, ui, canvas) {
    Hud.buildToolBelt(function (tool) {
      if (tool === 'plant') {
        Modals.showCropShop(state, function (cropId) {
          ui.tool = { type: 'plant-crop', id: cropId };
          Hud.refresh(state, ui);
        });
        return;
      }
      if (tool === 'animals') {
        Modals.showAnimalShop(function (animalId) {
          ui.tool = { type: 'place-animal', id: animalId };
          Hud.refresh(state, ui);
        });
        return;
      }
      if (tool === 'build') {
        Modals.showBuildingShop(function (buildingId) {
          ui.tool = { type: 'place-building', id: buildingId };
          Hud.refresh(state, ui);
        });
        return;
      }
      // water / harvest toggle directly, no drawer needed
      const type = tool === 'water' ? 'water' : 'harvest';
      ui.tool = (ui.tool && ui.tool.type === type) ? null : { type: type };
      Hud.refresh(state, ui);
    });
  }

  function placeCrop(state, plot, cropId) {
    const def = CROPS_BY_ID[cropId];
    if (!FarmRules.canPlaceOnPlot(plot)) return;
    if (!Economy.spendCoins(state, def.seedCost)) {
      Hud.toast(I18N.t('ui.toast.notEnoughCoins', 'Not enough coins yet!'));
      return;
    }
    plot.occupant = { kind: 'crop', id: cropId, plantedAt: state.clock.tick, waterGiven: 0, state: 'growing' };
    const inSeason = FarmRules.isCropInSeason(def, Simulation.currentSeason(state));
    Events.emit('plant', { cropId: cropId, inSeason: inSeason });
    Hud.toast(def.icon + ' ' + I18N.t('ui.toast.planted', 'Planted!') + (inSeason ? '' : ' 🌤️'));
    Persistence.scheduleSave(state);
  }

  function placeAnimal(state, plot, animalId) {
    const def = ANIMALS_BY_ID[animalId];
    if (!FarmRules.canPlaceOnPlot(plot)) return;
    if (!Economy.spendCoins(state, def.cost)) {
      Hud.toast(I18N.t('ui.toast.notEnoughCoins', 'Not enough coins yet!'));
      return;
    }
    const tick = state.clock.tick;
    plot.occupant = { kind: 'animal', id: animalId, placedAt: tick, lastFedAt: tick, lastWateredAt: tick, lastCollectedAt: tick, state: 'growing' };
    Hud.toast(def.icon + ' ' + I18N.t('ui.toast.placed', 'Welcome to the farm!'));
    Persistence.scheduleSave(state);
  }

  function placeBuilding(state, plot, buildingId) {
    const def = BUILDINGS_BY_ID[buildingId];
    if (!FarmRules.canPlaceOnPlot(plot)) return;
    if (!Economy.spendCoins(state, def.cost)) {
      Hud.toast(I18N.t('ui.toast.notEnoughCoins', 'Not enough coins yet!'));
      return;
    }
    plot.occupant = { kind: 'building', id: buildingId, job: null };
    Hud.toast(def.icon + ' ' + I18N.t('ui.toast.built', 'Built!'));
    Persistence.scheduleSave(state);
  }

  function waterCrop(state, plot) {
    const def = CROPS_BY_ID[plot.occupant.id];
    if (!FarmRules.canWaterCrop(plot, def, state.clock.tick)) {
      Hud.toast(I18N.t('ui.toast.notNeeded', 'Already watered enough for now!'));
      return;
    }
    plot.occupant.waterGiven += 1;
    Events.emit('water', { crop: def.id });
    Hud.toast('💧 ' + I18N.t('ui.toast.watered', 'Watered!'));
    Persistence.scheduleSave(state);
  }

  function harvestCrop(state, plot) {
    if (!FarmRules.canHarvestCrop(plot)) {
      Hud.toast(I18N.t('ui.toast.notReady', 'Not ready yet!'));
      return;
    }
    const def = CROPS_BY_ID[plot.occupant.id];
    const inSeason = FarmRules.isCropInSeason(def, Simulation.currentSeason(state));
    const result = FarmRules.cropYield(plot.occupant, def, inSeason);
    Economy.addItem(state, result.item, result.qty);
    plot.occupant = null;
    Events.emit('harvest', { crop: def.id, qty: result.qty });
    Hud.toast(def.icon + ' ' + I18N.t('ui.toast.harvested', 'Harvested!') + ' +' + result.qty);
    Persistence.scheduleSave(state);
  }

  function feedAnimal(state, plot) {
    const def = ANIMALS_BY_ID[plot.occupant.id];
    if (!FarmRules.canFeedAnimal(plot, state.inventory, def)) {
      Hud.toast(I18N.t('ui.animal.needFeed', 'Needs wheat grain to feed'));
      return;
    }
    Economy.removeItem(state, def.needs.feedItemId, 1);
    plot.occupant.lastFedAt = state.clock.tick;
    Events.emit('feedAnimal', { animal: def.id });
    Hud.toast('🍽️ ' + I18N.t('ui.toast.fed', 'Fed!'));
    Persistence.scheduleSave(state);
  }

  function waterAnimal(state, plot) {
    plot.occupant.lastWateredAt = state.clock.tick;
    Hud.toast('💧 ' + I18N.t('ui.toast.watered', 'Watered!'));
    Persistence.scheduleSave(state);
  }

  function collectAnimal(state, plot) {
    const def = ANIMALS_BY_ID[plot.occupant.id];
    if (!FarmRules.canCollectAnimal(plot, def, state.clock.tick)) return;
    Economy.addItem(state, def.produces.item, def.produces.qty);
    plot.occupant.lastCollectedAt = state.clock.tick;
    plot.occupant.state = 'growing';
    Events.emit('collectAnimal', { animal: def.id, item: def.produces.item, qty: def.produces.qty });
    Hud.toast(def.icon + ' ' + I18N.t('ui.toast.collected', 'Collected!') + ' +' + def.produces.qty);
    Persistence.scheduleSave(state);
  }

  function startRecipe(state, plot, recipeId) {
    const recipe = RECIPES_BY_ID[recipeId];
    if (!FarmRules.canStartRecipe(plot, recipe, state.inventory)) return;
    recipe.inputs.forEach(function (inp) { Economy.removeItem(state, inp.item, inp.qty); });
    plot.occupant.job = { recipeId: recipeId, startedAt: state.clock.tick, readyNotified: false };
    Hud.toast(I18N.t('ui.toast.started', 'Started!') + ' ' + BUILDINGS_BY_ID[plot.occupant.id].icon);
    Persistence.scheduleSave(state);
  }

  function collectBuilding(state, plot) {
    const job = plot.occupant.job;
    const recipe = RECIPES_BY_ID[job.recipeId];
    if (!FarmRules.canCollectRecipe(plot, recipe, state.clock.tick)) return;
    Economy.addItem(state, recipe.output.item, recipe.output.qty);
    plot.occupant.job = null;
    Events.emit('process', { recipe: recipe.id });
    Hud.toast('✨ ' + I18N.t('ui.toast.collected', 'Collected!') + ' ' + recipe.output.item.replace('_', ' '));
    Persistence.scheduleSave(state);
  }

  function unlockPlot(state, plot) {
    const cost = Economy.plotUnlockCost(plot.index);
    if (!FarmRules.canUnlockPlot(plot, state.coins, cost)) {
      Hud.toast(I18N.t('ui.toast.notEnoughCoins', 'Not enough coins yet!'));
      return;
    }
    Economy.spendCoins(state, cost);
    plot.unlocked = true;
    Hud.toast('🔓 ' + I18N.t('ui.toast.unlocked', 'Plot unlocked!'));
    Persistence.scheduleSave(state);
  }

  function showCropInfo(state, plot, screenX, screenY) {
    const def = CROPS_BY_ID[plot.occupant.id];
    const progress = FarmRules.cropProgress(plot.occupant, def, state.clock.tick);
    const name = I18N.t('crop.' + def.id + '.name', def.name);
    const fact = I18N.t('crop.' + def.id + '.fact', def.educational);
    const lines = [
      '<strong>' + def.icon + ' ' + name + '</strong>',
      plot.occupant.state === 'ready'
        ? I18N.t('ui.building.ready', 'Ready!')
        : I18N.t('ui.info.growth', 'Growth') + ': ' + Math.round(progress.frac * 100) + '%',
      I18N.t('ui.info.water', 'Water') + ': ' + Math.min(plot.occupant.waterGiven, def.waterRequired) + '/' + def.waterRequired,
      '<em>💡 ' + fact + '</em>'
    ];
    Modals.showTooltip(screenX, screenY, lines);
  }

  function handlePlotTap(state, ui, index, screenX, screenY) {
    const plot = state.plots[index];
    if (!plot) return;

    if (!plot.unlocked) {
      Modals.showUnlockPlot(state, plot, function () { unlockPlot(state, plot); });
      return;
    }

    if (!plot.occupant) {
      if (ui.tool && ui.tool.type === 'plant-crop') { placeCrop(state, plot, ui.tool.id); return; }
      if (ui.tool && ui.tool.type === 'place-animal') { placeAnimal(state, plot, ui.tool.id); return; }
      if (ui.tool && ui.tool.type === 'place-building') { placeBuilding(state, plot, ui.tool.id); return; }
      Hud.toast(I18N.t('ui.plot.empty.hint', 'Tap Plant to grow something here!'));
      return;
    }

    if (plot.occupant.kind === 'crop') {
      if (ui.tool && ui.tool.type === 'water') { waterCrop(state, plot); return; }
      if (ui.tool && ui.tool.type === 'harvest') { harvestCrop(state, plot); return; }
      showCropInfo(state, plot, screenX, screenY);
      return;
    }

    if (plot.occupant.kind === 'animal') {
      Modals.showAnimalInfo(state, plot, {
        feed: function () { feedAnimal(state, plot); },
        water: function () { waterAnimal(state, plot); },
        collect: function () { collectAnimal(state, plot); }
      });
      return;
    }

    if (plot.occupant.kind === 'building') {
      if (plot.occupant.job) {
        const recipe = RECIPES_BY_ID[plot.occupant.job.recipeId];
        if (FarmRules.canCollectRecipe(plot, recipe, state.clock.tick)) {
          collectBuilding(state, plot);
        } else {
          const progress = FarmRules.recipeProgress(plot.occupant.job, recipe, state.clock.tick);
          Modals.showTooltip(screenX, screenY, [I18N.t('ui.building.inProgress', 'Working...') + ' ' + Math.round(progress.frac * 100) + '%']);
        }
      } else {
        Modals.showBuildingRecipes(state, plot, function (recipeId) { startRecipe(state, plot, recipeId); });
      }
      return;
    }
  }

  function setupCanvas(state, ui, canvas) {
    canvas.addEventListener('pointerdown', function (e) {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const geom = canvas._geom || Render.resize(canvas);
      const g = Render.screenToGrid(geom, x, y);
      if (g.col < 0 || g.col >= geom.cols || g.row < 0 || g.row >= geom.rows) return;
      const index = g.row * geom.cols + g.col;
      Modals.hideTooltip();
      handlePlotTap(state, ui, index, e.clientX, e.clientY);
      Hud.refresh(state, ui);
    });
  }

  return {
    setupToolBelt: setupToolBelt,
    setupCanvas: setupCanvas,
    unlockPlot: unlockPlot,
    sellItem: function (state, itemId) { Economy.sellItem(state, itemId, 1); Persistence.scheduleSave(state); }
  };
})();
