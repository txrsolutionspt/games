const mapsOverlay = document.getElementById("maps-overlay");
const mapsListEl = document.getElementById("maps-list");
const mapsCloseButton = document.getElementById("maps-close");
const mapsNewButton = document.getElementById("maps-new");

export function setupMapsDialog({ getMaps, getActiveMapId, getObjectCount, onSwitch, onCreate, onRename, onDelete }) {
  mapsCloseButton.addEventListener("click", close);
  mapsNewButton.addEventListener("click", () => {
    onCreate();
    close();
  });

  function renderList() {
    const maps = getMaps();
    const activeId = getActiveMapId();
    mapsListEl.innerHTML = "";

    for (const mapEntry of maps) {
      const row = document.createElement("div");
      row.className = "maps-list-item" + (mapEntry.id === activeId ? " active" : "");

      const info = document.createElement("button");
      info.type = "button";
      info.className = "maps-list-info";
      info.innerHTML = `
        <span class="maps-list-icon">🗺️</span>
        <span class="maps-list-text">
          <span class="maps-list-name">${escapeHtml(mapEntry.name)}</span>
          <span class="maps-list-count">${getObjectCount(mapEntry.id)} objects</span>
        </span>
      `;
      info.addEventListener("click", () => {
        onSwitch(mapEntry.id);
        close();
      });

      const renameButton = document.createElement("button");
      renameButton.type = "button";
      renameButton.className = "maps-list-action";
      renameButton.textContent = "✏";
      renameButton.setAttribute("aria-label", "Rename map");
      renameButton.addEventListener("click", (event) => {
        event.stopPropagation();
        startRename(row, mapEntry);
      });

      const deleteButton = document.createElement("button");
      deleteButton.type = "button";
      deleteButton.className = "maps-list-action maps-list-delete";
      deleteButton.textContent = "🗑";
      deleteButton.setAttribute("aria-label", "Delete map");
      deleteButton.disabled = maps.length <= 1;
      deleteButton.addEventListener("click", async (event) => {
        event.stopPropagation();
        const deleted = await onDelete(mapEntry.id, mapEntry.name);
        if (deleted) renderList();
      });

      row.appendChild(info);
      row.appendChild(renameButton);
      row.appendChild(deleteButton);
      mapsListEl.appendChild(row);
    }
  }

  function startRename(row, mapEntry) {
    const nameEl = row.querySelector(".maps-list-name");
    const input = document.createElement("input");
    input.type = "text";
    input.className = "maps-list-rename-input";
    input.value = mapEntry.name;

    nameEl.replaceWith(input);
    input.focus();
    input.select();

    let committed = false;
    function commit() {
      if (committed) return;
      committed = true;
      const value = input.value.trim();
      if (value && value !== mapEntry.name) {
        onRename(mapEntry.id, value);
      }
      renderList();
    }

    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") input.blur();
      if (event.key === "Escape") {
        input.value = mapEntry.name;
        input.blur();
      }
    });
  }

  function close() {
    mapsOverlay.classList.add("hidden");
  }

  return {
    open() {
      renderList();
      mapsOverlay.classList.remove("hidden");
    },
  };
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}
