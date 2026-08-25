import { getState, replaceAll } from "../objects/object-store.js";

const addButton = document.getElementById("add-button");
const addDropdown = document.getElementById("add-dropdown");
const importButton = document.getElementById("import-button");
const importInput = document.getElementById("import-input");
const exportButton = document.getElementById("export-button");
const searchInput = document.getElementById("search-input");
const searchResults = document.getElementById("search-results");

export function setupToolbar({ onAdd, onFlyTo }) {
  addButton.addEventListener("click", () => {
    addDropdown.classList.toggle("hidden");
  });

  document.addEventListener("click", (event) => {
    if (!addDropdown.contains(event.target) && event.target !== addButton) {
      addDropdown.classList.add("hidden");
    }
  });

  for (const button of addDropdown.querySelectorAll("[data-add]")) {
    button.addEventListener("click", () => {
      addDropdown.classList.add("hidden");
      onAdd(button.dataset.add);
    });
  }

  exportButton.addEventListener("click", exportData);

  importButton.addEventListener("click", () => importInput.click());
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

    if (query.length < 3) {
      searchResults.classList.add("hidden");
      searchResults.innerHTML = "";
      return;
    }

    searchDebounce = setTimeout(() => runSearch(query, onFlyTo), 350);
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
