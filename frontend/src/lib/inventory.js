import { supabase } from "@/lib/supabase/client";

const MESSAGES = {
  NEGATIVE_STOCK: "Stok tidak boleh negatif",
  PRODUCT_NOT_FOUND: "Produk tidak ditemukan",
  FORBIDDEN: "Anda tidak punya akses",
  ZERO_DELTA: "Jumlah tidak boleh nol",
  INVALID_TYPE: "Jenis pergerakan tidak valid",
  NOT_AUTHENTICATED: "Sesi habis, silakan login ulang",
};

export const movementError = (e) => MESSAGES[e?.message] || e?.message || "Gagal memperbarui stok";

// Atomic: locks product, updates products.stock, inserts a stock_movements row.
export async function recordStockMovement({ product_id, type, delta, notes }) {
  const { data, error } = await supabase.rpc("record_stock_movement", {
    p_product_id: product_id,
    p_type: type,
    p_delta: delta,
    p_notes: notes || null,
  });
  if (error) throw error;
  return data;
}

export async function fetchMovements({ outletId, productId, type }) {
  let q = supabase
    .from("stock_movements")
    .select(
      "id,type,quantity,previous_stock,new_stock,notes,created_at,created_by,product_id,products!inner(name,outlet_id),creator:profiles(full_name,email)",
    )
    .eq("products.outlet_id", outletId)
    .order("created_at", { ascending: false })
    .limit(300);
  if (productId) q = q.eq("product_id", productId);
  if (type) q = q.eq("type", type);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export const MOVEMENT_TYPES = {
  sale: { label: "Penjualan", badge: "bg-rose-100 text-rose-700 border-rose-200" },
  purchase: { label: "Pembelian", badge: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  adjustment: { label: "Penyesuaian", badge: "bg-amber-100 text-amber-700 border-amber-200" },
  return: { label: "Retur", badge: "bg-sky-100 text-sky-700 border-sky-200" },
};
