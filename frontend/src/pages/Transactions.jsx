import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { rupiah } from "@/lib/format";

export default function Transactions({ outletId }) {
  
  // FIX FINAL - TANPA FILTER outlet_id, TANPA RLS
  const { data: riwayatTransfer = [], refetch } = useQuery({
    queryKey: ["riwayat-transfer-all-fix"],
    queryFn: async () => {
      console.log("FETCH transfer_laci ALL...");
      const { data, error } = await supabase
        .from("transfer_laci")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      
      if (error) {
        console.error("GAGAL FETCH transfer_laci:", error);
        alert("GAGAL FETCH: " + error.message);
        return [];
      }
      console.log("BERHASIL FETCH:", data);
      return data || [];
    },
  });

  const formatWita = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('id-ID', {
      timeZone: 'Asia/Makassar',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }) + ' WITA';
  };

  return (
    <div className="p-3 space-y-4">
      <div className="border rounded-lg p-3 bg-white">
        <div className="flex justify-between items-center mb-2">
          <p className="font-bold text-[13px]">Riwayat Transfer Antar Laci - FIX ({riwayatTransfer.length}x)</p>
          <button onClick={() => refetch()} className="border px-2 py-1 text-[11px] rounded">Refresh</button>
        </div>

        <div className="space-y-1 max-h-[500px] overflow-auto">
          {riwayatTransfer.length === 0 && (
            <p className="text-[11px] text-slate-400 py-6 text-center">Belum ada riwayat transfer.</p>
          )}
          
          {riwayatTransfer.map((r) => (
            <div key={r.id} className="flex justify-between items-center text-[11px] border-b py-2">
              <div className="flex flex-col">
                <span className="font-bold text-[12px]">
                  {r.dari_nama || r.dari_laci_id?.slice(0,8)} → {r.ke_nama || r.ke_laci_id?.slice(0,8)}
                </span>
                <span className="text-[10px] text-slate-500">
                  {formatWita(r.created_at)} • {r.keterangan || r.jumlah}
                </span>
                <span className="text-[9px] text-slate-400">
                  ID: {r.id?.slice(0,8)} | Outlet: {r.outlet_id?.slice(0,8)}
                </span>
              </div>
              <span className="font-black text-[12px]">{rupiah(r.jumlah)}</span>
            </div>
          ))}
        </div>

        <div className="mt-3 p-2 bg-slate-50 rounded text-[10px]">
          <p className="font-bold">DEBUG:</p>
          <p>Total data: {riwayatTransfer.length}</p>
          <p>Query: SELECT * FROM transfer_laci ORDER BY created_at DESC LIMIT 100</p>
          <p>Tanpa filter outlet_id - semua outlet muncul</p>
        </div>
      </div>
    </div>
  );
}
