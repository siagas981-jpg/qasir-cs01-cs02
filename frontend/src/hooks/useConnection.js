import { useEffect, useState } from "react";
import { healthCheck } from "@/lib/supabase/client";
import { getQueue, QUEUE_EVENT } from "@/lib/offlineQueue";

function safeGetQueue() {
  try {
    return getQueue();
  } catch (e) {
    console.warn("safeGetQueue error:", e);
    return [];
  }
}

function safeNavigatorOnLine() {
  try {
    return typeof navigator !== "undefined" ? navigator.onLine : true;
  } catch {
    return true;
  }
}

export function useConnection() {
  const [online, setOnline] = useState(safeNavigatorOnLine());
  const [healthy, setHealthy] = useState(null);
  const [queue, setQueue] = useState(() => safeGetQueue());

  useEffect(() => {
    let mounted = true;
    
    // healthCheck dengan try/catch total biar gak putih
    (async () => {
      try {
        const h = await healthCheck();
        if (mounted) setHealthy(h);
      } catch (e) {
        console.warn("healthCheck error:", e);
        if (mounted) setHealthy(false);
      }
    })();

    const on = () => { 
      try {
        setOnline(true); 
        healthCheck().then((h) => { if(mounted) setHealthy(h); }).catch(()=>{ if(mounted) setHealthy(false); });
      } catch {}
    };
    
    const off = () => { try { setOnline(false); } catch {} };
    
    const q = () => { 
      try { setQueue(safeGetQueue()); } catch {} 
    };

    try {
      window.addEventListener("online", on);
      window.addEventListener("offline", off);
      window.addEventListener(QUEUE_EVENT, q);
      window.addEventListener("storage", q);
    } catch {}

    return () => {
      mounted = false;
      try {
        window.removeEventListener("online", on);
        window.removeEventListener("offline", off);
        window.removeEventListener(QUEUE_EVENT, q);
        window.removeEventListener("storage", q);
      } catch {}
    };
  }, []);

  return { online, healthy, queue };
}
