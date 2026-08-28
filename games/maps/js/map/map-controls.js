// A small custom MapLibre control implementing the same onAdd/onRemove
// interface as the library's built-in controls (NavigationControl,
// GeolocateControl), so it can be added the same way and picks up the
// same .maplibregl-ctrl-group styling automatically.
export function createFitAllControl(onClick) {
  let map;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "maplibregl-ctrl-icon map-fit-all-icon";
  button.setAttribute("aria-label", "Show all objects");
  button.title = "Show all objects";
  button.textContent = "⊡";

  const container = document.createElement("div");
  container.className = "maplibregl-ctrl maplibregl-ctrl-group";
  container.appendChild(button);

  button.addEventListener("click", () => onClick(map));

  return {
    onAdd(mapInstance) {
      map = mapInstance;
      return container;
    },
    onRemove() {
      container.parentNode?.removeChild(container);
      map = undefined;
    },
  };
}
