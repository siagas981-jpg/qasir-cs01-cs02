import { runCheckout } from "@/lib/checkout";

const KEY = "qasir.offlineQueue.v1";
export const QUEUE_EVENT = "qasir-queue";
export const OFFLINE_QUEUE_EVENT = QUEUE_EVENT;
export const QUEUE_EVENTS = { UPDATED: QUEUE_EVENT, ADD: 'add', REMOVE: 'remove', RETRY: 'retry' };
export const DB_NAME = 'qasir_offline_db';
export const STORE_NAME = 'offline_queue';

// STORAGE ANTI PUTIH - JANGAN PERNAH HAPUS! - DITAMBAH ANTI FILTER ERROR
const _memory = { queue: [] };

function ensureArray(data) {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (typeof data === 'object') {
    // Kalau object, bungkus jadi array biar .filter gak error!
    if (data.client_ref) return [data];
    if (Object.keys(data).length > 0) return Object.values(data).filter(v => v && typeof v === 'object');
    return [];
  }
  return [];
}

export const getQueue = () => {
  try { 
    const raw = localStorage.getItem(KEY);
    if (!raw) return _memory.queue || [];
    const parsed = JSON.parse(raw);
    // FIX UTAMA e.filter ERROR: PASTIKAN SELALU ARRAY!
    const safeArray = ensureArray(parsed);
    _memory.queue = safeArray;
    return safeArray; 
  } catch (e) {
    console.warn("getQueue skip error, pakai memory:", e?.name);
    // JANGAN HAPUS! PAKAI MEMORY AJA BIAR GAK PUTIH & TRANSAKSI GAK HILANG!
    return ensureArray(_memory.queue);
  }
};

const save = (q) => {
  try {
    const safeQ = ensureArray(q);
    _memory.queue = safeQ;
    localStorage.setItem(KEY, JSON.stringify(safeQ));
    window.dispatchEvent(new Event(QUEUE_EVENT));
  } catch (e) {
    console.warn("save queue skip, simpan memory:", e?.name);
    _memory.queue = ensureArray(q);
    try { window.dispatchEvent(new Event(QUEUE_EVENT)); } catch {}
  }
};

export const enqueue = (entry) => {
  try {
    if (!entry || !entry.client_ref) return;
    const current = ensureArray(getQueue());
    // FIX: pakai ensureArray sebelum filter!
    const filtered = current.filter((e) => e && e.client_ref !== entry.client_ref);
    save([...filtered, { ...entry, status: "pending", error: null }]);
  } catch (e) { console.warn("enqueue skip:", e?.name); }
};

export const removeFromQueue = (ref) => {
  try {
    if (!ref) return;
    const current = ensureArray(getQueue());
    save(current.filter((e) => e && e.client_ref !== ref));
  } catch (e) { console.warn("remove skip:", e?.name); }
};

const patch = (ref, fields) => {
  try {
    if (!ref) return;
    const current = ensureArray(getQueue());
    save(current.map((e) => (e && e.client_ref === ref ? { ...e, ...fields } : e)));
  } catch (e) { console.warn("patch skip:", e?.name); }
};

let flushing = false;

export async function flushQueue(userId) {
  if (flushing || !navigator.onLine || !userId) return { synced: 0, failed: 0 };
  flushing = true;
  let synced = 0;
  let failed = 0;
  try {
    const allQueue = ensureArray(getQueue());
    const queue = allQueue.filter((x) => x && x.user_id === userId && x.status === "pending");
    for (const e of queue) {
      try {
        const res = await runCheckout(e);
        if (res.ok) { removeFromQueue(e.client_ref); synced++; }
        else if (res.network) break;
        else { patch(e.client_ref, { status: "failed", error: res.message }); failed++; }
      } catch (err) {
        console.warn("runCheckout error skip:", err?.name);
        patch(err?.client_ref || e.client_ref, { status: "failed", error: "DB error, skip" });
        failed++;
        continue;
      }
    }
  } catch (e) {
    console.warn("flushQueue global skip:", e?.name);
  } finally {
    flushing = false;
  }
  return { synced, failed };
}

export const retryEntry = (ref) => {
  try {
    patch(ref, { status: "pending", error: null });
  } catch (e) { console.warn("retry skip:", e?.name); }
};

// TAMBAHAN EXPORT BIAR BUILD GAK FAIL - KOMPATIBEL SAMA VERSI BARU
export const addToQueue = enqueue;
export const enqueueTransaction = enqueue;
export const enqueueOffline = enqueue;
export const removeEntry = removeFromQueue;
export const deleteFromQueue = removeFromQueue;
export const dequeue = removeFromQueue;
export const clearQueue = () => save([]);
export const getOfflineQueue = getQueue;
export const getAllQueue = getQueue;
export const OFFLINE_EVENT = QUEUE_EVENT;
export const SYNC_EVENT = 'qasir:sync';

export default {
  getQueue,
  enqueue,
  addToQueue,
  removeFromQueue,
  removeEntry,
  clearQueue,
  flushQueue,
  retryEntry,
  QUEUE_EVENT
};
