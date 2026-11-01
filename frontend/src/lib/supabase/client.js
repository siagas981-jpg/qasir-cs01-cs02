import { createClient } from "@supabase/supabase-js";

// BERSIHIN URL BIAR GAK KEPOTONG /rest/v1/ & GAK ADA SPASI OWY!
const rawUrl = 
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.REACT_APP_SUPABASE_URL ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.REACT_APP_SUPABASE_URL ||
  "https://fqmhxedhluaekg1m1gnt.supabase.co";

const rawKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.REACT_APP_SUPABASE_ANON_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.REACT_APP_SUPABASE_ANON_KEY ||
  "";

const cleanUrl = rawUrl.toString().replace(/\s/g, "").replace(/\/rest\/v1\/?/g, "").replace(/\/+$/, "").trim();
const cleanKey = rawKey.toString().replace(/\s/g, "").trim();

console.log("[CLIENT V12] URL:", cleanUrl);

export const supabase = createClient(cleanUrl, cleanKey);

// INI YANG BIKIN FAILED TADI OWY! HARUS ADA INI!
export const healthCheck = async () => {
  try {
    const { data, error } = await supabase.from('products').select('id').limit(1);
    if (error) throw error;
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: e.message };
  }
};

export default supabase;
