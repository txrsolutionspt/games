// ── Local save data (no backend — see GAME_SPEC.md § Data Persistence & Local Storage) ──
//
// Everything here is scoped to this browser/device via localStorage. There is
// no server, no accounts, and no sync. Reads/writes are wrapped so a quota
// error, private-browsing restriction, or disabled storage never blocks play.

const STORAGE_KEY = 'kingdomRun.saveData';
const SAVE_DATA_VERSION = 3; // bump only when the saved shape actually changes

// See games/kingdom-run/LEVELS.md for what each level is. Only level 1
// starts unlocked; completing a level unlocks the next one (see
// KingdomRunStorage.reportLevelResult).
const TOTAL_LEVELS = 5;

function defaultLevelsMap() {
    const levels = {};
    for (let id = 1; id <= TOTAL_LEVELS; id++) {
        levels[String(id)] = { unlocked: id === 1, completed: false, bestScore: 0, bestTimeMs: null };
    }
    return levels;
}

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
        levels: defaultLevelsMap(),
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
    },
    2: (data) => {
        // Levels 2-5 shipped (see LEVELS.md) — add locked entries for them.
        // (mergeWithDefaults would backfill these anyway since `levels` is
        // merged key-by-key, but doing it explicitly here keeps the
        // migration chain the single source of truth for what changed at
        // each version, matching the 1->2 migration above.)
        for (let id = 2; id <= TOTAL_LEVELS; id++) {
            const key = String(id);
            if (!data.levels[key]) {
                data.levels[key] = { unlocked: false, completed: false, bestScore: 0, bestTimeMs: null };
            }
        }
        data.version = 3;
        return data;
    }
    // Example for the next schema change:
    // 3: (data) => { data.settings.someNewField = true; data.version = 4; return data; }
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

        if (completed && levelId < TOTAL_LEVELS) {
            const nextKey = String(levelId + 1);
            const next = saveData.levels[nextKey] || { unlocked: false, completed: false, bestScore: 0, bestTimeMs: null };
            next.unlocked = true;
            saveData.levels[nextKey] = next;
        }

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
    },

    TOTAL_LEVELS
};

window.KingdomRunStorage = KingdomRunStorage;
