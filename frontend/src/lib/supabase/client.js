import { createClient } from "@supabase/supabase-js";

// CRA MURNI - LANGSUNG BACA process.env
const rawUrl = process.env.REACT_APP_SUPABASE_URL || "";
const rawKey = process.env.REACT_APP_SUPABASE_ANON_KEY || "";

const supabaseUrl = rawUrl.toString().trim().replace(/^["']|["']$/g, "");
const supabaseAnonKey = rawKey.toString().trim().replace(/^["']|["']$/g, "");

console.log("DEBUG FINAL CRA:", {
  rawUrlLength: rawUrl.length,
  urlLength: supabaseUrl.length,
  urlValue: supabaseUrl.substring(0, 40),
  hasKey: !!supabaseAnonKey,
  keyLength: supabaseAnonKey.length,
  allReactEnv: Object.keys(process.env).filter(k => k.includes("SUPABASE"))
});

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("ENV MASIH KOSONG! Vercel belum inject! Pakai placeholder biar gak putih!");
}

const finalUrl = supabaseUrl || "https://placeholder.supabase.co";
const finalKey = supabaseAnonKey || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDA1MTkyMDAsImV4cCI6MTk1NjA5NTIwMH0.placeholder";

export const supabase = createClient(finalUrl, finalKey);

export const healthCheck = async () => {
  try {
    const { error } = await supabase.from("outlets").select("id").limit(1);
    return !error;
  } catch { return false; }
};

export default supabase;
