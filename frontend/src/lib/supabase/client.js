import { createClient } from "@supabase/supabase-js";

// ID ASLI DARI SCREENSHOT OWY TADI!
const SUPABASE_URL = "https://fqmhxedhluaekg1m1gnt.supabase.co";

// COPY DARI HALAMAN API KEYS -> PUBLISHABLE KEY (klik Copy!)
const SUPABASE_ANON_KEY = "sb_publishable_...PASTE FULL DARI SUPABASE DISINI JANGAN ADA ...!";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const healthCheck = async () => {
  try {
    const { error } = await supabase.from("profiles").select("id").limit(1);
    return { ok: !error };
  } catch (e) {
    return { ok: false, error: e.message };
  }
};

export default supabase;
