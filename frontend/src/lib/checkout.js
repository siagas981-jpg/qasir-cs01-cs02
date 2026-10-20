import { supabase } from "@/lib/supabase/client";

const MESSAGES = {
  INSUFFICIENT_STOCK: "Stok tidak cukup — transaksi dibatalkan",
  INSUFFICIENT_PAYMENT: "Uang bayar kurang dari total",
  ACCOUNT_INACTIVE: "Akun dinonaktifkan. Hubungi owner.",
  FORBIDDEN_OUTLET: "Anda tidak punya akses ke outlet ini",
  PRODUCT_NOT_FOUND: "Produk tidak ditemukan di outlet ini",
  EMPTY_CART: "Keranjang kosong",
  NOT_AUTHENTICATED: "Sesi habis, silakan login ulang",
};

const isNetworkError = (e) => {
  if (!e) return true;
  if (e.name === "NotFoundError") return true;
  return !e.code || /fetch|network|load failed|not found/i.test(e.message || "");
};

// FIX: tambah p_discount biar backend tau!
export async function runCheckout({ outlet_id, items, paid, discount = 0, client_ref }) {
  try {
    if (!outlet_id || !items) {
      return { ok: false, message: "Data tidak lengkap" };
    }
    
    const { data, error } = await supabase.rpc("checkout", {
      p_outlet_id: outlet_id,
      p_items: items.map((i) => ({ product_id: i.product_id, qty: i.qty })),
      p_paid: paid,
      p_discount: discount, // <-- FIX KIRIM DISKON!
      p_client_ref: client_ref,
    });
    
    if (!error) return { ok: true, data };
    
    if (isNetworkError(error)) {
      return { ok: false, network: true, message: "Offline" };
    }
    
    let short = null;
    if (error.message === "INSUFFICIENT_STOCK") {
      try { short = JSON.parse(error.details); } catch { short = null; }
    }
    
    return { ok: false, code: error.message, message: MESSAGES[error.message] || error.message, short };
    
  } catch (e) {
    console.warn("runCheckout catch:", e);
    if (e?.name === "NotFoundError") {
      return { ok: false, network: true, message: "Offline - DB error" };
    }
    return { ok: false, network: true, message: e?.message || "Offline" };
  }
}
