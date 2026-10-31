// [ANTI-PUTIH] Patch V4 - Force Render Even If Crash
console.log('[ANTI-PUTIH] Patch V4 active - Ultimate Force');

if (typeof window !== 'undefined') {
  window.addEventListener('error', function(e) {
    if (e.message && e.message.toLowerCase().includes('supabaseurl')) {
      console.warn('[ANTI-PUTIH V4] Crash blocked, forcing app to continue');
      e.preventDefault();
      e.stopImmediatePropagation();
      return true;
    }
  }, true);

  window.addEventListener('unhandledrejection', function(e) {
    if (e.reason && e.reason.message && e.reason.message.toLowerCase().includes('supabaseurl')) {
      console.warn('[ANTI-PUTIH V4] Promise rejection blocked');
      e.preventDefault();
    }
  });

  console.log('[ANTI-PUTIH V4] All protections active');
}
