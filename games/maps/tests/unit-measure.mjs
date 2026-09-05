// Unit tests for the pure geometry math in js/geo/measure.js — no browser,
// no server. Run: node tests/unit-measure.mjs
import {
  haversineDistance,
  lineLengthMeters,
  polygonAreaMeters,
  formatDistance,
  formatArea,
  formatCoordinate,
  geometryBounds,
  featureCollectionBounds,
} from "../js/geo/measure.js";

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

function approx(actual, expected, tolerance) {
  return Math.abs(actual - expected) <= tolerance;
}

console.log("== haversineDistance / lineLengthMeters ==");
// One degree of longitude at the equator is ~111.32 km.
const oneDegreeAtEquator = haversineDistance([0, 0], [1, 0]);
check("1° longitude at the equator ≈ 111.32 km", approx(oneDegreeAtEquator, 111320, 200), `got ${oneDegreeAtEquator.toFixed(0)}m`);
check("distance to the same point is 0", haversineDistance([10, 20], [10, 20]) === 0);

const line = [[0, 0], [1, 0], [1, 1]];
const expectedLineLength = haversineDistance([0, 0], [1, 0]) + haversineDistance([1, 0], [1, 1]);
check("lineLengthMeters sums consecutive segments", lineLengthMeters(line) === expectedLineLength);
check("lineLengthMeters of a single point is 0", lineLengthMeters([[5, 5]]) === 0);

console.log("\n== polygonAreaMeters ==");
// A ~1°x1° square near the equator, where degrees are least distorted —
// roughly 111km x 111km ≈ 1.23e10 m².
const square = [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]];
const squareArea = polygonAreaMeters(square);
check("~1°×1° square area near the equator is plausible", approx(squareArea, 1.23e10, 1e9), `got ${squareArea.toExponential(3)}`);
check("polygonAreaMeters ignores winding direction (abs value)", polygonAreaMeters([[...square[0]].reverse()]) === squareArea);
check("polygonAreaMeters of an empty rings array is 0", polygonAreaMeters([]) === 0);

// A hole should subtract from the outer ring's area.
const withHole = [
  [[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]],
  [[0.5, 0.5], [1, 0.5], [1, 1], [0.5, 1], [0.5, 0.5]],
];
const outerOnly = polygonAreaMeters([withHole[0]]);
const withHoleArea = polygonAreaMeters(withHole);
check("a hole reduces the total area", withHoleArea < outerOnly, `outer=${outerOnly.toExponential(2)} withHole=${withHoleArea.toExponential(2)}`);

console.log("\n== formatDistance / formatArea / formatCoordinate ==");
check("formatDistance under 1km uses meters", formatDistance(250) === "250 m");
check("formatDistance at/over 1km uses km", formatDistance(1500) === "1.5 km");
check("formatArea under 1 hectare has no ha suffix", !formatArea(500).includes("ha"));
check("formatArea at/over 1 hectare adds a ha suffix", formatArea(50000).includes("ha"));
check("formatCoordinate is 'lat, lng' with 6 decimals", formatCoordinate([-8.5, 41.2]) === "41.200000, -8.500000");

console.log("\n== geometryBounds / featureCollectionBounds ==");
const pointBounds = geometryBounds({ type: "Point", coordinates: [5, 10] });
check("bounds of a single point collapse to that point", JSON.stringify(pointBounds) === JSON.stringify([[5, 10], [5, 10]]));

const lineBounds = geometryBounds({ type: "LineString", coordinates: [[0, 0], [10, -5], [3, 8]] });
check("LineString bounds cover every vertex", JSON.stringify(lineBounds) === JSON.stringify([[0, -5], [10, 8]]));

const polyBounds = geometryBounds({ type: "Polygon", coordinates: square });
check("Polygon bounds unwrap the nested ring array", JSON.stringify(polyBounds) === JSON.stringify([[0, 0], [1, 1]]));

const featureBounds = featureCollectionBounds([
  { geometry: { type: "Point", coordinates: [-5, -5] } },
  { geometry: { type: "Point", coordinates: [5, 5] } },
]);
check("featureCollectionBounds spans every feature", JSON.stringify(featureBounds) === JSON.stringify([[-5, -5], [5, 5]]));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
