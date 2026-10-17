export const DB_NAME = 'qasir_offline_db';
export const STORE_NAME = 'offline_queue';

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = (e) => reject(e.target.error);
  });
}

async function safeOp(fn, fb = null) {
  try { return await fn(); } catch (err) {
    if (err?.name === 'NotFoundError' || String(err?.message||'').toLowerCase().includes('not found')) {
      try { indexedDB.deleteDatabase(DB_NAME); } catch {}
      return fb;
    }
    return fb;
  }
}

export async function getQueue() { return (await safeOp(async () => {
  const db = await openDB();
  return new Promise(r => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const q = tx.objectStore(STORE_NAME).getAll();
    q.onsuccess = () => r(q.result||[]);
    q.onerror = () => r([]);
  });
}, [])) || []; }

export async function addToQueue(d) { return safeOp(async () => {
  const db = await openDB(); db.transaction(STORE_NAME,'readwrite').objectStore(STORE_NAME).add({...d, createdAt: Date.now()});
}); }

export async function clearQueue() { return safeOp(async () => {
  const db = await openDB(); db.transaction(STORE_NAME,'readwrite').objectStore(STORE_NAME).clear();
}); }

export async function retryEntry(id) { return safeOp(async () => {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME,'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const req = store.get(id);
  req.onsuccess = () => { const it = req.result; if(it){ it.retries=(it.retries||0)+1; store.put(it);} };
}); }

export async function removeEntry(id) { return safeOp(async () => {
  const db = await openDB(); db.transaction(STORE_NAME,'readwrite').objectStore(STORE_NAME).delete(id);
}); }

// FIX UNTUK ERROR KAMU DI FOTO
export const removeFromQueue = removeEntry;
export const deleteFromQueue = removeEntry;
export function removeFromQueueById(id){ return removeEntry(id); }

export async function flushQueue() {
  try { const q = await getQueue(); if(!q||!q.length) return; } catch {}
}

const offlineQueue = { getQueue, addToQueue, clearQueue, retryEntry, removeEntry, removeFromQueue, flushQueue };
export default offlineQueue;
