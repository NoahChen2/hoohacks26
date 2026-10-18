// Persistent cache of built canonical body meshes (IndexedDB), so a returning
// visitor sees their body immediately instead of waiting for the worker. The
// version is a hash of the character source files (see vite.config.js), so any
// change to how bodies are built invalidates old entries automatically.
import version from 'virtual:body-mesh-version';

const DB = 'rethread-body-mesh';
const STORE = 'meshes';
let opening = null;

function open() {
  if (opening) return opening;
  opening = new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(STORE);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return opening;
}

const run = (mode, action) =>
  open().then(
    (db) =>
      db &&
      new Promise((resolve) => {
        try {
          const tx = db.transaction(STORE, mode);
          const request = action(tx.objectStore(STORE));
          tx.oncomplete = () => resolve(request?.result ?? null);
          tx.onerror = tx.onabort = () => resolve(null);
        } catch {
          resolve(null);
        }
      })
  );

export const meshCache = {
  get: (key) => run('readonly', (store) => store.get(`${version}|${key}`)).catch(() => null),
  put(key, data) {
    const { id, ...mesh } = data;
    void id;
    return run('readwrite', (store) => {
      // Drop meshes built by older code before storing the new one.
      const keys = store.getAllKeys();
      keys.onsuccess = () => keys.result.filter((k) => !String(k).startsWith(`${version}|`)).forEach((k) => store.delete(k));
      return store.put(mesh, `${version}|${key}`);
    }).catch(() => null);
  },
};
