const SETTINGS_KEY_PREFIX = "map-settings-v1";

function keyFor(mapId) {
  return `${SETTINGS_KEY_PREFIX}:${mapId}`;
}

const DEFAULT_SETTINGS = Object.freeze({
  style: "satellite",
  projection: "mercator", // flat top-down view by default; 3D Globe is opt-in via the View menu
  labelsVisible: false,
  layers: Object.freeze({ Point: true, LineString: true, Polygon: true }),
  // Roughly the geographic center of mainland Portugal, zoomed to show the
  // whole country — used only until the user's own last-viewed position
  // gets saved below.
  view: Object.freeze({ center: Object.freeze([-8.0, 39.5]), zoom: 6 }),
});

export function loadMapSettings(mapId) {
  const raw = localStorage.getItem(keyFor(mapId));
  if (!raw) return cloneDefaults();

  try {
    const parsed = JSON.parse(raw);
    return {
      ...cloneDefaults(),
      ...parsed,
      layers: { ...DEFAULT_SETTINGS.layers, ...parsed.layers },
      view: { ...DEFAULT_SETTINGS.view, ...parsed.view },
    };
  } catch (error) {
    console.error("Invalid map settings in localStorage, ignoring them.", error);
    return cloneDefaults();
  }
}

export function saveMapSettings(mapId, settings) {
  localStorage.setItem(keyFor(mapId), JSON.stringify(settings));
}

function cloneDefaults() {
  return {
    ...DEFAULT_SETTINGS,
    layers: { ...DEFAULT_SETTINGS.layers },
    view: { center: [...DEFAULT_SETTINGS.view.center], zoom: DEFAULT_SETTINGS.view.zoom },
  };
}
