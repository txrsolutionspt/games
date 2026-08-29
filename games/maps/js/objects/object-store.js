import { loadObjects, saveObjects } from "../persistence/local-storage.js?v=2026-08-26.20";
import { getActiveMapId } from "../persistence/maps-index.js?v=2026-08-26.20";
import { MODES, touch } from "./object-model.js?v=2026-08-26.20";

let currentMapId = getActiveMapId();

const state = {
  objects: loadObjects(currentMapId),
  selectedId: null,
  mode: MODES.VIEW,
  drawing: { geometryType: null, coordinates: [] },
};

const listeners = new Set();

function emit() {
  for (const listener of listeners) {
    listener(state);
  }
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getState() {
  return state;
}

function persist() {
  saveObjects(currentMapId, state.objects);
}

export function getCurrentMapId() {
  return currentMapId;
}

// Switching maps is conceptually "close this world, open another one": the
// object list, selection, and any in-progress drawing/measuring all reset,
// same as a fresh load would for that map.
export function switchMap(mapId) {
  currentMapId = mapId;
  state.objects = loadObjects(currentMapId);
  state.selectedId = null;
  state.mode = MODES.VIEW;
  state.drawing = { geometryType: null, coordinates: [] };
  emit();
}

export function setMode(mode) {
  state.mode = mode;

  if (mode !== MODES.DRAW_LINE && mode !== MODES.DRAW_POLYGON && mode !== MODES.MEASURE) {
    state.drawing = { geometryType: null, coordinates: [] };
  }

  emit();
}

export function startDrawing(geometryType) {
  state.drawing = { geometryType, coordinates: [] };
  emit();
}

export function addDrawingPoint(coordinate) {
  state.drawing.coordinates.push(coordinate);
  emit();
}

export function cancelDrawing() {
  state.drawing = { geometryType: null, coordinates: [] };
  state.mode = MODES.VIEW;
  emit();
}

export function addObject(feature) {
  state.objects.push(feature);
  persist();
  emit();
}

export function updateObjectProperties(id, properties) {
  const feature = state.objects.find((object) => object.id === id);
  if (!feature) return null;

  Object.assign(feature.properties, properties);
  touch(feature);
  persist();
  emit();
  return feature;
}

export function updateObjectGeometry(id, mutator) {
  const feature = state.objects.find((object) => object.id === id);
  if (!feature) return null;

  mutator(feature.geometry);
  touch(feature);
  persist();
  emit();
  return feature;
}

export function deleteObject(id) {
  state.objects = state.objects.filter((object) => object.id !== id);
  if (state.selectedId === id) {
    state.selectedId = null;
  }
  persist();
  emit();
}

export function selectObject(id) {
  state.selectedId = id;
  emit();
}

export function getObject(id) {
  return state.objects.find((object) => object.id === id) || null;
}

export function getSelectedObject() {
  return state.selectedId ? getObject(state.selectedId) : null;
}

export function replaceAll(objects) {
  state.objects = objects;
  state.selectedId = null;
  state.mode = MODES.VIEW;
  persist();
  emit();
}

export function toFeatureCollection() {
  return { type: "FeatureCollection", features: state.objects };
}
