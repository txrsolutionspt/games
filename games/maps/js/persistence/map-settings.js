const SETTINGS_KEY = "map-settings-v1";

const DEFAULT_SETTINGS = Object.freeze({
  style: "satellite",
  projection: "globe",
  labelsVisible: false,
  layers: Object.freeze({ Point: true, LineString: true, Polygon: true }),
});

export function loadMapSettings() {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) return cloneDefaults();

  try {
    const parsed = JSON.parse(raw);
    return {
      ...cloneDefaults(),
      ...parsed,
      layers: { ...DEFAULT_SETTINGS.layers, ...parsed.layers },
    };
  } catch (error) {
    console.error("Invalid map settings in localStorage, ignoring them.", error);
    return cloneDefaults();
  }
}

export function saveMapSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function cloneDefaults() {
  return { ...DEFAULT_SETTINGS, layers: { ...DEFAULT_SETTINGS.layers } };
}
