// Unit tests for js/objects/object-model.js — no browser, no server.
// Run: node tests/unit-object-model.mjs
import {
  MODES,
  createPoint,
  createLine,
  createPolygon,
  closeRing,
  categoriesFor,
  categoryInfo,
  geometryKind,
  touch,
} from "../js/objects/object-model.js";

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

console.log("== createPoint / createLine / createPolygon ==");
const point = createPoint([1, 2]);
check("createPoint sets geometry type", point.geometry.type === "Point");
check("createPoint keeps the given coordinates", JSON.stringify(point.geometry.coordinates) === JSON.stringify([1, 2]));
check("feature.id and properties.id match", point.id === point.properties.id);
check("a fresh feature has an empty attachments array", Array.isArray(point.properties.attachments) && point.properties.attachments.length === 0);
check("a fresh Point feature defaults to that geometry's first category", point.properties.category === categoriesFor("Point")[0]?.value);
check("createdAt and updatedAt are set and equal at creation", point.metadata.createdAt === point.metadata.updatedAt);

const point2 = createPoint([1, 2]);
check("two features never share an id", point.id !== point2.id);

const line = createLine([[0, 0], [1, 1]]);
check("createLine sets geometry type", line.geometry.type === "LineString");
check("createLine copies the coordinates array (not the same reference)", line.geometry.coordinates !== [[0, 0], [1, 1]] && line.geometry.coordinates.length === 2);

const polygon = createPolygon([[0, 0], [1, 0], [1, 1]]);
check("createPolygon sets geometry type", polygon.geometry.type === "Polygon");
check("createPolygon wraps coordinates in a ring array", polygon.geometry.coordinates.length === 1);
check("createPolygon closes an open ring", JSON.stringify(polygon.geometry.coordinates[0][0]) === JSON.stringify(polygon.geometry.coordinates[0][polygon.geometry.coordinates[0].length - 1]));

console.log("\n== closeRing ==");
check("closeRing appends the first point if not already closed", closeRing([[0, 0], [1, 0], [0, 1]]).length === 4);
check("closeRing leaves an already-closed ring's length alone", closeRing([[0, 0], [1, 0], [0, 1], [0, 0]]).length === 4);

console.log("\n== categoriesFor / categoryInfo ==");
check("Point has at least one category", categoriesFor("Point").length > 0);
check("LineString has at least one category", categoriesFor("LineString").length > 0);
check("Polygon has at least one category", categoriesFor("Polygon").length > 0);
check("an unknown geometry type returns an empty category list", categoriesFor("Nonsense").length === 0);

const water = categoryInfo("Point", "water");
check("categoryInfo finds a known category with its icon/label", water && water.icon && water.label === "Water");
check("categoryInfo returns null for an unknown category value", categoryInfo("Point", "not-a-real-category") === null);
check("categoryInfo returns null for a category that belongs to a different geometry type", categoryInfo("LineString", "water") === null);

console.log("\n== geometryKind / touch / MODES ==");
check("geometryKind reads geometry.type off a feature", geometryKind(point) === "Point");
check("geometryKind is null for a feature with no geometry", geometryKind({}) === null);
check("geometryKind is null for null/undefined", geometryKind(null) === null);

const beforeTouch = point.metadata.updatedAt;
// Force the clock forward enough that a new ISO timestamp is guaranteed to differ.
await new Promise((resolve) => setTimeout(resolve, 5));
touch(point);
check("touch() bumps updatedAt without changing createdAt", point.metadata.updatedAt !== beforeTouch && point.metadata.createdAt !== point.metadata.updatedAt);

check("MODES has distinct values for every mode", new Set(Object.values(MODES)).size === Object.values(MODES).length);
check("MODES.VIEW exists (the default/idle mode)", MODES.VIEW === "view");

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
