// src/components/admin/AccessControl.jsx - FINAL 175 BARIS LENGKAP PER OUTLET
import { useState, useEffect } from "react";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";

// =============================================
// DAFTAR SEMUA PERMISSION YANG BISA DIATUR
// =============================================
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
  // =============================================
  // STATE
  // =============================================
  const [outlets, setOutlets] = useState([]); // Daftar outlet CS Qasir 01, 02
  const [selectedOutletId, setSelectedOutletId] = useState(
    localStorage.getItem("selectedOutletId") || ""
  );
  const [config, setConfig] = useState({}); // Config permission per outlet
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // =============================================
  // 1. LOAD DAFTAR OUTLET DARI SUPABASE
  // =============================================
  useEffect(() => {
    const fetchOutlets = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("outlets")
          .select("id, name")
          .order("name", { ascending: true });

        if (error) throw error;

        if (data && data.length > 0) {
          setOutlets(data);
          // Auto pilih outlet pertama kalau belum ada yang dipilih
          if (!selectedOutletId) {
            const firstId = data[0].id;
            setSelectedOutletId(firstId);
            localStorage.setItem("selectedOutletId", firstId);
          }
        }
      } catch (err) {
        console.error("Gagal load outlets:", err);
        toast.error("Gagal load outlet: " + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchOutlets();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // =============================================
  // 2. LOAD PERMISSION SESUAI OUTLET YANG DIPILIH
  //    INI KUNCINYA PER OUTLET! BUKAN GLOBAL!
  // =============================================
  useEffect(() => {
    if (!selectedOutletId) return;

    const loadPerms = async () => {
      try {
        setLoading(true);
        console.log("LOAD PERM OUTLET:", selectedOutletId);

        const { data, error } = await supabase
          .from("role_permissions")
          .select("permission_key, allowed, outlet_id")
          .eq("role", "cashier")
          .eq("outlet_id", selectedOutletId);

        if (error) throw error;

        // Default semua TRUE biar gak ngunci
        const map = {};
        Object.values(ALL_PERMS).forEach((p) => (map[p] = true));

        // Timpa dengan data DB yang sesuai outlet
        (data || []).forEach((row) => {
          map[row.permission_key] = !!row.allowed;
        });

        setConfig(map);
        localStorage.setItem("selectedOutletId", selectedOutletId);
      } catch (err) {
        console.error("Load perm error:", err);
      } finally {
        setLoading(false);
      }
    };

    loadPerms();
  }, [selectedOutletId]);

  // =============================================
  // 3. TOGGLE ON/OFF
  // =============================================
  const toggle = (perm) => {
    setConfig((prev) => ({ ...prev, [perm]: !prev[perm] }));
  };

  // =============================================
  // 4. SAVE PER OUTLET! KUNCINYA DI SINI!
  // =============================================
  const save = async () => {
    if (!selectedOutletId) {
      toast.error("Pilih outlet dulu!");
      return;
    }

    setSaving(true);
    try {
      const rowsToSave = Object.entries(config).map(([key, val]) => ({
        role: "cashier",
        permission_key: key,
        outlet_id: selectedOutletId, // SIMPAN SESUAI OUTLET!
        allowed: !!val,
      }));

      console.log("SAVE:", rowsToSave);

      const { error } = await supabase
        .from("role_permissions")
        .upsert(rowsToSave, { onConflict: "role,permission_key,outlet_id" });

      if (error) throw error;

      const outletName =
        outlets.find((o) => o.id === selectedOutletId)?.name || "Outlet";
      toast.success(`✅ Berhasil! Akses ${outletName} disimpan!`);
    } catch (e) {
      console.error(e);
      toast.error("Gagal simpan: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const selectedOutletName =
    outlets.find((o) => o.id === selectedOutletId)?.name || "Pilih Outlet";

  // =============================================
  // RENDER UI
  // =============================================
  return (
    <div className="w-full px-4 md:px-6 py-4 space-y-4 bg-[#fbfbfb] min-h-screen">
      <div className="bg-white p-4 rounded-xl border shadow-sm">
        <h1 className="text-[20px] font-extrabold tracking-tight">
          Kontrol Akses Per Outlet
        </h1>
        <p className="text-[11px] text-slate-500 mt-1">
          Pilih outlet di bawah, atur hak kasir beda-beda per outlet!
        </p>

        <div className="mt-4">
          <label className="text-[11px] font-bold uppercase">
            PILIH OUTLET (Filter Aktif):
          </label>
          <select
            value={selectedOutletId}
            onChange={(e) => setSelectedOutletId(e.target.value)}
            className="mt-1 w-full border rounded-lg px-3 py-2.5 text-[13px] font-bold bg-slate-50"
          >
            <option value="">-- Pilih Outlet --</option>
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} - {o.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </div>

        {selectedOutletId && (
          <div className="mt-3 p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
            <p className="text-[10px] text-emerald-700 font-bold">
              FILTER AKTIF: {selectedOutletName.toUpperCase()} - ID:{" "}
              {selectedOutletId.slice(0, 8)}...
            </p>
            <p className="text-[10px] text-slate-500">
              Setting di bawah hanya untuk outlet ini, bukan global!
            </p>
          </div>
        )}
      </div>

      {loading ? (
        <div className="p-10 text-center bg-white rounded-xl border">
          Loading akses {selectedOutletName}...
        </div>
      ) : !selectedOutletId ? (
        <div className="p-10 text-center border rounded-xl bg-white">
          Pilih outlet di atas dulu owy!
        </div>
      ) : (
        <>
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <p className="font-extrabold uppercase text-[12px] mb-3 tracking-wider">
              CASHIER @ {selectedOutletName.toUpperCase()} -{" "}
              {Object.values(config).filter(Boolean).length} AKTIF
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {Object.entries(ALL_PERMS).map(([label, perm]) => (
                <label
                  key={perm}
                  className="flex items-center justify-between text-[11px] border border-slate-100 rounded-lg px-3 py-2.5 hover:bg-slate-50 cursor-pointer"
                >
                  <span className="font-medium">
                    {label} <br />
                    <span className="text-[9px] text-slate-400">{perm}</span>
                  </span>
                  <Switch
                    checked={!!config[perm]}
                    onCheckedChange={() => toggle(perm)}
                  />
                </label>
              ))}
            </div>
          </div>

          <button
            onClick={save}
            disabled={saving}
            className="bg-slate-900 text-white px-6 py-3 rounded-xl text-[12px] font-bold w-full shadow hover:bg-black disabled:opacity-50"
          >
            {saving ? "Menyimpan..." : `Simpan Akses untuk ${selectedOutletName}`}
          </button>

          <p className="text-[10px] text-slate-400">
            Catatan: Ini per outlet! CS Qasir 01 beda dengan CS Qasir 02. Owner
            siagas981@gmail.com selalu full akses.
          </p>
        </>
      )}
    </div>
  );
}
