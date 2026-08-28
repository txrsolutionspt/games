import { buildBaseStyle } from "./map-styles.js?v=2026-08-26.14";

export function createMap(initialSettings) {
  const map = new maplibregl.Map({
    container: "map",
    style: buildBaseStyle(initialSettings.style, initialSettings.projection),
    center: initialSettings.view.center,
    zoom: initialSettings.view.zoom,
    pitch: initialSettings.projection === "globe" ? 65 : 0,
    maxPitch: 85,
  });

  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }));

  return map;
}
