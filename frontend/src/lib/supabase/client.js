import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://fqmhxedhluaekg1m1gnt.supabase.co";
const SUPABASE_ANON_KEY = "ISI_DISINI_KEY_ASLI_FULL_YANG_DARI_SUPABASE_API_KEYS";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const healthCheck = async () => {
  try {
    const result = await supabase.from("profiles").select("id").limit(1);
    return { ok: !result.error };
  } catch (e) {
    return { ok: false, error: e.message };
  }
};

export default supabase;
