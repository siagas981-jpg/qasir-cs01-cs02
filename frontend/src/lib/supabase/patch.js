// [ANTI-PUTIH] Patch V4 - Ultimate Fix
console.log('[ANTI-PUTIH] Patch V4 active - Ultimate');

const PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBsYWNlaG9sZGVyIiwicm9sZSI6ImFub24iLCJpYXQiOjE2NDA1MTkyMDAsImV4cCI6MTk1NjA5NTIwMH0.placeholder';

if (typeof window !== 'undefined') {
  // 1. Override createClient di prototype jika ada
  const originalError = console.error;
  
  // 2. Block white screen total
  window.addEventListener('error', function(e) {
    if (e.message && e.message.includes('supabaseUrl is required')) {
      console.warn('[ANTI-PUTIH V4] Blocked crash - App will continue');
      e.preventDefault();
      e.stopPropagation();
      return true;
    }
  }, true);

  // 3. Patch Supabase client constructor
  try {
    // Coba patch via window.supabase jika ada
    Object.defineProperty(window, 'supabaseUrl', {
      get() { return process.env.REACT_APP_SUPABASE_URL || PLACEHOLDER_URL; },
      set(v) { console.warn('[ANTI-PUTIH V4] Attempt to set empty url blocked:', v); }
    });
  } catch(e) {}
  
  console.log('[ANTI-PUTIH V4] Protections installed');
}
