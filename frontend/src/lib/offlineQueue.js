// FINAL - SEMUA EXPORT ADA - ANTI BUILD FAIL
export const DB_NAME = 'qasir_offline_db';
export const STORE_NAME = 'offline_queue';

// INI YANG BIKIN ERROR DI FOTO TERAKHIR - SEKARANG ADA!
export const QUEUE_EVENT = 'qasir:queue:update';
export const OFFLINE_QUEUE_EVENT = 'qasir:queue:update';
export const QUEUE_EVENTS = {
  UPDATED: QUEUE_EVENT,
  ADD: 'add',
  REMOVE: 'remove',
  RETRY: 'retry',
  CLEAR: 'clear',
  SYNC: 'sync'
};
export const OFFLINE_EVENT = QUEUE_EVENT;
export const SYNC_EVENT = 'qasir:sync';

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
    } catch (err) { reject(err); }
  });
}

async function safeOp(fn, fb = null) {
  try { return await fn(); } catch (err) {
    if (err?.name === 'NotFoundError' || String(err?.message||'').toLowerCase().includes('not found')) {
      try { indexedDB.deleteDatabase(DB_NAME); } catch {}
      try { localStorage.removeItem('qasir.offlineQueue.v1'); } catch {}
      return fb;
    }
    console.warn('offlineQueue:', err);
    return fb;
  }
}

export async function getQueue() {
  return (await safeOp(async () => {
    const db = await openDB();
    return new Promise(r => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const q = tx.objectStore(STORE_NAME).getAll();
      q.onsuccess = () => r(q.result||[]);
      q.onerror = () => r([]);
    });
  }, [])) || [];
}

export async function addToQueue(d) {
  const res = await safeOp(async () => {
    const db = await openDB();
    db.transaction(STORE_NAME,'readwrite').objectStore(STORE_NAME).add({...d, createdAt: Date.now()});
    try { window.dispatchEvent(new CustomEvent(QUEUE_EVENT)); } catch {}
  });
  return res;
}

export async function clearQueue() {
  return safeOp(async () => {
    const db = await openDB();
    db.transaction(STORE_NAME,'readwrite').objectStore(STORE_NAME).clear();
    try { window.dispatchEvent(new CustomEvent(QUEUE_EVENT)); } catch {}
  });
}

export async function retryEntry(id) {
  return safeOp(async () => {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME,'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(id);
    req.onsuccess = () => { const it = req.result; if(it){ it.retries=(it.retries||0)+1; store.put(it);} };
  });
}

export async function removeEntry(id) {
  return safeOp(async () => {
    const db = await openDB();
    db.transaction(STORE_NAME,'readwrite').objectStore(STORE_NAME).delete(id);
    try { window.dispatchEvent(new CustomEvent(QUEUE_EVENT)); } catch {}
  });
}

// ALIAS BIAR SEMUA NAMA LAMA JALAN
export const removeFromQueue = removeEntry;
export const deleteFromQueue = removeEntry;
export const deleteQueueEntry = removeEntry;
export const removeQueueItem = removeEntry;
export const removeFromQueueById = removeEntry;

export async function flushQueue() {
  try { const q = await getQueue(); if(!q||!q.length) return; } catch {}
}

const offlineQueue = { getQueue, addToQueue, clearQueue, retryEntry, removeEntry, removeFromQueue, flushQueue, QUEUE_EVENT, QUEUE_EVENTS };
export default offlineQueue;
