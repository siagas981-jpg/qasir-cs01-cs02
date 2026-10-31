// [ANTI-PUTIH] Patch V3 - Paksa semua empty client jadi placeholder
console.log('[ANTI-PUTIH] Patch V3 active - Force placeholder');

const PLACEHOLDER_URL = 'https://placeholder.supabase.co';
const PLACEHOLDER_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder';

if (typeof window !== 'undefined') {
  // Simpan placeholder global
  window.__SUPABASE_PLACEHOLDER__ = {
    url: PLACEHOLDER_URL,
    key: PLACEHOLDER_KEY
  };

  // Patch createClient dari @supabase/supabase-js agar tidak pernah throw
  try {
    const supabaseModule = require('@supabase/supabase-js');
    if (supabaseModule && supabaseModule.createClient) {
      const originalCreateClient = supabaseModule.createClient;
      supabaseModule.createClient = function(url, key, options) {
        let finalUrl = url;
        let finalKey = key;
        
        // Jika kosong atau terlalu pendek, paksa pakai placeholder atau ENV asli
        if (!finalUrl || finalUrl.length < 10 || finalUrl === '') {
          console.warn('[ANTI-PUTIH V3] Empty URL detected, using ENV or placeholder');
          finalUrl = process.env.REACT_APP_SUPABASE_URL || PLACEHOLDER_URL;
        }
        if (!finalKey || finalKey.length < 20 || finalKey === '') {
          finalKey = process.env.REACT_APP_SUPABASE_ANON_KEY || PLACEHOLDER_KEY;
        }
        
        try {
          return originalCreateClient(finalUrl, finalKey, options);
        } catch (e) {
          console.warn('[ANTI-PUTIH V3] createClient error caught, returning placeholder client', e.message);
          return originalCreateClient(PLACEHOLDER_URL, PLACEHOLDER_KEY, options);
        }
      };
      console.log('[ANTI-PUTIH V3] createClient patched successfully');
    }
  } catch (e) {
    console.warn('[ANTI-PUTIH V3] Could not patch supabase-js:', e.message);
  }

  // Patch window.onerror agar tidak bikin putih
  const originalOnError = window.onerror;
  window.onerror = function(message, source, lineno, colno, error) {
    if (message && message.includes && message.includes('supabaseUrl is required')) {
      console.warn('[ANTI-PUTIH V3] Blocked supabaseUrl crash - preventing white screen');
      return true; // Block error
    }
    if (originalOnError) return originalOnError.apply(this, arguments);
    return false;
  };
}
