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

// Jangan bikin client kalau kosong, biar errornya jelas, bukan muter
export const supabase = createClient(
  url || "https://placeholder.supabase.co",
  anonKey || "placeholder-key",
  {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  },
);

export async function healthCheck() {
  if (!url ||!anonKey) return false;
  const { error } = await supabase.from("outlets").select("id", { head: true, count: "exact" });
  if (error) console.error("[supabase] health check FAILED:", error.message);
  else console.info("[supabase] health check OK");
  return!error;
}
