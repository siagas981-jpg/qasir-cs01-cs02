import { supabase } from "@/lib/supabase/client";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";
import { toISO, toDateStr } from "@/lib/reports";

export const EXPENSE_CATEGORIES = ["Sewa", "Gaji", "Listrik & Air", "Operasional", "Pemasaran", "Lainnya"];

export async function fetchExpenses(outletId, from, to) {
  const { data, error } = await supabase
    .from("expenses")
    .select("*")
    .eq("outlet_id", outletId)
    .gte("date", toDateStr(from))
    .lte("date", toDateStr(to))
    .order("date", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function addExpense(row) {
  const { error } = await supabase.from("expenses").insert(row);
  if (error) throw error;
}

export async function deleteExpense(id) {
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw error;
}

async function cogs(outletId, from, to) {
  const { data, error } = await supabase
    .from("transaction_items")
    .select("qty,transactions!inner(outlet_id,created_at),products!inner(cost_price,outlet_id)")
    .eq("transactions.outlet_id", outletId)
    .gte("transactions.created_at", toISO(from))
    .lte("transactions.created_at", toISO(to));
  if (error) throw error;
  return (data || []).reduce((s, r) => s + (r.qty || 0) * (r.products?.cost_price || 0), 0);
}

export async function fetchProfitSummary(outletId, from, to) {
  const [txs, exps, purch, hpp] = await Promise.all([
    supabase.from("transactions").select("total").eq("outlet_id", outletId).gte("created_at", toISO(from)).lte("created_at", toISO(to)),
    supabase.from("expenses").select("amount").eq("outlet_id", outletId).gte("date", toDateStr(from)).lte("date", toDateStr(to)),
    supabase.from("stock_movements").select("quantity,products!inner(cost_price,outlet_id)").eq("type", "purchase").eq("products.outlet_id", outletId).gte("created_at", toISO(from)).lte("created_at", toISO(to)),
    cogs(outletId, from, to),
  ]);
  for (const r of [txs, exps, purch]) if (r.error) throw r.error;
  const pemasukan = (txs.data || []).reduce((s, t) => s + (t.total || 0), 0);
  const expensesTotal = (exps.data || []).reduce((s, e) => s + (e.amount || 0), 0);
  const purchasesTotal = (purch.data || []).reduce((s, p) => s + (p.quantity || 0) * (p.products?.cost_price || 0), 0);
  const pengeluaran = expensesTotal + purchasesTotal;
  return { pemasukan, hpp, expensesTotal, purchasesTotal, pengeluaran, laba: pemasukan - pengeluaran - hpp };
}

export async function fetchProfitSeries(outletId, months = 6) {
  const from = startOfMonth(subMonths(new Date(), months - 1));
  const [txs, exps, purch, items] = await Promise.all([
    supabase.from("transactions").select("total,created_at").eq("outlet_id", outletId).gte("created_at", from.toISOString()),
    supabase.from("expenses").select("amount,date").eq("outlet_id", outletId).gte("date", format(from, "yyyy-MM-dd")),
    supabase.from("stock_movements").select("quantity,created_at,products!inner(cost_price,outlet_id)").eq("type", "purchase").eq("products.outlet_id", outletId).gte("created_at", from.toISOString()),
    supabase.from("transaction_items").select("qty,transactions!inner(outlet_id,created_at),products!inner(cost_price,outlet_id)").eq("transactions.outlet_id", outletId).gte("transactions.created_at", from.toISOString()),
  ]);
  for (const r of [txs, exps, purch, items]) if (r.error) throw r.error;
  const buckets = {};
  for (let i = months - 1; i >= 0; i--) {
    const d = subMonths(new Date(), i);
    buckets[format(d, "yyyy-MM")] = { label: format(d, "MMM yy"), pemasukan: 0, pengeluaran: 0, hpp: 0 };
  }
  const add = (k, field, v) => { if (buckets[k]) buckets[k][field] += v; };
  (txs.data || []).forEach((t) => add(format(new Date(t.created_at), "yyyy-MM"), "pemasukan", t.total || 0));
  (exps.data || []).forEach((e) => add(format(new Date(e.date), "yyyy-MM"), "pengeluaran", e.amount || 0));
  (purch.data || []).forEach((p) => add(format(new Date(p.created_at), "yyyy-MM"), "pengeluaran", (p.quantity || 0) * (p.products?.cost_price || 0)));
  (items.data || []).forEach((it) => add(format(new Date(it.transactions.created_at), "yyyy-MM"), "hpp", (it.qty || 0) * (it.products?.cost_price || 0)));
  return Object.values(buckets).map((b) => ({ ...b, laba: b.pemasukan - b.pengeluaran - b.hpp }));
}
