import { createMap } from "./map/map-init.js";
import {
  setupObjectLayers,
  refreshObjectLayers,
  setSelectedFilter,
} from "./map/map-layers.js";
import { setupDrawingLayers, updateDrawingPreview } from "./map/map-drawing.js";
import { setupSelection } from "./map/map-selection.js";
import {
  setupEditLayers,
  showEditVertices,
  clearEditVertices,
  enableVertexDragging,
} from "./map/map-edit.js";
import {
  MODES,
  createPoint,
  createLine,
  createPolygon,
} from "./objects/object-model.js";
import {
  getState,
  subscribe,
  setMode,
  startDrawing,
  addDrawingPoint,
  cancelDrawing,
  addObject,
  updateObjectProperties,
  deleteObject,
  selectObject,
  getObject,
  toFeatureCollection,
  replaceAll,
} from "./objects/object-store.js";
import { renderSidebar, showFeaturePopup, closeFeaturePopup } from "./ui/editor-panel.js";
import { openEditorDialog, openConfirmDialog } from "./ui/dialogs.js";
import { setupToolbar } from "./ui/toolbar.js";

const hintEl = document.getElementById("drawing-hint");
const hintText = document.getElementById("drawing-hint-text");
const hintCancel = document.getElementById("drawing-cancel");

const map = createMap();

async function seedIfEmpty() {
  if (getState().objects.length > 0) return;

  try {
    const response = await fetch("data/default-objects.json");
    const data = await response.json();
    if (Array.isArray(data.objects)) {
      replaceAll(data.objects);
    }
  } catch (error) {
    console.warn("No default map data loaded", error);
  }
}

// Use "style.load" rather than "load": "load" waits for the first visually
// complete render, which on a terrain/globe map can block on DEM and
// satellite tile fetches. "style.load" fires as soon as the (inline, already
// in-memory) style and its sources/layers are parsed, which is all addSource
// / addLayer below actually need — it does not depend on tile network access.
map.on("style.load", async () => {
  await seedIfEmpty();

  setupObjectLayers(map, toFeatureCollection());
  setupDrawingLayers(map);
  setupEditLayers(map);

  setupSelection(map, {
    isSelectable: () => getState().mode === MODES.VIEW,
    onSelect: (id) => selectObject(id),
  });

  enableVertexDragging(map, () =>
    getState().mode === MODES.EDIT_SHAPE ? getState().selectedId : null
  );

  map.on("click", handleMapClick);
  map.on("dblclick", handleMapDoubleClick);

  setupToolbar({
    onAdd: handleAdd,
    onFlyTo: (center) => map.flyTo({ center, zoom: 12, pitch: 0 }),
  });

  subscribe(render);
  render(getState());
});

function handleAdd(kind) {
  closeFeaturePopup();
  selectObject(null);

  if (kind === "point") {
    setMode(MODES.ADD_POINT);
  } else if (kind === "line") {
    setMode(MODES.DRAW_LINE);
    startDrawing("LineString");
  } else if (kind === "polygon") {
    setMode(MODES.DRAW_POLYGON);
    startDrawing("Polygon");
  }
}

async function handleMapClick(event) {
  const state = getState();
  const coordinate = [event.lngLat.lng, event.lngLat.lat];

  if (state.mode === MODES.ADD_POINT) {
    setMode(MODES.VIEW);
    const feature = createPoint(coordinate);
    const result = await openEditorDialog("Point", { isNew: true, properties: feature.properties });
    if (result) {
      Object.assign(feature.properties, result);
      addObject(feature);
      selectObject(feature.id);
    }
    return;
  }

  if (state.mode === MODES.DRAW_LINE || state.mode === MODES.DRAW_POLYGON) {
    addDrawingPoint(coordinate);
  }
}

function handleMapDoubleClick(event) {
  const state = getState();
  if (state.mode !== MODES.DRAW_LINE && state.mode !== MODES.DRAW_POLYGON) return;

  event.preventDefault();
  finishDrawing();
}

function dedupeTrailingPoint(coordinates) {
  const result = [...coordinates];
  while (result.length > 1) {
    const [lng1, lat1] = result[result.length - 1];
    const [lng2, lat2] = result[result.length - 2];
    if (Math.abs(lng1 - lng2) < 1e-9 && Math.abs(lat1 - lat2) < 1e-9) {
      result.pop();
    } else {
      break;
    }
  }
  return result;
}

async function finishDrawing() {
  const state = getState();
  const geometryType = state.drawing.geometryType;
  const coordinates = dedupeTrailingPoint(state.drawing.coordinates);
  const minPoints = geometryType === "Polygon" ? 3 : 2;

  if (coordinates.length < minPoints) {
    cancelDrawing();
    return;
  }

  const feature = geometryType === "Polygon" ? createPolygon(coordinates) : createLine(coordinates);
  setMode(MODES.VIEW);

  const result = await openEditorDialog(geometryType, { isNew: true, properties: feature.properties });
  if (result) {
    Object.assign(feature.properties, result);
    addObject(feature);
    selectObject(feature.id);
  }
}

async function handleEditInfo(id) {
  const feature = getObject(id);
  if (!feature) return;

  const result = await openEditorDialog(feature.geometry.type, {
    isNew: false,
    properties: feature.properties,
  });

  if (result) {
    updateObjectProperties(id, result);
  }
}

async function handleDelete(id) {
  const feature = getObject(id);
  if (!feature) return;

  const confirmed = await openConfirmDialog(
    `Delete "${feature.properties.name || "this object"}"? This cannot be undone.`
  );

  if (confirmed) {
    deleteObject(id);
  }
}

hintCancel.addEventListener("click", () => {
  if (getState().mode === MODES.EDIT_SHAPE) {
    setMode(MODES.VIEW);
  } else {
    cancelDrawing();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  const mode = getState().mode;
  if (mode === MODES.EDIT_SHAPE) {
    setMode(MODES.VIEW);
  } else if (mode !== MODES.VIEW) {
    cancelDrawing();
  }
});

function updateDrawingHint(state) {
  if (state.mode === MODES.DRAW_LINE || state.mode === MODES.DRAW_POLYGON) {
    hintText.textContent = "Click on the map to add points. Double-click to finish.";
    hintCancel.textContent = "Cancel";
    hintEl.classList.remove("hidden");
  } else if (state.mode === MODES.ADD_POINT) {
    hintText.textContent = "Click on the map to place a point.";
    hintCancel.textContent = "Cancel";
    hintEl.classList.remove("hidden");
  } else if (state.mode === MODES.EDIT_SHAPE) {
    hintText.textContent = "Drag the white handles to reshape the object.";
    hintCancel.textContent = "Done";
    hintEl.classList.remove("hidden");
  } else {
    hintEl.classList.add("hidden");
  }
}

let lastPopupKey = null;

function render(state) {
  const collection = toFeatureCollection();
  refreshObjectLayers(map, collection);
  setSelectedFilter(map, state.selectedId);
  renderSidebar(state.objects, state.selectedId, (id) => selectObject(id));
  updateDrawingHint(state);
  updateDrawingPreview(map, state.drawing.coordinates, state.drawing.geometryType);

  if (state.mode === MODES.EDIT_SHAPE && state.selectedId) {
    showEditVertices(map, getObject(state.selectedId));
  } else {
    clearEditVertices(map);
  }

  const feature = state.selectedId && state.mode !== MODES.EDIT_SHAPE ? getObject(state.selectedId) : null;
  const popupKey = feature ? `${feature.id}:${feature.metadata.updatedAt}` : null;

  if (popupKey !== lastPopupKey) {
    lastPopupKey = popupKey;

    if (feature) {
      showFeaturePopup(map, feature, {
        onEditInfo: () => handleEditInfo(feature.id),
        onEditShape: () => setMode(MODES.EDIT_SHAPE),
        onDelete: () => handleDelete(feature.id),
      });
    } else {
      closeFeaturePopup();
    }
  }
}
