// Registry of "My Maps" — each map's own object data and settings live
// under their own namespaced keys (see local-storage.js / map-settings.js);
// this module only tracks which maps exist, their names, and which one is
// active.
const INDEX_KEY = "maps-v1";
const LEGACY_OBJECTS_KEY = "map-editor-data-v1";
const LEGACY_SETTINGS_KEY = "map-settings-v1";

// Set once, only when this load has to bootstrap a brand-new install (no
// index, no legacy data either) — the signal that the initial map should
// get the onboarding demo objects. Read via takeNeedsSeedingFlag().
let pendingSeedFlag = false;

function nowISO() {
  return new Date().toISOString();
}

function makeMapId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `map_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function readIndex() {
  const raw = localStorage.getItem(INDEX_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed.maps) && parsed.maps.length > 0 && parsed.activeMapId) {
      return parsed;
    }
  } catch (error) {
    console.error("Invalid maps index in localStorage, ignoring it.", error);
  }
  return null;
}

function writeIndex(index) {
  localStorage.setItem(INDEX_KEY, JSON.stringify(index));
}

// Installs from before "My Maps" existed kept everything under two flat
// keys. The first time this runs against that data, fold it into a single
// "My Map" entry under the new per-map keys instead of discarding it. A
// genuinely fresh install (no legacy keys either) still creates that one
// map, just empty — and flags that it should get the onboarding demo data.
function migrateLegacyData() {
  const id = makeMapId();
  const timestamp = nowISO();

  const legacyObjects = localStorage.getItem(LEGACY_OBJECTS_KEY);
  if (legacyObjects !== null) {
    localStorage.setItem(`${LEGACY_OBJECTS_KEY}:${id}`, legacyObjects);
    localStorage.removeItem(LEGACY_OBJECTS_KEY);
  } else {
    pendingSeedFlag = true;
  }

  const legacySettings = localStorage.getItem(LEGACY_SETTINGS_KEY);
  if (legacySettings !== null) {
    localStorage.setItem(`${LEGACY_SETTINGS_KEY}:${id}`, legacySettings);
    localStorage.removeItem(LEGACY_SETTINGS_KEY);
  }

  const index = {
    version: 1,
    activeMapId: id,
    maps: [{ id, name: "My Map", createdAt: timestamp, updatedAt: timestamp }],
  };
  writeIndex(index);
  return index;
}

export function ensureMapsIndex() {
  return readIndex() || migrateLegacyData();
}

// Only ever true once per fresh install, the first time this module is
// asked about the index — never again after that (the index now exists).
export function takeNeedsSeedingFlag() {
  const value = pendingSeedFlag;
  pendingSeedFlag = false;
  return value;
}

export function listMaps() {
  return ensureMapsIndex().maps;
}

export function getActiveMapId() {
  return ensureMapsIndex().activeMapId;
}

export function setActiveMapId(id) {
  const index = ensureMapsIndex();
  if (!index.maps.some((map) => map.id === id)) return;
  index.activeMapId = id;
  writeIndex(index);
}

export function createMap(name) {
  const index = ensureMapsIndex();
  const id = makeMapId();
  const timestamp = nowISO();

  index.maps.push({ id, name: name || "New Map", createdAt: timestamp, updatedAt: timestamp });
  index.activeMapId = id;
  writeIndex(index);
  return id;
}

export function renameMap(id, name) {
  const index = ensureMapsIndex();
  const map = index.maps.find((entry) => entry.id === id);
  const trimmed = (name || "").trim();
  if (!map || !trimmed) return;

  map.name = trimmed;
  map.updatedAt = nowISO();
  writeIndex(index);
}

// Returns false (and does nothing) if this is the last remaining map —
// there must always be at least one.
export function deleteMap(id) {
  const index = ensureMapsIndex();
  if (index.maps.length <= 1) return false;

  index.maps = index.maps.filter((map) => map.id !== id);
  if (index.activeMapId === id) {
    index.activeMapId = index.maps[0].id;
  }
  writeIndex(index);

  localStorage.removeItem(`${LEGACY_OBJECTS_KEY}:${id}`);
  localStorage.removeItem(`${LEGACY_SETTINGS_KEY}:${id}`);
  return true;
}
