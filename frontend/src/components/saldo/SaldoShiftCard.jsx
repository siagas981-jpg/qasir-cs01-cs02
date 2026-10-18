import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";

async function fetchAllLaci(outletId) {
  // AMBIL SEMUA LACI AKTIF, TANPA FILTER TYPE! JADI OTOMATIS!
  const { data, error } = await supabase
    .from("laci") // ganti jadi "drawers" kalau nama table mu drawers
    .select("*")
    .eq("outlet_id", outletId)
    .eq("is_active", true)
    .order("code", { ascending: true }); // LACI_1, LACI_2, LACI_5, LACI_6 GOPAY, dll urut

  if (error) throw error;
  return data;
}

export default function SaldoShiftCard() {
  const { activeOutletId } = useAuth();
  const { data: lacis = [], isLoading } = useQuery({
    queryKey: ["laci-kasir", activeOutletId],
    queryFn: () => fetchAllLaci(activeOutletId),
    enabled: !!activeOutletId,
  });

  if (isLoading) return <p className="p-4">Memuat laci...</p>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-bold">Laci ({lacis.length})</h2>
        {/* TOMBOL TRANSFER MUNCUL SELALU, UNTUK KARYAWAN JUGA */}
        <div className="flex gap-2">
          <button className="bg-blue-600 text-white px-3 py-1 rounded-lg text-sm">Transfer Laci 1 ↔ 2</button>
          <button className="bg-black text-white px-3 py-1 rounded-lg text-sm">+ Tambah</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {lacis.map((laci) => (
          <div key={laci.id} className="border rounded-xl p-4 bg-white">
            <p className="text-[10px] uppercase text-slate-500">{laci.code} • {laci.type}</p>
            <p className="font-bold">{laci.name}</p>
            <p className="text-xl font-extrabold mt-1">Rp {Number(laci.balance || 0).toLocaleString("id-ID")}</p>
            {laci.type === "BANK" && laci.details && (
              <p className="text-[11px] text-green-600 mt-1">Total {Object.keys(laci.details).join("+")} (Auto)</p>
            )}
            <button className="text-xs text-blue-600 mt-2">👉 Klik untuk input manual 1x hari ini</button>
          </div>
        ))}
      </div>

      {/* RINCIAN SALDO OTOMATIS - JIKA ADA */}
      {lacis.find(l => l.code === "LACI_5") && (
        <div className="mt-4">
          <p className="text-xs text-slate-500 mb-2">RINCIAN SALDO PER BANK (OTOMATIS):</p>
          <div className="grid gap-2">
            {/* Ini ambil dari transactions otomatis, bukan hardcode */}
            {lacis.filter(l => l.type === "BANK").map(l => (
              <div key={l.id} className="flex justify-between border rounded-lg px-3 py-2 bg-slate-50 text-sm">
                <span>{l.name}</span>
                <span className="font-bold">Rp {Number(l.balance).toLocaleString("id-ID")}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
