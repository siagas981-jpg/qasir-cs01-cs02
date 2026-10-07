import { runCheckout } from "@/lib/checkout";

const KEY = "qasir.offlineQueue.v1";
export const QUEUE_EVENT = "qasir-queue";

export const getQueue = () => {
  try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; }
};

const save = (q) => {
  localStorage.setItem(KEY, JSON.stringify(q));
  window.dispatchEvent(new Event(QUEUE_EVENT));
};

export const enqueue = (entry) =>
  save([...getQueue().filter((e) => e.client_ref !== entry.client_ref), { ...entry, status: "pending", error: null }]);

export const removeFromQueue = (ref) => save(getQueue().filter((e) => e.client_ref !== ref));

const patch = (ref, fields) => save(getQueue().map((e) => (e.client_ref === ref ? { ...e, ...fields } : e)));

let flushing = false;

// Idempotent: each entry carries client_ref, so the RPC returns the original sale on a retry.
export async function flushQueue(userId) {
  if (flushing || !navigator.onLine || !userId) return { synced: 0, failed: 0 };
  flushing = true;
  let synced = 0;
  let failed = 0;
  try {
    for (const e of getQueue().filter((x) => x.user_id === userId && x.status === "pending")) {
      const res = await runCheckout(e);
      if (res.ok) { removeFromQueue(e.client_ref); synced++; }
      else if (res.network) break;
      else { patch(e.client_ref, { status: "failed", error: res.message }); failed++; }
    }
  } finally {
    flushing = false;
  }
  return { synced, failed };
}

export const retryEntry = (ref) => patch(ref, { status: "pending", error: null });
