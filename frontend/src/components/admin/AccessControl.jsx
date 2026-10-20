// src/components/admin/AccessControl.jsx - FIX LENGKAP 100% MUNCUL + ANTI BALIK
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

const DEFAULT_ROLES = ["cashier"];

export default function AccessControl() {
  const [config, setConfig] = useState({ cashier: {} });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('role_permissions').select('role, permission_key, allowed').eq('role','cashier');
      console.log("ROLE_PERMS DATA:", data, "ERROR:", error);
      if (error) throw error;
      
      const map = { cashier: {} };
      // default OFF dulu biar jelas
      Object.values(ALL_PERMS).forEach(p => map.cashier[p] = false);
      
      (data || []).forEach(row => {
        map.cashier[row.permission_key] = !!row.allowed;
      });

      // Kalau kosong total, default ON semua kecuali diskon OFF contoh
      if (!data || data.length === 0) {
        toast.info("Table kosong, pakai default");
        Object.values(ALL_PERMS).forEach(p => map.cashier[p] = true);
        map.cashier['cashier_discount'] = false;
      }

      setConfig(map);
    } catch (e) {
      console.error(e);
      toast.error("Gagal load: " + e.message);
      const fallback = { cashier: {} };
      Object.values(ALL_PERMS).forEach(p => fallback.cashier[p] = true);
      setConfig(fallback);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggle = (role, perm) => {
    setConfig(prev => ({
      ...prev,
      [role]: { ...prev[role], [perm]: !prev[role]?.[perm] }
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      // FIX FINAL: HAPUS DULU BARU INSERT = ANTI DOBEL, ON TETAP ON!
      const rowsToSave = Object.entries(config.cashier).map(([key, val]) => ({
        role: 'cashier',
        permission_key: key,
        allowed: !!val
      }));

      console.log("MAU DISIMPAN:", rowsToSave);

      const { error: delError } = await supabase.from('role_permissions').delete().eq('role','cashier');
      if (delError) throw delError;

      const { error: insError } = await supabase.from('role_permissions').insert(rowsToSave);
      if (insError) throw insError;

      toast.success("✅ Akses GLOBAL berhasil disimpan!");
      await load();
    } catch (e) {
      toast.error("Gagal simpan: " + e.message);
      console.error(e);
    }
    setSaving(false);
  };

  if (loading) return <div className="p-10">Loading akses...</div>;

  return (
    <div className="w-full max-w-none px-4 md:px-6 py-4 space-y-4 bg-[#fbfbfb] min-h-screen">
      <div className="text-left">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700">OWNER</p>
        <h1 className="text-[22px] font-extrabold tracking-tight">Kontrol Akses Kasir</h1>
        <p className="text-[11px] text-slate-500 mt-0.5">Buka-tutup hak akses karyawan — Global semua outlet</p>
      </div>

      {Object.keys(config).filter(r => r !== 'owner').length === 0 && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl text-xs text-rose-700">
          GAK ADA ROLE TERDETEKSI! Klik Simpan untuk buat default cashier.
        </div>
      )}

      {Object.keys(config).filter(r => r !== 'owner').map(role => (
        <div key={role} className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="font-extrabold uppercase text-[12px] mb-3 tracking-wider">{role.replaceAll('_',' ')} - {Object.values(config[role] || {}).filter(Boolean).length} aktif</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {Object.entries(ALL_PERMS).map(([label, perm]) => (
              <label key={perm} className="flex items-center justify-between text-[11px] border border-slate-100 rounded-lg px-3 py-2.5 hover:bg-slate-50 cursor-pointer">
                <span className="font-medium">{label.toLowerCase()} <span className="text-[9px] text-slate-400">{perm}</span></span>
                <Switch checked={!!config[role]?.[perm]} onCheckedChange={() => toggle(role, perm)} />
              </label>
            ))}
          </div>
        </div>
      ))}
      
      <button onClick={save} disabled={saving} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-[12px] font-bold w-full md:w-auto">
        {saving ? "Menyimpan..." : "Simpan Akses Global"}
      </button>
    </div>
  );
}
