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
  const getWitaDate = (d = new Date()) => new Date(d.toLocaleString("en-US", { timeZone: "Asia/Makassar" }));
  const toWitaISODate = (d) => {
    const wita = getWitaDate(d);
    return `${wita.getFullYear()}-${String(wita.getMonth() + 1).padStart(2, "0")}-${String(wita.getDate()).padStart(2, "0")}`;
  };
  if (dateFilter) {
    const { type, start, end, month, year } = dateFilter;
    if (type === "hari_ini") {
      const t = toWitaISODate(new Date());
      q = q.gte("created_at", new Date(`${t}T00:00:00+08:00`).toISOString()).lte("created_at", new Date(`${t}T23:59:59+08:00`).toISOString());
    } else if (type === "kemarin") {
      const d = getWitaDate(new Date()); d.setDate(d.getDate() - 1);
      const t = toWitaISODate(d);
      q = q.gte("created_at", new Date(`${t}T00:00:00+08:00`).toISOString()).lte("created_at", new Date(`${t}T23:59:59+08:00`).toISOString());
    } else if (type === "bulan_ini") {
      const now = getWitaDate(); const y = now.getFullYear(); const m = now.getMonth();
      const firstUTC = new Date(`${y}-${String(m+1).padStart(2,'0')}-01T00:00:00+08:00`).toISOString();
      const lastDay = new Date(y, m+1, 0).getDate();
      const lastUTC = new Date(`${y}-${String(m+1).padStart(2,'0')}-${lastDay}T23:59:59+08:00`).toISOString();
      q = q.gte("created_at", firstUTC).lte("created_at", lastUTC);
    } else if (type === "bulan" && month && year) {
      const firstUTC = new Date(`${year}-${String(month).padStart(2,'0')}-01T00:00:00+08:00`).toISOString();
      const lastDay = new Date(year, month, 0).getDate();
      const lastUTC = new Date(`${year}-${String(month).padStart(2,'0')}-${lastDay}T23:59:59+08:00`).toISOString();
      q = q.gte("created_at", firstUTC).lte("created_at", lastUTC);
    } else if (type === "tahun_ini") {
      const y = getWitaDate().getFullYear();
      q = q.gte("created_at", new Date(`${y}-01-01T00:00:00+08:00`).toISOString()).lte("created_at", new Date(`${y}-12-31T23:59:59+08:00`).toISOString());
    } else if (type === "tahun" && year) {
      q = q.gte("created_at", new Date(`${year}-01-01T00:00:00+08:00`).toISOString()).lte("created_at", new Date(`${year}-12-31T23:59:59+08:00`).toISOString());
    } else if (type === "custom" && start && end) {
      q = q.gte("created_at", new Date(`${start}T00:00:00+08:00`).toISOString()).lte("created_at", new Date(`${end}T23:59:59+08:00`).toISOString());
    }
  }
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

function getWitaRange(dateFilter) {
  if (!dateFilter) return null;
  const getWitaDate = (d = new Date()) => new Date(d.toLocaleString("en-US", { timeZone: "Asia/Makassar" }));
  const toWitaISODate = (d) => {
    const w = getWitaDate(d);
    return `${w.getFullYear()}-${String(w.getMonth()+1).padStart(2,"0")}-${String(w.getDate()).padStart(2,"0")}`;
  };
  let startUTC, endUTC;
  if (dateFilter.type === "hari_ini") {
    const t = toWitaISODate(new Date());
    startUTC = new Date(`${t}T00:00:00+08:00`).toISOString();
    endUTC = new Date(`${t}T23:59:59+08:00`).toISOString();
  } else if (dateFilter.type === "kemarin") {
    const d = getWitaDate(new Date()); d.setDate(d.getDate()-1);
    const t = toWitaISODate(d);
    startUTC = new Date(`${t}T00:00:00+08:00`).toISOString();
    endUTC = new Date(`${t}T23:59:59+08:00`).toISOString();
  } else if (dateFilter.type === "bulan_ini") {
    const now = getWitaDate(); const y=now.getFullYear(), m=now.getMonth();
    startUTC = new Date(`${y}-${String(m+1).padStart(2,'0')}-01T00:00:00+08:00`).toISOString();
    const lastDay = new Date(y, m+1, 0).getDate();
    endUTC = new Date(`${y}-${String(m+1).padStart(2,'0')}-${lastDay}T23:59:59+08:00`).toISOString();
  } else if (dateFilter.type === "bulan" && dateFilter.month && dateFilter.year) {
    startUTC = new Date(`${dateFilter.year}-${String(dateFilter.month).padStart(2,'0')}-01T00:00:00+08:00`).toISOString();
    const lastDay = new Date(dateFilter.year, dateFilter.month, 0).getDate();
    endUTC = new Date(`${dateFilter.year}-${String(dateFilter.month).padStart(2,'0')}-${lastDay}T23:59:59+08:00`).toISOString();
  } else if (dateFilter.type === "tahun_ini") {
    const y=getWitaDate().getFullYear();
    startUTC = new Date(`${y}-01-01T00:00:00+08:00`).toISOString();
    endUTC = new Date(`${y}-12-31T23:59:59+08:00`).toISOString();
  } else if (dateFilter.type === "tahun" && dateFilter.year) {
    startUTC = new Date(`${dateFilter.year}-01-01T00:00:00+08:00`).toISOString();
    endUTC = new Date(`${dateFilter.year}-12-31T23:59:59+08:00`).toISOString();
  } else if (dateFilter.type === "custom" && dateFilter.start && dateFilter.end) {
    startUTC = new Date(`${dateFilter.start}T00:00:00+08:00`).toISOString();
    endUTC = new Date(`${dateFilter.end}T23:59:59+08:00`).toISOString();
  }
  if (startUTC && endUTC) return { startUTC, endUTC };
  return null;
}

function TxRow({ tx }) {
  const [open, setOpen] = useState(false);
  const hasDiscount = tx.discount && Number(tx.discount) > 0;
  return (
    <div className="border-b last:border-b-0">
      <button onClick={() => setOpen(!open)} className="w-full grid grid-cols-12 items-center gap-2 px-4 py-3 text-left hover:bg-slate-50 transition-colors">
        <span className="col-span-5 sm:col-span-3 text-sm flex flex-col">
          <span>{dateTime(tx.created_at)}</span>
          {hasDiscount && <span className="mt-1 inline-flex w-fit rounded bg-amber-100 border border-amber-300 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">DISKON {rupiah(tx.discount)}</span>}
        </span>
        <span className="hidden sm:block col-span-3 text-sm text-slate-600 truncate">{tx.outlets?.name}</span>
        <span className="hidden sm:block col-span-2 text-xs font-mono text-slate-400">#{tx.id.slice(0, 8)}</span>
        <span className="col-span-6 sm:col-span-3 text-right font-mono font-bold">{rupiah(tx.total)}</span>
        <ChevronDown className={`col-span-1 h-4 w-4 justify-self-end transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 text-sm animate-in fade-in slide-in-from-top-1 duration-200 space-y-2">
          {tx.transaction_items.map((i) => (
            <div key={i.id} className="flex justify-between py-1"><span>{i.qty} × {i.product_name} <span className="text-slate-400 font-mono">@ {rupiah(i.price_each)}</span></span><span className="font-mono">{rupiah(i.qty * i.price_each)}</span></div>
          ))}
          {hasDiscount && (
            <div className="rounded-lg border-2 border-amber-200 bg-amber-50 p-3 mt-2">
              <div className="flex justify-between font-bold text-amber-800"><span>Diskon Diberikan</span><span>- {rupiah(tx.discount)}</span></div>
              <div className="mt-2 text-xs space-y-1">
                <div><span className="text-slate-500">Alasan:</span> <span className="font-bold text-slate-900">{tx.discount_reason || "Tidak ada catatan"}</span></div>
                <div><span className="text-slate-500">Oleh Kasir:</span> <span className="font-mono text-slate-700">{tx.discount_by || "-"}</span></div>
                {tx.original_total && <div><span className="text-slate-500">Total Asli:</span> <span className="font-mono">{rupiah(tx.original_total)}</span></div>}
              </div>
            </div>
          )}
          <div className="flex justify-between pt-2 mt-2 border-t text-slate-600"><span>Dibayar {rupiah(tx.paid)}</span><span>Kembalian {rupiah(tx.change)}</span></div>
        </div>
      )}
    </div>
  );
}

export default function Transactions() {
  const { isOwner, outlets, activeOutletId } = useAuth();
  const [outletFilter, setOutletFilter] = useState(isOwner ? "all" : activeOutletId);
  const [period, setPeriod] = useState("hari_ini");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [filterMonth, setFilterMonth] = useState(String(new Date().toLocaleString("en-US", {timeZone: "Asia/Makassar", month: "numeric"})));
  const [filterYear, setFilterYear] = useState(String(new Date().toLocaleString("en-US", {timeZone: "Asia/Makassar", year: "numeric"})));
  const [tabRiwayat, setTabRiwayat] = useState("produk");

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
    enabled: !!outletFilter,
    staleTime: 5_000
  });

  // === FIX 1: HAPUS FILTER outlet_id & HAPUS JOIN laci_id ===
  const { data: riwayatBank = [] } = useQuery({
    queryKey: ["riwayat-bank", dateFilter],
    queryFn: async () => {
      let q = supabase.from("laci_mutasi").select("*").order("created_at", { ascending: false }).limit(300);
      const range = getWitaRange(dateFilter);
      if (range) q = q.gte("created_at", range.startUTC).lte("created_at", range.endUTC);
      const { data, error } = await q;
      if (error) {
        console.log("BANK ERROR:", error.message);
        return [];
      }
      return data || [];
    },
  });

  const { data: riwayatBank = [] } = useQuery({
  queryKey: ["riwayat-laci-test"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("v_riwayat_transfer_wita")
      .select("*")
      .order("jam_utc", { ascending: false })
      .limit(100)
    console.log("DEBUG transfer_laci RAW:", data);
    console.log("DEBUG transfer_laci ERROR:", error);
    if (error) return [];
    return data || [];
  },
});

  const totalFiltered = data.reduce((s, t) => s + t.total, 0);
  const totalDiskonFiltered = data.reduce((s, t) => s + (Number(t.discount) || 0), 0);
  const months = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
  const years = Array.from({length: 5}, (_, i) => new Date().getFullYear() - i);
  
  // === FIX 3: HITUNG TOTAL PAKAI includes("masuk") BIAR KENA bank_masuk JUGA ===
  const totalBankMasuk = riwayatBank.filter(r=> (r.tipe||"").toLowerCase().includes("masuk")).reduce((s,r)=>s+Number(r.jumlah||0),0);
  const totalBankKeluar = riwayatBank.filter(r=> (r.tipe||"").toLowerCase().includes("keluar")).reduce((s,r)=>s+Number(r.jumlah||0),0);

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Riwayat</p>
          <h1 className="font-heading text-3xl sm:text-4xl font-extrabold tracking-tight">Transaksi</h1>
        </div>
        {isOwner && (
          <Select value={outletFilter} onValueChange={setOutletFilter}>
            <SelectTrigger className="w-[220px] bg-white"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Semua outlet</SelectItem>{outlets.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent>
          </Select>
        )}
      </div>

      <div className="flex gap-2 mb-4">
        <button onClick={() => setTabRiwayat("produk")} className={`px-5 py-2.5 rounded-xl text-sm font-bold border ${tabRiwayat==="produk" ? "bg-emerald-600 text-white border-emerald-600" : "bg-white"}`}>🛒 Transaksi Produk</button>
        <button onClick={() => setTabRiwayat("bank")} className={`px-5 py-2.5 rounded-xl text-sm font-bold border ${tabRiwayat==="bank" ? "bg-green-600 text-white border-green-600" : "bg-white"}`}>🏦 Bank & Laci (AUTO Laci 5)</button>
      </div>

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
            <Select value={filterMonth} onValueChange={setFilterMonth}><SelectTrigger className="w-[140px]"><SelectValue/></SelectTrigger><SelectContent>{months.map((m,i) => <SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}</SelectContent></Select>
            <Select value={filterYear} onValueChange={setFilterYear}><SelectTrigger className="w-[100px]"><SelectValue/></SelectTrigger><SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>
          </>
        )}
        {period === "tahun" && (
          <Select value={filterYear} onValueChange={setFilterYear}><SelectTrigger className="w-[100px]"><SelectValue/></SelectTrigger><SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>
        )}
        {period === "custom" && (
          <>
            <input type="date" value={customStart} onChange={e=>setCustomStart(e.target.value)} className="border rounded-md px-3 py-2 text-sm"/>
            <span className="text-sm">s/d</span>
            <input type="date" value={customEnd} onChange={e=>setCustomEnd(e.target.value)} className="border rounded-md px-3 py-2 text-sm"/>
          </>
        )}
      </div>

      {tabRiwayat === "bank" ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="rounded-xl border bg-white p-5"><p className="text-xs text-muted-foreground">Total Bank Masuk (Filter)</p><p className="font-mono text-xl font-extrabold text-green-600 mt-1">{rupiah(totalBankMasuk)}</p></div>
            <div className="rounded-xl border bg-white p-5"><p className="text-xs text-muted-foreground">Total Bank Keluar (Filter)</p><p className="font-mono text-xl font-extrabold text-red-600 mt-1">{rupiah(totalBankKeluar)}</p></div>
            <div className="rounded-xl border bg-white p-5"><p className="text-xs text-muted-foreground">Jumlah Transaksi Bank</p><p className="font-mono text-xl font-extrabold mt-1">{riwayatBank.length}</p></div>
            <div className="rounded-xl border bg-white p-5"><p className="text-xs text-muted-foreground">Transfer Laci</p><p className="font-mono text-xl font-extrabold mt-1">{riwayatLaci.length} x</p></div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border bg-white p-4">
              <h3 className="font-bold mb-3">🏦 Riwayat Bank - dari laci_mutasi</h3>
              <div className="max-h-[700px] overflow-auto text-sm rounded border">
                <table className="w-full"><thead className="sticky top-0 bg-slate-100"><tr className="border-b text-left text-xs"><th className="p-2">Tgl (WITA)</th><th className="p-2">Bank</th><th className="p-2">Tipe</th><th className="p-2 text-right">Jumlah</th></tr></thead>
                  <tbody>
                    {riwayatBank.length===0 ? <tr><td colSpan={4} className="p-4 text-center text-slate-400">Tidak ada data bank untuk filter ini - Coba ganti ke Semua Waktu!</td></tr> :
                    riwayatBank.map(r=>(
                      <tr key={r.id} className="border-b hover:bg-slate-50">
                        <td className="p-2 text-[11px]">{new Date(r.created_at).toLocaleString("id-ID",{timeZone:"Asia/Makassar"})}</td>
                        <td className="p-2">{r.keterangan || r.laci_id || "Bank"}<div className="text-[10px] text-slate-400">{r.keterangan || ""}</div></td>
                        <td className={`p-2 font-bold ${(r.tipe||"").toLowerCase().includes("keluar") ? "text-red-600" : "text-green-600"}`}>{r.tipe}</td>
                        <td className="p-2 text-right font-mono">Rp {Number(r.jumlah).toLocaleString("id-ID")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="rounded-xl border bg-white p-4">
              <h3 className="font-bold mb-3">🔁 Riwayat Transfer Antar Laci - BARU</h3>
              <div className="max-h-[700px] overflow-auto text-sm rounded border">
                <table className="w-full"><thead className="sticky top-0 bg-slate-100"><tr className="border-b text-left text-xs"><th className="p-2">Tgl (WITA)</th><th className="p-2">Dari → Ke</th><th className="p-2 text-right">Jumlah</th></tr></thead>
                  <tbody>
                    {riwayatLaci.length===0 ? <tr><td colSpan={3} className="p-4 text-center text-slate-400">Belum ada transfer. Coba transfer DANA → CASH BANK!</td></tr> :
                    riwayatLaci.map(r=>(
                      <tr key={r.id} className="border-b hover:bg-slate-50">
                        <td className="p-2 text-[11px]">{new Date(r.created_at).toLocaleString("id-ID",{timeZone:"Asia/Makassar"})}</td>
                        <td className="p-2 font-bold">{r.dari_nama} → {r.ke_nama}<div className="text-[10px] text-slate-400 font-normal">{r.keterangan||""}</div><div className="text-[9px] text-slate-400 font-normal">{r.kasir_email||""}</div></td>
                        <td className="p-2 text-right font-mono font-bold">Rp {Number(r.jumlah||0).toLocaleString("id-ID")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="rounded-xl border bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Filter</p><p className="font-mono text-2xl font-extrabold text-emerald-700 mt-1">{rupiah(totalFiltered)}</p></div>
            <div className="rounded-xl border bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Jumlah Transaksi</p><p className="font-mono text-2xl font-extrabold mt-1">{data.length}</p></div>
            <div className="rounded-xl border bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total Diskon</p><p className="font-mono text-2xl font-extrabold text-amber-600 mt-1">{rupiah(totalDiskonFiltered)}</p></div>
            <div className="rounded-xl border bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Waktu Makassar</p><p className="font-mono text-sm font-bold mt-1">{new Date().toLocaleString("id-ID", {timeZone: "Asia/Makassar"})}</p></div>
          </div>
          <div className="rounded-xl border bg-white">
            {isLoading && <p className="p-4 text-sm text-muted-foreground">Memuat…</p>}
            {error && <p className="p-4 text-sm text-rose-600">{error.message}</p>}
            {!isLoading && data.length === 0 && <p className="p-4 text-sm text-muted-foreground">Belum ada transaksi untuk filter ini.</p>}
            {data.map((t) => <TxRow key={t.id} tx={t} />)}
          </div>
        </>
      )}
    </div>
  );
}
