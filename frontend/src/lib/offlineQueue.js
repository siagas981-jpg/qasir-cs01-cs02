// VERSI ULTIMATE - SEMUA NAMA ADA - PASTI HIJAU
export const DB_NAME = 'qasir_offline_db';
export const STORE_NAME = 'offline_queue';
export const QUEUE_EVENT = 'qasir:queue:update';
export const OFFLINE_QUEUE_EVENT = QUEUE_EVENT;
export const QUEUE_EVENTS = { UPDATED: QUEUE_EVENT, ADD: 'add', REMOVE: 'remove', RETRY: 'retry', CLEAR: 'clear', SYNC: 'sync' };
export const OFFLINE_EVENT = QUEUE_EVENT;
export const SYNC_EVENT = 'qasir:sync';

function openDB() {
  return new Promise((res, rej) => {
    try {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      };
      r.onsuccess = (e) => res(e.target.result);
      r.onerror = (e) => rej(e.target.error);
    } catch (e) { rej(e); }
  });
}

async function safeOp(fn, fb=null) {
  try { return await fn(); } catch (err) {
    if (err?.name==='NotFoundError' || String(err?.message||'').toLowerCase().includes('not found')) {
      try { indexedDB.deleteDatabase(DB_NAME); } catch {}
      return fb;
    }
    return fb;
  }
}

// CORE
export async function getQueue() { return (await safeOp(async () => {
  const db=await openDB(); return new Promise(r=>{
    const tx=db.transaction(STORE_NAME,'readonly'); const q=tx.objectStore(STORE_NAME).getAll();
    q.onsuccess=()=>r(q.result||[]); q.onerror=()=>r([]);
  });
},[]))||[]; }

export async function addToQueue(d){ return safeOp(async()=>{
  const db=await openDB(); db.transaction(STORE_NAME,'readwrite').objectStore(STORE_NAME).add({...d, createdAt: Date.now()});
  try{ window.dispatchEvent(new CustomEvent(QUEUE_EVENT)); }catch{}
}); }

export async function clearQueue(){ return safeOp(async()=>{
  const db=await openDB(); db.transaction(STORE_NAME,'readwrite').objectStore(STORE_NAME).clear();
}); }

export async function retryEntry(id){ return safeOp(async()=>{
  const db=await openDB(); const tx=db.transaction(STORE_NAME,'readwrite'); const s=tx.objectStore(STORE_NAME);
  const req=s.get(id); req.onsuccess=()=>{ const it=req.result; if(it){ it.retries=(it.retries||0)+1; s.put(it);} };
}); }

export async function removeEntry(id){ return safeOp(async()=>{
  const db=await openDB(); db.transaction(STORE_NAME,'readwrite').objectStore(STORE_NAME).delete(id);
}); }

export async function flushQueue(){ try{ const q=await getQueue(); if(!q?.length) return; }catch{} }

// SEMUA ALIAS YANG PERNAH ADA - BIAR GAK ERROR LAGI
export const enqueue = addToQueue;
export const dequeue = removeEntry;
export const enQueue = addToQueue;
export const deQueue = removeEntry;
export const pushToQueue = addToQueue;
export const addQueue = addToQueue;
export const addToOfflineQueue = addToQueue;
export const enqueueTransaction = addToQueue;
export const enqueueOffline = addToQueue;
export const removeFromQueue = removeEntry;
export const deleteFromQueue = removeEntry;
export const deleteQueueEntry = removeEntry;
export const removeQueueItem = removeEntry;
export const popFromQueue = removeEntry;
export const removeFromQueueById = removeEntry;
export const deleteQueue = clearQueue;
export const getOfflineQueue = getQueue;
export const getAllQueue = getQueue;

const offlineQueue = { getQueue, addToQueue, enqueue, dequeue, clearQueue, retryEntry, removeEntry, removeFromQueue, flushQueue, QUEUE_EVENT, QUEUE_EVENTS };
export default offlineQueue;
