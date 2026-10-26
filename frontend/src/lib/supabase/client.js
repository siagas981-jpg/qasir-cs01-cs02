import { createClient } from "@supabase/supabase-js";

// Baca ENV yang benar untuk craco build (REACT_APP) + fallback VITE
const supabaseUrl = 
  process.env.REACT_APP_SUPABASE_URL || 
  process.env.NEXT_PUBLIC_SUPABASE_URL || 
  (typeof import.meta !== "undefined" ? import.meta.env?.VITE_SUPABASE_URL : null);

const supabaseAnonKey = 
  process.env.REACT_APP_SUPABASE_ANON_KEY || 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
  (typeof import.meta !== "undefined" ? import.meta.env?.VITE_SUPABASE_ANON_KEY : null);

// Jangan throw biar gak layar putih, cukup log aja
if (!supabaseUrl || !supabaseAnonKey) {
  console.error("SUPABASE ENV KOSONG!", { 
    url: !!supabaseUrl, 
    key: !!supabaseAnonKey,
    REACT_APP_URL: process.env.REACT_APP_SUPABASE_URL,
    VITE_URL: typeof import.meta !== "undefined" ? import.meta.env?.VITE_SUPABASE_URL : "no import.meta"
  });
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const healthCheck = async () => {
  try {
    const { error } = await supabase.from("outlets").select("id").limit(1);
    return !error;
  } catch {
    return false;
  }
};

export { supabase };
export default supabase;
