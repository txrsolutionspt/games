// Little Farm School — global configuration constants.
// Kept separate from content data (data-*.js) so tuning numbers (grid size,
// time scale, save key) never require touching crops/animals/recipes.

const CONFIG = {
  saveKey: 'farm-school-save-v1',
  schemaVersion: 1,

  gridCols: 6,
  gridRows: 6,
  initialUnlockedPlots: 8, // first N plots (row-major) are unlocked at game start

  // 1 tick = 1 real second at timeScale 1. Raising timeScale speeds up the
  // whole game (growth, animal cycles, day length) uniformly for tuning
  // without touching any content data.
  tickIntervalMs: 1000,
  timeScale: 1,

  dayLengthSec: 90,   // in-game day length, in ticks
  daysPerSeason: 3,   // in-game days before the season advances

  // Offline progress: crops/animals/day-night keep advancing while the tab
  // is closed, but catch-up is bounded so a save left untouched for weeks
  // doesn't trigger an enormous replay loop on load.
  maxOfflineCatchUpSec: 24 * 60 * 60,

  autosaveDebounceMs: 1000,

  startingCoins: 60,

  // Cost, in coins, to unlock the Nth plot (0-indexed) beyond the starting set.
  plotUnlockCost(index) {
    return 20 + index * 15;
  }
};

if (typeof module === 'object' && module.exports) {
  module.exports = CONFIG;
}
