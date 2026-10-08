import { useEffect, useState } from "react";
import { healthCheck } from "@/lib/supabase/client";
import { getQueue, QUEUE_EVENT } from "@/lib/offlineQueue";

export function useConnection() {
  const [online, setOnline] = useState(navigator.onLine);
  const [healthy, setHealthy] = useState(null);
  const [queue, setQueue] = useState(getQueue());

  useEffect(() => {
    healthCheck().then(setHealthy);
    const on = () => { setOnline(true); healthCheck().then(setHealthy); };
    const off = () => setOnline(false);
    const q = () => setQueue(getQueue());
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    window.addEventListener(QUEUE_EVENT, q);
    window.addEventListener("storage", q);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      window.removeEventListener(QUEUE_EVENT, q);
      window.removeEventListener("storage", q);
    };
  }, []);

  return { online, healthy, queue };
}
