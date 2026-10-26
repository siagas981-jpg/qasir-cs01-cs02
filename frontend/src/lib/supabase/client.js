import { createClient } from "@supabase/supabase-js";

const getEnv = (viteName, nextName, reactName) => {
  if (typeof import.meta !== "undefined" && import.meta.env) {
    if (import.meta.env[viteName]) return import.meta.env[viteName];
  }
  if (typeof process !== "undefined" && process.env) {
    if (process.env[nextName]) return process.env[nextName];
    if (process.env[reactName]) return process.env[reactName];
  }
  return null;
};

const supabaseUrl = 
  getEnv("VITE_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "REACT_APP_SUPABASE_URL") ||
  getEnv("VITE_SU_ASE_URL", "NEXT_PU_ASE_URL", "REACT_A_ASE_URL");

const supabaseAnonKey = 
  getEnv("VITE_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "REACT_APP_SUPABASE_ANON_KEY") ||
  getEnv("VITE_SU_NON_KEY", "NEXT_PU_NON_KEY", "REACT_A_NON_KEY") ||
  getEnv("VITE_SUPABASE_ANON_KEY", "NEXT_PU_BLE_KEY", "REACT_APP_FORCE");

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// === INI YANG HILANG BIKIN FAILED TADI OWY! ===
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
