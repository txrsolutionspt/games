import {
  lineLengthMeters,
  polygonAreaMeters,
  formatDistance,
  formatArea,
  formatCoordinate,
} from "../geo/measure.js?v=2026-08-26.14";

const summaryEl = document.getElementById("object-summary");
const listEl = document.getElementById("object-list");

const GROUPS = [
  { type: "Point", label: "Places", icon: "🔵" },
  { type: "Polygon", label: "Areas", icon: "🟢" },
  { type: "LineString", label: "Routes", icon: "🟠" },
];

export function renderSidebar(objects, selectedId, onSelect) {
  const counts = { Point: 0, LineString: 0, Polygon: 0 };
  for (const feature of objects) {
    if (feature.geometry.type in counts) {
      counts[feature.geometry.type] += 1;
    }
  }

  summaryEl.innerHTML = "";
  for (const group of GROUPS) {
    const li = document.createElement("li");
    li.innerHTML = `<span>${group.icon} ${group.label}</span><span>${counts[group.type]}</span>`;
    summaryEl.appendChild(li);
  }

  listEl.innerHTML = "";
  for (const feature of objects) {
    const item = document.createElement("div");
    item.className = "object-list-item" + (feature.id === selectedId ? " selected" : "");
    item.innerHTML = `
      <span class="name">${escapeHtml(feature.properties.name || "(unnamed)")}</span>
      <span class="category">${escapeHtml(feature.properties.category || "")}</span>
    `;
    item.addEventListener("click", () => onSelect(feature.id));
    listEl.appendChild(item);
  }
}

let activePopup = null;

export function showFeaturePopup(map, feature, handlers) {
  closeFeaturePopup();

  const coordinates = popupAnchor(feature.geometry);
  if (!coordinates) return;

  const container = document.createElement("div");
  container.className = "feature-popup";
  container.innerHTML = `
    <h4>${escapeHtml(feature.properties.name || "(unnamed)")}</h4>
    <p class="category">${escapeHtml(feature.properties.category || "")}</p>
    ${geometryMeta(feature.geometry)}
    <p>${escapeHtml(feature.properties.description || "")}</p>
    <div class="actions">
      <button data-action="edit-info">✏ Edit</button>
      <button data-action="edit-shape">⌖ Shape</button>
    </div>
    <div class="actions-danger">
      <button data-action="delete">🗑 Delete</button>
    </div>
  `;

  container.querySelector('[data-action="edit-info"]').addEventListener("click", handlers.onEditInfo);
  container.querySelector('[data-action="edit-shape"]').addEventListener("click", handlers.onEditShape);
  container.querySelector('[data-action="delete"]').addEventListener("click", handlers.onDelete);

  activePopup = new maplibregl.Popup({ closeOnClick: false, closeButton: false })
    .setLngLat(coordinates)
    .setDOMContent(container)
    .addTo(map);
}

export function closeFeaturePopup() {
  if (activePopup) {
    activePopup.remove();
    activePopup = null;
  }
}

function geometryMeta(geometry) {
  if (geometry.type === "Point") {
    return `<p class="meta">📍 ${formatCoordinate(geometry.coordinates)}</p>`;
  }

  if (geometry.type === "LineString") {
    const length = lineLengthMeters(geometry.coordinates);
    return `
      <p class="meta">📍 ${formatCoordinate(geometry.coordinates[0])}</p>
      <p class="meta">📏 ${formatDistance(length)}</p>
    `;
  }

  if (geometry.type === "Polygon") {
    const area = polygonAreaMeters(geometry.coordinates);
    return `
      <p class="meta">📍 ${formatCoordinate(geometry.coordinates[0][0])}</p>
      <p class="meta">▦ ${formatArea(area)}</p>
    `;
  }

  return "";
}

function popupAnchor(geometry) {
  if (geometry.type === "Point") return geometry.coordinates;
  if (geometry.type === "LineString") return geometry.coordinates[Math.floor(geometry.coordinates.length / 2)];
  if (geometry.type === "Polygon") return ringCentroid(geometry.coordinates[0]);
  return null;
}

function ringCentroid(ring) {
  const points = ring.slice(0, -1);
  const total = points.reduce(
    (acc, [lng, lat]) => [acc[0] + lng, acc[1] + lat],
    [0, 0]
  );
  return [total[0] / points.length, total[1] / points.length];
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}
