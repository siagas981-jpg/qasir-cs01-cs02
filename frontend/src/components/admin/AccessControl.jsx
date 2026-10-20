// src/components/admin/AccessControl.jsx - FIX FULL 115 BARIS - SESUAI TABLE KAMU
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
  const [config, setConfig] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.from('role_permissions').select('role, permission_key, allowed');
        if (error) throw error;
        const map = {};
        // Group by role
        (data || []).forEach(row => {
          if (!map[row.role]) map[row.role] = {};
          map[row.role][row.permission_key] = row.allowed;
        });
        // Pastikan role cashier ada
        if (!map['cashier']) map['cashier'] = {};
        setConfig(map);
      } catch (e) {
        toast.error("Gagal load: " + e.message);
      }
      setLoading(false);
    };
    load();
  }, []);

  const toggle = (role, perm) => {
    setConfig(prev => ({
      ...prev,
      [role]: {
        ...prev[role],
        [perm]: !prev[role]?.[perm]
      }
    }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const roles = Object.keys(config).filter(r => r !== 'owner');
      for (const role of roles) {
        for (const perm of Object.values(ALL_PERMS)) {
          const allowed = config[role]?.[perm] ?? false;
          const { error } = await supabase.from('role_permissions').upsert({
            role,
            permission_key: perm,
            allowed,
            created_at: new Date().toISOString()
          }, { onConflict: 'role,permission_key' });
          if (error) throw error;
        }
      }
      toast.success("✅ Akses GLOBAL berhasil disimpan!");
    } catch (e) {
      toast.error("Gagal simpan: " + e.message);
      console.error(e);
    }
    setSaving(false);
  };

  if (loading) {
    return <div className="w-full max-w-none px-4 md:px-6 py-10 text-sm text-muted-foreground">Loading akses...</div>;
  }

  return (
    <div className="w-full max-w-none px-4 md:px-6 py-4 space-y-4 bg-[#fbfbfb] min-h-screen">
      <div className="text-left">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700">OWNER</p>
        <h1 className="text-[22px] font-extrabold tracking-tight">Kontrol Akses Kasir</h1>
        <p className="text-[11px] text-slate-500 mt-0.5">Buka-tutup hak akses karyawan — Global semua outlet</p>
        <p className="text-[10px] text-emerald-700 mt-1 font-semibold">✅ FIX: OFF Diskon ≠ OFF Bank/Bayar (udah pisah per permission_key)</p>
      </div>

      {Object.keys(config).filter(r => r !== 'owner').map(role => (
        <div key={role} className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="font-extrabold uppercase text-[12px] mb-3 tracking-wider">{role.replaceAll('_',' ')} - {Object.values(config[role] || {}).filter(Boolean).length} aktif</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {Object.entries(ALL_PERMS).map(([label, perm]) => {
              const isActive = !!config[role]?.[perm];
              const isDiskon = perm === 'cashier_discount';
              const isBank = perm === 'pembukuan_bank';
              const isCheckout = perm === 'cashier_checkout';
              return (
                <label key={perm} className={`flex items-center justify-between text-[11px] border rounded-lg px-3 py-2.5 hover:bg-slate-50 cursor-pointer ${isDiskon ? 'border-amber-200 bg-amber-50/50' : ''} ${isBank ? 'border-emerald-200 bg-emerald-50/50' : ''} ${isCheckout ? 'border-blue-200 bg-blue-50/50' : ''} ${!isDiskon && !isBank && !isCheckout ? 'border-slate-100' : ''}`}>
                  <span className="font-medium">{label.toLowerCase()} <span className="text-[9px] text-slate-400 ml-1">{perm}</span></span>
                  <Switch checked={isActive} onCheckedChange={() => toggle(role, perm)} />
                </label>
              );
            })}
          </div>
        </div>
      ))}
      
      <button onClick={save} disabled={saving} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-[12px] font-bold w-full md:w-auto hover:bg-black disabled:opacity-50">
        {saving ? "Menyimpan..." : "Simpan Akses Global"}
      </button>
      <p className="text-[10px] text-slate-400">Table sesuai screenshot: role | permission_key | allowed TRUE/FALSE</p>
    </div>
  );
}
