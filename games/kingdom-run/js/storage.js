// ── Local save data (no backend — see GAME_SPEC.md § Data Persistence & Local Storage) ──
//
// Everything here is scoped to this browser/device via localStorage. There is
// no server, no accounts, and no sync. Reads/writes are wrapped so a quota
// error, private-browsing restriction, or disabled storage never blocks play.

const STORAGE_KEY = 'kingdomRun.saveData';
const SAVE_DATA_VERSION = 2; // bump only when the saved shape actually changes

function getDefaultSaveData() {
    return {
        version: SAVE_DATA_VERSION,
        settings: {
            audioVolume: 0.8,
            audioMuted: false,
            controlOpacity: 0.85,
            controlSize: 'normal'
        },
        highScore: 0,
        levels: {
            '1': { unlocked: true, completed: false, bestScore: 0, bestTimeMs: null }
        },
        // Explicit mid-level "Save & Quit" slot (see GAME_SPEC.md § Data
        // Persistence & Local Storage) — null when there's nothing to
        // resume. Populated only by an explicit player action, never
        // autosaved, and cleared on restart/level-complete/game-over so a
        // stale run is never offered as "Continue".
        inProgress: null
    };
}

// Migration chain: migrations[N] upgrades a save from version N to N+1.
// Each entry mutates and returns `data`. Keep migrations additive — never
// drop a player's existing progress (highScore, level completion) when
// backfilling a new field.
const migrations = {
    1: (data) => {
        data.inProgress = null;
        data.version = 2;
        return data;
    }
    // Example for the next schema change:
    // 2: (data) => { data.settings.someNewField = true; data.version = 3; return data; }
};

function migrate(data) {
    let safety = 0;
    while (data.version < SAVE_DATA_VERSION && migrations[data.version] && safety++ < 50) {
        data = migrations[data.version](data);
    }
    return data;
}

// Shallow defensive merge: backfills any missing top-level/second-level key
// from defaults without discarding values already present in `data`.
function mergeWithDefaults(data, defaults) {
    const out = { ...defaults, ...data };
    for (const key of Object.keys(defaults)) {
        if (defaults[key] && typeof defaults[key] === 'object' && !Array.isArray(defaults[key])) {
            out[key] = { ...defaults[key], ...(data[key] || {}) };
        }
    }
    return out;
}

function loadSaveData() {
    const defaults = getDefaultSaveData();
    let raw;
    try {
        raw = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
        // localStorage unavailable entirely (disabled, some private-browsing modes).
        return defaults;
    }

    if (!raw) return defaults;

    let data;
    try {
        data = JSON.parse(raw);
    } catch (e) {
        // Corrupted JSON — fall back to defaults rather than crash.
        return defaults;
    }

    if (typeof data !== 'object' || data === null || typeof data.version !== 'number') {
        return defaults;
    }

    if (data.version > SAVE_DATA_VERSION) {
        // Written by a newer build (e.g. after a rollback). Don't guess at a
        // shape we don't understand.
        return defaults;
    }

    let migrated = false;
    if (data.version < SAVE_DATA_VERSION) {
        data = migrate(data);
        data.version = SAVE_DATA_VERSION;
        migrated = true;
    }

    data = mergeWithDefaults(data, defaults);

    // Persist the upgraded shape immediately rather than leaving the older
    // shape on disk until some unrelated action happens to trigger a save —
    // otherwise every load until then re-runs the same migration on stale
    // data, and anything reading localStorage directly sees a stale version.
    if (migrated) saveSaveData(data);

    return data;
}

function saveSaveData(data) {
    data.version = SAVE_DATA_VERSION;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return true;
    } catch (e) {
        // Write failed (quota exceeded, storage disabled, etc). Gameplay
        // continues; the in-memory copy just won't survive a reload.
        return false;
    }
}

const KingdomRunStorage = {
    load: loadSaveData,
    save: saveSaveData,
    getDefault: getDefaultSaveData,

    updateSettings(saveData, partialSettings) {
        saveData.settings = { ...saveData.settings, ...partialSettings };
        saveSaveData(saveData);
        return saveData;
    },

    reportHighScore(saveData, score) {
        if (score > saveData.highScore) saveData.highScore = score;
        saveSaveData(saveData);
        return saveData;
    },

    reportLevelResult(saveData, levelId, { score, timeMs, completed }) {
        const key = String(levelId);
        const existing = saveData.levels[key] || { unlocked: true, completed: false, bestScore: 0, bestTimeMs: null };
        existing.completed = existing.completed || !!completed;
        existing.bestScore = Math.max(existing.bestScore, score);
        if (timeMs != null && (existing.bestTimeMs == null || timeMs < existing.bestTimeMs)) {
            existing.bestTimeMs = timeMs;
        }
        existing.unlocked = true;
        saveData.levels[key] = existing;
        saveSaveData(saveData);
        return saveData;
    },

    saveInProgress(saveData, progress) {
        saveData.inProgress = { ...progress, savedAt: Date.now() };
        saveSaveData(saveData);
        return saveData;
    },

    clearInProgress(saveData) {
        if (saveData.inProgress !== null) {
            saveData.inProgress = null;
            saveSaveData(saveData);
        }
        return saveData;
    }
};

window.KingdomRunStorage = KingdomRunStorage;
