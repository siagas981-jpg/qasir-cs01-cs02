import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { rupiah } from "@/lib/format";
import { useState } from "react";

function formatWita(utcDate) {
  if (!utcDate) return "-";
  let s = String(utcDate).replace(" ", "T");
  if (!s.endsWith("Z") && !s.includes("+")) s += "Z";
  return new Date(s).toLocaleString("id-ID", {
    timeZone: "Asia/Makassar",
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  });
}

function getWitaRange(filter) {
  if (filter === "Semua Waktu") return null;
  const witaDateStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Makassar" });
  if (filter === "Hari Ini") {
    return {
      startUTC: new Date(`${witaDateStr}T00:00:00+08:00`).toISOString(),
      endUTC: new Date(`${witaDateStr}T23:59:59.999+08:00`).toISOString(),
    };
  }
  if (filter === "Kemarin") {
    const kemarin = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Makassar" }));
    kemarin.setDate(kemarin.getDate() - 1);
    const kemarinStr = kemarin.toLocaleDateString("en-CA", { timeZone: "Asia/Makassar" });
    return {
      startUTC: new Date(`${kemarinStr}T00:00:00+08:00`).toISOString(),
      endUTC: new Date(`${kemarinStr}T23:59:59.999+08:00`).toISOString(),
    };
  }
  return null;
}

export default function Transactions() {
  const [dateFilter, setDateFilter] = useState("Semua Waktu");

  const { data: riwayatBank = [] } = useQuery({
    queryKey: ["riwayat-bank", dateFilter],
    queryFn: async () => {
      let q = supabase.from("laci_mutasi").select("*").order("created_at", { ascending: false }).limit(300);
      const range = getWitaRange(dateFilter);
      if (range) q = q.gte("created_at", range.startUTC).lte("created_at", range.endUTC);
      const { data } = await q;
      return data || [];
    },
  });

  const { data: masterLaci = [] } = useQuery({
    queryKey: ["master-laci"],
    queryFn: async () => {
      const { data } = await supabase.from("laci").select("id,nama,outlet_id");
      return data || [];
    }
  });

  // FIX FINAL - TANPA FILTER OUTLET_ID, TANPA FILTER TANGGAL
  const { data: riwayatLaci = [] } = useQuery({
    queryKey: ["riwayat-laci-wita-fix"],
    queryFn: async () => {
      const { data, error } = await supabase.from("transfer_laci").select("*").order("created_at", { ascending: false }).limit(100);
      if (error) {
        console.error(error);
        return [];
      }
      return (data || []).map(r => ({
        ...r,
        dari_nama: r.dari_nama || masterLaci.find(l => l.id === r.dari_laci_id)?.nama || "Laci",
        ke_nama: r.ke_nama || masterLaci.find(l => l.id === r.ke_laci_id)?.nama || "Laci",
      }));
    },
  });

  const totalMasuk = riwayatBank.filter(r => r.tipe?.includes("masuk")).reduce((a,b) => a + Number(b.jumlah||0), 0);
  const totalKeluar = riwayatBank.filter(r => r.tipe?.includes("keluar")).reduce((a,b) => a + Number(b.jumlah||0), 0);

  return (
    <div className="p-4 space-y-4">
      <div className="flex gap-2 items-center">
        <span>Filter Bank:</span>
        <select value={dateFilter} onChange={e=>setDateFilter(e.target.value)} className="border rounded px-2 py-1">
          <option>Hari Ini</option>
          <option>Kemarin</option>
          <option>Semua Waktu</option>
        </select>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <div className="border rounded p-3 bg-white"><p className="text-[10px]">Total Bank Masuk</p><p className="font-bold text-green-600">{rupiah(totalMasuk)}</p></div>
        <div className="border rounded p-3 bg-white"><p className="text-[10px]">Total Bank Keluar</p><p className="font-bold text-red-600">{rupiah(totalKeluar)}</p></div>
        <div className="border rounded p-3 bg-white"><p className="text-[10px]">Jumlah Bank</p><p className="font-bold">{riwayatBank.length}</p></div>
        <div className="border rounded p-3 bg-white"><p className="text-[10px]">Transfer Laci</p><p className="font-bold text-blue-600">{riwayatLaci.length} x</p></div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="border rounded bg-white p-3">
          <p className="font-bold text-sm mb-2">Riwayat Bank</p>
          <div className="space-y-1 max-h-[500px] overflow-auto text-[11px]">
            {riwayatBank.map(r => (
              <div key={r.id} className="flex justify-between border-b py-1">
                <div><p className="font-mono text-[10px]">{formatWita(r.created_at)} WITA</p><p className="text-[10px] truncate w-[200px]">{r.keterangan}</p></div>
                <div className="text-right"><p className={r.tipe?.includes("keluar") ? "text-red-600 font-bold" : "text-green-600 font-bold"}>{r.tipe}</p><p className="font-black">{rupiah(r.jumlah)}</p></div>
              </div>
            ))}
          </div>
        </div>
        <div className="border rounded bg-white p-3">
          <p className="font-bold text-sm mb-2">Riwayat Transfer Antar Laci - FIX</p>
          <div className="space-y-1 max-h-[500px] overflow-auto text-[11px]">
            {riwayatLaci.map(r => (
              <div key={r.id} className="flex justify-between border-b py-1.5">
                <div><p className="font-mono text-[10px]">{formatWita(r.created_at)} WITA</p><p className="font-bold">{r.dari_nama} → {r.ke_nama}</p></div>
                <p className="font-black">{rupiah(r.jumlah)}</p>
              </div>
            ))}
            {riwayatLaci.length===0 && <p className="text-center text-slate-400 py-10">Belum ada data<br/>Cek F12 Console</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
