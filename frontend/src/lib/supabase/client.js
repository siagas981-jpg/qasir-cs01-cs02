import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://fqmhxedhluaekg1m1gnt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_g6w6v8kJ7l9m0n1p2q3r4s5t6u7v8w9x0y1z2a3b4c5d6e7f8g9h0i1j2k3"; // GANTI DENGAN YANG ASLI DARI Settings -> API Keys -> Publishable Key!

// Validasi biar gak salah lagi
if (!SUPABASE_URL.startsWith("https://")) {
  throw new Error("URL HARUS https://fqmhxedhluaekg1m1gnt.supabase.co");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export const healthCheck = async () => {
  const { error } = await supabase.from("profiles").select("id").limit(1);
  return { ok: !error };
};
export default supabase;{ createClient } from "@supabase/supabase-js";

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
