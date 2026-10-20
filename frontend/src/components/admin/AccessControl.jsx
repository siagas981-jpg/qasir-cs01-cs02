// src/components/admin/AccessControl.jsx - FIX PISAH TOTAL
import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { PERMISSIONS, ROLE_DEFAULTS } from "@/lib/permissions";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function AccessControl() {
  const [config, setConfig] = useState(ROLE_DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // === FIX 1: LOAD DATA ASLI DARI SUPABASE, BUKAN CUMA DEFAULT ===
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.from('role_permissions').select('role, permissions');
        if (error) throw error;
        if (data && data.length > 0) {
          const merged = { ...ROLE_DEFAULTS };
          data.forEach(row => {
            if (row.role !== 'owner') {
              merged[row.role] = row.permissions || ROLE_DEFAULTS[row.role] || [];
            }
          });
          setConfig(merged);
        }
      } catch (e) {
        console.error("Load akses gagal:", e.message);
        toast.error("Gagal load akses: " + e.message);
      }
      setLoading(false);
    };
    load();
  }, []);

  const toggle = (role, perm) => {
    setConfig(prev => {
      const current = prev[role] || [];
      const has = current.includes(perm);
      return {
        ...prev,
        [role]: has ? current.filter(p => p !== perm) : [...current, perm]
      }
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      for (const role of Object.keys(config)) {
        if (role === 'owner') continue;
        const { error } = await supabase.from('role_permissions').upsert({ 
          role, 
          permissions: config[role] 
        }, { onConflict: 'role' });
        if (error) throw error;
      }
      toast.success("✅ Akses GLOBAL berhasil disimpan! Refresh kasir untuk update.");
      // invalidasi cache permission
      localStorage.removeItem('permissions_cache');
    } catch (e) {
      toast.error("Gagal: " + e.message);
    }
    setSaving(false);
  };

  if (loading) return <div className="p-10 text-sm">Loading akses...</div>;

  return (
    <div className="w-full max-w-none px-4 md:px-6 py-4 space-y-4 bg-[#fbfbfb] min-h-screen">
      <div className="text-left">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700">OWNER</p>
        <h1 className="text-[22px] font-extrabold tracking-tight">Kontrol Akses Kasir</h1>
        <p className="text-[11px] text-slate-500 mt-0.5">Buka-tutup hak akses karyawan — Global semua outlet</p>
        <p className="text-[10px] text-amber-600 mt-1">⚠️ OFF Diskon = Cuma Diskon mati, Bank & Bayar tetap hidup (udah dipisah!)</p>
      </div>

      {Object.keys(config).filter(r => r !== 'owner').map(role => (
        <div key={role} className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="font-extrabold uppercase text-[12px] mb-3 tracking-wider">{role.replaceAll('_',' ')} - {config[role]?.length || 0} akses aktif</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {Object.entries(PERMISSIONS).map(([label, perm]) => {
              const isActive = (config[role] || []).includes(perm);
              const isCritical = ['cashier_discount','cashier_checkout','pembukuan_bank'].includes(perm);
              return (
                <label key={perm} className={`flex items-center justify-between text-[11px] border rounded-lg px-3 py-2.5 hover:bg-slate-50 ${isCritical ? 'border-amber-200 bg-amber-50/30' : 'border-slate-100'}`}>
                  <span className="font-medium">{label.toLowerCase().replaceAll('_',' ')} <span className="text-[9px] text-slate-400">({perm})</span></span>
                  <Switch checked={isActive} onCheckedChange={() => toggle(role, perm)} />
                </label>
              )
            })}
          </div>
        </div>
      ))}
      
      <button onClick={save} disabled={saving} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-[12px] font-bold w-full md:w-auto hover:bg-black disabled:opacity-50">
        {saving ? "Menyimpan..." : "Simpan Akses Global"}
      </button>
      <p className="text-[10px] text-slate-400">Setelah simpan, kasir harus logout-login lagi / refresh biar akses baru kepakai.</p>
    </div>
  );
}
