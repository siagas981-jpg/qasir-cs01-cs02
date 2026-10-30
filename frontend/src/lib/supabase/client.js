import { createClient } from "@supabase/supabase-js";

const getEnv = (name) => {
  try {
    if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env[name]) {
      return import.meta.env[name];
    }
  } catch {}
  if (typeof process !== "undefined" && process.env) {
    return process.env[name] || process.env[`REACT_APP_${name}`] || process.env[`VITE_${name}`] || process.env[`NEXT_PUBLIC_${name}`];
  }
  return undefined;
};

let supabaseUrl = getEnv("SUPABASE_URL") || getEnv("VITE_SUPABASE_URL") || getEnv("REACT_APP_SUPABASE_URL") || getEnv("NEXT_PUBLIC_SUPABASE_URL") || import.meta.env?.VITE_SUPABASE_URL || "";
let supabaseAnonKey = getEnv("SUPABASE_ANON_KEY") || getEnv("VITE_SUPABASE_ANON_KEY") || getEnv("REACT_APP_SUPABASE_ANON_KEY") || getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") || import.meta.env?.VITE_SUPABASE_ANON_KEY || "";

// Trim biar gak ada spasi / newline yang bikin error
supabaseUrl = (supabaseUrl || "").toString().trim();
supabaseAnonKey = (supabaseAnonKey || "").toString().trim();

console.log("CHECK ENV:", { 
  hasUrl: !!supabaseUrl, 
  hasKey: !!supabaseAnonKey, 
  urlLen: supabaseUrl.length, 
  urlStart: supabaseUrl.substring(0, 35),
  keyLen: supabaseAnonKey.length 
});

// ANTI PUTIH: jangan throw, pakai dummy kalau kosong biar app tetap jalan dan kasih tau error
if (!supabaseUrl || !supabaseAnonKey) {
  console.error("SUPABASE ENV KOSONG! App tetap jalan pakai dummy biar gak putih. Cek Vercel ENV & Root Directory!");
  supabaseUrl = supabaseUrl || "https://placeholder.supabase.co";
  supabaseAnonKey = supabaseAnonKey || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder";
}

let supabase;
try {
  supabase = createClient(supabaseUrl, supabaseAnonKey);
} catch (e) {
  console.error("Gagal createClient, pakai dummy:", e);
  supabase = createClient("https://placeholder.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder");
}

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
