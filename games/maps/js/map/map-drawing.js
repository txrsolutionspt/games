const DRAWING_SOURCE_ID = "drawing-preview";

export function setupDrawingLayers(map) {
  map.addSource(DRAWING_SOURCE_ID, {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });

  map.addLayer({
    id: "drawing-fill",
    type: "fill",
    source: DRAWING_SOURCE_ID,
    filter: ["==", ["geometry-type"], "Polygon"],
    paint: { "fill-color": "#ef4444", "fill-opacity": 0.15 },
  });

  map.addLayer({
    id: "drawing-line",
    type: "line",
    source: DRAWING_SOURCE_ID,
    filter: ["==", ["geometry-type"], "LineString"],
    paint: { "line-color": "#ef4444", "line-width": 2, "line-dasharray": [2, 2] },
  });

  map.addLayer({
    id: "drawing-vertices",
    type: "circle",
    source: DRAWING_SOURCE_ID,
    filter: ["==", ["geometry-type"], "Point"],
    paint: { "circle-radius": 5, "circle-color": "#ef4444" },
  });
}

export function updateDrawingPreview(map, coordinates, geometryType) {
  const source = map.getSource(DRAWING_SOURCE_ID);
  if (!source) return;

  const features = coordinates.map((coordinate) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: coordinate },
    properties: {},
  }));

  if (coordinates.length >= 2) {
    if (geometryType === "Polygon" && coordinates.length >= 3) {
      features.push({
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [[...coordinates, coordinates[0]]] },
        properties: {},
      });
    } else {
      features.push({
        type: "Feature",
        geometry: { type: "LineString", coordinates },
        properties: {},
      });
    }
  }

  source.setData({ type: "FeatureCollection", features });
}

export function clearDrawingPreview(map) {
  updateDrawingPreview(map, [], null);
}
