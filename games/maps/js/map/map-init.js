export function createMap() {
  const map = new maplibregl.Map({
    container: "map",
    // 1. Enable Globe view via style projection options
    style: {
      version: 8,
      projection: { type: "globe" },
      sources: {
        // Base satellite imagery layer
        satellite: {
          type: "raster",
          tiles: [
            "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg",
          ],
          tileSize: 256,
        },
        // 2. Add Digital Elevation Model (DEM) data source for 3D heights
        "terrain-source": {
          type: "raster-dem",
          url: "https://demotiles.maplibre.org/terrain-tiles/tiles.json",
          tileSize: 256,
        },
      },
      layers: [
        {
          id: "satellite-layer",
          type: "raster",
          source: "satellite",
        },
      ],
      // 3. Apply the DEM source to render true 3D terrain
      terrain: {
        source: "terrain-source",
        exaggeration: 1.5,
      },
    },
    center: [137.91, 36.25], // Centered over the Japanese Alps
    zoom: 3,
    pitch: 65,
    maxPitch: 85,
  });

  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }));
  map.addControl(
    new maplibregl.TerrainControl({ source: "terrain-source", exaggeration: 1.5 })
  );

  return map;
}
