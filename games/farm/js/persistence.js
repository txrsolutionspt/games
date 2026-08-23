// localStorage load/save/reset — PLAN.md §7. Autosave is debounced so
// gameplay never blocks on a synchronous write. No server, no accounts —
// see ../PRIVACY.md.

const Persistence = (function () {
  let saveTimer = null;

  function load() {
    try {
      const raw = localStorage.getItem(CONFIG.saveKey);
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
      localStorage.setItem(CONFIG.saveKey, JSON.stringify(state));
    } catch (e) {
      console.warn('Little Farm School: failed to save', e);
    }
  }

  function scheduleSave(state) {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(function () { saveNow(state); }, CONFIG.autosaveDebounceMs);
  }

  function reset() {
    try {
      if (saveTimer) clearTimeout(saveTimer);
      localStorage.removeItem(CONFIG.saveKey);
    } catch (e) {
      console.warn('Little Farm School: failed to reset save', e);
    }
  }

  return { load: load, saveNow: saveNow, scheduleSave: scheduleSave, reset: reset };
})();
