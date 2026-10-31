// ANTI-PUTIH V2 - Gak overwrite, cuma blok crash
(function() {
  if (typeof window === "undefined") return;
  
  window.addEventListener("error", function(e) {
    var msg = (e.message || "") + (e.error && e.error.message || "");
    if (msg.includes("supabaseUrl is required")) {
      console.warn("[ANTI-PUTIH] Blocked crash from empty supabase client");
      e.preventDefault();
      e.stopImmediatePropagation();
      return false;
    }
  }, true);

  window.addEventListener("unhandledrejection", function(e) {
    var msg = (e.reason && e.reason.message || "") + String(e.reason || "");
    if (msg.includes("supabaseUrl is required")) {
      console.warn("[ANTI-PUTIH] Blocked unhandled rejection");
      e.preventDefault();
    }
  });

  console.log("[ANTI-PUTIH] Patch V2 active - white screen blocked");
})();
