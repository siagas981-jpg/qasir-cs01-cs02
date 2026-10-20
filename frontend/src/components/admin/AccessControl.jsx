// src/components/admin/AccessControl.jsx
import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { PERMISSIONS, ROLE_DEFAULTS } from "@/lib/permissions";
import { supabase } from "@/lib/supabase"; // sesuaikan path supabase mu

export default function AccessControl() {
  const [config, setConfig] = useState(ROLE_DEFAULTS);
  const [saving, setSaving] = useState(false);

  const toggle = (role, perm) => {
    setConfig(prev => {
      const has = prev[role].includes(perm);
      return {
        ...prev,
        [role]: has ? prev[role].filter(p => p !== perm) : [...prev[role], perm]
      }
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      for (const role of Object.keys(config)) {
        if (role === 'owner') continue;
        await supabase.from('role_permissions').upsert({ 
          role, 
          permissions: config[role] 
        }, { onConflict: 'role' });
      }
      alert("✅ Akses GLOBAL berhasil disimpan!");
    } catch (e) {
      alert("Gagal: " + e.message);
    }
    setSaving(false);
  };

  return (
    <div className="w-full max-w-none px-4 md:px-6 py-4 space-y-4 bg-[#fbfbfb] min-h-screen">
      <div className="text-left">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700">OWNER</p>
        <h1 className="text-[22px] font-extrabold tracking-tight">Kontrol Akses Kasir</h1>
        <p className="text-[11px] text-slate-500 mt-0.5">Buka-tutup hak akses karyawan — Global semua outlet</p>
      </div>

      {Object.keys(ROLE_DEFAULTS).filter(r => r !== 'owner').map(role => (
        <div key={role} className="rounded-xl border bg-white p-4 shadow-sm">
          <p className="font-extrabold uppercase text-[12px] mb-3 tracking-wider">{role.replace('_',' ')}</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {Object.entries(PERMISSIONS).map(([label, perm]) => (
              <label key={perm} className="flex items-center justify-between text-[11px] border border-slate-100 rounded-lg px-3 py-2.5 hover:bg-slate-50">
                <span className="font-medium">{label.toLowerCase().replaceAll('_',' ')}</span>
                <Switch checked={config[role].includes(perm)} onCheckedChange={() => toggle(role, perm)} />
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
