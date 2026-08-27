const EARTH_RADIUS_METERS = 6378137; // WGS84 equatorial radius, matches turf.js's default

function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

export function haversineDistance([lng1, lat1], [lng2, lat2]) {
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaPhi = toRadians(lat2 - lat1);
  const deltaLambda = toRadians(lng2 - lng1);

  const a =
    Math.sin(deltaPhi / 2) ** 2 +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

export function lineLengthMeters(coordinates) {
  let total = 0;
  for (let i = 1; i < coordinates.length; i++) {
    total += haversineDistance(coordinates[i - 1], coordinates[i]);
  }
  return total;
}

// Spherical excess formula for the area of a polygon on a sphere (Robert G.
// Chamberlain & William H. Duquette, "Some Algorithms for Polygons on a
// Sphere", JPL Publication 07-03) — same algorithm turf.js's area() uses.
// `ring` is a closed GeoJSON ring (first coordinate repeated as the last).
function ringAreaMeters(ring) {
  const n = ring.length;
  if (n < 3) return 0;

  let total = 0;
  for (let i = 0; i < n; i++) {
    let lowerIndex, middleIndex, upperIndex;
    if (i === n - 2) {
      lowerIndex = n - 2;
      middleIndex = n - 1;
      upperIndex = 0;
    } else if (i === n - 1) {
      lowerIndex = n - 1;
      middleIndex = 0;
      upperIndex = 1;
    } else {
      lowerIndex = i;
      middleIndex = i + 1;
      upperIndex = i + 2;
    }

    const [lng1] = ring[lowerIndex];
    const [lng3] = ring[upperIndex];
    const [, lat2] = ring[middleIndex];

    total += (toRadians(lng3) - toRadians(lng1)) * Math.sin(toRadians(lat2));
  }

  return Math.abs((total * EARTH_RADIUS_METERS * EARTH_RADIUS_METERS) / 2);
}

// `rings` is a GeoJSON Polygon's full coordinates array: [outerRing, ...holes].
export function polygonAreaMeters(rings) {
  if (!rings || rings.length === 0) return 0;

  let total = ringAreaMeters(rings[0]);
  for (let i = 1; i < rings.length; i++) {
    total -= ringAreaMeters(rings[i]);
  }
  return total;
}

export function formatDistance(meters) {
  if (meters >= 1000) {
    return `${(meters / 1000).toLocaleString(undefined, { maximumFractionDigits: 2 })} km`;
  }
  return `${Math.round(meters).toLocaleString()} m`;
}

export function formatArea(squareMeters) {
  const base = `${Math.round(squareMeters).toLocaleString()} m²`;
  if (squareMeters >= 10000) {
    const hectares = (squareMeters / 10000).toLocaleString(undefined, { maximumFractionDigits: 2 });
    return `${base} (${hectares} ha)`;
  }
  return base;
}

export function formatCoordinate([lng, lat]) {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

function collectCoordinatePairs(coordinates, out) {
  if (typeof coordinates[0] === "number") {
    out.push(coordinates);
  } else {
    for (const nested of coordinates) collectCoordinatePairs(nested, out);
  }
}

// Works for any geometry's coordinates (Point/LineString/Polygon nest to
// different depths) by recursively flattening down to [lng, lat] pairs.
export function geometryBounds(geometry) {
  const points = [];
  collectCoordinatePairs(geometry.coordinates, points);

  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;

  for (const [lng, lat] of points) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }

  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ];
}
