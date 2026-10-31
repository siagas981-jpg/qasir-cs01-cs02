import { createClient } from '@supabase/supabase-js';

// Fallback biar gak pernah putih
const FALLBACK_URL = 'https://fqmhxedhluaekg1m1gnt.supabase.co';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxbWh4ZWRobHVhZWtnMW0xZ250Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYwOTI4MDAsImV4cCI6MjA1MTY2ODgwMH0.placeholder';

function getSafeUrl() {
  try {
    const envUrl = process.env.REACT_APP_SUPABASE_URL;
    if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 10) {
      return envUrl.trim();
    }
  } catch {}
  console.warn('[CLIENT.JS] ENV URL kosong, pakai FALLBACK');
  return FALLBACK_URL;
}

function getSafeKey() {
  try {
    const envKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
    if (envKey && typeof envKey === 'string' && envKey.trim().length > 20) {
      return envKey.trim();
    }
  } catch {}
  console.warn('[CLIENT.JS] ENV KEY kosong, pakai FALLBACK');
  return FALLBACK_KEY;
}

const supabaseUrl = getSafeUrl();
const supabaseAnonKey = getSafeKey();

console.log('[CLIENT.JS] Final URL length:', supabaseUrl.length, 'Key length:', supabaseAnonKey.length, 'URL:', supabaseUrl);

let supabase;

try {
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
    }
  });
  console.log('[CLIENT.JS] Supabase client created OK');
} catch (e) {
  console.error('[CLIENT.JS] createClient gagal, pakai fallback total:', e.message);
  try {
    supabase = createClient(FALLBACK_URL, FALLBACK_KEY);
  } catch (e2) {
    console.error('[CLIENT.JS] Fallback juga gagal, pakai mock client agar tidak putih');
    // Mock client biar App tetap render, tidak putih
    supabase = {
      auth: {
        getSession: async () => ({ data: { session: null }, error: null }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        signInWithPassword: async () => ({ data: null, error: { message: 'Supabase belum konfigurasi' } }),
        signOut: async () => ({ error: null }),
        signUp: async () => ({ data: null, error: null }),
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({ data: null, error: null }),
            order: () => Promise.resolve({ data: [], error: null }),
            limit: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
            maybeSingle: async () => ({ data: null, error: null }),
          }),
          order: () => Promise.resolve({ data: [], error: null }),
          limit: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
        }),
        insert: () => ({ select: () => ({ single: async () => ({ data: null, error: null }) }) }),
        update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      }),
    };
  }
}

export { supabase };
export default supabase;
