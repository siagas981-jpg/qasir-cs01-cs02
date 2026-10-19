import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, PackageSearch, Calendar, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { fetchProducts } from "@/pages/POS";
import { fetchMovements, MOVEMENT_TYPES } from "@/lib/inventory";
import { dateTime } from "@/lib/format";

const ALL = "all";

function toDateInput(d) {
  return d.toISOString().slice(0, 10);
}

export default function Inventory() {
  const { activeOutletId, activeOutlet } = useAuth();
  const [productId, setProductId] = useState(ALL);
  const [type, setType] = useState(ALL);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { data: products = [] } = useQuery({
    queryKey: ["products", activeOutletId],
    queryFn: () => fetchProducts(activeOutletId),
    enabled: !!activeOutletId,
  });

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["movements", activeOutletId, productId, type],
    queryFn: () => fetchMovements({
      outletId: activeOutletId,
      productId: productId === ALL ? null : productId,
      type: type === ALL ? null : type,
    }),
    enabled: !!activeOutletId,
  });

  // FILTER TANGGAL CLIENT-SIDE
  const filtered = useMemo(() => {
    if (!from && !to) return rows;
    return rows.filter((m) => {
      const d = new Date(m.created_at);
      if (from) {
        const f = new Date(from); f.setHours(0,0,0,0);
        if (d < f) return false;
      }
      if (to) {
        const t = new Date(to); t.setHours(23,59,59,999);
        if (d > t) return false;
      }
      return true;
    });
  }, [rows, from, to]);

  const setPreset = (p) => {
    const now = new Date();
    if (p === "today") { setFrom(toDateInput(now)); setTo(toDateInput(now)); }
    if (p === "yesterday") { const d = new Date(); d.setDate(d.getDate()-1); setFrom(toDateInput(d)); setTo(toDateInput(d)); }
    if (p === "7d") { const d = new Date(); d.setDate(d.getDate()-6); setFrom(toDateInput(d)); setTo(toDateInput(now)); }
    if (p === "month") { const d = new Date(now.getFullYear(), now.getMonth(), 1); setFrom(toDateInput(d)); setTo(toDateInput(now)); }
    if (p === "reset") { setFrom(""); setTo(""); }
  };

  return (
    <div className="w-full max-w-none px-4 md:px-6 py-4 space-y-3 bg-[#fbfbfb] min-h-screen">
      <div className="mb-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700">{activeOutlet?.name}</p>
        <h1 className="font-heading text-2xl font-extrabold tracking-tight">Inventaris</h1>
        <p className="text-[11px] text-slate-500 mt-0.5">Riwayat pergerakan stok — penjualan, pembelian, penyesuaian, retur.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={productId} onValueChange={setProductId}>
          <SelectTrigger className="w-[180px] h-8 text-[11px] bg-white border-slate-200" data-testid="inventory-filter-product">
            <SelectValue placeholder="Semua produk" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Semua produk</SelectItem>
            {products.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-[140px] h-8 text-[11px] bg-white border-slate-200" data-testid="inventory-filter-type">
            <SelectValue placeholder="Semua jenis" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Semua jenis</SelectItem>
            {Object.entries(MOVEMENT_TYPES).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="h-6 w-px bg-slate-200 mx-1" />

        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2 h-8">
          <Calendar className="h-3.5 w-3.5 text-slate-400" />
          <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="text-[11px] outline-none w-[120px]" />
          <span className="text-[10px] text-slate-400">-</span>
          <input type="date" value={to} onChange={e=>setTo(e.target.value)} className="text-[11px] outline-none w-[120px]" />
          {(from||to) && <button onClick={()=>setPreset("reset")} className="ml-1 p-0.5 rounded hover:bg-slate-100"><X className="h-3 w-3" /></button>}
        </div>

        <div className="flex gap-1">
          <button onClick={()=>setPreset("today")} className="h-8 px-2.5 text-[11px] rounded-lg border bg-white hover:bg-slate-50">Hari ini</button>
          <button onClick={()=>setPreset("7d")} className="h-8 px-2.5 text-[11px] rounded-lg border bg-white hover:bg-slate-50">7 Hari</button>
          <button onClick={()=>setPreset("month")} className="h-8 px-2.5 text-[11px] rounded-lg border bg-white hover:bg-slate-50">Bulan ini</button>
        </div>

        <span className="text-[11px] text-slate-400 ml-2">{filtered.length} data</span>
      </div>

      <div className="w-full bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-[11px]" data-testid="inventory-table">
            <thead>
              <tr className="border-b bg-slate-50/80 text-left text-[10px] uppercase tracking-wider text-slate-500">
                <th className="py-2.5 px-3 font-bold whitespace-nowrap">Waktu</th>
                <th className="py-2.5 px-3 font-bold">Produk</th>
                <th className="py-2.5 px-3 font-bold">Jenis</th>
                <th className="py-2.5 px-3 text-right font-bold">Perubahan</th>
                <th className="py-2.5 px-3 text-right font-bold">Stok</th>
                <th className="py-2.5 px-3 font-bold">Catatan</th>
                <th className="py-2.5 px-3 font-bold">Oleh</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td className="py-6 px-3 text-slate-500" colSpan={7}>Memuat…</td></tr>}
              {!isLoading && error && (
                <tr><td className="py-6 px-3 text-center text-rose-600" colSpan={7}>Gagal: {error.message}</td></tr>
              )}
              {!isLoading && !error && filtered.length === 0 && (
                <tr><td className="py-10 px-3 text-center text-slate-500" colSpan={7}>
                  <PackageSearch className="h-5 w-5 mx-auto mb-1.5 opacity-50" />
                  <span className="text-[11px]">Belum ada pergerakan stok di rentang ini.</span>
                </td></tr>
              )}
              {filtered.map((m) => {
                const cfg = MOVEMENT_TYPES[m.type] || { label: m.type, badge: "bg-slate-100 text-slate-700 border-slate-200" };
                const up = m.quantity > 0;
                return (
                  <tr key={m.id} className="border-b last:border-b-0 hover:bg-slate-50/70 transition">
                    <td className="py-2 px-3 whitespace-nowrap text-slate-500 text-[11px]">{dateTime(m.created_at)}</td>
                    <td className="py-2 px-3 font-semibold text-slate-900">{m.products?.name || "—"}</td>
                    <td className="py-2 px-3"><Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 font-medium border ${cfg.badge}`}>{cfg.label}</Badge></td>
                    <td className={`py-2 px-3 text-right font-mono font-bold ${up ? "text-emerald-600" : "text-rose-600"}`}>
                      <span className="inline-flex items-center gap-0.5 justify-end">
                        {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        {up ? `+${m.quantity}` : m.quantity}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-slate-500 text-[11px]">{m.previous_stock} → <span className="font-bold text-slate-900">{m.new_stock}</span></td>
                    <td className="py-2 px-3 text-slate-600 max-w-[220px] truncate">{m.notes || "—"}</td>
                    <td className="py-2 px-3 text-slate-500 truncate max-w-[120px]">{m.creator?.full_name || m.creator?.email || "—"}</td>
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
