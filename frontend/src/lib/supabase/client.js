import { createClient } from '@supabase/supabase-js';

const FALLBACK_URL = 'https://fqmhxedhluaekg1m1gnt.supabase.co';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxbWh4ZWRobHVhZWtnMW0xZ250Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYwOTI4MDAsImV4cCI6MjA1MTY2ODgwMH0.placeholder';

function getSafeUrl() {
  try {
    const envUrl = process.env.REACT_APP_SUPABASE_URL;
    if (envUrl && typeof envUrl === 'string' && envUrl.trim().length > 10) return envUrl.trim();
  } catch {}
  return FALLBACK_URL;
}
function getSafeKey() {
  try {
    const envKey = process.env.REACT_APP_SUPABASE_ANON_KEY;
    if (envKey && typeof envKey === 'string' && envKey.trim().length > 20) return envKey.trim();
  } catch {}
  return FALLBACK_KEY;
}

const supabaseUrl = getSafeUrl();
const supabaseAnonKey = getSafeKey();

console.log('[CLIENT.JS V7] URL length:', supabaseUrl.length, 'Key length:', supabaseAnonKey.length);

let supabase;
try {
  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true }
  });
  console.log('[CLIENT.JS V7] OK');
} catch (e) {
  console.error('[CLIENT.JS V7] gagal:', e.message);
  supabase = createClient(FALLBACK_URL, FALLBACK_KEY);
}

// --- INI YANG KURANG TADI OWY! ---
export const healthCheck = async () => {
  try {
    const { data, error } = await supabase.from('profiles').select('id').limit(1);
    if (error) {
      console.warn('[healthCheck] error:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('[healthCheck] exception:', err.message);
    return false;
  }
};

// Biar kompatibel sama semua import lama
export const getSupabase = () => supabase;
export const checkSupabaseConnection = healthCheck;

export { supabase };
export default supabase;
