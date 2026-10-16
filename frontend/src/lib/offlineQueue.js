import { runCheckout } from "@/lib/checkout";

const KEY = "qasir.offlineQueue.v1";
export const QUEUE_EVENT = "qasir-queue";

export const getQueue = () => {
  try { 
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw); 
  } catch (e) {
    // KALAU ERROR NotFoundError / SecurityError JANGAN BIKIN PUTIH
    console.warn("getQueue error, reset:", e);
    try { localStorage.removeItem(KEY); } catch {}
    return []; 
  }
};

const save = (q) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(q));
    window.dispatchEvent(new Event(QUEUE_EVENT));
  } catch (e) {
    console.warn("save queue error:", e);
    // kalau storage penuh / di-block, jangan crash
  }
};

export const enqueue = (entry) => {
  try {
    save([...getQueue().filter((e) => e.client_ref !== entry.client_ref), { ...entry, status: "pending", error: null }]);
  } catch {}
};

export const removeFromQueue = (ref) => {
  try {
    save(getQueue().filter((e) => e.client_ref !== ref));
  } catch {}
};

const patch = (ref, fields) => {
  try {
    save(getQueue().map((e) => (e.client_ref === ref ? { ...e, ...fields } : e)));
  } catch {}
};

let flushing = false;

export async function flushQueue(userId) {
  if (flushing || !navigator.onLine || !userId) return { synced: 0, failed: 0 };
  flushing = true;
  let synced = 0;
  let failed = 0;
  try {
    const queue = getQueue().filter((x) => x.user_id === userId && x.status === "pending");
    for (const e of queue) {
      try {
        const res = await runCheckout(e);
        if (res.ok) { removeFromQueue(e.client_ref); synced++; }
        else if (res.network) break;
        else { patch(e.client_ref, { status: "failed", error: res.message }); failed++; }
      } catch (err) {
        console.warn("runCheckout error:", err);
        // jangan biarin 1 transaksi gagal bikin semua putih
        if (err?.name === "NotFoundError") {
          // ini yang bikin putih di HP lain owy, kita skip aja
          patch(e.client_ref, { status: "failed", error: "DB error, skip" });
          failed++;
        }
        continue;
      }
    }
  } catch (e) {
    console.warn("flushQueue global error:", e);
  } finally {
    flushing = false;
  }
  return { synced, failed };
}

export const retryEntry = (ref) => {
  try {
    patch(ref, { status: "pending", error: null });
  } catch {}
};
