// Canonical game-state shape — PLAN.md §7. A single factory function so
// there is exactly one place that defines "what a fresh save looks like".

function createInitialState() {
  const plots = [];
  const total = CONFIG.gridCols * CONFIG.gridRows;
  for (let i = 0; i < total; i++) {
    // For now, every plot starts unlocked — no buy-to-expand economy.
    // Easy to bring back later: change this to
    // `i < CONFIG.initialUnlockedPlots` again. The unlock machinery itself
    // (farm-rules.js canUnlockPlot, input.js unlockPlot, Modals.
    // showUnlockPlot) is left in place, just unreachable while every plot
    // starts unlocked.
    plots.push({ index: i, unlocked: true, occupant: null });
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
