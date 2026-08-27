import { updateObjectGeometry } from "../objects/object-store.js?v=2026-08-26.11";

const EDIT_SOURCE_ID = "edit-vertices";
let dragState = null;

export function setupEditLayers(map) {
  map.addSource(EDIT_SOURCE_ID, {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });

  map.addLayer({
    id: "edit-vertices",
    type: "circle",
    source: EDIT_SOURCE_ID,
    paint: {
      "circle-radius": 6,
      "circle-color": "#ffffff",
      "circle-stroke-width": 2,
      "circle-stroke-color": "#2563eb",
    },
  });
}

function vertexCoordinates(geometry) {
  if (geometry.type === "Point") return [geometry.coordinates];
  if (geometry.type === "LineString") return geometry.coordinates;
  if (geometry.type === "Polygon") return geometry.coordinates[0].slice(0, -1);
  return [];
}

export function showEditVertices(map, feature) {
  const source = map.getSource(EDIT_SOURCE_ID);
  if (!source) return;

  const features = feature
    ? vertexCoordinates(feature.geometry).map((coordinates, index) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates },
        properties: { index },
      }))
    : [];

  source.setData({ type: "FeatureCollection", features });
}

export function clearEditVertices(map) {
  showEditVertices(map, null);
}

export function enableVertexDragging(map, getEditingFeatureId) {
  // Mouse and touch are handled in parallel: browsers only fire mousemove
  // continuously for an actual mouse, not for a finger drag, so touchstart/
  // touchmove/touchend are required for this to work on a real phone at all
  // — it isn't just a UX nicety on top of the mouse handlers.
  function startDrag(event) {
    const featureId = getEditingFeatureId();
    if (!featureId) return;

    event.preventDefault();
    dragState = { featureId, vertexIndex: event.features[0].properties.index };
    map.dragPan.disable();
    map.getCanvas().style.cursor = "grabbing";
  }

  function moveDrag(event) {
    if (!dragState) return;

    const { featureId, vertexIndex } = dragState;
    const coordinate = [event.lngLat.lng, event.lngLat.lat];

    updateObjectGeometry(featureId, (geometry) => {
      if (geometry.type === "Point") {
        geometry.coordinates = coordinate;
      } else if (geometry.type === "LineString") {
        geometry.coordinates[vertexIndex] = coordinate;
      } else if (geometry.type === "Polygon") {
        const ring = geometry.coordinates[0];
        ring[vertexIndex] = coordinate;
        if (vertexIndex === 0) {
          ring[ring.length - 1] = coordinate;
        }
      }
    });
  }

  function endDrag() {
    if (!dragState) return;
    dragState = null;
    map.dragPan.enable();
    map.getCanvas().style.cursor = "";
  }

  map.on("mousedown", "edit-vertices", startDrag);
  map.on("touchstart", "edit-vertices", startDrag);

  map.on("mousemove", moveDrag);
  map.on("touchmove", moveDrag);

  map.on("mouseup", endDrag);
  map.on("touchend", endDrag);
  map.on("touchcancel", endDrag);

  map.on("mouseenter", "edit-vertices", () => {
    if (!dragState) map.getCanvas().style.cursor = "grab";
  });
  map.on("mouseleave", "edit-vertices", () => {
    if (!dragState) map.getCanvas().style.cursor = "";
  });
}
