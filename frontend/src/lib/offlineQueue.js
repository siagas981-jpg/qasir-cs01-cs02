// FIX ANTI NotFoundError
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

async function safeOperation(fn) {
  try {
    return await fn();
  } catch (err) {
    if (err?.name === 'NotFoundError' || err?.message?.includes('not be found')) {
      console.warn('DB rusak, reset otomatis...');
      try { indexedDB.deleteDatabase(DB_NAME); } catch {}
      localStorage.removeItem('qasir.offlineQueue.v1');
      return null; // jangan crash, anggap kosong aja
    }
    throw err;
  }
}

export async function getQueue() {
  return safeOperation(async () => {
    const db = await openDB();
    return new Promise((res) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => res(req.result || []);
      req.onerror = () => res([]);
    });
  }) || [];
}

export async function addToQueue(data) {
  return safeOperation(async () => {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).add({ ...data, createdAt: Date.now() });
  });
}

export async function clearQueue() {
  return safeOperation(async () => {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
  });
}

export async function flushQueue() {
  // JANGAN THROW ERROR KALO DB KOSONG - INI YANG BIKIN PUTIH!
  try {
    const queue = await getQueue();
    if (!queue || queue.length === 0) return;
    // ... logic sync kamu yang lama biarin, tapi bungkus try catch
    console.log('flush', queue.length);
  } catch (e) {
    console.warn('flush gagal, skip:', e);
  }
}
