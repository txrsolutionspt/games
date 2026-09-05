// Tick loop — PLAN.md §8: crop growth, animal needs, machine processing,
// day/season/weather. Growth/produce/job progress are pure functions of
// elapsed ticks (see farm-rules.js), so advancing the clock is *itself*
// the offline catch-up — no per-tick replay loop is needed for those. Only
// day-boundary side effects (rainy-day and lake-irrigation auto-watering)
// need to walk each day that passed, which the bounded catch-up keeps cheap.

const Simulation = (function () {
  // A stable hash of the day index in [0, 1) — deterministic, so the same
  // day always rolls the same weather without needing to store it in the
  // save file.
  function hashDay(day) {
    const x = Math.sin((day + 1) * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  }

  function dayForTick(tick) {
    return Math.floor(tick / CONFIG.dayLengthSec);
  }

  function seasonForDay(day) {
    const idx = Math.floor(day / CONFIG.daysPerSeason) % SEASONS.length;
    return SEASONS[idx];
  }

  function weatherForDay(day) {
    const table = WEATHER_TABLE[seasonForDay(day)];
    const r = hashDay(day);
    let acc = 0;
    const keys = Object.keys(table);
    for (let i = 0; i < keys.length; i++) {
      acc += table[keys[i]];
      if (r <= acc) return keys[i];
    }
    return keys[keys.length - 1];
  }

  function currentDay(state) { return dayForTick(state.clock.tick); }
  function currentSeason(state) { return seasonForDay(currentDay(state)); }
  function currentWeather(state) { return weatherForDay(currentDay(state)); }

  // Rain waters every still-growing crop once for the day — free, and
  // never more than a crop's own waterRequired count.
  function applyRainAutoWater(state) {
    state.plots.forEach(function (plot) {
      if (!plot.occupant || plot.occupant.kind !== 'crop') return;
      if (plot.occupant.state === 'ready') return;
      const def = CROPS_BY_ID[plot.occupant.id];
      if (plot.occupant.waterGiven < def.waterRequired) plot.occupant.waterGiven += 1;
    });
  }

  // Lakes (PLAN.md §10/§17) auto-water nearby crops once per day, for
  // free — the same free-watering pattern as rain, but gated by proximity
  // to a lake instead of weather, and unconditional (happens every day,
  // rain or not).
  function applyLakeIrrigation(state) {
    state.plots.forEach(function (plot) {
      if (!plot.occupant || plot.occupant.kind !== 'crop') return;
      if (plot.occupant.state === 'ready') return;
      const col = plot.index % CONFIG.gridCols;
      const row = Math.floor(plot.index / CONFIG.gridCols);
      if (!FarmRules.isNearLake(col, row, CONFIG.terrainBlockSize, CONFIG.terrainSafeCols, CONFIG.lakeIrrigationRadius)) return;
      const def = CROPS_BY_ID[plot.occupant.id];
      if (plot.occupant.waterGiven < def.waterRequired) plot.occupant.waterGiven += 1;
    });
  }

  // Walks every in-game day boundary crossed between oldDay (exclusive) and
  // newDay (inclusive), applying rain/irrigation and emitting season-change
  // events. Bounded by CONFIG.maxOfflineCatchUpSec upstream, so this never
  // loops more than a small, predictable number of times.
  function processDayBoundaries(state, oldDay, newDay) {
    for (let day = oldDay + 1; day <= newDay; day++) {
      const prevSeason = seasonForDay(day - 1);
      const season = seasonForDay(day);
      if (weatherForDay(day) === 'rainy') applyRainAutoWater(state);
      applyLakeIrrigation(state);
      if (season !== prevSeason) Events.emit('seasonChanged', { season: season });
      Events.emit('dayChanged', { day: day, season: season, weather: weatherForDay(day) });
    }
    state.clock.lastProcessedDay = newDay;
  }

  // One simulation tick: advance the clock, flip any plot whose growth/
  // produce/job just completed, and let the UI/missions react via events.
  //
  // Only schedules a save when something in this tick is actually worth
  // persisting (a day boundary, or a crop/animal/job newly becoming ready)
  // — NOT on every tick unconditionally. Ticks fire every second forever
  // while the tab is open, so an unconditional save here would mean the
  // game effectively autosaves every ~1-2s regardless of player activity,
  // which is both wasteful and defeats the point of debouncing/delaying
  // autosave elsewhere (game.js's initial-boot delay, in particular, would
  // get clobbered by the very first tick). Direct player actions already
  // schedule their own save from input.js; the clock tick itself doesn't
  // need to force one, since lastRealTimestamp is refreshed at whatever
  // save actually happens next, not tied to a specific tick count.
  function tick(state) {
    const oldDay = currentDay(state);
    state.clock.tick += 1;
    const newDay = currentDay(state);
    let changed = false;
    if (newDay > oldDay) {
      processDayBoundaries(state, oldDay, newDay);
      changed = true;
    }

    state.plots.forEach(function (plot) {
      if (!plot.occupant) return;
      const occ = plot.occupant;

      if (occ.kind === 'crop') {
        const def = CROPS_BY_ID[occ.id];
        const progress = FarmRules.cropProgress(occ, def, state.clock.tick);
        if (progress.matured && occ.state !== 'ready') {
          occ.state = 'ready';
          changed = true;
          Events.emit('cropReady', { plot: plot, cropId: occ.id });
        }
      } else if (occ.kind === 'animal') {
        const def = ANIMALS_BY_ID[occ.id];
        const progress = FarmRules.animalProgress(occ, def, state.clock.tick);
        if (progress.ready && occ.state !== 'ready') {
          occ.state = 'ready';
          changed = true;
          Events.emit('produceReady', { plot: plot, animalId: occ.id });
        }
      } else if (occ.kind === 'building' && occ.job) {
        const def = RECIPES_BY_ID[occ.job.recipeId];
        const progress = FarmRules.recipeProgress(occ.job, def, state.clock.tick);
        if (progress.ready && !occ.job.readyNotified) {
          occ.job.readyNotified = true;
          changed = true;
          Events.emit('productReady', { plot: plot, recipeId: occ.job.recipeId });
        }
      }
    });

    Events.emit('tick', { tick: state.clock.tick, day: newDay, season: currentSeason(state), weather: currentWeather(state) });
    if (changed) Persistence.scheduleSave(state);
  }

  // Called once at boot: fast-forwards the clock (and any day boundaries
  // crossed) to account for real time that passed while the tab was closed,
  // capped so a long-neglected save can't trigger an unbounded replay.
  //
  // Returns a summary for game.js's "welcome back" popup (Modals.
  // showWelcomeBack) describing what's now waiting for the player, or null
  // if there's nothing worth telling them about (no time passed, or too
  // little time passed for anything to actually finish). Counts are read
  // with the same FarmRules progress functions the live tick() loop uses,
  // computed here because catchUpOffline — unlike tick() — never flips
  // occupant.state to 'ready' itself (see tick() above); that still only
  // happens on the first live tick after boot, so this has to check
  // readiness directly rather than count 'ready' flags that don't exist
  // yet.
  function catchUpOffline(state) {
    const elapsedRealSec = Math.max(0, Math.floor((Date.now() - (state.clock.lastRealTimestamp || Date.now())) / 1000));
    const catchUpSec = Math.min(elapsedRealSec, CONFIG.maxOfflineCatchUpSec);
    if (catchUpSec <= 0) return null;
    const oldDay = currentDay(state);
    state.clock.tick += Math.floor(catchUpSec * CONFIG.timeScale);
    const newDay = currentDay(state);
    if (newDay > oldDay) processDayBoundaries(state, oldDay, newDay);

    let cropsReady = 0, animalsReady = 0, jobsReady = 0;
    state.plots.forEach(function (plot) {
      const occ = plot.occupant;
      if (!occ) return;
      if (occ.kind === 'crop' && occ.state !== 'ready') {
        if (FarmRules.cropProgress(occ, CROPS_BY_ID[occ.id], state.clock.tick).matured) cropsReady++;
      } else if (occ.kind === 'animal' && occ.state !== 'ready') {
        if (FarmRules.animalProgress(occ, ANIMALS_BY_ID[occ.id], state.clock.tick).ready) animalsReady++;
      } else if (occ.kind === 'building' && occ.job && !occ.job.readyNotified) {
        if (FarmRules.recipeProgress(occ.job, RECIPES_BY_ID[occ.job.recipeId], state.clock.tick).ready) jobsReady++;
      }
    });

    const daysPassed = newDay - oldDay;
    if (daysPassed <= 0 && cropsReady === 0 && animalsReady === 0 && jobsReady === 0) return null;
    return { daysPassed: daysPassed, cropsReady: cropsReady, animalsReady: animalsReady, jobsReady: jobsReady };
  }

  let intervalId = null;

  function start(state) {
    stop();
    intervalId = setInterval(function () { tick(state); }, CONFIG.tickIntervalMs / CONFIG.timeScale);
  }

  function stop() {
    if (intervalId) clearInterval(intervalId);
    intervalId = null;
  }

  return {
    dayForTick: dayForTick,
    seasonForDay: seasonForDay,
    weatherForDay: weatherForDay,
    currentDay: currentDay,
    currentSeason: currentSeason,
    currentWeather: currentWeather,
    catchUpOffline: catchUpOffline,
    tick: tick,
    start: start,
    stop: stop
  };
})();

if (typeof module === 'object' && module.exports) {
  module.exports = Simulation;
}
