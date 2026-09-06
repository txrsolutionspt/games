// Little Farm School — global configuration constants.
// Kept separate from content data (data-*.js) so tuning numbers (grid size,
// time scale, save key) never require touching crops/animals/recipes.

const CONFIG = {
  // Prefix for a per-slot save (persistence.js appends ":<slotId>"); the
  // slots themselves — name, which one is active, last-played preview —
  // live under slotsKey. Both still 100% localStorage, no accounts.
  saveKeyPrefix: 'farm-school-save-v1',
  slotsKey: 'farm-school-slots-v1',
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
  // How many plots start already unlocked (state.js's createInitialState) —
  // half the field, computed below (after gridCols/gridRows) so it always
  // tracks the real field size regardless of grid dimensions. Buy-to-expand
  // is active: the player starts with a large, immediately-playable half
  // of the map (rows 0..29 of 60, row-major order) and buys their way into
  // the rest — see plotUnlockCost below for how the purchase price is
  // re-anchored to start counting from here. Also anchors the starting
  // camera focus (render.js FOCUS_COL/FOCUS_ROW).
  initialUnlockedPlots: 0, // placeholder — set below, after gridCols/gridRows

  // Terrain (PLAN.md §10): plots are grouped into blockSize x blockSize
  // blocks for terrain generation, so each terrain type reads as a
  // multi-tile patch rather than single-tile speckle. terrainSafeCols
  // guarantees row 0's first few columns are always soil regardless of the
  // hash, so the tutorial's first planting step always lands on usable
  // ground. Deliberately kept small and independent of
  // initialUnlockedPlots (a large fraction of the field, now that
  // buy-to-expand is active) — widening the guaranteed-soil zone to match
  // would strip most terrain variety, and therefore pasture/animals, out
  // of the entire starting half of the map.
  terrainBlockSize: 4,
  terrainSafeCols: 8,

  // Lake irrigation (PLAN.md §10/§17): a growing crop within this many
  // tiles of any lake gets a free daily watering, the same free-watering
  // pattern rainy weather already uses (see simulation.js
  // applyLakeIrrigation). A square neighborhood (like the terrain blocks
  // themselves), not a circle, to keep the check cheap.
  lakeIrrigationRadius: 2,

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
  // How long to wait before the very first autosave of a fresh boot, so
  // just opening the game (and closing it again a moment later) doesn't
  // immediately re-write a save that's often identical to what's already
  // there. A real action within this window reschedules straight to the
  // short debounce above (see Persistence.scheduleSave); closing the tab
  // before either fires is still covered by game.js's flush-on-hide.
  initialAutosaveDelayMs: 10000,

  startingCoins: 60,

  // Cost, in coins, to unlock the Nth *purchasable* plot (0-indexed,
  // counting from the first plot beyond the starting unlocked set, not
  // from plot 0) — re-anchored to initialUnlockedPlots so the price curve
  // always starts cheap right where purchasing actually begins, regardless
  // of how many plots start unlocked. Growth is slower than a smaller
  // field would need — at the far purchasable edge (~1,800 plots in) this
  // is still only in the low thousands of coins, not the tens of thousands
  // a steeper per-plot rate would reach — since there's far more field to
  // eventually grow into than any player needs to fully unlock.
  plotUnlockCost(index) {
    return 20 + (index - CONFIG.initialUnlockedPlots) * 2;
  }
};

CONFIG.initialUnlockedPlots = Math.floor(CONFIG.gridCols * CONFIG.gridRows / 2);

if (typeof module === 'object' && module.exports) {
  module.exports = CONFIG;
}
