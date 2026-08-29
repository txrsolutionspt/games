// Pointer/touch handling, tool selection, tile picking — PLAN.md §11.
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
        Modals.showBuildingShop(state, function (buildingId) {
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

  // Terrain (PLAN.md §10) is a pure function of a plot's position, never
  // stored in the save — see farm-rules.js's terrainForPlot.
  function terrainOf(plot) {
    const col = plot.index % CONFIG.gridCols;
    const row = Math.floor(plot.index / CONFIG.gridCols);
    return FarmRules.terrainForPlot(col, row, CONFIG.terrainBlockSize, CONFIG.terrainSafeCols);
  }

  function placeCrop(state, plot, cropId) {
    const def = CROPS_BY_ID[cropId];
    if (!FarmRules.canPlaceOnPlot(plot, terrainOf(plot), 'crop')) {
      Hud.toast(I18N.t('ui.toast.needsFarmland', '🌾 Needs farmland soil!'));
      return;
    }
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
    if (!FarmRules.canPlaceOnPlot(plot, terrainOf(plot), 'animal')) {
      Hud.toast(I18N.t('ui.toast.needsPasture', '🐄 Animals need pasture!'));
      return;
    }
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
    if (!FarmRules.canPlaceOnPlot(plot, terrainOf(plot), 'building')) {
      Hud.toast(I18N.t('ui.toast.needsFarmland', '🌾 Needs farmland soil!'));
      return;
    }
    // Stone (PLAN.md §10/§17), mined from mountain quarries, alongside
    // coins — checked before spending either, so a shortfall never leaves
    // the player partially charged.
    if ((state.inventory.stone || 0) < (def.stoneCost || 0)) {
      Hud.toast(I18N.t('ui.toast.needsStone', '⛏️ Needs more stone from a quarry!'));
      return;
    }
    if (!Economy.spendCoins(state, def.cost)) {
      Hud.toast(I18N.t('ui.toast.notEnoughCoins', 'Not enough coins yet!'));
      return;
    }
    if (def.stoneCost) Economy.removeItem(state, 'stone', def.stoneCost);
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

  // Quarries (PLAN.md §10/§17): a mountain tile needs no buying/placing —
  // every mountain is already a quarry, so its occupant is created lazily
  // right here on first tap rather than through a shop/tool like
  // crops/animals/buildings. Tapping again either collects (if ready) or
  // shows mining progress, mirroring how a building's job-in-progress tap
  // behaves in handlePlotTap below.
  function mineQuarry(state, plot, screenX, screenY) {
    if (!plot.occupant) {
      plot.occupant = { kind: 'quarry', lastCollectedAt: state.clock.tick };
      Persistence.scheduleSave(state);
    }
    const progress = FarmRules.quarryProgress(plot.occupant, QUARRY, state.clock.tick);
    if (!progress.ready) {
      Modals.showTooltip(screenX, screenY, [QUARRY.icon + ' ' + I18N.t('ui.building.inProgress', 'Working...') + ' ' + Math.round(progress.frac * 100) + '%']);
      return;
    }
    Economy.addItem(state, QUARRY.produces.item, QUARRY.produces.qty);
    plot.occupant.lastCollectedAt = state.clock.tick;
    Events.emit('mine', { item: QUARRY.produces.item, qty: QUARRY.produces.qty });
    Hud.toast(QUARRY.icon + ' ' + I18N.t('ui.toast.collected', 'Collected!') + ' +' + QUARRY.produces.qty);
    Persistence.scheduleSave(state);
  }

  // Lakes (PLAN.md §10/§17) are pure scenery with one automatic benefit
  // (free daily watering for nearby crops — see simulation.js
  // applyLakeIrrigation) rather than something to tap-and-collect, so
  // tapping one just explains that: the first tap shows the full
  // educational fact (like a crop's first harvest), every tap after that a
  // short reminder tooltip — the same "full fact once, short reminder
  // after" pattern showCropInfo's "i" tooltip already establishes.
  function showLakeInfo(state, plot, screenX, screenY) {
    const factKey = 'terrain.lake';
    if (!state.seenFacts[factKey]) {
      state.seenFacts[factKey] = true;
      Persistence.scheduleSave(state);
      Modals.showFact(
        I18N.t('terrain.lake.name', 'Lake'),
        '🌊',
        I18N.t('terrain.lake.irrigationFact', 'Lakes send water to nearby fields — crops planted close to a lake get watered automatically, every day, for free!')
      );
      return;
    }
    Modals.showTooltip(screenX, screenY, ['🌊 ' + I18N.t('terrain.lake.irrigationHint', 'Waters nearby crops every day, for free!')]);
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
      Modals.showUnlockPlot(state, plot, terrainOf(plot), function () { unlockPlot(state, plot); });
      return;
    }

    // Mountains and lakes (PLAN.md §10/§17) are tapped directly — mining/
    // info, not "select a tool then tap" like crops/animals/buildings —
    // so both take priority over whatever tool happens to be selected,
    // the same way an occupied plot's own interaction (below) does.
    const terrain = terrainOf(plot);
    if (terrain === 'mountain') { mineQuarry(state, plot, screenX, screenY); return; }
    if (terrain === 'lake') { showLakeInfo(state, plot, screenX, screenY); return; }

    if (!plot.occupant) {
      if (ui.tool && ui.tool.type === 'plant-crop') { placeCrop(state, plot, ui.tool.id); return; }
      if (ui.tool && ui.tool.type === 'place-animal') { placeAnimal(state, plot, ui.tool.id); return; }
      if (ui.tool && ui.tool.type === 'place-building') { placeBuilding(state, plot, ui.tool.id); return; }
      const emptyHintKey = { soil: 'ui.plot.empty.hint', pasture: 'ui.plot.empty.pasture' };
      Hud.toast(I18N.t(emptyHintKey[terrain], 'Tap Plant to grow something here!'));
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

  // Pinch-to-zoom, scroll/trackpad-to-zoom, and drag-to-pan on the farm
  // grid itself (not a tool-belt button — this is a direct-manipulation
  // gesture on the field, same as pinching a map). A single pointer that
  // doesn't move past a small threshold is still a tap (existing
  // plant/water/harvest/etc. behavior below is unaffected); one that moves
  // pans instead. Two pointers pinch-zoom, anchored at their midpoint so
  // panning and zooming blend into one continuous gesture like on a phone
  // map app. Render.clampView keeps panning within the field's own extent
  // — the field (CONFIG.gridCols × gridRows) spans multiple screens on
  // purpose, so most of it is only reachable this way, not by shrinking
  // everything to fit — and bounds zoom to a sensible min/max.
  function setupCanvas(state, ui, canvas) {
    const pointers = new Map(); // pointerId -> {x, y} in canvas-relative CSS px
    let mode = 'idle'; // 'idle' | 'drag' | 'pinch'
    let dragStart = null; // {x, y, panX, panY}
    let pinchStart = null; // {dist, mid, zoom, panX, panY}
    let moved = false;
    // Double-tap-to-reset only matters once the view is actually zoomed
    // in, so a pending tap is held briefly *only* in that case, in case a
    // second tap follows within the window — otherwise (the common,
    // zoom===1 case) every tap fires its plant/water/harvest/etc. action
    // immediately with no delay at all, same as before this feature
    // existed. Zoomed-in-only, not real-time-critical.
    let pendingTapTimer = null;

    function performTap(index, clientX, clientY) {
      Modals.hideTooltip();
      handlePlotTap(state, ui, index, clientX, clientY);
      Hud.refresh(state, ui);
    }

    function posFromEvent(e) {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
    function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
    function mid(a, b) { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }

    canvas.addEventListener('pointerdown', function (e) {
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* not universally supported; drag/pinch still work without it as long as the pointer stays over the canvas */ }
      pointers.set(e.pointerId, posFromEvent(e));
      if (pointers.size === 1) {
        const p = pointers.get(e.pointerId);
        dragStart = { x: p.x, y: p.y, panX: ui.view.panX, panY: ui.view.panY };
        moved = false;
        mode = 'drag';
      } else if (pointers.size === 2) {
        const pts = Array.from(pointers.values());
        pinchStart = { dist: dist(pts[0], pts[1]), mid: mid(pts[0], pts[1]), zoom: ui.view.zoom, panX: ui.view.panX, panY: ui.view.panY };
        mode = 'pinch';
      }
    });

    canvas.addEventListener('pointermove', function (e) {
      if (!pointers.has(e.pointerId)) return;
      pointers.set(e.pointerId, posFromEvent(e));
      const baseGeom = canvas._baseGeom || Render.resize(canvas);

      if (mode === 'drag' && pointers.size === 1) {
        const p = pointers.get(e.pointerId);
        const dx = p.x - dragStart.x, dy = p.y - dragStart.y;
        if (!moved && Math.hypot(dx, dy) > 6) moved = true;
        if (moved) {
          ui.view = Render.clampView(baseGeom, { zoom: ui.view.zoom, panX: dragStart.panX + dx, panY: dragStart.panY + dy });
        }
      } else if (mode === 'pinch' && pointers.size === 2) {
        const pts = Array.from(pointers.values());
        const d = dist(pts[0], pts[1]);
        const m = mid(pts[0], pts[1]);
        const scale = pinchStart.dist > 0 ? d / pinchStart.dist : 1;
        ui.view = Render.clampView(baseGeom, {
          zoom: pinchStart.zoom * scale,
          panX: pinchStart.panX + (m.x - pinchStart.mid.x),
          panY: pinchStart.panY + (m.y - pinchStart.mid.y)
        });
        moved = true;
      }
    });

    function endPointer(e) {
      const wasTap = mode === 'drag' && !moved && pointers.size === 1;
      const tapPos = wasTap ? pointers.get(e.pointerId) : null;
      pointers.delete(e.pointerId);

      if (pointers.size === 0) {
        mode = 'idle';
      } else if (pointers.size === 1) {
        // Dropped from a pinch (2 fingers) to 1 — start a fresh drag from
        // here rather than reusing stale pinch math, and treat the
        // gesture as "already moved" so lifting the last finger next
        // doesn't spuriously register as a tap.
        const remaining = Array.from(pointers.values())[0];
        dragStart = { x: remaining.x, y: remaining.y, panX: ui.view.panX, panY: ui.view.panY };
        moved = true;
        mode = 'drag';
      }

      if (wasTap && tapPos) {
        if (pendingTapTimer) {
          // A second tap arrived while the first was still on hold: reset
          // the view instead of acting on whatever tile is underneath —
          // checked *before* anything about which tile was tapped, since
          // on a field this much bigger than the screen the tap can
          // easily land past the grid's edge (out of bounds) after a big
          // pan, and the reset must still work there.
          clearTimeout(pendingTapTimer);
          pendingTapTimer = null;
          ui.view = { zoom: 1, panX: 0, panY: 0 };
          return;
        }

        const geom = canvas._geom || Render.resize(canvas);
        const g = Render.screenToGrid(geom, tapPos.x, tapPos.y);
        const inBounds = g.col >= 0 && g.col < geom.cols && g.row >= 0 && g.row < geom.rows;
        const index = inBounds ? g.row * geom.cols + g.col : null;
        const clientX = e.clientX, clientY = e.clientY;

        const atHome = ui.view.zoom <= 1.001 && Math.abs(ui.view.panX) < 1 && Math.abs(ui.view.panY) < 1;
        if (atHome) {
          if (index !== null) performTap(index, clientX, clientY); // nothing to reset back to: act immediately
        } else {
          // Arm the pending-tap timer even for an out-of-bounds tap (index
          // null just means the eventual action is a no-op) — a double-tap
          // must be able to cancel it and reset the view either way.
          pendingTapTimer = setTimeout(function () {
            pendingTapTimer = null;
            if (index !== null) performTap(index, clientX, clientY);
          }, 280);
        }
      }
    }

    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);

    canvas.addEventListener('wheel', function (e) {
      e.preventDefault();
      const baseGeom = canvas._baseGeom || Render.resize(canvas);
      const delta = e.deltaY > 0 ? -0.15 : 0.15;
      ui.view = Render.clampView(baseGeom, { zoom: ui.view.zoom + delta, panX: ui.view.panX, panY: ui.view.panY });
    }, { passive: false });
  }

  return {
    setupToolBelt: setupToolBelt,
    setupCanvas: setupCanvas,
    unlockPlot: unlockPlot,
    sellItem: function (state, itemId) { Economy.sellItem(state, itemId, 1); Persistence.scheduleSave(state); }
  };
})();
