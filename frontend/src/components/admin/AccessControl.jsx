// src/components/admin/AccessControl.jsx - FIX FINAL ANTI BLOCK OWNER
import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";

const ALL_PERMS = {
  "POS - Checkout / Bayar": "cashier_checkout",
  "POS - Hapus Item": "cashier_delete_item",
  "POS - Diskon": "cashier_discount",
  "POS - Void Transaksi": "cashier_void",
  "Pembukuan - Transaksi Bank": "pembukuan_bank",
  "Pembukuan - Laci Kas": "pembukuan_laci",
  "Pembukuan - Saldo": "pembukuan_saldo",
};

export default function AccessControl() {
  const [config, setConfig] = useState({ cashier: {} });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.from('role_permissions').select('role, permission_key, allowed').eq('role','cashier');
    console.log("LOAD DATA:", data, "ERROR:", error);
    const map = { cashier: {} };
    Object.values(ALL_PERMS).forEach(p => map.cashier[p] = false);
    (data || []).forEach(row => { map.cashier[row.permission_key] = !!row.allowed; });
    if (!data || data.length === 0) {
      Object.values(ALL_PERMS).forEach(p => map.cashier[p] = true);
      map.cashier['cashier_discount'] = false;
      map.cashier['pembukuan_bank'] = false; // default kasir gak boleh bank
    }
    setConfig(map);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggle = (role, perm) => {
    setConfig(prev => ({ ...prev, [role]: { ...prev[role], [perm]: !prev[role]?.[perm] } }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const rowsToSave = Object.entries(config.cashier).map(([key, val]) => ({
        role: 'cashier',
        permission_key: key,
        allowed: !!val
      }));
      const { error } = await supabase.from('role_permissions').upsert(rowsToSave, { onConflict: 'role,permission_key' });
      if (error) throw error;
      toast.success("✅ Berhasil disimpan! Kasir akan ikut aturan baru");
      await load();
    } catch (e) {
      console.error("SAVE ERROR:", e);
      toast.error("Gagal simpan: " + e.message);
    }
    setSaving(false);
  };

  if (loading) return <div className="p-10">Loading akses...</div>;

  return (
    <div className="w-full max-w-none px-4 md:px-6 py-4 space-y-4 bg-[#fbfbfb] min-h-screen">
      <div className="text-left">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700">OWNER - siagas981@gmail.com FULL ACCESS</p>
        <h1 className="text-[22px] font-extrabold tracking-tight">Kontrol Akses Kasir</h1>
        <p className="text-[11px] text-slate-500 mt-0.5">Owner selalu full akses (POS.jsx sudah di-fix). Ini untuk atur hak kasir saja.</p>
      </div>
      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <p className="font-extrabold uppercase text-[12px] mb-3 tracking-wider">CASHIER - {Object.values(config.cashier || {}).filter(Boolean).length} AKTIF</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {Object.entries(ALL_PERMS).map(([label, perm]) => (
            <label key={perm} className="flex items-center justify-between text-[11px] border border-slate-100 rounded-lg px-3 py-2.5 hover:bg-slate-50 cursor-pointer">
              <span className="font-medium">{label.toLowerCase()} <span className="text-[9px] text-slate-400">{perm}</span></span>
              <Switch checked={!!config.cashier?.[perm]} onCheckedChange={() => toggle('cashier', perm)} />
            </label>
          ))}
        </div>
      </div>
      <button onClick={save} disabled={saving} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-[12px] font-bold w-full md:w-auto">
        {saving ? "Menyimpan..." : "Simpan Akses Global"}
      </button>
      <p className="text-[10px] text-slate-400">Catatan: pembukuan_bank OFF = kasir gak lihat Transaksi Bank. Owner tetap bisa karena fix di POS.jsx</p>
    </div>
  );
}
