// Files attached to objects are stored as raw blobs in IndexedDB, not
// localStorage (which is string-only and far too small for photos/PDFs/etc).
// Each object's GeoJSON properties only ever hold lightweight metadata
// ({id, name, type, size}) pointing at a record here — see
// objects/object-store.js's addAttachmentMeta/removeAttachmentMeta.
//
// Deliberately left out of Export/Import for now: embedding files as base64
// would bloat the exported JSON and slow it down, so attachments are
// local-to-this-browser only until that's actually asked for.
const DB_NAME = "map-editor-files-v1";
const STORE_NAME = "files";

export const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("byFeature", "featureId");
        store.createIndex("byMap", "mapId");
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });

  return dbPromise;
}

function makeId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `file_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function runTransaction(db, mode, work) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const result = work(tx.objectStore(STORE_NAME));
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export function isImageType(type) {
  return typeof type === "string" && type.startsWith("image/");
}

export async function addFile(mapId, featureId, file) {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`"${file.name}" is too large (max ${Math.round(MAX_FILE_SIZE_BYTES / 1024 / 1024)}MB).`);
  }

  const db = await openDB();
  const id = makeId();
  const record = {
    id,
    mapId,
    featureId,
    name: file.name,
    type: file.type || "application/octet-stream",
    size: file.size,
    blob: file,
    createdAt: Date.now(),
  };

  await runTransaction(db, "readwrite", (store) => store.add(record));
  return { id: record.id, name: record.name, type: record.type, size: record.size };
}

export async function getFileBlob(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result ? request.result.blob : null);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteFile(id) {
  const db = await openDB();
  await runTransaction(db, "readwrite", (store) => store.delete(id));
}

function deleteByIndex(indexName, value) {
  return openDB().then((db) =>
    runTransaction(db, "readwrite", (store) => {
      const request = store.index(indexName).openCursor(IDBKeyRange.only(value));
      request.onsuccess = () => {
        const cursor = request.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
    })
  );
}

export function deleteFilesForFeature(featureId) {
  return deleteByIndex("byFeature", featureId);
}

export function deleteFilesForMap(mapId) {
  return deleteByIndex("byMap", mapId);
}
