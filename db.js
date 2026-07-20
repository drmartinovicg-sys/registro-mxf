/* ============================================================
   Almacenamiento local en el dispositivo (IndexedDB)
   Reemplaza window.storage de Claude. Sin límite práctico de
   tamaño y funciona sin conexión.
   ============================================================ */
window.DB = (function () {
  const NAME = "registro-mxf";
  const STORE = "kv";
  let _db = null;

  function open() {
    return new Promise((res, rej) => {
      const r = indexedDB.open(NAME, 1);
      r.onupgradeneeded = () => {
        if (!r.result.objectStoreNames.contains(STORE)) r.result.createObjectStore(STORE);
      };
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  }

  async function db() {
    if (!_db) _db = await open();
    return _db;
  }

  async function get(key) {
    try {
      const d = await db();
      return await new Promise((res) => {
        const q = d.transaction(STORE, "readonly").objectStore(STORE).get(key);
        q.onsuccess = () => res(q.result === undefined ? null : q.result);
        q.onerror = () => res(null);
      });
    } catch { return null; }
  }

  async function set(key, val) {
    try {
      const d = await db();
      return await new Promise((res) => {
        const t = d.transaction(STORE, "readwrite");
        t.objectStore(STORE).put(val, key);
        t.oncomplete = () => res(true);
        t.onerror = () => res(false);
        t.onabort = () => res(false);
      });
    } catch (e) { console.error("DB.set", e); return false; }
  }

  async function del(key) {
    try {
      const d = await db();
      await new Promise((res) => {
        const t = d.transaction(STORE, "readwrite");
        t.objectStore(STORE).delete(key);
        t.oncomplete = () => res();
        t.onerror = () => res();
      });
    } catch { /* ok */ }
  }

  return { get, set, del };
})();
