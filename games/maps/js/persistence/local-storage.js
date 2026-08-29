const STORAGE_KEY_PREFIX = "map-editor-data-v1";

function keyFor(mapId) {
  return `${STORAGE_KEY_PREFIX}:${mapId}`;
}

export function loadObjects(mapId) {
  const raw = localStorage.getItem(keyFor(mapId));

  if (!raw) {
    return [];
  }

  try {
    const data = JSON.parse(raw);
    return Array.isArray(data.objects) ? data.objects : [];
  } catch (error) {
    console.error("Invalid map data in localStorage, ignoring it.", error);
    return [];
  }
}

export function saveObjects(mapId, objects) {
  localStorage.setItem(
    keyFor(mapId),
    JSON.stringify({ version: 1, objects })
  );
}
