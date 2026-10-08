import { useState } from "react";
import { supabase } from "@/lib/supabase/client";
import {
  startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, format,
} from "date-fns";

export const PERIOD_LABELS = { today: "Harian", week: "Mingguan", month: "Bulanan", custom: "Kustom" };

export function presetRange(preset) {
  const now = new Date();
  if (preset === "today") return { from: startOfDay(now), to: endOfDay(now) };
  if (preset === "week") return { from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) };
  return { from: startOfMonth(now), to: endOfMonth(now) };
}

export const toISO = (d) => (d instanceof Date ? d : new Date(d)).toISOString();
export const toDateStr = (d) => format(d instanceof Date ? d : new Date(d), "yyyy-MM-dd");

export function useDateRange(initial = "month") {
  const [preset, setPresetState] = useState(initial);
  const [range, setRange] = useState(presetRange(initial));
  const setPreset = (p) => { setPresetState(p); if (p !== "custom") setRange(presetRange(p)); };
  const setFrom = (d) => { setPresetState("custom"); setRange((r) => ({ ...r, from: startOfDay(d) })); };
  const setTo = (d) => { setPresetState("custom"); setRange((r) => ({ ...r, to: endOfDay(d) })); };
  return { preset, setPreset, from: range.from, to: range.to, setFrom, setTo };
}

// ── Stok ──
export async function fetchLowStock(outletId) {
  const { data, error } = await supabase
    .from("products")
    .select("id,name,sku,stock,min_stock,price,cost_price")
    .eq("outlet_id", outletId)
    .order("stock", { ascending: true });
  if (error) throw error;
  return data || [];
}

// ── Penjualan ──
export async function fetchSales(outletId, from, to) {
  const { data, error } = await supabase
    .from("transactions")
    .select("id,total,paid,change,created_at")
    .eq("outlet_id", outletId)
    .gte("created_at", toISO(from))
    .lte("created_at", toISO(to))
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchSalesSeries(outletId, months = 6) {
  const from = startOfMonth(subMonths(new Date(), months - 1));
  const { data, error } = await supabase
    .from("transactions")
    .select("total,created_at")
    .eq("outlet_id", outletId)
    .gte("created_at", from.toISOString());
  if (error) throw error;
  const buckets = {};
  for (let i = months - 1; i >= 0; i--) {
    const d = subMonths(new Date(), i);
    buckets[format(d, "yyyy-MM")] = { label: format(d, "MMM yy"), total: 0 };
  }
  (data || []).forEach((t) => {
    const k = format(new Date(t.created_at), "yyyy-MM");
    if (buckets[k]) buckets[k].total += t.total || 0;
  });
  return Object.values(buckets);
}

// ── Pembelian (stock_movements type purchase) ──
export async function fetchPurchases(outletId, from, to) {
  const { data, error } = await supabase
    .from("stock_movements")
    .select("id,quantity,created_at,notes,products!inner(name,cost_price,outlet_id)")
    .eq("type", "purchase")
    .eq("products.outlet_id", outletId)
    .gte("created_at", toISO(from))
    .lte("created_at", toISO(to))
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map((r) => ({
    id: r.id,
    created_at: r.created_at,
    name: r.products?.name || "—",
    quantity: r.quantity,
    cost_price: r.products?.cost_price || 0,
    nilai: (r.quantity || 0) * (r.products?.cost_price || 0),
    notes: r.notes,
  }));
}
