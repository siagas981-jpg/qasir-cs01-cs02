import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { rupiah } from "@/lib/format";
import { useEffect } from "react";

export default function Transactions({ outletId }) {
  
  const { data: riwayatTransfer = [], refetch: refetchTransfer } = useQuery({
    queryKey: ["riwayat-transfer", outletId],
    queryFn: async () => {
      // AMBIL SEMUA DULU, TIDAK USAH FILTER OUTLET BIAR PASTI MUNCUL
      const { data, error } = await supabase.from("transfer_laci").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) {
        console.log("TRANSFER ERROR:", error);
        return [];
      }
      console.log("TRANSFER OK:", data?.length, "rows");
      return data || [];
    },
  });

  const { data: riwayatBank = [], refetch: refetchBank } = useQuery({
    queryKey: ["riwayat-bank", outletId],
    queryFn: async () => {
      // COBA transaksi_bank DULU
      try {
        const { data: bank, error } = await supabase.from("transaksi_bank").select("*").order("created_at", { ascending: false }).limit(100);
        if (!error && bank && bank.length > 0) return bank;
        if (!error && bank) return bank;
      } catch (e) {
        console.log("BANK TABLE BELUM ADA");
      }
      // KALAU transaksi_bank KOSONG / TIDAK ADA, COBA DARI TABEL transaksi
      try {
        const { data: trx } = await supabase.from("transaksi").select("*").order("created_at", { ascending: false }).limit(100);
        // filter yang ada bank-nya saja
        return (trx || []).filter(t => t.bank || t.jenis === 'BANK' || t.metode === 'BANK');
      } catch (e) {
        return [];
      }
    },
  });

  // REALTIME - AUTO REFRESH KALAU ADA TRANSFER BARU
  useEffect(() => {
    const channel = supabase
      .channel('transactions-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transfer_laci' }, () => {
        refetchTransfer();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'transaksi_bank' }, () => {
        refetchBank();
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [refetchTransfer, refetchBank]);

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
          <p className="font-bold text-[13px]">Riwayat Transfer Antar Laci ({riwayatTransfer.length}x)</p>
          <button onClick={() => refetchTransfer()} className="border px-2 py-1 text-[11px] rounded">Refresh</button>
        </div>
        <div className="space-y-1 max-h-[350px] overflow-auto">
          {riwayatTransfer.length === 0 && <p className="text-[11px] text-slate-400 py-4 text-center">Belum ada transfer antar laci.</p>}
          {riwayatTransfer.map((r) => (
            <div key={r.id} className="flex justify-between items-center text-[11px] border-b py-2">
              <div className="flex flex-col">
                <span className="font-bold text-[12px]">{r.dari_nama} → {r.ke_nama}</span>
                <span className="text-[10px] text-slate-500">{formatWita(r.created_at)} • {r.keterangan}</span>
              </div>
              <span className="font-black text-[12px]">{rupiah(r.jumlah)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="border rounded-lg p-3 bg-white">
        <div className="flex justify-between items-center mb-2">
          <p className="font-bold text-[13px]">Riwayat Transaksi Bank ({riwayatBank.length}x)</p>
          <button onClick={() => refetchBank()} className="border px-2 py-1 text-[11px] rounded">Refresh</button>
        </div>
        <div className="space-y-1 max-h-[350px] overflow-auto">
          {riwayatBank.length === 0 && <p className="text-[11px] text-slate-400 py-4 text-center">Belum ada transaksi bank.</p>}
          {riwayatBank.map((r) => (
            <div key={r.id} className="flex justify-between items-center text-[11px] border-b py-2">
              <div className="flex flex-col">
                <span className="font-bold text-[12px]">{r.keterangan || r.jenis || r.bank || 'Transaksi Bank'}</span>
                <span className="text-[10px] text-slate-500">{formatWita(r.created_at)}</span>
              </div>
              <span className="font-black text-[12px]">{rupiah(r.jumlah || r.nominal || r.total || 0)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
