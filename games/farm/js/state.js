// Canonical game-state shape — PLAN.md §7. A single factory function so
// there is exactly one place that defines "what a fresh save looks like".

function createInitialState() {
  const plots = [];
  const total = CONFIG.gridCols * CONFIG.gridRows;
  for (let i = 0; i < total; i++) {
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
    settings: { locale: null } // null = not chosen yet, auto-detect from browser
  };
}

if (typeof module === 'object' && module.exports) {
  module.exports = { createInitialState: createInitialState };
}
