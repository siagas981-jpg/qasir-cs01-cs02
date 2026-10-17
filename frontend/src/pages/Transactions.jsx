import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Calendar } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { rupiah, dateTime } from "@/lib/format";

async function fetchTx(outletId, dateFilter) {
  let q = supabase.from("transactions").select("*, outlets(name), transaction_items(*)").order("created_at", { ascending: false }).limit(200);
  if (outletId !== "all") q = q.eq("outlet_id", outletId);

  // === FILTER TANGGAL / BULAN / TAHUN ===
  if (dateFilter) {
    const { type, start, end, month, year } = dateFilter;
    const now = new Date();
    
    if (type === "hari_ini") {
      const t = new Date().toISOString().split('T')[0];
      q = q.gte("created_at", `${t}T00:00:00`).lte("created_at", `${t}T23:59:59`);
    } else if (type === "kemarin") {
      const d = new Date(); d.setDate(d.getDate() - 1);
      const t = d.toISOString().split('T')[0];
      q = q.gte("created_at", `${t}T00:00:00`).lte("created_at", `${t}T23:59:59`);
    } else if (type === "bulan_ini" || (type === "bulan" && month && year)) {
      const m = month ? month - 1 : now.getMonth();
      const y = year || now.getFullYear();
      const first = new Date(y, m, 1).toISOString();
      const last = new Date(y, m + 1, 0, 23, 59, 59).toISOString();
      q = q.gte("created_at", first).lte("created_at", last);
    } else if (type === "tahun_ini" || (type === "tahun" && year)) {
      const y = year || now.getFullYear();
      const first = new Date(y, 0, 1).toISOString();
      const last = new Date(y, 11, 31, 23, 59, 59).toISOString();
      q = q.gte("created_at", first).lte("created_at", last);
    } else if (type === "custom" && start && end) {
      q = q.gte("created_at", `${start}T00:00:00`).lte("created_at", `${end}T23:59:59`);
    }
  }

  const { data, error } = await q;
  if (error) throw error;
  return data;
}

function TxRow({ tx }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b last:border-b-0">
      <button onClick={() => setOpen(!open)} className="w-full grid grid-cols-12 items-center gap-2 px-4 py-3 text-left hover:bg-slate-50">
        <span className="col-span-5 sm:col-span-3 text-sm">{dateTime(tx.created_at)}</span>
        <span className="hidden sm:block col-span-3 text-sm text-slate-600 truncate">{tx.outlets?.name}</span>
        <span className="hidden sm:block col-span-2 text-xs font-mono text-slate-400">#{tx.id.slice(0, 8)}</span>
        <span className="col-span-6 sm:col-span-3 text-right font-mono font-bold">{rupiah(tx.total)}</span>
        <ChevronDown className={`col-span-1 h-4 w-4 justify-self-end transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 text-sm">
          {tx.transaction_items.map((i) => (
            <div key={i.id} className="flex justify-between py-1"><span>{i.qty} × {i.product_name} <span className="text-slate-400 font-mono">@ {rupiah(i.price_each)}</span></span><span className="font-mono">{rupiah(i.qty * i.price_each)}</span></div>
          ))}
          <div className="flex justify-between pt-2 mt-2 border-t text-slate-600"><span>Dibayar {rupiah(tx.paid)}</span><span>Kembalian {rupiah(tx.change)}</span></div>
        </div>
      )}
    </div>
  );
}

export default function Transactions() {
  const { isOwner, outlets, activeOutletId } = useAuth();
  const [outletFilter, setOutletFilter] = useState(isOwner ? "all" : activeOutletId);
  
  // === STATE FILTER BARU ===
  const [period, setPeriod] = useState("semua");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [filterMonth, setFilterMonth] = useState(String(new Date().getMonth() + 1));
  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()));

  const dateFilter = (() => {
    if (period === "semua") return null;
    if (period === "custom") return { type: "custom", start: customStart, end: customEnd };
    if (period === "bulan") return { type: "bulan", month: Number(filterMonth), year: Number(filterYear) };
    if (period === "tahun") return { type: "tahun", year: Number(filterYear) };
    return { type: period };
  })();

  const { data = [], isLoading, error } = useQuery({ 
    queryKey: ["transactions", outletFilter, dateFilter], 
    queryFn: () => fetchTx(outletFilter, dateFilter), 
    enabled: !!outletFilter 
  });

  const today = new Date().toDateString();
  const todays = data.filter((t) => new Date(t.created_at).toDateString() === today);
  const totalFiltered = data.reduce((s, t) => s + t.total, 0);

  const months = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
  const years = Array.from({length: 5}, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Riwayat</p>
          <h1 className="font-heading text-3xl sm:text-4xl font-extrabold tracking-tight">Transaksi</h1>
        </div>
        {isOwner && (
          <Select value={outletFilter} onValueChange={setOutletFilter}>
            <SelectTrigger className="w-[200px] bg-white"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua outlet</SelectItem>
              {outlets.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* === BAR FILTER BARU - TGL/BLN/THN === */}
      <div className="rounded-xl border bg-white p-4 mb-6 flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 text-sm font-semibold"><Calendar className="h-4 w-4"/> Filter:</div>
        
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Periode"/></SelectTrigger>
          <SelectContent>
            <SelectItem value="semua">Semua Waktu</SelectItem>
            <SelectItem value="hari_ini">Hari Ini</SelectItem>
            <SelectItem value="kemarin">Kemarin</SelectItem>
            <SelectItem value="bulan_ini">Bulan Ini</SelectItem>
            <SelectItem value="tahun_ini">Tahun Ini</SelectItem>
            <SelectItem value="bulan">Pilih Bulan</SelectItem>
            <SelectItem value="tahun">Pilih Tahun</SelectItem>
            <SelectItem value="custom">Custom Tanggal</SelectItem>
          </SelectContent>
        </Select>

        {period === "bulan" && (
          <>
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="w-[140px]"><SelectValue/></SelectTrigger>
              <SelectContent>{months.map((m,i) => <SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="w-[100px]"><SelectValue/></SelectTrigger>
              <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
            </Select>
          </>
        )}

        {period === "tahun" && (
          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger className="w-[100px]"><SelectValue/></SelectTrigger>
            <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
        )}

        {period === "custom" && (
          <>
            <input type="date" value={customStart} onChange={e=>setCustomStart(e.target.value)} className="border rounded-md px-3 py-2 text-sm"/>
            <span className="text-sm">s/d</span>
            <input type="date" value={customEnd} onChange={e=>setCustomEnd(e.target.value)} className="border rounded-md px-3 py-2 text-sm"/>
          </>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl border bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total {period === "semua" ? "Semua" : "Filter"} </p><p className="font-mono text-2xl font-extrabold text-emerald-700 mt-1">{rupiah(totalFiltered)}</p></div>
        <div className="rounded-xl border bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Jumlah Transaksi</p><p className="font-mono text-2xl font-extrabold mt-1">{data.length}</p></div>
        <div className="rounded-xl border bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Penjualan Hari Ini</p><p className="font-mono text-xl font-extrabold mt-1">{rupiah(todays.reduce((s,t)=>s+t.total,0))} ({todays.length})</p></div>
      </div>

      <div className="rounded-xl border bg-white">
        {isLoading && <p className="p-4 text-sm text-muted-foreground">Memuat…</p>}
        {error && <p className="p-4 text-sm text-rose-600">{error.message}</p>}
        {!isLoading && data.length === 0 && <p className="p-4 text-sm text-muted-foreground">Belum ada transaksi untuk filter ini.</p>}
        {data.map((t) => <TxRow key={t.id} tx={t} />)}
      </div>
    </div>
  );
}
