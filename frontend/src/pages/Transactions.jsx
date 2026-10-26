import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";

export default function Transactions() {
  const { data = [], refetch, isLoading } = useQuery({
    queryKey: ["riwayat-transfer-laci-final"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transfer_laci")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="p-4">
      <div className="bg-white rounded-xl shadow p-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-bold text-lg">Riwayat Transfer Antar Laci ({data.length}×)</h2>
          <button onClick={() => refetch()} className="px-3 py-1 border rounded text-sm">Refresh</button>
        </div>

        {isLoading && <p>Loading...</p>}
        
        <div className="space-y-2">
          {data.map((t) => (
            <div key={t.id} className="flex justify-between items-center border-b py-3">
              <div>
                <div className="font-semibold text-sm">{t.dari_nama} → {t.ke_nama}</div>
                <div className="text-xs text-gray-500">
                  {new Date(t.created_at).toLocaleString("id-ID")} • {t.kasir_email}
                </div>
              </div>
              <div className="font-bold text-sm">
                Rp {Number(t.jumlah).toLocaleString("id-ID")}
              </div>
            </div>
          ))}
        </div>

        {data.length === 0 && <p className="text-center text-gray-400 py-10">Belum ada riwayat</p>}
      </div>
    </div>
  );
}
