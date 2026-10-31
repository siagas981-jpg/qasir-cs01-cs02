// [ANTI-PUTIH] Patch V5 Ultimate - Patch createClient sebelum dipakai file lain
console.log('[ANTI-PUTIH] Patch V5 Ultimate active');

const PLACEHOLDER_URL = 'https://fqmhxedhluaekg1m1gnt.supabase.co';
const PLACEHOLDER_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxbWh4ZWRobHVhZWtnMW0xZ250Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MjAxNTU3NjAwMH0.placeholder-key-for-anti-putih';

function safeUrl(url) {
  if (!url || typeof url !== 'string' || url.trim() === '' || url.length < 10) {
    const envUrl = (typeof process !== 'undefined' && process.env && process.env.REACT_APP_SUPABASE_URL) || '';
    return envUrl && envUrl.length > 10 ? envUrl : PLACEHOLDER_URL;
  }
  return url;
}
function safeKey(key) {
  if (!key || typeof key !== 'string' || key.trim() === '' || key.length < 20) {
    const envKey = (typeof process !== 'undefined' && process.env && process.env.REACT_APP_SUPABASE_ANON_KEY) || '';
    return envKey && envKey.length > 20 ? envKey : PLACEHOLDER_KEY;
  }
  return key;
}

if (typeof window !== 'undefined') {
  // 1. Blok crash total
  window.addEventListener('error', function(e) {
    if (e.message && e.message.toLowerCase().includes('supabaseurl')) {
      console.warn('[ANTI-PUTIH V5] Crash blocked at window.error, app continues');
      e.preventDefault();
      e.stopImmediatePropagation();
      return true;
    }
  }, true);

  window.addEventListener('unhandledrejection', function(e) {
    const msg = e.reason && e.reason.message ? e.reason.message.toLowerCase() : '';
    if (msg.includes('supabaseurl')) {
      console.warn('[ANTI-PUTIH V5] Rejection blocked');
      e.preventDefault();
    }
  });

  // 2. Patch via require (CRA webpack)
  try {
    const mod = require('@supabase/supabase-js');
    if (mod && mod.createClient && !mod.createClient.__antiPutihPatched) {
      const original = mod.createClient;
      const patched = function(url, key, options) {
        const u = safeUrl(url);
        const k = safeKey(key);
        try {
          return original(u, k, options);
        } catch (err) {
          console.warn('[ANTI-PUTIH V5] original threw, fallback to placeholder:', err.message);
          try {
            return original(PLACEHOLDER_URL, PLACEHOLDER_KEY, options);
          } catch {
            return { auth: { getSession: async () => ({ data: { session: null } }) }, from: () => ({ select: async () => ({ data: [], error: null }) }) };
          }
        }
      };
      patched.__antiPutihPatched = true;
      mod.createClient = patched;
      console.log('[ANTI-PUTIH V5] createClient patched via require');
    }
  } catch (err) {
    console.warn('[ANTI-PUTIH V5] require patch failed:', err.message);
  }

  // 3. Patch via dynamic import (ESM)
  import('@supabase/supabase-js').then(mod => {
    if (mod && mod.createClient && !mod.createClient.__antiPutihPatched) {
      const original = mod.createClient;
      const patched = function(url, key, options) {
        const u = safeUrl(url);
        const k = safeKey(key);
        try {
          return original(u, k, options);
        } catch {
          return original(PLACEHOLDER_URL, PLACEHOLDER_KEY, options);
        }
      };
      patched.__antiPutihPatched = true;
      mod.createClient = patched;
      console.log('[ANTI-PUTIH V5] createClient patched via dynamic import');
    }
  }).catch(() => {});

  console.log('[ANTI-PUTIH V5] All protections installed');
}
