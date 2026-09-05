// App-wide preferences — unlike map-settings.js, these apply across every
// map rather than being namespaced per map: a US-based user almost
// certainly wants imperial units everywhere, not just on one map.
const PREFERENCES_KEY = "map-editor-preferences-v1";

const DEFAULT_PREFERENCES = Object.freeze({
  units: "metric", // "metric" | "imperial"
});

export function loadPreferences() {
  const raw = localStorage.getItem(PREFERENCES_KEY);
  if (!raw) return { ...DEFAULT_PREFERENCES };

  try {
    return { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) };
  } catch (error) {
    console.error("Invalid preferences in localStorage, ignoring them.", error);
    return { ...DEFAULT_PREFERENCES };
  }
}

export function savePreferences(preferences) {
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify(preferences));
}
