// localStorage load/save/reset, with named save slots ("farms") — PLAN.md
// §7. Autosave is debounced so gameplay never blocks on a synchronous
// write. No server, no accounts — see ../PRIVACY.md; slots are purely a
// local organizing label, nothing about them leaves the device.
//
// Storage shape: a small "slots index" under CONFIG.slotsKey lists every
// farm (id, name, timestamps, a lightweight preview for the picker list)
// and which one is active; each farm's actual game state is a separate
// save under CONFIG.saveKeyPrefix + ':' + id. Splitting them like this
// means listing/renaming/deleting farms never needs to load (or hold in
// memory) more than one full game state at a time.

const Persistence = (function () {
  let saveTimer = null;

  function slotSaveKey(id) {
    return CONFIG.saveKeyPrefix + ':' + id;
  }

  function readIndex() {
    try {
      const raw = localStorage.getItem(CONFIG.slotsKey);
      if (!raw) return null;
      const idx = JSON.parse(raw);
      if (!idx || !Array.isArray(idx.slots) || idx.slots.length === 0) return null;
      return idx;
    } catch (e) {
      return null;
    }
  }

  function writeIndex(idx) {
    try {
      localStorage.setItem(CONFIG.slotsKey, JSON.stringify(idx));
    } catch (e) {
      console.warn('Little Farm School: failed to save farm list', e);
    }
  }

  function newSlotId() {
    return 'slot-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
  }

  // Creates the slots index on first-ever run. If a save from before this
  // feature existed (a single fixed-key save, no slots) is sitting in
  // localStorage, it's adopted as "Farm 1" rather than left orphaned —
  // existing players keep their progress, they just see it show up as a
  // named farm now.
  function ensureIndex() {
    let idx = readIndex();
    if (idx) return idx;

    let migratedState = null;
    try {
      const oldRaw = localStorage.getItem(CONFIG.saveKeyPrefix);
      if (oldRaw) migratedState = JSON.parse(oldRaw);
    } catch (e) { /* no valid pre-slots save to migrate */ }

    const id = newSlotId();
    idx = {
      activeId: id,
      nextSlotNumber: 2,
      slots: [{
        id: id,
        name: 'Farm 1',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        preview: { coins: CONFIG.startingCoins, day: 1 }
      }]
    };

    if (migratedState) {
      try {
        localStorage.setItem(slotSaveKey(id), JSON.stringify(migratedState));
        localStorage.removeItem(CONFIG.saveKeyPrefix);
        const day = (migratedState.clock && typeof migratedState.clock.tick === 'number')
          ? Math.floor(migratedState.clock.tick / CONFIG.dayLengthSec) + 1
          : 1;
        idx.slots[0].preview = { coins: migratedState.coins || 0, day: day };
      } catch (e) { /* migration is best-effort; an empty Farm 1 is still fine */ }
    }

    writeIndex(idx);
    return idx;
  }

  function listSlots() {
    const idx = ensureIndex();
    return idx.slots.slice().sort(function (a, b) { return b.updatedAt - a.updatedAt; });
  }

  function getActiveSlotId() {
    return ensureIndex().activeId;
  }

  function setActiveSlotId(id) {
    const idx = ensureIndex();
    if (!idx.slots.some(function (s) { return s.id === id; })) return;
    idx.activeId = id;
    writeIndex(idx);
  }

  function createSlot(name) {
    const idx = ensureIndex();
    const num = idx.nextSlotNumber++;
    const id = newSlotId();
    idx.slots.push({
      id: id,
      name: (name && name.trim()) || ('Farm ' + num),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      preview: { coins: CONFIG.startingCoins, day: 1 }
    });
    writeIndex(idx);
    return id;
  }

  function renameSlot(id, name) {
    const trimmed = (name || '').trim();
    if (!trimmed) return;
    const idx = ensureIndex();
    const slot = idx.slots.find(function (s) { return s.id === id; });
    if (!slot) return;
    slot.name = trimmed.slice(0, 24);
    writeIndex(idx);
  }

  // Refuses to delete the last remaining farm — there must always be
  // somewhere for the game to boot into. Returns false in that case,
  // true once the slot (and its save) are actually gone.
  function deleteSlot(id) {
    const idx = ensureIndex();
    if (idx.slots.length <= 1) return false;
    const i = idx.slots.findIndex(function (s) { return s.id === id; });
    if (i === -1) return false;
    idx.slots.splice(i, 1);
    try { localStorage.removeItem(slotSaveKey(id)); } catch (e) { /* ignore */ }
    if (idx.activeId === id) {
      const next = idx.slots.slice().sort(function (a, b) { return b.updatedAt - a.updatedAt; })[0];
      idx.activeId = next.id;
    }
    writeIndex(idx);
    return true;
  }

  function load() {
    try {
      const id = getActiveSlotId();
      const raw = localStorage.getItem(slotSaveKey(id));
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object') return null;
      // No migrations exist yet (schema version 1 was the first shape). If a
      // future version changes the shape, add a migration chain here keyed
      // by data.version, the same pattern games/kingdom-run/js/storage.js
      // uses, so existing saves upgrade in place instead of being dropped.
      if (data.version !== CONFIG.schemaVersion) return null;
      // Belt-and-braces: even at the current schema version, a plots array
      // whose length doesn't match today's CONFIG.gridCols x gridRows can't
      // be read correctly (render.js's row/col math assumes the current
      // column count) — reject it rather than silently rendering a
      // squashed, wrong-shaped grid. This is exactly the failure mode a
      // missed schemaVersion bump caused once already.
      if (!Array.isArray(data.plots) || data.plots.length !== CONFIG.gridCols * CONFIG.gridRows) return null;
      return data;
    } catch (e) {
      console.warn('Little Farm School: failed to load save', e);
      return null;
    }
  }

  function saveNow(state) {
    try {
      state.clock.lastRealTimestamp = Date.now();
      const id = getActiveSlotId();
      localStorage.setItem(slotSaveKey(id), JSON.stringify(state));
      const idx = ensureIndex();
      const slot = idx.slots.find(function (s) { return s.id === id; });
      if (slot) {
        slot.updatedAt = Date.now();
        slot.preview = { coins: state.coins, day: Math.floor(state.clock.tick / CONFIG.dayLengthSec) + 1 };
        writeIndex(idx);
      }
    } catch (e) {
      console.warn('Little Farm School: failed to save', e);
    }
  }

  function scheduleSave(state) {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { saveNow(state); }, CONFIG.autosaveDebounceMs);
  }

  // Erases every farm and the slots index itself — the blanket "erase all
  // progress on this device" promised in PRIVACY.md / Settings > Reset
  // Game Data. Deleting one farm while keeping others is deleteSlot()
  // instead, in the Farms screen.
  function reset() {
    try {
      if (saveTimer) clearTimeout(saveTimer);
      const idx = readIndex();
      if (idx) {
        idx.slots.forEach(function (s) {
          try { localStorage.removeItem(slotSaveKey(s.id)); } catch (e) { /* ignore */ }
        });
      }
      localStorage.removeItem(CONFIG.slotsKey);
      localStorage.removeItem(CONFIG.saveKeyPrefix); // pre-slots key, if still lingering
    } catch (e) {
      console.warn('Little Farm School: failed to reset save', e);
    }
  }

  return {
    load: load,
    saveNow: saveNow,
    scheduleSave: scheduleSave,
    reset: reset,
    listSlots: listSlots,
    getActiveSlotId: getActiveSlotId,
    setActiveSlotId: setActiveSlotId,
    createSlot: createSlot,
    renameSlot: renameSlot,
    deleteSlot: deleteSlot
  };
})();

// Node-testable (see test-persistence.js): this file only ever touches
// CONFIG and localStorage as ambient globals (the same way <script> load
// order provides them in the browser), so a test just needs to set
// global.CONFIG/global.localStorage before requiring this file.
if (typeof module === 'object' && module.exports) {
  module.exports = Persistence;
}
