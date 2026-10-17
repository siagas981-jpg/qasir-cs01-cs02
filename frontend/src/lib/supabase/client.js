import { createClient } from "@supabase/supabase-js";

const url = process.env.REACT_APP_SUPABASE_URL;
const anonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  console.error("FATAL: Supabase env missing!", {
    hasUrl: !!url,
    hasKey: !!anonKey,
    allEnv: Object.keys(process.env).filter(k => k.includes("SUPABASE"))
  });
}

const safeStorage = {
  _memory: {},
  getItem(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn("safeStorage getItem skip:", e?.name, key);
      return this._memory[key] || null;
    }
  },
  setItem(key, value) {
    try {
      localStorage.setItem(key, value);
      this._memory[key] = value;
    } catch (e) {
      console.warn("safeStorage setItem skip:", e?.name, key);
      this._memory[key] = value;
    }
  },
  removeItem(key) {
    try {
      localStorage.removeItem(key);
      delete this._memory[key];
    } catch (e) {
      console.warn("safeStorage removeItem skip:", e?.name);
      delete this._memory[key];
    }
  }
};

export const supabase = createClient(
  url || "https://placeholder.supabase.co",
  anonKey || "placeholder-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: safeStorage,
      flowType: 'pkce'
    },
  },
);

export async function healthCheck() {
  if (!url || !anonKey) return false;
  try {
    const { error } = await supabase.from("outlets").select("id", { head: true, count: "exact" });
    if (error) {
      console.error("[supabase] health check FAILED:", error.message);
      return false;
    }
    console.info("[supabase] health check OK");
    return true;
  } catch (e) {
    console.warn("[supabase] health check offline:", e?.name);
    return false;
  }
}
