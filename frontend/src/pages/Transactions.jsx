import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { rupiah } from "@/lib/format";

export default function Transactions() {
  const { data: transfers = [], refetch, isLoading } = useQuery({
    queryKey: ["transfer-laci-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transfer_laci")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    }
  });

  return (
    <div className="p-4 space-y-4">
      <div className="bg-white rounded-lg p-4 shadow">
        <div className="flex justify-between items-center mb-3">
          <h3 className="font-bold">Riwayat Transfer Antar Laci ({transfers.length}×)</h3>
          <button onClick={() => refetch()} className="border px-3 py-1 rounded text-sm">Refresh</button>
        </div>
        {isLoading ? <p>Loading...</p> : transfers.map(t => (
          <div key={t.id} className="flex justify-between py-2 border-b text-sm">
            <div>
              <div className="font-medium">{t.dari_nama} → {t.ke_nama}</div>
              <div className="text-xs text-gray-400">{new Date(t.created_at).toLocaleString('id-ID')}</div>
            </div>
            <div className="font-bold">{rupiah(t.jumlah)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
