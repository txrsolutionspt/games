// Canonical game-state shape — PLAN.md §7. A single factory function so
// there is exactly one place that defines "what a fresh save looks like".

function createInitialState() {
  const plots = [];
  const total = CONFIG.gridCols * CONFIG.gridRows;
  for (let i = 0; i < total; i++) {
    // Buy-to-expand: half the field starts unlocked (CONFIG.
    // initialUnlockedPlots), the rest is bought plot-by-plot via
    // farm-rules.js canUnlockPlot / input.js unlockPlot / Modals.
    // showUnlockPlot — see PLAN.md §10.
    plots.push({ index: i, unlocked: i < CONFIG.initialUnlockedPlots, occupant: null });
  }

  return {
    version: CONFIG.schemaVersion,
    coins: CONFIG.startingCoins,
    clock: { tick: 0, lastRealTimestamp: Date.now(), lastProcessedDay: 0 },
    plots: plots,
    inventory: {},
    missions: {},       // id -> { progress, completed }
    seenFacts: {},       // key -> true; which first-time educational popups have shown
    tutorialStep: 0,
    settings: {
      locale: null,   // null = not chosen yet, auto-detect from browser
      muted: false,
      // A brand-new farm starts "caught up" on What's New (see
      // modals.js showWhatsNew / hud.js) -- a first-time player has no
      // history to catch up on. An existing save predating this field
      // simply loads without it, which FarmRules.compareVersions treats
      // as older than everything, correctly surfacing what they've missed.
      lastSeenVersion: APP_VERSION
    }
  };
}

if (typeof module === 'object' && module.exports) {
  module.exports = { createInitialState: createInitialState };
}
