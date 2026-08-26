const viewButton = document.getElementById("view-button");
const viewDropdown = document.getElementById("view-dropdown");

export function setupViewMenu({ getSettings, onSelectStyle, onSelectProjection }) {
  renderActiveState(getSettings());

  viewButton.addEventListener("click", () => {
    viewDropdown.classList.toggle("hidden");
  });

  document.addEventListener("click", (event) => {
    if (!viewDropdown.contains(event.target) && !viewButton.contains(event.target)) {
      viewDropdown.classList.add("hidden");
    }
  });

  for (const button of viewDropdown.querySelectorAll("[data-style]")) {
    button.addEventListener("click", () => {
      onSelectStyle(button.dataset.style);
      renderActiveState(getSettings());
      viewDropdown.classList.add("hidden");
    });
  }

  for (const button of viewDropdown.querySelectorAll("[data-projection]")) {
    button.addEventListener("click", () => {
      onSelectProjection(button.dataset.projection);
      renderActiveState(getSettings());
      viewDropdown.classList.add("hidden");
    });
  }
}

function renderActiveState(settings) {
  for (const button of viewDropdown.querySelectorAll("[data-style]")) {
    button.classList.toggle("active", button.dataset.style === settings.style);
  }
  for (const button of viewDropdown.querySelectorAll("[data-projection]")) {
    button.classList.toggle("active", button.dataset.projection === settings.projection);
  }
}
