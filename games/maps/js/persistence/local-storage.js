const STORAGE_KEY = "map-editor-data-v1";

export function loadObjects() {
  const raw = localStorage.getItem(STORAGE_KEY);

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

export function saveObjects(objects) {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({ version: 1, objects })
  );
}
