import { getState, replaceAll } from "../objects/object-store.js?v=2026-08-26.19";
import { categoryInfo } from "../objects/object-model.js?v=2026-08-26.19";

const addButton = document.getElementById("add-button");
const addDropdown = document.getElementById("add-dropdown");
const moreButton = document.getElementById("more-button");
const moreDropdown = document.getElementById("more-dropdown");
const importInput = document.getElementById("import-input");
const searchInput = document.getElementById("search-input");
const searchClear = document.getElementById("search-clear");
const searchResults = document.getElementById("search-results");
const aboutOverlay = document.getElementById("about-overlay");
const aboutClose = document.getElementById("about-close");

export function setupToolbar({ onAdd, onFlyTo, onSelectObject, onOpenMyMaps }) {
  setupDropdown(addButton, addDropdown, "[data-add]", (button) => onAdd(button.dataset.add));

  setupDropdown(moreButton, moreDropdown, "[data-action]", (button) => {
    const action = button.dataset.action;
    if (action === "import") importInput.click();
    else if (action === "export") exportData();
    else if (action === "about") openAboutDialog();
    else if (action === "my-maps") onOpenMyMaps();
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

  setupSearch(onFlyTo, onSelectObject);
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

function openAboutDialog() {
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
let userMatches = [];
let geoResults = [];

// Unified search: your own map objects (instant, no network) plus
// geographic places (debounced, via Nominatim) in one dropdown, so the
// search box isn't just "where is this place" but also "where's the thing
// I already added".
function setupSearch(onFlyTo, onSelectObject) {
  searchInput.addEventListener("input", () => {
    clearTimeout(searchDebounce);
    const query = searchInput.value.trim();

    searchClear.classList.toggle("hidden", query.length === 0);

    if (query.length < 2) {
      userMatches = [];
      geoResults = [];
      renderSearchResults(onFlyTo, onSelectObject);
      return;
    }

    userMatches = matchUserObjects(query);
    renderSearchResults(onFlyTo, onSelectObject);

    if (query.length < 3) return;
    searchDebounce = setTimeout(() => runGeoSearch(query, onFlyTo, onSelectObject), 350);
  });

  searchClear.addEventListener("click", () => {
    searchInput.value = "";
    searchClear.classList.add("hidden");
    userMatches = [];
    geoResults = [];
    renderSearchResults(onFlyTo, onSelectObject);
    searchInput.focus();
  });

  document.addEventListener("click", (event) => {
    if (!searchResults.contains(event.target) && event.target !== searchInput) {
      searchResults.classList.add("hidden");
    }
  });
}

function matchUserObjects(query) {
  const needle = query.toLowerCase();
  return getState()
    .objects.filter((feature) => (feature.properties.name || "").toLowerCase().includes(needle))
    .slice(0, 5);
}

async function runGeoSearch(query, onFlyTo, onSelectObject) {
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(query)}`;
    const response = await fetch(url, { headers: { Accept: "application/json" } });
    geoResults = await response.json();
  } catch (error) {
    console.error("Location search failed", error);
    geoResults = [];
  }
  renderSearchResults(onFlyTo, onSelectObject);
}

function renderSearchResults(onFlyTo, onSelectObject) {
  searchResults.innerHTML = "";

  if (userMatches.length === 0 && geoResults.length === 0) {
    searchResults.classList.add("hidden");
    return;
  }

  for (const feature of userMatches) {
    const category = categoryInfo(feature.geometry.type, feature.properties.category);
    const button = document.createElement("button");
    button.type = "button";
    button.innerHTML = `
      <span class="search-result-icon">${category?.icon || "📍"}</span>
      <span class="search-result-text">
        <span class="search-result-name">${escapeHtml(feature.properties.name || "(unnamed)")}</span>
        <span class="search-result-tag">Your map</span>
      </span>
    `;
    button.addEventListener("click", () => {
      onSelectObject(feature.id);
      searchResults.classList.add("hidden");
    });
    searchResults.appendChild(button);
  }

  if (userMatches.length > 0 && geoResults.length > 0) {
    const divider = document.createElement("div");
    divider.className = "search-results-divider";
    searchResults.appendChild(divider);
  }

  for (const result of geoResults) {
    const button = document.createElement("button");
    button.type = "button";
    button.innerHTML = `
      <span class="search-result-icon">🌍</span>
      <span class="search-result-text">
        <span class="search-result-name">${escapeHtml(result.display_name)}</span>
        <span class="search-result-tag">Map location</span>
      </span>
    `;
    button.addEventListener("click", () => {
      onFlyTo([parseFloat(result.lon), parseFloat(result.lat)]);
      searchResults.classList.add("hidden");
    });
    searchResults.appendChild(button);
  }

  searchResults.classList.remove("hidden");
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}
