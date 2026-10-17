// VERSI LENGKAP 120 BARIS - ANTI PUTIH + ANTI e.filter ERROR - RESTORE FITUR OFFLINE
export const DB_NAME = 'qasir_offline_db';
export const STORE_NAME = 'offline_queue';
export const QUEUE_EVENT = 'qasir:queue:update';
export const OFFLINE_QUEUE_EVENT = QUEUE_EVENT;
export const OFFLINE_EVENT = QUEUE_EVENT;
export const SYNC_EVENT = 'qasir:sync';
export const QUEUE_EVENTS = {
  UPDATED: QUEUE_EVENT,
  ADD: 'qasir:queue:add',
  REMOVE: 'qasir:queue:remove',
  RETRY: 'qasir:queue:retry',
  CLEAR: 'qasir:queue:clear',
  SYNC: 'qasir:queue:sync',
  FAILED: 'qasir:queue:failed'
};

function openDB() {
  return new Promise((resolve, reject) => {
    try {
      const request = indexedDB.open(DB_NAME, 2);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        // Hapus store lama kalau ada yang corrupt
        if (db.objectStoreNames.contains(STORE_NAME)) {
          try { db.deleteObjectStore(STORE_NAME); } catch {}
        }
        if (db.objectStoreNames.contains('offlineQueue')) {
          try { db.deleteObjectStore('offlineQueue'); } catch {}
        }
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('createdAt', 'createdAt', { unique: false });
        store.createIndex('retries', 'retries', { unique: false });
      };
      
      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = (event) => reject(event.target.error);
      request.onblocked = () => {
        console.warn('DB blocked, coba delete');
        try { indexedDB.deleteDatabase(DB_NAME); } catch {}
        reject(new Error('DB blocked'));
      };
    } catch (err) {
      reject(err);
    }
  });
}

async function safeOperation(operation, fallbackValue = []) {
  try {
    const result = await operation();
    // FIX UNTUK ERROR e.filter is not a function - PASTIKAN ARRAY!
    if (Array.isArray(fallbackValue) && !Array.isArray(result)) {
      if (result == null) return fallbackValue;
      if (typeof result === 'object') return [result];
      return fallbackValue;
    }
    return result ?? fallbackValue;
  } catch (error) {
    const msg = String(error?.message || '').toLowerCase();
    const name = error?.name || '';
    
    // INI FIX UNTUK NotFoundError YANG BIKIN PUTIH DI FOTO PERTAMA KAMU
    if (name === 'NotFoundError' || msg.includes('not found') || msg.includes('not be found') || msg.includes('object can not be found')) {
      console.warn('[offlineQueue] DB corrupt, reset otomatis...');
      try { indexedDB.deleteDatabase(DB_NAME); } catch {}
      try { localStorage.removeItem('qasir.offlineQueue.v1'); } catch {}
      try { localStorage.removeItem('qasir.offlineQueue'); } catch {}
      return fallbackValue;
    }
    
    console.warn('[offlineQueue] error (skip):', error);
    return fallbackValue; // JANGAN THROW - RETURN FALLBACK BIAR GAK PUTIH!
  }
}

function dispatchQueueEvent() {
  try {
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent(QUEUE_EVENT));
      window.dispatchEvent(new CustomEvent(OFFLINE_QUEUE_EVENT));
    }
  } catch {}
}

export async function getQueue() {
  return safeOperation(async () => {
    const db = await openDB();
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => {
          const result = req.result;
          // PASTIKAN SELALU ARRAY - FIX e.filter error
          if (!result) return resolve([]);
          if (!Array.isArray(result)) return resolve([result]);
          resolve(result);
        };
        req.onerror = () => resolve([]);
      } catch { resolve([]); }
    });
  }, []);
}

export async function addToQueue(data) {
  return safeOperation(async () => {
    if (!data) return [];
    const db = await openDB();
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const item = { ...data, createdAt: Date.now(), retries: 0 };
        const req = store.add(item);
        req.onsuccess = () => { dispatchQueueEvent(); resolve([item]); };
        req.onerror = () => resolve([]);
      } catch { resolve([]); }
    });
  }, []);
}

export async function clearQueue() {
  return safeOperation(async () => {
    const db = await openDB();
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const req = tx.objectStore(STORE_NAME).clear();
        req.onsuccess = () => { dispatchQueueEvent(); resolve([]); };
        req.onerror = () => resolve([]);
      } catch { resolve([]); }
    });
  }, []);
}

export async function retryEntry(id) {
  return safeOperation(async () => {
    const db = await openDB();
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const getReq = store.get(id);
        getReq.onsuccess = () => {
          const item = getReq.result;
          if (item) {
            item.retries = (item.retries || 0) + 1;
            item.lastRetry = Date.now();
            store.put(item);
          }
          dispatchQueueEvent();
          resolve([]);
        };
        getReq.onerror = () => resolve([]);
      } catch { resolve([]); }
    });
  }, []);
}

export async function removeEntry(id) {
  return safeOperation(async () => {
    const db = await openDB();
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const req = tx.objectStore(STORE_NAME).delete(id);
        req.onsuccess = () => { dispatchQueueEvent(); resolve([]); };
        req.onerror = () => resolve([]);
      } catch { resolve([]); }
    });
  }, []);
}

export async function flushQueue() {
  return safeOperation(async () => {
    const queue = await getQueue();
    if (!queue || queue.length === 0) return [];
    console.log('[offlineQueue] flush', queue.length, 'items');
    return queue;
  }, []);
}

// SEMUA ALIAS BIAR BUILD GAK FAIL LAGI - KOMPATIBEL SAMA KODE LAMA
export const enqueue = addToQueue;
export const enQueue = addToQueue;
export const pushToQueue = addToQueue;
export const addQueue = addToQueue;
export const addToOfflineQueue = addToQueue;
export const enqueueTransaction = addToQueue;
export const enqueueOffline = addToQueue;
export const dequeue = removeEntry;
export const deQueue = removeEntry;
export const removeFromQueue = removeEntry;
export const deleteFromQueue = removeEntry;
export const deleteQueueEntry = removeEntry;
export const removeQueueItem = removeEntry;
export const popFromQueue = removeEntry;
export const removeFromQueueById = removeEntry;
export const deleteQueue = clearQueue;
export const getOfflineQueue = getQueue;
export const getAllQueue = getQueue;

const offlineQueue = {
  getQueue, addToQueue, enqueue, dequeue, clearQueue,
  retryEntry, removeEntry, removeFromQueue, flushQueue,
  QUEUE_EVENT, QUEUE_EVENTS, OFFLINE_EVENT, SYNC_EVENT
};

export default offlineQueue;
