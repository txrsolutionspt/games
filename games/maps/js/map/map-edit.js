import { updateObjectGeometry, getObject } from "../objects/object-store.js?v=2026-08-26.14";

const EDIT_SOURCE_ID = "edit-vertices";
const MIDPOINT_SOURCE_ID = "edit-midpoints";

// How far (in screen pixels) a finger/mouse can drift during a press on a
// vertex handle before it counts as a drag instead of a tap-to-delete.
const TAP_MOVE_THRESHOLD_PX = 6;

let dragState = null;

export function setupEditLayers(map) {
  map.addSource(EDIT_SOURCE_ID, {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });

  map.addSource(MIDPOINT_SOURCE_ID, {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  });

  // Midpoint handles are added first so the real vertex handles always
  // render on top of them.
  map.addLayer({
    id: "edit-midpoints",
    type: "circle",
    source: MIDPOINT_SOURCE_ID,
    paint: {
      "circle-radius": 5,
      "circle-color": "#93c5fd",
      "circle-stroke-width": 1.5,
      "circle-stroke-color": "#2563eb",
      "circle-opacity": 0.85,
    },
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

function midpoint(a, b) {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

// One midpoint handle per edge, tagged with the index it should be inserted
// at (i.e. the index it becomes once dropped).
function midpointFeatures(geometry) {
  const vertices = vertexCoordinates(geometry);

  if (geometry.type === "LineString") {
    return vertices.slice(0, -1).map((coordinates, index) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: midpoint(coordinates, vertices[index + 1]) },
      properties: { insertAt: index + 1 },
    }));
  }

  if (geometry.type === "Polygon") {
    return vertices.map((coordinates, index) => ({
      type: "Feature",
      geometry: { type: "Point", coordinates: midpoint(coordinates, vertices[(index + 1) % vertices.length]) },
      properties: { insertAt: index + 1 },
    }));
  }

  return [];
}

export function showEditVertices(map, feature) {
  const vertexSource = map.getSource(EDIT_SOURCE_ID);
  const midpointSource = map.getSource(MIDPOINT_SOURCE_ID);
  if (!vertexSource || !midpointSource) return;

  const vertexFeatures = feature
    ? vertexCoordinates(feature.geometry).map((coordinates, index) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates },
        properties: { index },
      }))
    : [];
  vertexSource.setData({ type: "FeatureCollection", features: vertexFeatures });

  const midFeatures = feature ? midpointFeatures(feature.geometry) : [];
  midpointSource.setData({ type: "FeatureCollection", features: midFeatures });
}

export function clearEditVertices(map) {
  showEditVertices(map, null);
}

function canDeleteVertex(geometry) {
  if (geometry.type === "LineString") return geometry.coordinates.length > 2;
  if (geometry.type === "Polygon") return geometry.coordinates[0].length - 1 > 3;
  return false;
}

function deleteVertex(featureId, vertexIndex) {
  const feature = getObject(featureId);
  if (!feature || !canDeleteVertex(feature.geometry)) return;

  updateObjectGeometry(featureId, (geometry) => {
    if (geometry.type === "LineString") {
      geometry.coordinates.splice(vertexIndex, 1);
    } else if (geometry.type === "Polygon") {
      const ring = geometry.coordinates[0];
      ring.splice(vertexIndex, 1);
      if (vertexIndex === 0) {
        // The ring must start and end on the same coordinate; the removed
        // vertex used to be that anchor, so the new first vertex takes over.
        ring[ring.length - 1] = ring[0];
      }
    }
  });
}

function insertVertex(featureId, insertAt, coordinate) {
  updateObjectGeometry(featureId, (geometry) => {
    if (geometry.type === "LineString") {
      geometry.coordinates.splice(insertAt, 0, coordinate);
    } else if (geometry.type === "Polygon") {
      geometry.coordinates[0].splice(insertAt, 0, coordinate);
    }
  });
}

export function enableVertexDragging(map, getEditingFeatureId) {
  // Mouse and touch are handled in parallel: browsers only fire mousemove
  // continuously for an actual mouse, not for a finger drag, so touchstart/
  // touchmove/touchend are required for this to work on a real phone at all
  // — it isn't just a UX nicety on top of the mouse handlers.
  function startVertexDrag(event) {
    const featureId = getEditingFeatureId();
    if (!featureId) return;

    event.preventDefault();
    dragState = {
      kind: "vertex",
      featureId,
      vertexIndex: event.features[0].properties.index,
      startPoint: event.point,
      moved: false,
    };
    map.dragPan.disable();
    map.getCanvas().style.cursor = "grabbing";
  }

  // Dragging a midpoint handle inserts a real vertex there and immediately
  // continues as a normal vertex drag, so one finger motion both adds the
  // point and places it.
  function startMidpointDrag(event) {
    const featureId = getEditingFeatureId();
    if (!featureId) return;

    event.preventDefault();
    const insertAt = event.features[0].properties.insertAt;
    insertVertex(featureId, insertAt, [event.lngLat.lng, event.lngLat.lat]);

    dragState = {
      kind: "vertex",
      featureId,
      vertexIndex: insertAt,
      startPoint: event.point,
      // Already a real edit — a plain tap that inserted the point shouldn't
      // also delete it on release.
      moved: true,
    };
    map.dragPan.disable();
    map.getCanvas().style.cursor = "grabbing";
  }

  function moveDrag(event) {
    if (!dragState) return;

    const dx = event.point.x - dragState.startPoint.x;
    const dy = event.point.y - dragState.startPoint.y;
    if (Math.hypot(dx, dy) > TAP_MOVE_THRESHOLD_PX) {
      dragState.moved = true;
    }

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

    // A tap (no real movement) on an existing vertex handle deletes that
    // vertex instead of "moving it nowhere". Dragging a midpoint never
    // reaches here, since it starts already marked as moved.
    if (!dragState.moved) {
      deleteVertex(dragState.featureId, dragState.vertexIndex);
    }

    dragState = null;
    map.dragPan.enable();
    map.getCanvas().style.cursor = "";
  }

  map.on("mousedown", "edit-vertices", startVertexDrag);
  map.on("touchstart", "edit-vertices", startVertexDrag);

  map.on("mousedown", "edit-midpoints", startMidpointDrag);
  map.on("touchstart", "edit-midpoints", startMidpointDrag);

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

  map.on("mouseenter", "edit-midpoints", () => {
    if (!dragState) map.getCanvas().style.cursor = "copy";
  });
  map.on("mouseleave", "edit-midpoints", () => {
    if (!dragState) map.getCanvas().style.cursor = "";
  });
}
