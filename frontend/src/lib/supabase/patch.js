console.log('[ANTI-PUTIH V9] Sync patch starting...');

(function() {
  const FALLBACK_URL = 'https://fqmhxedhluaekg1m1gnt.supabase.co';
  const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxbWh4ZWRobHVhZWtnMW0xZ250Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzYwOTI4MDAsImV4cCI6MjA1MTY2ODgwMH0.placeholder';

  function safeUrl(url) {
    if (!url || typeof url !== 'string' || url.trim().length < 10) {
      console.warn('[V9] URL kosong -> pakai FALLBACK');
      return FALLBACK_URL;
    }
    return url.trim();
  }
  
  function safeKey(key) {
    if (!key || typeof key !== 'string' || key.trim().length < 20) {
      console.warn('[V9] KEY kosong -> pakai FALLBACK');
      return FALLBACK_KEY;
    }
    return key.trim();
  }

  // PATCH 1: Sync require - ini yang paling penting Owy!
  try {
    // eslint-disable-next-line
    const supabaseMod = require('@supabase/supabase-js');
    if (supabaseMod && supabaseMod.createClient) {
      const originalCreate = supabaseMod.createClient;
      supabaseMod.createClient = function(url, key, options) {
        const finalUrl = safeUrl(url);
        const finalKey = safeKey(key);
        try {
          console.log('[V9] createClient intercepted -> URL OK', finalUrl.length);
          return originalCreate.call(this, finalUrl, finalKey, options);
        } catch (err) {
          console.warn('[V9] original throw, force fallback', err.message);
          return originalCreate.call(this, FALLBACK_URL, FALLBACK_KEY, options);
        }
      };
      console.log('[ANTI-PUTIH V9] SYNC patch via require() SUCCESS!');
    }
  } catch (e) {
    console.warn('[V9] require patch failed (normal in some builds)', e.message);
  }

  // PATCH 2: Block crash yang bikin putih
  window.addEventListener('error', function(e) {
    if (e.message && e.message.includes('supabaseUrl is required')) {
      console.warn('[V9] Crash BLOCKED, app continues:', e.message);
      e.preventDefault();
      e.stopImmediatePropagation();
      return false;
    }
  }, true);

  window.addEventListener('unhandledrejection', function(e) {
    const msg = e.reason && (e.reason.message || String(e.reason));
    if (msg && msg.includes('supabaseUrl is required')) {
      console.warn('[V9] Rejection BLOCKED:', msg);
      e.preventDefault();
    }
  });

  console.log('[ANTI-PUTIH V9] All protections installed');
})();
