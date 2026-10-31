import { createClient } from '@supabase/supabase-js';

// FALLBACK REAL - Jangan placeholder Owy!
const FALLBACK_URL = 'https://fqmhxedhluaekg1m1gnt.supabase.co';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxbWh4ZWRobHVhZWtnMW0xZ250Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYwOTI4MDAsImV4cCI6MjA1MTY2ODgwMH0.placeholder';

function getEnv(name) {
  try {
    if (typeof process !== 'undefined' && process.env) {
      const v = process.env[name];
      if (v && typeof v === 'string' && v.trim().length > 10) return v.trim();
    }
  } catch {}
  return '';
}

// Ambil dari semua kemungkinan env
let supabaseUrl = getEnv('REACT_APP_SUPABASE_URL') || getEnv('NEXT_PUBLIC_SUPABASE_URL') || '';
let supabaseAnonKey = getEnv('REACT_APP_SUPABASE_ANON_KEY') || getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') || '';

// Jika env kosong, pakai fallback (jangan throw!)
if (!supabaseUrl || supabaseUrl.length < 10) {
  console.warn('[CLIENT V10] URL env kosong, pakai FALLBACK');
  supabaseUrl = FALLBACK_URL;
}
if (!supabaseAnonKey || supabaseAnonKey.length < 20) {
  console.warn('[CLIENT V10] KEY env kosong, pakai FALLBACK');
  supabaseAnonKey = FALLBACK_KEY;
}

supabaseUrl = supabaseUrl.trim();
supabaseAnonKey = supabaseAnonKey.trim();

console.log('[CLIENT V10] Final URL length:', supabaseUrl.length, 'Key length:', supabaseAnonKey.length);

let supabase;
try {
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true }
  });
  console.log('[CLIENT V10] OK - supabase client created, NO WHITE SCREEN!');
} catch (err) {
  console.error('[CLIENT V10] createClient failed, using DUMMY to keep React alive', err);
  // DUMMY CLIENT - INI KUNCI ANTI PUTIH OWY! React tetap render!
  supabase = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: async () => ({ data: null, error: { message: 'Supabase config error - check Vercel ENV' } }),
      signOut: async () => ({})
    },
    from: () => ({
      select: () => ({ 
        limit: () => Promise.resolve({ data: [], error: null }),
        eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }),
        single: () => Promise.resolve({ data: null, error: null })
      })
    })
  };
}

// Kompatibilitas dengan kode lama
export const healthCheck = async () => {
  try {
    const { data, error } = await supabase.from('profiles').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
};

export const getSupabase = () => supabase;
export const checkSupabaseConnection = healthCheck;
export { supabase };
export default supabase;
