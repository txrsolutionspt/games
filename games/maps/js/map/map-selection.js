import { OBJECT_LAYER_IDS } from "./map-layers.js?v=2026-08-26.22";

export function setupSelection(map, { onSelect, isSelectable }) {
  map.on("click", OBJECT_LAYER_IDS, (event) => {
    if (!isSelectable() || !event.features?.length) return;
    onSelect(event.features[0].properties.id);
  });

  map.on("click", (event) => {
    if (!isSelectable()) return;
    const hits = map.queryRenderedFeatures(event.point, { layers: OBJECT_LAYER_IDS });
    if (hits.length === 0) {
      onSelect(null);
    }
  });

  for (const layerId of OBJECT_LAYER_IDS) {
    map.on("mouseenter", layerId, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", layerId, () => {
      map.getCanvas().style.cursor = "";
    });
  }
}
