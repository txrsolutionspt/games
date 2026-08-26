const layersButton = document.getElementById("layers-button");
const layersDropdown = document.getElementById("layers-dropdown");

export function setupLayersMenu({ getSettings, onToggleGroup, onToggleLabels }) {
  renderState(getSettings());

  layersButton.addEventListener("click", () => {
    layersDropdown.classList.toggle("hidden");
  });

  document.addEventListener("click", (event) => {
    if (!layersDropdown.contains(event.target) && !layersButton.contains(event.target)) {
      layersDropdown.classList.add("hidden");
    }
  });

  for (const button of layersDropdown.querySelectorAll("[data-layer]")) {
    button.addEventListener("click", () => {
      const layer = button.dataset.layer;
      if (layer === "labels") {
        onToggleLabels();
      } else {
        onToggleGroup(layer);
      }
      renderState(getSettings());
    });
  }
}

function renderState(settings) {
  for (const button of layersDropdown.querySelectorAll("[data-layer]")) {
    const layer = button.dataset.layer;
    const on = layer === "labels" ? settings.labelsVisible : settings.layers[layer] !== false;

    const stateEl = button.querySelector(".layer-state");
    if (stateEl) stateEl.textContent = on ? "●" : "○";
    button.classList.toggle("layer-off", !on);
  }
}
