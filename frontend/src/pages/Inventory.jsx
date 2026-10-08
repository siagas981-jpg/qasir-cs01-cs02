import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, PackageSearch } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { useAuth } from "@/context/AuthContext";
import { fetchProducts } from "@/pages/POS";
import { fetchMovements, MOVEMENT_TYPES } from "@/lib/inventory";
import { dateTime } from "@/lib/format";

const ALL = "all";

export default function Inventory() {
  const { activeOutletId, activeOutlet } = useAuth();
  const [productId, setProductId] = useState(ALL);
  const [type, setType] = useState(ALL);

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

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">{activeOutlet?.name}</p>
        <h1 className="font-heading text-3xl sm:text-4xl font-extrabold tracking-tight">Inventaris</h1>
        <p className="text-sm text-muted-foreground mt-1">Riwayat pergerakan stok — penjualan, pembelian, penyesuaian, retur.</p>
      </div>

      <div className="flex flex-wrap gap-3 mb-5">
        <Select value={productId} onValueChange={setProductId}>
          <SelectTrigger className="w-[240px] bg-white" data-testid="inventory-filter-product">
            <SelectValue placeholder="Semua produk" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL} data-testid="inventory-filter-product-all">Semua produk</SelectItem>
            {products.map((p) => (
              <SelectItem key={p.id} value={p.id} data-testid={`inventory-filter-product-${p.id}`}>{p.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-[200px] bg-white" data-testid="inventory-filter-type">
            <SelectValue placeholder="Semua jenis" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL} data-testid="inventory-filter-type-all">Semua jenis</SelectItem>
            {Object.entries(MOVEMENT_TYPES).map(([k, v]) => (
              <SelectItem key={k} value={k} data-testid={`inventory-filter-type-${k}`}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border bg-white overflow-x-auto">
        <table className="w-full text-sm" data-testid="inventory-table">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="p-4">Waktu</th>
              <th className="p-4">Produk</th>
              <th className="p-4">Jenis</th>
              <th className="p-4 text-right">Perubahan</th>
              <th className="p-4 text-right">Stok</th>
              <th className="p-4">Catatan</th>
              <th className="p-4">Oleh</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td className="p-4 text-muted-foreground" colSpan={7}>Memuat…</td></tr>}
            {!isLoading && error && (
              <tr><td className="p-8 text-center text-rose-600" colSpan={7} data-testid="inventory-error">
                Gagal memuat riwayat stok: {error.message}
              </td></tr>
            )}
            {!isLoading && !error && rows.length === 0 && (
              <tr><td className="p-8 text-center text-muted-foreground" colSpan={7}>
                <PackageSearch className="h-6 w-6 mx-auto mb-2 opacity-50" />
                Belum ada pergerakan stok.
              </td></tr>
            )}
            {rows.map((m) => {
              const cfg = MOVEMENT_TYPES[m.type] || { label: m.type, badge: "bg-slate-100 text-slate-700" };
              const up = m.quantity > 0;
              return (
                <tr key={m.id} className="border-b last:border-b-0 hover:bg-slate-50" data-testid={`movement-row-${m.id}`}>
                  <td className="p-4 whitespace-nowrap text-slate-500">{dateTime(m.created_at)}</td>
                  <td className="p-4 font-semibold">{m.products?.name || "—"}</td>
                  <td className="p-4"><Badge variant="outline" className={cfg.badge} data-testid={`movement-type-${m.id}`}>{cfg.label}</Badge></td>
                  <td className={`p-4 text-right font-mono font-bold ${up ? "text-emerald-600" : "text-rose-600"}`} data-testid={`movement-qty-${m.id}`}>
                    <span className="inline-flex items-center gap-1 justify-end">
                      {up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
                      {up ? `+${m.quantity}` : m.quantity}
                    </span>
                  </td>
                  <td className="p-4 text-right font-mono text-slate-500">{m.previous_stock} → <span className="font-bold text-slate-900">{m.new_stock}</span></td>
                  <td className="p-4 text-slate-600">{m.notes || "—"}</td>
                  <td className="p-4 text-slate-500">{m.creator?.full_name || m.creator?.email || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
