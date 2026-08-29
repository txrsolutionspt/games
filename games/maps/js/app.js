import { createMap } from "./map/map-init.js?v=2026-08-26.22";
import {
  setupObjectLayers,
  refreshObjectLayers,
  setSelectedFilter,
  applyLayerVisibility,
} from "./map/map-layers.js?v=2026-08-26.22";
import { setupDrawingLayers, updateDrawingPreview } from "./map/map-drawing.js?v=2026-08-26.22";
import { setupSelection } from "./map/map-selection.js?v=2026-08-26.22";
import {
  setupEditLayers,
  showEditVertices,
  clearEditVertices,
  enableVertexDragging,
} from "./map/map-edit.js?v=2026-08-26.22";
import {
  MODES,
  createPoint,
  createLine,
  createPolygon,
} from "./objects/object-model.js?v=2026-08-26.22";
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
  switchMap,
  getCurrentMapId,
} from "./objects/object-store.js?v=2026-08-26.22";
import { renderSidebar, showFeaturePopup, closeFeaturePopup } from "./ui/editor-panel.js?v=2026-08-26.22";
import { openEditorDialog, openConfirmDialog } from "./ui/dialogs.js?v=2026-08-26.22";
import { setupToolbar } from "./ui/toolbar.js?v=2026-08-26.22";
import { setupViewMenu } from "./ui/view-menu.js?v=2026-08-26.22";
import { setupLayersMenu } from "./ui/layers-menu.js?v=2026-08-26.22";
import { setupMapsDialog } from "./ui/maps-menu.js?v=2026-08-26.22";
import { buildBaseStyle } from "./map/map-styles.js?v=2026-08-26.22";
import { createFitAllControl } from "./map/map-controls.js?v=2026-08-26.22";
import { loadMapSettings, saveMapSettings } from "./persistence/map-settings.js?v=2026-08-26.22";
import { loadObjects } from "./persistence/local-storage.js?v=2026-08-26.22";
import {
  ensureMapsIndex,
  takeNeedsSeedingFlag,
  listMaps,
  getActiveMapId,
  setActiveMapId,
  createMap as createMapEntry,
  renameMap,
  deleteMap,
} from "./persistence/maps-index.js?v=2026-08-26.22";
import {
  geometryBounds,
  featureCollectionBounds,
  lineLengthMeters,
  polygonAreaMeters,
  formatDistance,
  formatArea,
} from "./geo/measure.js?v=2026-08-26.22";

const hintEl = document.getElementById("drawing-hint");
const hintText = document.getElementById("drawing-hint-text");
const hintCancel = document.getElementById("drawing-cancel");
const hintFinish = document.getElementById("drawing-finish");
const sidebarToggleButton = document.getElementById("sidebar-toggle-button");
const sidebarScrim = document.getElementById("sidebar-scrim");
const sidebarEl = document.getElementById("sidebar");
const sidebarTitleEl = document.getElementById("sidebar-title");

// Migrates any pre-"My Maps" flat localStorage data into the new per-map
// keys the first time this runs against it — see maps-index.js. object-store
// already resolved the active map id at its own module load time (imports
// run before this file's top-level code), so this is just making sure the
// index itself exists before anything else here touches localStorage.
ensureMapsIndex();

let mapSettings = loadMapSettings(getCurrentMapId());
const map = createMap(mapSettings);

// The map style (base imagery, terrain) is swappable independently of the
// user's data: map.setStyle() reloads the style and wipes any source/layer
// that isn't part of it, so the object/drawing/edit-vertex overlay layers
// have to be re-added every time — see addOverlayLayers() and the
// non-first-load branch of the "style.load" handler below. The name-label
// layers are part of that same overlay source, so their visibility has to be
// reapplied here too every time they're recreated, not just once.
function addOverlayLayers() {
  setupObjectLayers(map, toFeatureCollection());
  setupDrawingLayers(map);
  setupEditLayers(map);
  applyLayerVisibility(map, { groupVisibility: mapSettings.layers, labelsVisible: mapSettings.labelsVisible });
}

function applyLabelsToggle() {
  mapSettings = { ...mapSettings, labelsVisible: !mapSettings.labelsVisible };
  saveMapSettings(getCurrentMapId(), mapSettings);
  applyLayerVisibility(map, { groupVisibility: mapSettings.layers, labelsVisible: mapSettings.labelsVisible });
}

function toggleLayerGroup(geometryType) {
  const currentlyOn = mapSettings.layers[geometryType] !== false;
  mapSettings = { ...mapSettings, layers: { ...mapSettings.layers, [geometryType]: !currentlyOn } };
  saveMapSettings(getCurrentMapId(), mapSettings);
  applyLayerVisibility(map, { groupVisibility: mapSettings.layers, labelsVisible: mapSettings.labelsVisible });
}

// On mobile the sidebar is a bottom sheet, closed by default; on desktop
// it's the always-visible left panel and these classes are simply inert
// (the CSS only reads them inside the mobile breakpoint).
function openSidebarSheet() {
  sidebarEl.classList.add("open");
  sidebarScrim.classList.add("open");
}

function closeSidebarSheet() {
  sidebarEl.classList.remove("open");
  sidebarScrim.classList.remove("open");
}

function toggleSidebarSheet() {
  if (sidebarEl.classList.contains("open")) {
    closeSidebarSheet();
  } else {
    openSidebarSheet();
  }
}

function applyStyleChange(styleId) {
  mapSettings = { ...mapSettings, style: styleId };
  saveMapSettings(getCurrentMapId(), mapSettings);
  map.setStyle(buildBaseStyle(mapSettings.style, mapSettings.projection));
}

function applyProjectionChange(projection) {
  mapSettings = { ...mapSettings, projection };
  saveMapSettings(getCurrentMapId(), mapSettings);
  map.setProjection({ type: projection });
  map.easeTo({ pitch: projection === "globe" ? 65 : 0, duration: 500 });
}

// Selecting an object from the sidebar list can point at something
// anywhere on the map, not just what's currently in view, so bring it on
// screen rather than just opening its popup wherever the camera happens
// to be pointed.
function flyToFeature(feature) {
  if (feature.geometry.type === "Point") {
    map.flyTo({
      center: feature.geometry.coordinates,
      zoom: Math.max(map.getZoom(), 14),
      duration: 800,
    });
  } else {
    map.fitBounds(geometryBounds(feature.geometry), {
      padding: 72,
      maxZoom: 16,
      duration: 800,
    });
  }
}

function fitAllObjects() {
  const objects = getState().objects;
  if (objects.length === 0) return;
  map.fitBounds(featureCollectionBounds(objects), {
    padding: 72,
    maxZoom: 16,
    duration: 800,
  });
}

// Only for a genuinely fresh install (see maps-index.js's
// takeNeedsSeedingFlag) — a deliberately-created new map should start
// blank, not surprise the user with demo pins.
async function seedInitialMap() {
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

function updateSidebarTitle() {
  const activeMap = listMaps().find((entry) => entry.id === getCurrentMapId());
  sidebarTitleEl.textContent = activeMap ? activeMap.name : "My Map";
}

// Switching maps is a bigger jump than panning to a place, so the camera
// snaps straight to the other map's saved view (jumpTo) instead of flying.
function switchToMap(mapId) {
  if (mapId === getCurrentMapId()) return;

  closeFeaturePopup();
  closeSidebarSheet();

  setActiveMapId(mapId);
  switchMap(mapId);

  mapSettings = loadMapSettings(mapId);
  map.setProjection({ type: mapSettings.projection });
  map.jumpTo({
    center: mapSettings.view.center,
    zoom: mapSettings.view.zoom,
    pitch: mapSettings.projection === "globe" ? 65 : 0,
  });
  map.setStyle(buildBaseStyle(mapSettings.style, mapSettings.projection));

  updateSidebarTitle();
}

function handleCreateMap() {
  const id = createMapEntry("New Map");
  switchToMap(id);
}

async function handleDeleteMap(id, name) {
  const confirmed = await openConfirmDialog(`Delete "${name}" and everything on it? This cannot be undone.`);
  if (!confirmed) return false;

  const wasActive = id === getCurrentMapId();
  const deleted = deleteMap(id);
  if (deleted && wasActive) {
    switchToMap(getActiveMapId());
  }
  return deleted;
}

// Use "style.load" rather than "load": "load" waits for the first visually
// complete render, which on a terrain/globe map can block on DEM and
// satellite tile fetches. "style.load" fires as soon as the (inline, already
// in-memory) style and its sources/layers are parsed, which is all addSource
// / addLayer below actually need — it does not depend on tile network access.
//
// "style.load" also fires again every time applyStyleChange() calls
// map.setStyle() (switching Street/Satellite/Terrain/Dark from the View
// menu), which wipes our overlay source/layers along with the old style. The
// one-time app wiring (event listeners, store subscription, toolbar/menus)
// only needs to happen once — those survive a style swap since they're
// registered on the Map instance, not the style — but the overlay layers
// need to be re-added every time.
let firstStyleLoad = true;

map.on("style.load", async () => {
  if (!firstStyleLoad) {
    addOverlayLayers();
    render(getState()); // reapply selection highlight / drawing preview / edit vertices
    return;
  }
  firstStyleLoad = false;

  map.addControl(createFitAllControl(fitAllObjects));

  if (takeNeedsSeedingFlag()) {
    await seedInitialMap();
  }
  addOverlayLayers();

  setupSelection(map, {
    isSelectable: () => getState().mode === MODES.VIEW,
    onSelect: (id) => selectObject(id),
  });

  enableVertexDragging(map, () =>
    getState().mode === MODES.EDIT_SHAPE ? getState().selectedId : null
  );

  map.on("click", handleMapClick);
  map.on("dblclick", handleMapDoubleClick);

  const mapsDialog = setupMapsDialog({
    getMaps: listMaps,
    getActiveMapId: getCurrentMapId,
    getObjectCount: (id) => loadObjects(id).length,
    onSwitch: switchToMap,
    onCreate: handleCreateMap,
    onRename: (id, name) => {
      renameMap(id, name);
      updateSidebarTitle();
    },
    onDelete: handleDeleteMap,
  });

  setupToolbar({
    onAdd: handleAdd,
    onFlyTo: (center) => map.flyTo({ center, zoom: 12, pitch: mapSettings.projection === "globe" ? 65 : 0 }),
    onSelectObject: (id) => {
      selectObject(id);
      closeSidebarSheet();
      const feature = getObject(id);
      if (feature) flyToFeature(feature);
    },
    onOpenMyMaps: () => mapsDialog.open(),
  });

  setupViewMenu({
    getSettings: () => mapSettings,
    onSelectStyle: applyStyleChange,
    onSelectProjection: applyProjectionChange,
  });

  setupLayersMenu({
    getSettings: () => mapSettings,
    onToggleGroup: toggleLayerGroup,
    onToggleLabels: applyLabelsToggle,
  });

  updateSidebarTitle();

  sidebarToggleButton.addEventListener("click", toggleSidebarSheet);
  sidebarScrim.addEventListener("click", closeSidebarSheet);

  hintFinish.addEventListener("click", finishDrawing);

  // Remember whatever the user was last looking at (pan/zoom, including our
  // own flyTo/fitBounds calls) so reopening the page picks up where they
  // left off instead of resetting to the default view every time.
  map.on("moveend", () => {
    const center = map.getCenter();
    mapSettings = { ...mapSettings, view: { center: [center.lng, center.lat], zoom: map.getZoom() } };
    saveMapSettings(getCurrentMapId(), mapSettings);
  });

  subscribe(render);
  render(getState());

  // Tells the page-level diagnostics (see search.html) that the app reached a
  // working state, so a later, unrelated error (e.g. a MapLibre terrain/globe
  // rendering glitch) doesn't get reported as if the page never loaded.
  window.__mapEditorInitialized = true;
});

function handleAdd(kind) {
  closeFeaturePopup();
  selectObject(null);
  closeSidebarSheet();

  if (kind === "point") {
    setMode(MODES.ADD_POINT);
  } else if (kind === "line") {
    setMode(MODES.DRAW_LINE);
    startDrawing("LineString");
  } else if (kind === "polygon") {
    setMode(MODES.DRAW_POLYGON);
    startDrawing("Polygon");
  } else if (kind === "measure") {
    setMode(MODES.MEASURE);
    startDrawing("Measure");
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

  if (state.mode === MODES.DRAW_LINE || state.mode === MODES.DRAW_POLYGON || state.mode === MODES.MEASURE) {
    addDrawingPoint(coordinate);
  }
}

function handleMapDoubleClick(event) {
  const state = getState();

  // Measuring never saves anything, so "finish" is just "stop and clear" —
  // the same thing Cancel/Escape/Done already do for it.
  if (state.mode === MODES.MEASURE) {
    event.preventDefault();
    cancelDrawing();
    return;
  }

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
  hintFinish.classList.add("hidden");

  if (state.mode === MODES.DRAW_LINE || state.mode === MODES.DRAW_POLYGON) {
    const count = state.drawing.coordinates.length;
    const minPoints = state.mode === MODES.DRAW_POLYGON ? 3 : 2;

    // Relying on a double-tap to finish is unreliable on touchscreens (it
    // competes with the map's own double-tap-to-zoom gesture), so give
    // mobile users an explicit button as soon as there are enough points.
    hintText.textContent = count === 0
      ? "Tap the map to start drawing."
      : `${count} point${count === 1 ? "" : "s"} — tap Finish when done, or keep tapping to add more.`;
    hintCancel.textContent = "Cancel";
    hintFinish.classList.toggle("hidden", count < minPoints);
    hintEl.classList.remove("hidden");
  } else if (state.mode === MODES.ADD_POINT) {
    hintText.textContent = "Tap the map to place a point.";
    hintCancel.textContent = "Cancel";
    hintEl.classList.remove("hidden");
  } else if (state.mode === MODES.EDIT_SHAPE) {
    const geometry = state.selectedId && getObject(state.selectedId)?.geometry;
    hintText.textContent = geometry && geometry.type !== "Point"
      ? "Drag a white handle to move it, tap it to remove it, or drag a light blue handle to add a point."
      : "Drag the white handle to move it.";
    hintCancel.textContent = "Done";
    hintEl.classList.remove("hidden");
  } else if (state.mode === MODES.MEASURE) {
    const coords = state.drawing.coordinates;
    if (coords.length < 2) {
      hintText.textContent = "Tap the map to start measuring.";
    } else {
      let text = `📏 ${formatDistance(lineLengthMeters(coords))}`;
      if (coords.length >= 3) {
        const area = polygonAreaMeters([[...coords, coords[0]]]);
        text += ` · ▦ ${formatArea(area)} enclosed`;
      }
      hintText.textContent = `${text} — tap to add more points, or Done to finish.`;
    }
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
  renderSidebar(state.objects, state.selectedId, (id) => {
    selectObject(id);
    closeSidebarSheet();
    const feature = getObject(id);
    if (feature) flyToFeature(feature);
  });
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
