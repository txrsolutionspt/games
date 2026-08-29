import { buildBaseStyle } from "./map-styles.js?v=2026-08-26.20";

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

  // "Locate me": centers on the device's current position, and (since
  // trackUserLocation is on) turns into a "follow my location" toggle on a
  // second click — MapLibre handles the permission prompt and the button's
  // active/error states itself.
  map.addControl(
    new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: true,
      showUserHeading: true,
    })
  );

  return map;
}
