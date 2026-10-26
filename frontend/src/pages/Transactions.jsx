import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { rupiah } from "@/lib/format";

export default function Transactions({ outletId }) {

  // FIX FINAL - INI YANG BIKIN (3x) JADI (4x) (5x) OTOMATIS
  const { data: riwayatTransfer = [], refetch: refetchTransfer } = useQuery({
    queryKey: ["riwayat-transfer", outletId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transfer_laci")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) {
        console.log("TRANSFER ERROR:", error);
        return [];
      }
      return data || [];
    },
  });

  const { data: riwayatBank = [], refetch: refetchBank } = useQuery({
    queryKey: ["riwayat-bank", outletId],
    queryFn: async () => {
      try {
        const { data: bank, error } = await supabase.from("transaksi_bank").select("*").order("created_at", { ascending: false }).limit(100);
        if (bank && bank.length > 0) return bank;
        if (error && bank) return bank;
      } catch (e) {
        console.log("BANK TABLE BELUM ADA");
      }
      try {
        const { data: trx } = await supabase.from("transaksi").select("*").order("created_at", { ascending: false }).limit(100);
        return (trx || []).filter((t) => t.bank || t.jenis === "BANK" || t.metode === "BANK");
      } catch {
        return [];
      }
    },
  });

  const formatWita = (row) => {
    if (!row?.created_at) return "-";
    return new Date(row.created_at).toLocaleString("id-ID", {
      timeZone: "Asia/Makassar",
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }) + " WITA";
  };

  return (
    <div className="space-y-4 p-3">
      {/* RIWAYAT TRANSFER LACI */}
      <div className="border rounded-lg p-3 bg-white">
        <div className="flex justify-between items-center mb-2">
          <p className="font-bold text-[12px]">Riwayat Transfer Antar Laci ({riwayatTransfer.length}x)</p>
          <button onClick={() => refetchTransfer()} className="border rounded px-2 py-1 text-[10px]">Refresh</button>
        </div>
        <div className="space-y-1 max-h-[400px] overflow-auto">
          {riwayatTransfer.length === 0 && <p className="text-[11px] text-slate-400">Belum ada transfer</p>}
          {riwayatTransfer.map((r) => (
            <div key={r.id} className="flex justify-between items-center text-[11px] border-b py-1.5">
              <div className="flex flex-col">
                <span className="font-semibold">{r.dari_nama} → {r.ke_nama}</span>
                <span className="text-[9px] text-slate-400">{formatWita(r)}</span>
              </div>
              <span className="font-black">{rupiah(r.jumlah)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* RIWAYAT BANK - biar tidak error */}
      <div className="border rounded-lg p-3 bg-white">
        <p className="font-bold text-[12px] mb-2">Riwayat Bank ({riwayatBank.length}x)</p>
      </div>
    </div>
  );
}
