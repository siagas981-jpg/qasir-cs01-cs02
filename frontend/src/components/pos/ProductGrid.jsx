import { Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { rupiah } from "@/lib/format";

function stockTone(left) {
  if (left <= 0) return "bg-rose-100 text-rose-700";
  if (left <= 5) return "bg-amber-100 text-amber-800";
  return "bg-emerald-100 text-emerald-800";
}

export function ProductGrid({ products, loading, inCart, onAdd, search, setSearch }) {
  const list = products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()) || (p.sku || "").toLowerCase().includes(search.toLowerCase()));
  return (
    <div>
      <div className="relative mb-5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari produk atau SKU…" className="h-12 pl-10 bg-white" data-testid="pos-product-search-input" />
      </div>
      {loading && <p className="text-sm text-muted-foreground" data-testid="products-loading">Memuat produk…</p>}
      {!loading && list.length === 0 && <p className="text-sm text-muted-foreground" data-testid="products-empty">Tidak ada produk.</p>}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
        {list.map((p, idx) => {
          const left = p.stock - (inCart[p.id] || 0);
          const disabled = left <= 0;
          return (
            <button key={p.id} disabled={disabled} onClick={() => onAdd(p)} data-testid={`product-card-${p.id}`}
              style={{ animationDelay: `${idx * 30}ms` }}
              className="group relative text-left rounded-xl border bg-white p-4 min-h-[132px] flex flex-col justify-between animate-in fade-in slide-in-from-bottom-2 duration-300 fill-mode-both hover:border-emerald-500 hover:shadow-[0_4px_0_0_#059669] hover:-translate-y-0.5 active:translate-y-0 active:shadow-none transition-[transform,box-shadow,border-color] disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none disabled:cursor-not-allowed">
              <div>
                <p className="font-heading font-semibold leading-snug line-clamp-2" data-testid={`product-name-${p.id}`}>{p.name}</p>
                <p className="text-[11px] font-mono text-slate-400 mt-0.5">{p.sku}</p>
              </div>
              <div className="flex flex-col items-start sm:flex-row sm:items-end sm:justify-between mt-3 gap-1.5 sm:gap-2">
                <span className="font-mono font-bold text-emerald-700 whitespace-nowrap" data-testid={`product-price-${p.id}`}>{rupiah(p.price)}</span>
                <span className={`text-[11px] font-semibold rounded-full px-2 py-0.5 ${stockTone(left)}`} data-testid={`product-stock-${p.id}`}>
                  {left <= 0 ? "Habis" : `Stok ${left}`}
                </span>
              </div>
              <span data-testid={`add-to-cart-button-${p.id}`} className="absolute top-3 right-3 grid h-7 w-7 place-items-center rounded-full bg-slate-900 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                <Plus className="h-4 w-4" />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
