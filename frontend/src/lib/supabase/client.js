import { createClient } from "@supabase/supabase-js";

const url = process.env.REACT_APP_SUPABASE_URL;
const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!url ||!anonKey) {
  console.error("FATAL: Supabase env missing!", {
    hasUrl:!!url,
    hasKey:!!anonKey,
    allEnv: Object.keys(process.env).filter(k => k.includes("SUPABASE"))
  });
}

// STORAGE ANTI PUTIH - kalau localStorage error, jangan crash, pakai memory aja
const safeStorage = {
  _memory: {},
  getItem(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn("safeStorage getItem error:", e?.name, key);
      if (e?.name === "NotFoundError") {
        try { localStorage.clear(); } catch {}
        try { indexedDB.deleteDatabase("qasir_offline_db"); } catch {}
      }
      return this._memory[key] || null;
    }
  },
  setItem(key, value) {
    try {
      localStorage.setItem(key, value);
      this._memory[key] = value;
    } catch (e) {
      console.warn("safeStorage setItem error:", e?.name, key);
      // jangan crash, simpen di memory aja
      this._memory[key] = value;
      if (e?.name === "NotFoundError") {
        try { localStorage.clear(); } catch {}
      }
    }
  },
  removeItem(key) {
    try {
      localStorage.removeItem(key);
      delete this._memory[key];
    } catch (e) {
      console.warn("safeStorage removeItem error:", e?.name);
      delete this._memory[key];
    }
  }
};

// Hapus DB rusak saat load pertama kali (biar HP lain auto sembuh)
try {
  // ini yang bikin putih di HP lain owy
  if (typeof indexedDB!== "undefined") {
    const badDbs = ["qasir_offline_db", "keyval-store", "localforage"];
    badDbs.forEach(dbName => {
      try { indexedDB.deleteDatabase(dbName); } catch {}
    });
  }
} catch {}

export const supabase = createClient(
  url || "https://placeholder.supabase.co",
  anonKey || "placeholder-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: safeStorage, // PAKAI STORAGE ANTI PUTIH!
      flowType: 'pkce'
    },
  },
);

export async function healthCheck() {
  if (!url ||!anonKey) return false;
  try {
    const { error } = await supabase.from("outlets").select("id", { head: true, count: "exact" });
    if (error) {
      console.error("[supabase] health check FAILED:", error.message);
      return false;
    }
    console.info("[supabase] health check OK");
    return true;
  } catch (e) {
    console.warn("[supabase] health check error (anggap offline):", e?.name, e?.message);
    // JANGAN PERNAH THROW NotFoundError! ANGGAP OFFLINE AJA BIAR GAK PUTIH!
    return false;
  }
}
