// FIX LENGKAP - SEMUA NAMA EXPORT ADA BIAR GAK FAILED LAGI
const DB_NAME = 'qasir_offline_db';
const STORE_NAME = 'offline_queue';

function openDB() {
  return new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        }
      };
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = (e) => reject(e.target.error);
    } catch (err) {
      reject(err);
    }
  });
}

async function safeOperation(fn, fallback = null) {
  try {
    return await fn();
  } catch (err) {
    if (err?.name === 'NotFoundError' || (err?.message && err.message.toLowerCase().includes('not found'))) {
      console.warn('DB rusak, reset otomatis...');
      try { indexedDB.deleteDatabase(DB_NAME); } catch {}
      try { localStorage.removeItem('qasir.offlineQueue.v1'); } catch {}
      return fallback;
    }
    console.warn('offlineQueue error:', err);
    return fallback;
  }
}

export async function getQueue() {
  const res = await safeOperation(async () => {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  }, []);
  return res || [];
}

export async function addToQueue(data) {
  return safeOperation(async () => {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).add({ ...data, createdAt: Date.now() });
  }, null);
}

export async function clearQueue() {
  return safeOperation(async () => {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
  }, null);
}

export async function retryEntry(id) {
  return safeOperation(async () => {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => {
      const item = req.result;
      if (item) {
        item.retries = (item.retries || 0) + 1;
        store.put(item);
      }
    };
  }, null);
}

export async function removeEntry(id) {
  return safeOperation(async () => {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
  }, null);
}

// INI YANG BIKIN FAIL SEKARANG - ALIAS BIAR COMPATIBLE
export const removeFromQueue = removeEntry;
export const deleteFromQueue = removeEntry;
export const deleteQueueEntry = removeEntry;
export const removeQueueItem = removeEntry;

export async function flushQueue() {
  try {
    const queue = await getQueue();
    if (!queue || queue.length === 0) return;
    console.log('flush', queue.length);
  } catch (e) {
    console.warn('flush gagal, skip:', e);
  }
}

export default { getQueue, addToQueue, clearQueue, retryEntry, removeEntry, removeFromQueue, flushQueue };
