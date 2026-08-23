// Little Farm School — global configuration constants.
// Kept separate from content data (data-*.js) so tuning numbers (grid size,
// time scale, save key) never require touching crops/animals/recipes.

const CONFIG = {
  saveKey: 'farm-school-save-v1',
  // Bump this whenever the save shape changes in a way old saves can't
  // just be loaded as-is — including changing gridCols/gridRows, since
  // state.plots.length silently stops matching what render.js assumes
  // about the grid otherwise (an old, shorter plots array read against
  // the new column count renders as a squashed few-row strip instead of
  // the full grid — exactly the bug that shipped without this bump).
  // persistence.js has no migration chain yet, so bumping this discards
  // old saves outright rather than upgrading them in place; write a
  // migration there instead once real players have progress worth
  // preserving.
  schemaVersion: 2,

  // A world bigger than any one screen: the field is rendered at a
  // natural, readable tile size (see render.js computeGeometry) rather
  // than shrunk to fit, so most of it is only reachable by panning/
  // scrolling — see PLAN.md §9 "Camera & world size".
  //
  // 60x60 (3,600 plots) is a deliberate ceiling, not an arbitrary round
  // number: state.plots holds one object per plot and gets JSON-
  // serialized into localStorage on every autosave (see persistence.js),
  // and render.js sorts/iterates every plot each frame. At this size a
  // save is well under 1MB (localStorage quotas are typically ~5-10MB)
  // and the per-frame sort is a few thousand elements (imperceptible at
  // 60fps) — both comfortably safe without changing how state or
  // rendering work. A dense per-plot grid stops being safe well before
  // six figures of plots: at that scale most of the array would be
  // default "locked, empty" filler nobody will ever reach anyway, so it
  // would need a sparse/lazy world model (only store and draw what's
  // actually been touched or is on screen) rather than just a bigger
  // number here.
  gridCols: 60,
  gridRows: 60,
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

  // Cost, in coins, to unlock the Nth plot (0-indexed) beyond the
  // starting set. Growth is slower than a smaller field would need — at
  // the far edge of a 3,600-plot field (index ~3599) this is still only
  // in the low thousands of coins, not the tens of thousands a steeper
  // per-plot rate would reach — since there's now far more field to
  // eventually grow into than any player needs to fully unlock.
  plotUnlockCost(index) {
    return 20 + index * 2;
  }
};

if (typeof module === 'object' && module.exports) {
  module.exports = CONFIG;
}
