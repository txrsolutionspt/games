// Unit tests for js/persistence/maps-index.js (the "My Maps" registry) —
// no browser, but it touches the real localStorage global (Node already
// provides a spec-compliant `crypto`), so this installs a minimal
// in-memory shim for localStorage before importing it.
// Run: node tests/unit-maps-index.mjs
function makeLocalStorageShim() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
    clear: () => data.clear(),
  };
}
globalThis.localStorage = makeLocalStorageShim();

const {
  ensureMapsIndex,
  takeNeedsSeedingFlag,
  listMaps,
  getActiveMapId,
  setActiveMapId,
  createMap,
  renameMap,
  deleteMap,
} = await import("../js/persistence/maps-index.js");

let passed = 0;
let failed = 0;

function check(name, cond, detail) {
  if (cond) {
    passed++;
    console.log(`  ok  ${name}`);
  } else {
    failed++;
    console.error(`FAIL  ${name}${detail !== undefined ? " — " + detail : ""}`);
  }
}

console.log("== fresh install ==");
const index = ensureMapsIndex();
check("a fresh install gets exactly one map", index.maps.length === 1);
check("the first map is named 'My Map'", index.maps[0].name === "My Map");
check("the first map is the active one", index.activeMapId === index.maps[0].id);
check("a genuinely fresh install flags that it needs seeding", takeNeedsSeedingFlag() === true);
check("the seed flag is one-shot — asking again returns false", takeNeedsSeedingFlag() === false);

console.log("\n== createMap / setActiveMapId ==");
const secondId = createMap("Trip Planning");
check("createMap returns a new, distinct id", secondId !== index.maps[0].id);
check("createMap adds it to the list", listMaps().length === 2);
check("createMap switches the active map to the new one", getActiveMapId() === secondId);

const firstId = index.maps[0].id;
setActiveMapId(firstId);
check("setActiveMapId switches back", getActiveMapId() === firstId);
setActiveMapId("not-a-real-id");
check("setActiveMapId ignores an unknown id (stays on the last valid one)", getActiveMapId() === firstId);

console.log("\n== renameMap ==");
renameMap(secondId, "  Renamed Trip  ");
check("renameMap trims whitespace", listMaps().find((m) => m.id === secondId).name === "Renamed Trip");
const beforeBlankRename = listMaps().find((m) => m.id === secondId).name;
renameMap(secondId, "   ");
check("renameMap ignores a blank/whitespace-only name", listMaps().find((m) => m.id === secondId).name === beforeBlankRename);

console.log("\n== deleteMap ==");
const thirdId = createMap("Third Map");
check("now three maps exist", listMaps().length === 3);
const deletedOk = deleteMap(thirdId);
check("deleteMap succeeds when more than one map remains", deletedOk === true);
check("the deleted map is gone from the list", !listMaps().some((m) => m.id === thirdId));

setActiveMapId(secondId);
const deletedActiveOk = deleteMap(secondId);
check("deleting the currently-active map succeeds", deletedActiveOk === true);
check("deleting the active map falls back to a remaining map", listMaps().some((m) => m.id === getActiveMapId()));

check("exactly one map remains", listMaps().length === 1);
const lastId = getActiveMapId();
const deletedLastOk = deleteMap(lastId);
check("deleteMap refuses to delete the last remaining map", deletedLastOk === false);
check("the last map is still there after the refused delete", listMaps().length === 1 && listMaps()[0].id === lastId);

console.log("\n== legacy data migration ==");
localStorage.clear();
localStorage.setItem("map-editor-data-v1", JSON.stringify({ version: 1, objects: [{ id: "x" }] }));
localStorage.setItem("map-settings-v1", JSON.stringify({ view: { center: [1, 2], zoom: 3 } }));
const migrated = ensureMapsIndex();
check("migrating pre-'My Maps' data creates exactly one map", migrated.maps.length === 1);
check("the legacy flat objects key is moved under the new map's namespaced key", localStorage.getItem(`map-editor-data-v1:${migrated.activeMapId}`) !== null);
check("the legacy flat objects key itself is removed", localStorage.getItem("map-editor-data-v1") === null);
check("the legacy flat settings key is moved under the new map's namespaced key", localStorage.getItem(`map-settings-v1:${migrated.activeMapId}`) !== null);
check("migrating existing legacy data does NOT flag for seeding (there's already real data)", takeNeedsSeedingFlag() === false);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
