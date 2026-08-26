const SOURCE_ID = "user-objects";

export const OBJECT_LAYER_IDS = ["user-points", "user-lines", "user-polygons"];

export function setupObjectLayers(map, initialData) {
  map.addSource(SOURCE_ID, { type: "geojson", data: initialData });

  map.addLayer({
    id: "user-polygons",
    type: "fill",
    source: SOURCE_ID,
    filter: ["==", ["geometry-type"], "Polygon"],
    paint: { "fill-color": "#22c55e", "fill-opacity": 0.35 },
  });

  map.addLayer({
    id: "user-polygon-outline",
    type: "line",
    source: SOURCE_ID,
    filter: ["==", ["geometry-type"], "Polygon"],
    paint: { "line-color": "#16a34a", "line-width": 2 },
  });

  map.addLayer({
    id: "user-lines",
    type: "line",
    source: SOURCE_ID,
    filter: ["==", ["geometry-type"], "LineString"],
    paint: { "line-color": "#f97316", "line-width": 4 },
  });

  map.addLayer({
    id: "user-points",
    type: "circle",
    source: SOURCE_ID,
    filter: ["==", ["geometry-type"], "Point"],
    paint: {
      "circle-radius": 7,
      "circle-color": "#3b82f6",
      "circle-stroke-width": 2,
      "circle-stroke-color": "#ffffff",
    },
  });

  map.addLayer({
    id: "user-points-selected",
    type: "circle",
    source: SOURCE_ID,
    filter: ["all", ["==", ["geometry-type"], "Point"], ["==", ["get", "id"], "__none__"]],
    paint: {
      "circle-radius": 10,
      "circle-color": "#facc15",
      "circle-stroke-width": 3,
      "circle-stroke-color": "#ffffff",
    },
  });

  map.addLayer({
    id: "user-lines-selected",
    type: "line",
    source: SOURCE_ID,
    filter: ["all", ["==", ["geometry-type"], "LineString"], ["==", ["get", "id"], "__none__"]],
    paint: { "line-color": "#facc15", "line-width": 6 },
  });

  map.addLayer({
    id: "user-polygon-selected-outline",
    type: "line",
    source: SOURCE_ID,
    filter: ["all", ["==", ["geometry-type"], "Polygon"], ["==", ["get", "id"], "__none__"]],
    paint: { "line-color": "#facc15", "line-width": 4 },
  });

  addLabelLayers(map);
}

const LABEL_LAYOUT_PAINT = {
  paint: {
    "text-color": "#111827",
    "text-halo-color": "#ffffff",
    "text-halo-width": 1.5,
  },
};

const LABEL_LAYER_IDS = ["user-points-label", "user-lines-label", "user-polygons-label"];

function addLabelLayers(map) {
  // Hidden by default (visibility: "none") and toggled as a group via
  // setLabelsVisibility — a layout-property flip, not add/remove, so turning
  // labels on/off is instant. One layer per geometry type so each can use a
  // placement that actually suits its shape.
  map.addLayer({
    id: "user-points-label",
    type: "symbol",
    source: SOURCE_ID,
    filter: ["==", ["geometry-type"], "Point"],
    layout: {
      "text-field": ["get", "name"],
      "text-size": 12,
      "text-anchor": "top",
      "text-offset": [0, 0.8],
      "text-max-width": 10,
      visibility: "none",
    },
    ...LABEL_LAYOUT_PAINT,
  });

  map.addLayer({
    id: "user-lines-label",
    type: "symbol",
    source: SOURCE_ID,
    filter: ["==", ["geometry-type"], "LineString"],
    layout: {
      "text-field": ["get", "name"],
      "text-size": 12,
      "symbol-placement": "line",
      visibility: "none",
    },
    ...LABEL_LAYOUT_PAINT,
  });

  map.addLayer({
    id: "user-polygons-label",
    type: "symbol",
    source: SOURCE_ID,
    filter: ["==", ["geometry-type"], "Polygon"],
    layout: {
      "text-field": ["get", "name"],
      "text-size": 12,
      "text-max-width": 10,
      visibility: "none",
    },
    ...LABEL_LAYOUT_PAINT,
  });
}

export function setLabelsVisibility(map, visible) {
  const value = visible ? "visible" : "none";
  for (const id of LABEL_LAYER_IDS) {
    if (!map.getLayer(id)) continue;
    map.setLayoutProperty(id, "visibility", value);
  }
}

export function refreshObjectLayers(map, featureCollection) {
  const source = map.getSource(SOURCE_ID);
  if (!source) return;
  source.setData(featureCollection);
}

const SELECTABLE_LAYERS = [
  { id: "user-points-selected", geometryType: "Point" },
  { id: "user-lines-selected", geometryType: "LineString" },
  { id: "user-polygon-selected-outline", geometryType: "Polygon" },
];

export function setSelectedFilter(map, selectedId) {
  const value = selectedId ?? "__none__";

  for (const { id, geometryType } of SELECTABLE_LAYERS) {
    if (!map.getLayer(id)) continue;
    map.setFilter(id, ["all", ["==", ["geometry-type"], geometryType], ["==", ["get", "id"], value]]);
  }
}
