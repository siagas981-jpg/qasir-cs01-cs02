// src/components/admin/AccessControl.jsx - FINAL LENGKAP PER OUTLET SESUAI HEADER
import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

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
  const { user, currentOutlet, selectedOutlet, outlets } = useAuth();
  
  // 1. AMBIL OUTLET YANG AKTIF DI HEADER (CS Qasir 01)
  const outletId = currentOutlet?.id || selectedOutlet?.id || localStorage.getItem("selectedOutletId") || localStorage.getItem("outlet_id") || null;
  const outletName = currentOutlet?.name || selectedOutlet?.name || localStorage.getItem("selectedOutletName") || "Pilih Outlet di Header";
  const allOutlets = outlets || [];

  const [config, setConfig] = useState({ cashier: {} });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [outletList, setOutletList] = useState([]);

  // 2. LOAD DAFTAR OUTLET UNTUK INFO
  useEffect(() => {
    const fetchOutlets = async () => {
      const { data } = await supabase.from("outlets").select("id, name");
      if (data) setOutletList(data);
    };
    fetchOutlets();
  }, []);

  // 3. LOAD PERMISSION SESUAI OUTLET YANG DIPILIH!
  const load = async () => {
    if (!outletId) {
      setLoading(false);
      toast.error("Pilih outlet dulu di header atas! Contoh: CS Qasir 01");
      return;
    }
    setLoading(true);
    console.log("LOAD PERM UNTUK OUTLET:", outletId, outletName);
    
    // Query per outlet!
    const { data, error } = await supabase
      .from('role_permissions')
      .select('role, permission_key, allowed, outlet_id')
      .eq('role','cashier')
      .eq('outlet_id', outletId);

    console.log("DATA LOAD:", data, "ERROR:", error);

    const map = { cashier: {} };
    // Default semua TRUE biar gak ngunci pas pertama kali
    Object.values(ALL_PERMS).forEach(p => map.cashier[p] = true);
    
    // Timpa dengan data dari DB sesuai outlet
    (data || []).forEach(row => { 
      map.cashier[row.permission_key] = !!row.allowed; 
    });

    setConfig(map);
    setLoading(false);
  };

    useEffect(() => { 
    load(); 
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outletId]);

  const toggle = (role, perm) => {
    setConfig(prev => ({ 
      ...prev, 
      [role]: { ...prev[role], [perm]: !prev[role]?.[perm] } 
    }));
  };

  // 4. SAVE PER OUTLET! BUKAN GLOBAL!
  const save = async () => {
    if (!outletId) {
      toast.error("❌ Pilih outlet dulu! Klik CS Qasir 01 di header atas!");
      return;
    }
    setSaving(true);
    try {
      const rowsToSave = Object.entries(config.cashier).map(([key, val]) => ({
        role: 'cashier',
        permission_key: key,
        outlet_id: outletId, // SIMPAN SESUAI OUTLET YANG DIPILIH!
        allowed: !!val
      }));
      
      console.log("SAVE ROWS:", rowsToSave);

      const { error } = await supabase
        .from('role_permissions')
        .upsert(rowsToSave, { onConflict: 'role,permission_key,outlet_id' });
      
      if (error) throw error;
      
      toast.success(`✅ Berhasil disimpan untuk ${outletName}!`);
      await load();
    } catch (e) {
      console.error("SAVE ERROR:", e);
      toast.error("Gagal simpan: " + e.message + " - Pastikan sudah run SQL DROP TABLE per outlet!");
    }
    setSaving(false);
  };

  if (loading) return <div className="p-10 text-center">Loading akses untuk {outletName}...</div>;

  if (!outletId) {
    return (
      <div className="p-10 text-center">
        <h2 className="text-xl font-bold">Pilih Outlet Dulu!</h2>
        <p className="text-sm text-slate-500 mt-2">Klik dropdown outlet di header atas (CS Qasir 01 / CS Qasir 02) untuk atur akses per outlet.</p>
        <p className="text-xs mt-4">Outlet tersedia di DB: {outletList.map(o => o.name).join(", ")}</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-none px-4 md:px-6 py-4 space-y-4 bg-[#fbfbfb] min-h-screen">
      <div className="text-left border-l-4 border-emerald-500 pl-4 bg-white p-3 rounded">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700">FILTER AKTIF: {outletName.toUpperCase()} - ID: {outletId.slice(0,8)}...</p>
        <h1 className="text-[22px] font-extrabold tracking-tight">Kontrol Akses Kasir - {outletName}</h1>
        <p className="text-[11px] text-slate-500 mt-0.5">Login: {user?.email} | Setting ini HANYA untuk outlet <b>{outletName}</b>, tidak berlaku untuk outlet lain!</p>
        <p className="text-[10px] text-amber-600 mt-1">Ganti outlet di header atas untuk atur outlet lain. Owner siagas981@gmail.com selalu FULL.</p>
      </div>

      <div className="rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex justify-between items-center mb-3">
          <p className="font-extrabold uppercase text-[12px] tracking-wider">CASHIER @ {outletName.toUpperCase()} - {Object.values(config.cashier || {}).filter(Boolean).length} AKTIF</p>
          <span className="text-[10px] bg-slate-100 px-2 py-1 rounded">{outletName}</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {Object.entries(ALL_PERMS).map(([label, perm]) => (
            <label key={perm} className="flex items-center justify-between text-[11px] border border-slate-100 rounded-lg px-3 py-2.5 hover:bg-slate-50 cursor-pointer">
              <span className="font-medium">{label} <br/><span className="text-[9px] text-slate-400">{perm} | {outletName}</span></span>
              <Switch checked={!!config.cashier?.[perm]} onCheckedChange={() => toggle('cashier', perm)} />
            </label>
          ))}
        </div>
      </div>

      <button onClick={save} disabled={saving} className="bg-slate-900 text-white px-6 py-3 rounded-xl text-[12px] font-bold w-full md:w-auto shadow">
        {saving ? "Menyimpan..." : `Simpan Akses untuk ${outletName}`}
      </button>
      
      <p className="text-[10px] text-slate-400">Catatan: Ini per outlet! Kalau kamu ganti header ke CS Qasir 02, settingnya beda lagi. Harus simpan per outlet!</p>
    </div>
  );
}
