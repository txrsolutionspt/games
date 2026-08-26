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

function addLabelLayers(map) {
  // Hidden by default (visibility: "none") and toggled via applyLayerVisibility
  // below — a layout-property flip, not add/remove, so turning labels on/off
  // is instant. One layer per geometry type so each can use a placement that
  // actually suits its shape.
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

const GROUP_LAYER_IDS = {
  Point: ["user-points", "user-points-selected"],
  LineString: ["user-lines", "user-lines-selected"],
  Polygon: ["user-polygons", "user-polygon-outline", "user-polygon-selected-outline"],
};

const GROUP_LABEL_LAYER_ID = {
  Point: "user-points-label",
  LineString: "user-lines-label",
  Polygon: "user-polygons-label",
};

// Each geometry-type group (Places/Routes/Areas) can be shown or hidden on
// its own, and labels are a further toggle on top of that — a label only
// actually shows when its group is visible AND labels are turned on.
export function applyLayerVisibility(map, { groupVisibility, labelsVisible }) {
  for (const [type, layerIds] of Object.entries(GROUP_LAYER_IDS)) {
    const groupOn = groupVisibility[type] !== false;
    const value = groupOn ? "visible" : "none";

    for (const id of layerIds) {
      if (!map.getLayer(id)) continue;
      map.setLayoutProperty(id, "visibility", value);
    }

    const labelId = GROUP_LABEL_LAYER_ID[type];
    if (map.getLayer(labelId)) {
      map.setLayoutProperty(labelId, "visibility", groupOn && labelsVisible ? "visible" : "none");
    }
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
