import {
  lineLengthMeters,
  polygonAreaMeters,
  formatDistance,
  formatArea,
  formatCoordinate,
  haversineDistance,
} from "../geo/measure.js?v=2026-08-26.30";
import { categoryInfo } from "../objects/object-model.js?v=2026-08-26.30";
import { getFileBlob, isImageType } from "../persistence/attachments.js?v=2026-08-26.30";

const summaryEl = document.getElementById("object-summary");
const listEl = document.getElementById("object-list");
const sortSelect = document.getElementById("sidebar-sort");
const filterSelect = document.getElementById("sidebar-filter");

const GROUPS = [
  { type: "Point", label: "Places", icon: "🔵" },
  { type: "Polygon", label: "Areas", icon: "🟢" },
  { type: "LineString", label: "Routes", icon: "🟠" },
];

// Sort/filter selections are UI state that belongs to the sidebar itself,
// not the object store — they shouldn't reset just because an unrelated
// change (a drag, a property edit elsewhere) triggers a re-render. So this
// module caches the latest renderSidebar() call and re-applies it whenever
// either control changes, rather than needing app.js to re-call in.
let currentObjects = [];
let currentSelectedId = null;
let currentOnSelect = () => {};
let sortMode = "default";
let filterKey = "all";

// Fetched lazily, only once "Nearest to me" is actually picked — no point
// prompting for location permission before the user asks for it. null
// until a fix succeeds; sorting by "nearest" silently falls back to
// insertion order until then (or forever, if permission is denied).
let userLocation = null;
let locationRequestInFlight = false;

function ensureUserLocation(onReady) {
  if (userLocation || locationRequestInFlight || !navigator.geolocation) return;

  locationRequestInFlight = true;
  navigator.geolocation.getCurrentPosition(
    (position) => {
      userLocation = [position.coords.longitude, position.coords.latitude];
      locationRequestInFlight = false;
      onReady();
    },
    () => {
      locationRequestInFlight = false;
    },
    { enableHighAccuracy: false, timeout: 8000 }
  );
}

sortSelect?.addEventListener("change", () => {
  sortMode = sortSelect.value;
  if (sortMode === "nearest") ensureUserLocation(renderList);
  renderList();
});

filterSelect?.addEventListener("change", () => {
  filterKey = filterSelect.value;
  renderList();
});

function categorySortKey(geometryType, value) {
  const info = categoryInfo(geometryType, value);
  return info ? info.label : value || "";
}

function distanceFromUser(feature) {
  const anchor = popupAnchor(feature.geometry);
  if (!anchor) return Infinity;
  return haversineDistance(userLocation, anchor);
}

function sortFeatures(features) {
  if (sortMode === "name") {
    return [...features].sort((a, b) =>
      (a.properties.name || "").localeCompare(b.properties.name || "", undefined, { sensitivity: "base" })
    );
  }

  if (sortMode === "category") {
    const groupOrder = GROUPS.map((group) => group.type);
    return [...features].sort((a, b) => {
      const groupDiff = groupOrder.indexOf(a.geometry.type) - groupOrder.indexOf(b.geometry.type);
      if (groupDiff !== 0) return groupDiff;

      const labelDiff = categorySortKey(a.geometry.type, a.properties.category).localeCompare(
        categorySortKey(b.geometry.type, b.properties.category)
      );
      if (labelDiff !== 0) return labelDiff;

      return (a.properties.name || "").localeCompare(b.properties.name || "");
    });
  }

  if (sortMode === "nearest") {
    if (!userLocation) return features;
    return [...features].sort((a, b) => distanceFromUser(a) - distanceFromUser(b));
  }

  return features; // "default": whatever order the store holds them in
}

function applyFilter(features) {
  if (filterKey === "all") return features;
  const [type, value] = filterKey.split(":");
  return features.filter((feature) => feature.geometry.type === type && feature.properties.category === value);
}

// Rebuilt on every render so it only ever offers categories actually in
// use — picking one that then matches nothing can't happen. Grouped into
// the same Places/Routes/Areas buckets as the summary above, so a "water"
// Point and a "water" Polygon (same value, different geometry types, see
// CATEGORIES in object-model.js) show up as distinct options rather than
// colliding into one.
function renderFilterOptions(objects) {
  if (!filterSelect) return;

  const present = new Map();
  for (const feature of objects) {
    const type = feature.geometry.type;
    const value = feature.properties.category;
    const info = categoryInfo(type, value);
    if (!info) continue;
    present.set(`${type}:${value}`, { type, value, label: info.label, icon: info.icon });
  }

  filterSelect.innerHTML = '<option value="all">All categories</option>';

  for (const group of GROUPS) {
    const entries = [...present.values()]
      .filter((entry) => entry.type === group.type)
      .sort((a, b) => a.label.localeCompare(b.label));
    if (entries.length === 0) continue;

    const optgroup = document.createElement("optgroup");
    optgroup.label = group.label;
    for (const entry of entries) {
      const option = document.createElement("option");
      option.value = `${entry.type}:${entry.value}`;
      option.textContent = `${entry.icon ? entry.icon + " " : ""}${entry.label}`;
      optgroup.appendChild(option);
    }
    filterSelect.appendChild(optgroup);
  }

  if (filterKey !== "all" && !present.has(filterKey)) {
    filterKey = "all";
  }
  filterSelect.value = filterKey;
}

function renderList() {
  const sorted = sortFeatures(applyFilter(currentObjects));

  listEl.innerHTML = "";

  if (sorted.length === 0) {
    const empty = document.createElement("p");
    empty.className = "object-list-empty";
    empty.textContent = currentObjects.length === 0 ? "No objects yet." : "No objects match this filter.";
    listEl.appendChild(empty);
    return;
  }

  for (const feature of sorted) {
    const item = document.createElement("div");
    item.className = "object-list-item" + (feature.id === currentSelectedId ? " selected" : "");
    item.innerHTML = `
      <span class="name">${escapeHtml(feature.properties.name || "(unnamed)")}</span>
      <span class="category">${categoryLabel(feature.geometry.type, feature.properties.category)}</span>
    `;
    item.addEventListener("click", () => currentOnSelect(feature.id));
    listEl.appendChild(item);
  }
}

export function renderSidebar(objects, selectedId, onSelect) {
  currentObjects = objects;
  currentSelectedId = selectedId;
  currentOnSelect = onSelect;

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

  renderFilterOptions(objects);
  renderList();
}

let activePopup = null;
let popupObjectUrls = [];

export function showFeaturePopup(map, feature, handlers, unitSystem = "metric") {
  closeFeaturePopup();

  const coordinates = popupAnchor(feature.geometry);
  if (!coordinates) return;

  const container = document.createElement("div");
  container.className = "feature-popup";
  container.innerHTML = `
    <h4>${escapeHtml(feature.properties.name || "(unnamed)")}</h4>
    <p class="category">${categoryLabel(feature.geometry.type, feature.properties.category)}</p>
    ${geometryMeta(feature.geometry, unitSystem)}
    <p>${escapeHtml(feature.properties.description || "")}</p>
    <div class="popup-attachments"></div>
    <div class="actions">
      <button data-action="edit-info">✏ Edit</button>
      <button data-action="edit-shape">⌖ Shape</button>
      <button data-action="duplicate">⧉ Copy</button>
    </div>
    <div class="actions-danger">
      <button data-action="delete">🗑 Delete</button>
    </div>
  `;

  container.querySelector('[data-action="edit-info"]').addEventListener("click", handlers.onEditInfo);
  container.querySelector('[data-action="edit-shape"]').addEventListener("click", handlers.onEditShape);
  container.querySelector('[data-action="duplicate"]').addEventListener("click", handlers.onDuplicate);
  container.querySelector('[data-action="delete"]').addEventListener("click", handlers.onDelete);

  renderPopupAttachments(container.querySelector(".popup-attachments"), feature.properties.attachments || []);

  activePopup = new maplibregl.Popup({ closeOnClick: false, closeButton: false })
    .setLngLat(coordinates)
    .setDOMContent(container)
    .addTo(map);
}

function renderPopupAttachments(container, attachments) {
  if (!attachments.length) return;

  for (const attachment of attachments) {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "popup-attachment";
    item.title = attachment.name;

    const thumb = document.createElement("span");
    thumb.className = "popup-attachment-thumb";
    thumb.textContent = "📄";
    item.appendChild(thumb);

    async function open() {
      const blob = await getFileBlob(attachment.id).catch(() => null);
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      popupObjectUrls.push(url);
      window.open(url, "_blank");
    }
    item.addEventListener("click", open);

    if (isImageType(attachment.type)) {
      getFileBlob(attachment.id)
        .then((blob) => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          popupObjectUrls.push(url);
          thumb.textContent = "";
          thumb.classList.add("popup-attachment-thumb-image");
          thumb.style.backgroundImage = `url("${url}")`;
        })
        .catch(() => {});
    }

    container.appendChild(item);
  }
}

export function closeFeaturePopup() {
  for (const url of popupObjectUrls) URL.revokeObjectURL(url);
  popupObjectUrls = [];

  if (activePopup) {
    activePopup.remove();
    activePopup = null;
  }
}

function geometryMeta(geometry, unitSystem) {
  if (geometry.type === "Point") {
    return `<p class="meta">📍 ${formatCoordinate(geometry.coordinates)}</p>`;
  }

  if (geometry.type === "LineString") {
    const length = lineLengthMeters(geometry.coordinates);
    return `
      <p class="meta">📍 ${formatCoordinate(geometry.coordinates[0])}</p>
      <p class="meta">📏 ${formatDistance(length, unitSystem)}</p>
    `;
  }

  if (geometry.type === "Polygon") {
    const area = polygonAreaMeters(geometry.coordinates);
    return `
      <p class="meta">📍 ${formatCoordinate(geometry.coordinates[0][0])}</p>
      <p class="meta">▦ ${formatArea(area, unitSystem)}</p>
    `;
  }

  return "";
}

function categoryLabel(geometryType, value) {
  const category = categoryInfo(geometryType, value);
  if (!category) return escapeHtml(value || "");
  return `${category.icon ? escapeHtml(category.icon) + " " : ""}${escapeHtml(category.label)}`;
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
