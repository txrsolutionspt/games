// Base map styles are pure configuration, independent of the user's data.
// The "terrain" entry bundles elevation with satellite imagery as one
// cohesive choice; 2D/3D projection is a separate, orthogonal setting that
// applies to whichever style is active (see buildBaseStyle below).

const SATELLITE_SOURCE = {
  type: "raster",
  tiles: ["https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg"],
  tileSize: 256,
  attribution: "Sentinel-2 cloudless — EOX IT Services GmbH",
};

// CARTO's basemaps.cartocdn.com raster endpoints (rastertiles/voyager,
// dark_all) now require a signed-up API key and serve a watermarked
// "API KEY REQUIRED" placeholder instead of tiles without one. OpenStreetMap's
// own tile server remains free with no key required, so "street" uses that
// directly; "dark" reuses it too, darkened with raster paint properties
// (MapLibre has no true color-invert paint property, so this is a dimmed/
// muted look rather than a proper dark-mode redraw — but it actually renders,
// which the previous CARTO source no longer does).
const OSM_SOURCE = {
  type: "raster",
  tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
  tileSize: 256,
  attribution: "© OpenStreetMap contributors",
};

const TERRAIN_DEM_SOURCE = {
  type: "raster-dem",
  url: "https://demotiles.maplibre.org/terrain-tiles/tiles.json",
  tileSize: 256,
};

export const MAP_STYLES = Object.freeze({
  street: {
    id: "street",
    name: "Street",
    icon: "🛣️",
    source: OSM_SOURCE,
  },
  satellite: {
    id: "satellite",
    name: "Satellite",
    icon: "🛰️",
    source: SATELLITE_SOURCE,
  },
  terrain: {
    id: "terrain",
    name: "Terrain",
    icon: "⛰️",
    source: SATELLITE_SOURCE,
    elevation: true,
  },
  dark: {
    id: "dark",
    name: "Dark",
    icon: "🌙",
    source: OSM_SOURCE,
    paint: {
      "raster-brightness-max": 0.35,
      "raster-saturation": -0.6,
      "raster-contrast": 0.15,
    },
  },
});

export function buildBaseStyle(styleId, projection) {
  const style = MAP_STYLES[styleId] || MAP_STYLES.satellite;

  const sources = { base: style.source };
  if (style.elevation) {
    sources.terrain = TERRAIN_DEM_SOURCE;
  }

  return {
    version: 8,
    projection: { type: projection },
    sources,
    layers: [
      {
        id: "base-layer",
        type: "raster",
        source: "base",
        ...(style.paint ? { paint: style.paint } : {}),
      },
    ],
    ...(style.elevation ? { terrain: { source: "terrain", exaggeration: 1.5 } } : {}),
  };
}
