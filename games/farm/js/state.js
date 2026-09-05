// Canonical game-state shape — PLAN.md §7. A single factory function so
// there is exactly one place that defines "what a fresh save looks like".

function createInitialState() {
  const plots = [];
  const total = CONFIG.gridCols * CONFIG.gridRows;
  for (let i = 0; i < total; i++) {
    // Buy-to-expand economy (PLAN.md §10/§14): only the starting cluster
    // (row 0, col < initialUnlockedPlots — the same span terrainSafeCols
    // uses to force soil, see farm-rules.js) is unlocked from the start.
    // Every other plot is locked until a player spends coins to unlock it
    // (farm-rules.js canUnlockPlot, input.js unlockPlot, Modals.
    // showUnlockPlot, economy.js plotUnlockCost) — any locked plot can be
    // unlocked directly, in any order, not just the nearest one.
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
