import * as SupaLib from "@supabase/supabase-js";

const ORIG_CREATE = SupaLib.createClient;

function getSafeEnv() {
  const url = (process.env.REACT_APP_SUPABASE_URL || "").toString().trim().replace(/^["']|["']$/g, "");
  const key = (process.env.REACT_APP_SUPABASE_ANON_KEY || "").toString().trim().replace(/^["']|["']$/g, "");
  return { url, key };
}

SupaLib.createClient = function (url, key, opts) {
  const env = getSafeEnv();
  const safeUrl = (url && url.toString().trim()) || env.url || "https://placeholder.supabase.co";
  const safeKey = (key && key.toString().trim()) || env.key || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDA1MTkyMDAsImV4cCI6MTk1NjA5NTIwMH0.placeholder";
  try {
    return ORIG_CREATE(safeUrl, safeKey, opts);
  } catch (e) {
    console.warn("Blocked crash from empty client");
    return ORIG_CREATE("https://placeholder.supabase.co", safeKey, opts);
  }
};
