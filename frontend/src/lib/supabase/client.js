import { createClient } from "@supabase/supabase-js";

const rawUrl = import.meta.env.VITE_SUPABASE_URL || "https://fqmhxedhluaekg1m1gnt.supabase.co";
const rawKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_ru5Gx...GANTI KEY ASLI FULL DISINI";

// INI OBAT ANTI KEPOTONG OWY!
const cleanUrl = rawUrl.replace(/\s/g,"").replace(/\/rest\/v1\/?/g,"").replace(/\/+$/,"").trim();
const cleanKey = rawKey.replace(/\s/g,"").trim();

export const supabase = createClient(cleanUrl, cleanKey);

export const healthCheck = async () => {
  const { error } = await supabase.from('profiles').select('id').limit(1);
  return { ok: !error };
};
export default supabase;
