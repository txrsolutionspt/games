const SETTINGS_KEY = "map-settings-v1";

const DEFAULT_SETTINGS = Object.freeze({
  style: "satellite",
  projection: "globe",
  labelsVisible: false,
});

export function loadMapSettings() {
  const raw = localStorage.getItem(SETTINGS_KEY);
  if (!raw) return { ...DEFAULT_SETTINGS };

  try {
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_SETTINGS, ...parsed };
  } catch (error) {
    console.error("Invalid map settings in localStorage, ignoring them.", error);
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveMapSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
