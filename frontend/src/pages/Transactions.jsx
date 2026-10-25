import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { rupiah } from "@/lib/format";
import { useState } from "react";

function formatWita(utcDate) {
  if (!utcDate) return "-";
  return new Date(utcDate).toLocaleString("id-ID", {
    timeZone: "Asia/Makassar",
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function getWitaRange(filter) {
  if (filter === "Semua Waktu") return null;
  
  // FIX JAM - pakai string WITA yang pasti
  const witaDateStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Makassar" }); // YYYY-MM-DD di Makassar
  let startWitaStr, endWitaStr;

  if (filter === "Hari Ini") {
    startWitaStr = `${witaDateStr}T00:00:00+08:00`;
    endWitaStr = `${witaDateStr}T23:59:59.999+08:00`;
  } else if (filter === "Kemarin") {
    const kemarin = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Makassar" }));
    kemarin.setDate(kemarin.getDate() - 1);
    const kemarinStr = kemarin.toLocaleDateString("en-CA", { timeZone: "Asia/Makassar" });
    startWitaStr = `${kemarinStr}T00:00:00+08:00`;
    endWitaStr = `${kemarinStr}T23:59:59.999+08:00`;
  } else return null;

  return {
    startUTC: new Date(startWitaStr).toISOString(),
    endUTC: new Date(endWitaStr).toISOString(),
  };
}

export default function Transactions() {
  const [dateFilter, setDateFilter] = useState("Hari Ini");

  const { data: riwayatBank = [] } = useQuery({
    queryKey: ["riwayat-bank", dateFilter],
    queryFn: async () => {
      let q = supabase.from("laci_mutasi").select("*").order("created_at", { ascending: false }).limit(300);
      const range = getWitaRange(dateFilter);
      if (range) q = q.gte("created_at", range.startUTC).lte("created_at", range.endUTC);
      const { data, error } = await q;
      if (error) { console.log(error); return []; }
      return data || [];
    },
  });

  // MASTER LACI untuk translate UUID jadi nama
  const { data: masterLaci = [] } = useQuery({
    queryKey: ["master-laci"],
    queryFn: async () => {
      const { data } = await supabase.from("laci").select("id,nama");
      return data || [];
    }
  });

    const { data: riwayatLaci = [] } = useQuery({
    queryKey: ["riwayat-laci", dateFilter, masterLaci.length],
    queryFn: async () => {
      const range = getWitaRange(dateFilter);
      
      let q1 = supabase.from("laci_transfer").select("*").order("created_at", { ascending: false }).limit(300);
      if (range) q1 = q1.gte("created_at", range.startUTC).lte("created_at", range.endUTC);
      const { data: d1 } = await q1;

      let q2 = supabase.from("transfer_laci").select("*").order("created_at", { ascending: false }).limit(300);
      if (range) q2 = q2.gte("created_at", range.startUTC).lte("created_at", range.endUTC);
      const { data: d2 } = await q2;

      const all = [...(d1||[]), ...(d2||[])];
      
      return all.map(r => {
        const dariId = r.dari_laci_id;
        const keId = r.ke_laci_id;
        const dariMaster = masterLaci.find(l => l.id === dariId)?.nama;
        const keMaster = masterLaci.find(l => l.id === keId)?.nama;
        return {
          ...r,
          dari_nama: r.dari_nama || dariMaster || "Laci",
          ke_nama: r.ke_nama || keMaster || "Laci",
        };
      }).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));
    },
  });

  const totalMasuk = riwayatBank.filter(r => r.tipe === "masuk" || r.tipe === "bank_masuk").reduce((a,b) => a + Number(b.jumlah||0), 0);
  const totalKeluar = riwayatBank.filter(r => r.tipe === "keluar" || r.tipe === "bank_keluar").reduce((a,b) => a + Number(b.jumlah||0), 0);

  return (
    <div className="p-4 space-y-4">
      <div className="flex gap-2 items-center">
        <span>Filter:</span>
        <select value={dateFilter} onChange={e=>setDateFilter(e.target.value)} className="border rounded px-2 py-1">
          <option>Hari Ini</option>
          <option>Kemarin</option>
          <option>Semua Waktu</option>
        </select>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <div className="border rounded p-3 bg-white"><p className="text-[10px]">Total Bank Masuk (Filter)</p><p className="font-bold text-green-600">{rupiah(totalMasuk)}</p></div>
        <div className="border rounded p-3 bg-white"><p className="text-[10px]">Total Bank Keluar (Filter)</p><p className="font-bold text-red-600">{rupiah(totalKeluar)}</p></div>
        <div className="border rounded p-3 bg-white"><p className="text-[10px]">Jumlah Transaksi Bank</p><p className="font-bold">{riwayatBank.length}</p></div>
        <div className="border rounded p-3 bg-white"><p className="text-[10px]">Transfer Laci</p><p className="font-bold">{riwayatLaci.length} x</p></div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="border rounded bg-white p-3">
          <p className="font-bold text-sm mb-2">Riwayat Bank - dari laci_mutasi (WITA)</p>
          <div className="space-y-1 max-h-[500px] overflow-auto text-[11px]">
            {riwayatBank.map(r => (
              <div key={r.id} className="flex justify-between border-b py-1">
                <div>
                  <p className="font-mono text-[10px]">{formatWita(r.created_at)} WITA</p>
                  <p className="text-[10px] text-slate-500 truncate w-[200px]">{r.keterangan}</p>
                </div>
                <div className="text-right">
                  <p className={r.tipe?.includes("keluar") ? "text-red-600 font-bold" : "text-green-600 font-bold"}>{r.tipe}</p>
                  <p className="font-black">{rupiah(r.jumlah)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border rounded bg-white p-3">
          <p className="font-bold text-sm mb-2">Riwayat Transfer Antar Laci - WITA FIX</p>
          <div className="space-y-1 max-h-[500px] overflow-auto text-[11px]">
            {riwayatLaci.map(r => (
              <div key={r.id} className="flex justify-between border-b py-1.5">
                <div>
                  <p className="font-mono text-[10px]">{formatWita(r.created_at)} WITA</p>
                  <p className="font-bold">{r.dari_nama} → {r.ke_nama}</p>
                  <p className="text-[9px] text-slate-400">{r.keterangan} • {r.kasir_email}</p>
                </div>
                <p className="font-black">{rupiah(r.jumlah)}</p>
              </div>
            ))}
            {riwayatLaci.length===0 && <p className="text-center text-slate-400 py-4">Belum ada data</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
