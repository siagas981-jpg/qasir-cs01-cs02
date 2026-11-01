import { createClient } from "@supabase/supabase-js";

// HARDCODE LANGSUNG OWY, BIAR GAK KOSONG LAGI!
const SUPABASE_URL = "https://fqmhxedhluaekg1m1gnt.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_ru5GxQyP9z8a7b6c5d4e3f2g1h0iJkL... GANTI INI DENGAN KEY FULL ASLI YANG OWY COPY DARI SUPABASE!";

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
