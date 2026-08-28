export const MODES = Object.freeze({
  VIEW: "view",
  ADD_POINT: "add-point",
  DRAW_LINE: "draw-line",
  DRAW_POLYGON: "draw-polygon",
  EDIT_SHAPE: "edit-shape",
});

export const CATEGORIES = Object.freeze({
  Point: [
    { value: "place", label: "Other", icon: "📍" },
    { value: "house", label: "House", icon: "🏠" },
    { value: "farm", label: "Farm", icon: "🚜" },
    { value: "water", label: "Water", icon: "💧" },
    { value: "landmark", label: "Landmark", icon: "🏛️" },
    { value: "park", label: "Park", icon: "🌳" },
    { value: "incident", label: "Incident", icon: "⚠️" },
    { value: "parking", label: "Parking", icon: "🅿️" },
  ],
  LineString: [
    { value: "route", label: "Route", icon: "🧭" },
    { value: "road", label: "Road", icon: "🛣️" },
    { value: "trail", label: "Trail", icon: "🥾" },
    { value: "river", label: "River", icon: "🌊" },
  ],
  Polygon: [
    { value: "area", label: "Area", icon: "▱" },
    { value: "field", label: "Field", icon: "🌾" },
    { value: "forest", label: "Forest", icon: "🌳" },
    { value: "water", label: "Water", icon: "💧" },
  ],
});

const DEFAULT_CATEGORY = {
  Point: "place",
  LineString: "route",
  Polygon: "area",
};

function nowISO() {
  return new Date().toISOString();
}

function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `obj_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function createFeature(geometry) {
  const id = makeId();
  const timestamp = nowISO();

  return {
    id,
    type: "Feature",
    geometry,
    properties: {
      id,
      name: "",
      category: DEFAULT_CATEGORY[geometry.type] || "",
      description: "",
    },
    metadata: {
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  };
}

export function createPoint(coordinates) {
  return createFeature({ type: "Point", coordinates });
}

export function createLine(coordinates) {
  return createFeature({ type: "LineString", coordinates: [...coordinates] });
}

export function closeRing(coordinates) {
  const ring = [...coordinates];
  const first = ring[0];
  const last = ring[ring.length - 1];

  if (!first || !last || first[0] !== last[0] || first[1] !== last[1]) {
    ring.push(first);
  }

  return ring;
}

export function createPolygon(coordinates) {
  return createFeature({ type: "Polygon", coordinates: [closeRing(coordinates)] });
}

export function geometryKind(feature) {
  return feature?.geometry?.type ?? null;
}

export function touch(feature) {
  feature.metadata = feature.metadata || {};
  feature.metadata.updatedAt = nowISO();
  return feature;
}

export function categoriesFor(geometryType) {
  return CATEGORIES[geometryType] || [];
}

// null for a value that isn't in the list — covers legacy/imported data
// saved before a category existed, or from a category set that has since
// changed.
export function categoryInfo(geometryType, value) {
  return categoriesFor(geometryType).find((category) => category.value === value) || null;
}
