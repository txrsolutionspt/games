import { getState, replaceAll } from "../objects/object-store.js?v=2026-08-26.12";

const addButton = document.getElementById("add-button");
const addDropdown = document.getElementById("add-dropdown");
const moreButton = document.getElementById("more-button");
const moreDropdown = document.getElementById("more-dropdown");
const importInput = document.getElementById("import-input");
const searchInput = document.getElementById("search-input");
const searchClear = document.getElementById("search-clear");
const searchResults = document.getElementById("search-results");
const aboutOverlay = document.getElementById("about-overlay");
const aboutVersion = document.getElementById("about-version");
const aboutClose = document.getElementById("about-close");

export function setupToolbar({ onAdd, onFlyTo }) {
  setupDropdown(addButton, addDropdown, "[data-add]", (button) => onAdd(button.dataset.add));

  setupDropdown(moreButton, moreDropdown, "[data-action]", (button) => {
    const action = button.dataset.action;
    if (action === "import") importInput.click();
    else if (action === "export") exportData();
    else if (action === "about") openAboutDialog();
  });

  aboutClose.addEventListener("click", () => aboutOverlay.classList.add("hidden"));

  importInput.addEventListener("change", async () => {
    const file = importInput.files[0];
    importInput.value = "";
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!Array.isArray(data.objects)) {
        throw new Error("Missing objects array");
      }
      replaceAll(data.objects);
    } catch (error) {
      console.error("Failed to import map data", error);
      alert("That file doesn't look like valid map data.");
    }
  });

  setupSearch(onFlyTo);
}

function setupDropdown(triggerButton, dropdown, itemSelector, onItemClick) {
  triggerButton.addEventListener("click", () => {
    dropdown.classList.toggle("hidden");
  });

  document.addEventListener("click", (event) => {
    if (!dropdown.contains(event.target) && !triggerButton.contains(event.target)) {
      dropdown.classList.add("hidden");
    }
  });

  for (const button of dropdown.querySelectorAll(itemSelector)) {
    button.addEventListener("click", () => {
      dropdown.classList.add("hidden");
      onItemClick(button);
    });
  }
}

// Reads from the build badge rather than a separate literal, so there's
// only one place to update when the version is bumped.
function openAboutDialog() {
  const badge = document.getElementById("build-badge");
  aboutVersion.textContent = badge ? badge.textContent.trim() : "";
  aboutOverlay.classList.remove("hidden");
}

function exportData() {
  const data = { version: 1, objects: getState().objects };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "map-data.json";
  link.click();

  URL.revokeObjectURL(url);
}

let searchDebounce = null;

function setupSearch(onFlyTo) {
  searchInput.addEventListener("input", () => {
    clearTimeout(searchDebounce);
    const query = searchInput.value.trim();

    searchClear.classList.toggle("hidden", query.length === 0);

    if (query.length < 3) {
      searchResults.classList.add("hidden");
      searchResults.innerHTML = "";
      return;
    }

    searchDebounce = setTimeout(() => runSearch(query, onFlyTo), 350);
  });

  searchClear.addEventListener("click", () => {
    searchInput.value = "";
    searchClear.classList.add("hidden");
    searchResults.classList.add("hidden");
    searchResults.innerHTML = "";
    searchInput.focus();
  });

  document.addEventListener("click", (event) => {
    if (!searchResults.contains(event.target) && event.target !== searchInput) {
      searchResults.classList.add("hidden");
    }
  });
}

async function runSearch(query, onFlyTo) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(query)}`;
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    const results = await response.json();

    searchResults.innerHTML = "";

    if (!results.length) {
      searchResults.classList.add("hidden");
      return;
    }

    for (const result of results) {
      const button = document.createElement("button");
      button.textContent = result.display_name;
      button.addEventListener("click", () => {
        onFlyTo([parseFloat(result.lon), parseFloat(result.lat)]);
        searchResults.classList.add("hidden");
      });
      searchResults.appendChild(button);
    }

    searchResults.classList.remove("hidden");
  } catch (error) {
    console.error("Location search failed", error);
  }
}
