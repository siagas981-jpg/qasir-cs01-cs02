import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search, AlertTriangle, PackageX, Calendar, X } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useAuth } from "@/context/AuthContext";
import { rupiah, dateTime } from "@/lib/format";
import { useDateRange, fetchLowStock, fetchSales, fetchSalesSeries, fetchPurchases, toDateStr } from "@/lib/reports";
import { exportExcel, exportPDF } from "@/lib/exporters";
import { PageHeader, RangeBar, ExportButtons, StatCard, TableShell, shortId, formatShort } from "@/components/reports/parts";

const asArray = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.data)) return raw.data;
  return [];
};

function SearchBox({ value, onChange, placeholder, testId }) {
  return (
    <div className="relative">
      <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
      <Input className="pl-8 h-9 w-[220px] bg-white text-[11px]" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} data-testid={testId} />
    </div>
  );
}

function StockReport({ outletId }) {
  const [q, setQ] = useState("");
  const { data: raw = [], isLoading } = useQuery({ queryKey: ["rpt-lowstock", outletId], queryFn: () => fetchLowStock(outletId), enabled: !!outletId });
  const data = useMemo(() => asArray(raw), [raw]);
  const low = useMemo(() => data.filter((p) => (p.stock ?? 0) < 10 || p.stock < (p.min_stock ?? 1)), [data]);
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? low.filter((p) => p.name.toLowerCase().includes(t) || (p.sku || "").toLowerCase().includes(t)) : low;
  }, [low, q]);
  const habis = low.filter((p) => p.stock === 0).length;
  const menipis = low.length - habis;

  const toRows = () => rows.map((p) => ({ Nama: p.name, SKU: p.sku || "", Stok: p.stock, "Stok Min": p.min_stock ?? 0, Status: p.stock === 0 ? "Habis" : "Menipis" }));
  const onExcel = () => exportExcel(toRows(), "laporan-stok", "Stok");
  const onPDF = () => exportPDF({ title: "Laporan Stok", subtitle: `${menipis} menipis · ${habis} habis`, head: ["Nama", "SKU", "Stok", "Min", "Status"], body: rows.map((p) => [p.name, p.sku || "", p.stock, p.min_stock ?? 0, p.stock === 0 ? "Habis" : "Menipis"]), filename: "laporan-stok" });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <SearchBox value={q} onChange={setQ} placeholder="Cari produk / SKU…" testId="stock-search" />
        <Badge variant="outline" className="border-amber-200 bg-amber-100 text-amber-700 gap-1 text-[10px] h-6"><AlertTriangle className="h-3 w-3" /> {menipis} menipis</Badge>
        <Badge variant="outline" className="border-rose-200 bg-rose-100 text-rose-700 gap-1 text-[10px] h-6"><PackageX className="h-3 w-3" /> {habis} habis</Badge>
        <div className="ml-auto"><ExportButtons onExcel={onExcel} onPDF={onPDF} idPrefix="stock" /></div>
      </div>
      <div className="w-full bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-[11px]">
            <thead><tr className="border-b bg-slate-50/80 text-left text-[10px] uppercase tracking-wider text-slate-500">
              <th className="py-2.5 px-3 font-bold">Nama</th><th className="py-2.5 px-3 font-bold">SKU</th>
              <th className="py-2.5 px-3 text-right font-bold">Stok</th><th className="py-2.5 px-3 text-right font-bold">Stok Min</th><th className="py-2.5 px-3 font-bold">Status</th>
            </tr></thead>
            <tbody>
              {isLoading && <tr><td className="py-6 px-3 text-slate-500 text-[11px]" colSpan={5}>Memuat…</td></tr>}
              {!isLoading && rows.length === 0 && <tr><td className="py-10 text-center text-slate-500 text-[11px]" colSpan={5}>Semua stok aman 🎉</td></tr>}
              {rows.map((p) => {
                const habisRow = p.stock === 0;
                return (
                  <tr key={p.id} className={`border-b last:border-b-0 ${habisRow ? "bg-rose-50/70" : "bg-amber-50/40"}`} data-testid={`stock-report-row-${p.id}`}>
                    <td className="py-2.5 px-3 font-semibold text-slate-900">{p.name}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-500">{p.sku}</td>
                    <td className={`py-2.5 px-3 text-right font-mono font-bold ${habisRow ? "text-rose-600" : "text-amber-600"}`}>{p.stock}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-500">{p.min_stock ?? 0}</td>
                    <td className="py-2.5 px-3">
                      {habisRow
                        ? <Badge className="bg-rose-600 text-white gap-1 text-[10px] h-5 px-1.5"><PackageX className="h-3 w-3" /> Habis</Badge>
                        : <Badge className="bg-amber-500 text-white gap-1 text-[10px] h-5 px-1.5"><AlertTriangle className="h-3 w-3" /> Menipis</Badge>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function SalesReport({ outletId }) {
  const range = useDateRange("all");
  const [q, setQ] = useState("");
  const { data: raw = [], isLoading } = useQuery({
    queryKey: ["rpt-sales", outletId, range.from, range.to],
    queryFn: () => fetchSales(outletId, range.from, range.to), enabled: !!outletId,
  });
  const { data: seriesRaw = [] } = useQuery({ queryKey: ["rpt-sales-series", outletId], queryFn: () => fetchSalesSeries(outletId, 6), enabled: !!outletId });
  const data = useMemo(() => asArray(raw), [raw]);
  const series = useMemo(() => asArray(seriesRaw), [seriesRaw]);
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? data.filter((r) => r.id.toLowerCase().includes(t)) : data;
  }, [data, q]);
  const total = rows.reduce((s, r) => s + (r.total || 0), 0);

  const toRows = () => rows.map((r) => ({ Tanggal: dateTime(r.created_at), Nota: shortId(r.id), Total: r.total, Bayar: r.paid, Kembali: r.change }));
  const onExcel = () => exportExcel(toRows(), "laporan-penjualan", "Penjualan");
  const onPDF = () => exportPDF({ title: "Laporan Penjualan", subtitle: `${toDateStr(range.from)} s/d ${toDateStr(range.to)} · Total ${rupiah(total)}`, head: ["Tanggal", "Nota", "Total", "Bayar", "Kembali"], body: rows.map((r) => [dateTime(r.created_at), shortId(r.id), rupiah(r.total), rupiah(r.paid), rupiah(r.change)]), filename: "laporan-penjualan" });

  return (
    <div className="space-y-3">
      <RangeBar range={range}>
        <SearchBox value={q} onChange={setQ} placeholder="Cari no. nota…" testId="sales-search" />
        <ExportButtons onExcel={onExcel} onPDF={onPDF} idPrefix="sales" />
      </RangeBar>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <StatCard label="Total Penjualan" value={rupiah(total)} accent="emerald" testId="sales-total" />
        <StatCard label="Jumlah Transaksi" value={rows.length} accent="sky" />
        <StatCard label="Rata-rata / Transaksi" value={rupiah(rows.length ? total / rows.length : 0)} accent="slate" />
      </div>

      <div className="rounded-xl border bg-white p-4">
        <p className="text-[11px] font-bold mb-3 uppercase tracking-wider text-slate-500">Penjualan per Bulan (6 bulan terakhir)</p>
        <div className="h-64" data-testid="sales-chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={series}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={formatShort} tick={{ fontSize: 11 }} width={48} />
              <Tooltip formatter={(v) => rupiah(v)} cursor={{ fill: "rgba(16,185,129,0.08)" }} />
              <Bar dataKey="total" name="Penjualan" fill="#10b981" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="w-full bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-[11px]">
            <thead><tr className="border-b bg-slate-50/80 text-left text-[10px] uppercase tracking-wider text-slate-500">
              <th className="py-2.5 px-3 font-bold">Tanggal</th><th className="py-2.5 px-3 font-bold">Nota</th>
              <th className="py-2.5 px-3 text-right font-bold">Total</th><th className="py-2.5 px-3 text-right font-bold">Bayar</th><th className="py-2.5 px-3 text-right font-bold">Kembali</th>
            </tr></thead>
            <tbody>
              {isLoading && <tr><td className="py-6 px-3 text-slate-500" colSpan={5}>Memuat…</td></tr>}
              {!isLoading && rows.length === 0 && <tr><td className="py-10 text-center text-slate-500 text-[11px]" colSpan={5}>Tidak ada penjualan pada periode ini.</td></tr>}
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-b-0 hover:bg-slate-50/70 transition">
                  <td className="py-2.5 px-3 whitespace-nowrap text-slate-500">{dateTime(r.created_at)}</td>
                  <td className="py-2.5 px-3 font-mono">{shortId(r.id)}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">{rupiah(r.total)}</td>
                  <td className="py-2.5 px-3 text-right font-mono">{rupiah(r.paid)}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-500">{rupiah(r.change)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PurchaseReport({ outletId }) {
  const range = useDateRange("all");
  const [q, setQ] = useState("");
  const { data: raw = [], isLoading } = useQuery({
    queryKey: ["rpt-purchases", outletId, range.from, range.to],
    queryFn: () => fetchPurchases(outletId, range.from, range.to), enabled: !!outletId,
  });
  const data = useMemo(() => asArray(raw), [raw]);
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? data.filter((r) => (r.name||"").toLowerCase().includes(t)) : data;
  }, [data, q]);
  const total = rows.reduce((s, r) => s + (r.nilai || 0), 0);

  const toRows = () => rows.map((r) => ({ Tanggal: dateTime(r.created_at), Produk: r.name, Qty: r.quantity, "Harga Modal": r.cost_price, Nilai: r.nilai, Catatan: r.notes || "" }));
  const onExcel = () => exportExcel(toRows(), "laporan-pembelian", "Pembelian");
  const onPDF = () => exportPDF({ title: "Laporan Pembelian", subtitle: `${toDateStr(range.from)} s/d ${toDateStr(range.to)} · Total ${rupiah(total)}`, head: ["Tanggal", "Produk", "Qty", "Modal", "Nilai", "Catatan"], body: rows.map((r) => [dateTime(r.created_at), r.name, r.quantity, rupiah(r.cost_price), rupiah(r.nilai), r.notes || ""]), filename: "laporan-pembelian" });

  return (
    <div className="space-y-3">
      <RangeBar range={range}>
        <SearchBox value={q} onChange={setQ} placeholder="Cari produk…" testId="purchase-search" />
        <ExportButtons onExcel={onExcel} onPDF={onPDF} idPrefix="purchase" />
      </RangeBar>
      <div className="mb-1"><StatCard label="Total Pembelian" value={rupiah(total)} accent="amber" testId="purchase-total" /></div>
      <div className="w-full bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-[11px]">
            <thead><tr className="border-b bg-slate-50/80 text-left text-[10px] uppercase tracking-wider text-slate-500">
              <th className="py-2.5 px-3 font-bold">Tanggal</th><th className="py-2.5 px-3 font-bold">Produk</th>
              <th className="py-2.5 px-3 text-right font-bold">Qty</th><th className="py-2.5 px-3 text-right font-bold">Modal</th>
              <th className="py-2.5 px-3 text-right font-bold">Nilai</th><th className="py-2.5 px-3 font-bold">Catatan</th>
            </tr></thead>
            <tbody>
              {isLoading && <tr><td className="py-6 px-3 text-slate-500" colSpan={6}>Memuat…</td></tr>}
              {!isLoading && rows.length === 0 && <tr><td className="py-10 text-center text-slate-500 text-[11px]" colSpan={6}>Belum ada pembelian (stok masuk) pada periode ini.</td></tr>}
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-b-0 hover:bg-slate-50/70 transition">
                  <td className="py-2.5 px-3 whitespace-nowrap text-slate-500">{dateTime(r.created_at)}</td>
                  <td className="py-2.5 px-3 font-semibold text-slate-900">{r.name}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-emerald-600">+{r.quantity}</td>
                  <td className="py-2.5 px-3 text-right font-mono text-slate-500">{rupiah(r.cost_price)}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold">{rupiah(r.nilai)}</td>
                  <td className="py-2.5 px-3 text-slate-600">{r.notes || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function Reports() {
  const { activeOutletId, activeOutlet } = useAuth();
  return (
    <div className="w-full max-w-none px-4 md:px-6 py-4 space-y-3 bg-[#fbfbfb] min-h-screen">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700">{activeOutlet?.name || "CS QASIR 01"}</p>
        <h1 className="text-2xl font-extrabold tracking-tight">Laporan</h1>
        <p className="text-[11px] text-slate-500 mt-0.5">Stok, penjualan, dan pembelian — dengan filter & ekspor.</p>
      </div>
      <Tabs defaultValue="stock">
        <TabsList className="mb-3 h-9 bg-white border border-slate-200 p-1" data-testid="reports-tabs">
          <TabsTrigger value="stock" className="text-[11px] h-7 data-[state=active]:bg-slate-900 data-[state=active]:text-white" data-testid="tab-stock">Laporan Stok</TabsTrigger>
          <TabsTrigger value="sales" className="text-[11px] h-7 data-[state=active]:bg-slate-900 data-[state=active]:text-white" data-testid="tab-sales">Laporan Penjualan</TabsTrigger>
          <TabsTrigger value="purchase" className="text-[11px] h-7 data-[state=active]:bg-slate-900 data-[state=active]:text-white" data-testid="tab-purchase">Laporan Pembelian</TabsTrigger>
        </TabsList>
        <TabsContent value="stock"><StockReport outletId={activeOutletId} /></TabsContent>
        <TabsContent value="sales"><SalesReport outletId={activeOutletId} /></TabsContent>
        <TabsContent value="purchase"><PurchaseReport outletId={activeOutletId} /></TabsContent>
      </Tabs>
    </div>
  );
}
