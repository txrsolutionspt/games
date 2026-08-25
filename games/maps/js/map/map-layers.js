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
