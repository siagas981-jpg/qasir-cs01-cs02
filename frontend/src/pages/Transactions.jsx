import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";

export default function Transactions() {
  const { activeOutletId } = useAuth();
  const [tab, setTab] = useState("transfer"); // transfer | bank

  const { data: transfer = [], refetch: refTransfer } = useQuery({
  queryKey: ["riwayat-transfer-laci-final", activeOutletId],
  enabled: !!activeOutletId,
  queryFn: async () => {
    console.log("ACTIVE OUTLET ID:", activeOutletId);
    const { data, error } = await supabase.from("transfer_laci").select("*").eq("outlet_id", activeOutletId).order("created_at", { ascending: false }).limit(100);
    if(error) {
      console.error("ERROR transfer_laci:", error);
      return [];
    }
    console.log("HASIL transfer_laci:", data);
    return data || [];
  }
});

  const { data: bankTx = [], refetch: refBank } = useQuery({
    queryKey: ["bank-transactions-history", activeOutletId],
    enabled: !!activeOutletId,
    queryFn: async () => {
      const { data } = await supabase.from("bank_transactions").select("*, laci:laci_id(nama, kode)").eq("outlet_id", activeOutletId).order("created_at", { ascending: false }).limit(100);
      return data || [];
    }
  });

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <button onClick={() => setTab("transfer")} className={`px-4 py-2 rounded-full text-xs font-bold ${tab==="transfer" ? "bg-slate-900 text-white" : "bg-white border"}`}>Riwayat Transfer Antar Laci ({transfer.length})</button>
          <button onClick={() => setTab("bank")} className={`px-4 py-2 rounded-full text-xs font-bold ${tab==="bank" ? "bg-emerald-600 text-white" : "bg-white border"}`}>Riwayat Transaksi Bank ({bankTx.length})</button>
        </div>
        <button onClick={() => { refTransfer(); refBank(); }} className="px-3 py-1.5 bg-white border rounded text-xs">Refresh</button>
      </div>

      {tab === "transfer" ? (
        <div className="bg-white rounded-xl border divide-y">
          {transfer.map((t) => (
            <div key={t.id} className="p-3 flex justify-between text-xs">
              <div><b>{t.dari_nama} → {t.ke_nama}</b><div className="text-[11px] text-slate-500">{new Date(t.created_at).toLocaleString("id-ID")} • {t.kasir_email}</div></div>
              <div className="font-black">Rp {Number(t.jumlah).toLocaleString()}</div>
            </div>
          ))}
          {transfer.length===0 && <div className="p-10 text-center text-xs text-slate-400">Belum ada transfer</div>}
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="grid grid-cols-12 gap-2 p-3 bg-slate-50 text-[10px] font-black uppercase text-slate-500">
            <div className="col-span-3">Tanggal</div><div className="col-span-2">Bank</div><div className="col-span-2">Tipe</div><div className="col-span-2">Jumlah</div><div className="col-span-3">Keterangan / Kasir</div>
          </div>
          <div className="divide-y">
            {bankTx.map((b) => (
              <div key={b.id} className="grid grid-cols-12 gap-2 p-3 text-xs items-center">
                <div className="col-span-3 text-[11px]">{new Date(b.created_at).toLocaleString("id-ID")}<div className="text-[10px] text-slate-400">{b.shift}</div></div>
                <div className="col-span-2 font-bold">{b.laci?.nama || b.laci_id.slice(0,6)}</div>
                <div className="col-span-2"><span className={`px-2 py-1 rounded-full text-[10px] font-bold ${b.tipe==="masuk" ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>{b.tipe.toUpperCase()}</span></div>
                <div className="col-span-2 font-black">Rp {Number(b.jumlah).toLocaleString()}</div>
                <div className="col-span-3"><div className="truncate">{b.keterangan}</div><div className="text-[10px] text-slate-400 truncate">{b.kasir_email}</div></div>
              </div>
            ))}
            {bankTx.length===0 && <div className="p-10 text-center text-xs text-slate-400">Belum ada transaksi bank</div>}
          </div>
        </div>
      )}
    </div>
  );
}
