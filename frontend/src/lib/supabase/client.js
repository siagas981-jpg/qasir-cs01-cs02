import { createClient } from "@supabase/supabase-js";

// Browser client — publishable/anon key only. RLS is the security boundary.
export const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY,
  { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } },
);

export async function healthCheck() {
  const { error } = await supabase.from("outlets").select("id", { head: true, count: "exact" });
  if (error) console.error("[supabase] health check FAILED:", error.message);
  else console.info("[supabase] health check OK — outlets reachable");
  return !error;
}
