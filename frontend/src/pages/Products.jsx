import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { rupiah, parseRupiah } from "@/lib/format";
import { fetchProducts } from "@/pages/POS";

const EMPTY = { name: "", sku: "", price: 0, stock: 0 };

function ProductForm({ initial, onSave, busy }) {
  const [f, setF] = useState(initial);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSave(f); }}>
      <div className="space-y-1.5"><Label>Nama</Label><Input required value={f.name} onChange={set("name")} data-testid="product-form-name-input" /></div>
      <div className="space-y-1.5"><Label>SKU</Label><Input value={f.sku || ""} onChange={set("sku")} data-testid="product-form-sku-input" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>Harga</Label><Input inputMode="numeric" className="font-mono" value={rupiah(f.price)} onChange={(e) => setF({ ...f, price: parseRupiah(e.target.value) })} data-testid="product-form-price-input" /></div>
        <div className="space-y-1.5"><Label>Stok</Label><Input type="number" min="0" className="font-mono" value={f.stock} onChange={(e) => setF({ ...f, stock: Math.max(0, parseInt(e.target.value, 10) || 0) })} data-testid="product-form-stock-input" /></div>
      </div>
      <Button type="submit" disabled={busy} className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="product-form-submit-button">Simpan</Button>
    </form>
  );
}

export default function Products() {
  const { activeOutletId, activeOutlet } = useAuth();
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["products", activeOutletId], queryFn: () => fetchProducts(activeOutletId), enabled: !!activeOutletId });
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);

  const save = async (f) => {
    setBusy(true);
    const row = { name: f.name.trim(), sku: f.sku || null, price: f.price, stock: f.stock, outlet_id: activeOutletId };
    const { error } = f.id ? await supabase.from("products").update(row).eq("id", f.id) : await supabase.from("products").insert(row);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Produk disimpan");
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["products", activeOutletId] });
  };

  const del = async (p) => {
    if (!window.confirm(`Hapus ${p.name}?`)) return;
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["products", activeOutletId] });
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">{activeOutlet?.name}</p>
          <h1 className="font-heading text-3xl sm:text-4xl font-extrabold tracking-tight">Produk</h1>
        </div>
        <Button onClick={() => setEditing(EMPTY)} disabled={!activeOutletId} className="bg-slate-900 hover:bg-emerald-700 text-white" data-testid="product-add-button"><Plus className="h-4 w-4 mr-1" /> Tambah produk</Button>
      </div>
      <div className="rounded-xl border bg-white overflow-x-auto">
        <table className="w-full text-sm" data-testid="products-table">
          <thead><tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="p-4">Nama</th><th className="p-4">SKU</th><th className="p-4 text-right">Harga</th><th className="p-4 text-right">Stok</th><th className="p-4" /></tr></thead>
          <tbody>
            {isLoading && <tr><td className="p-4 text-muted-foreground" colSpan={5}>Memuat…</td></tr>}
            {data.map((p) => (
              <tr key={p.id} className="border-b last:border-b-0 hover:bg-slate-50" data-testid={`product-row-${p.id}`}>
                <td className="p-4 font-semibold">{p.name}</td>
                <td className="p-4 font-mono text-slate-500">{p.sku}</td>
                <td className="p-4 text-right font-mono">{rupiah(p.price)}</td>
                <td className={`p-4 text-right font-mono font-bold ${p.stock === 0 ? "text-rose-600" : p.stock <= 5 ? "text-amber-600" : ""}`} data-testid={`product-row-stock-${p.id}`}>{p.stock}</td>
                <td className="p-4 text-right whitespace-nowrap">
                  <button onClick={() => setEditing(p)} className="p-2 rounded-md hover:bg-slate-900 hover:text-white" data-testid={`product-edit-${p.id}`}><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => del(p)} className="p-2 rounded-md hover:bg-rose-600 hover:text-white" data-testid={`product-delete-${p.id}`}><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="sm:max-w-md bg-background" data-testid="product-form-dialog">
          <DialogHeader><DialogTitle className="font-heading">{editing?.id ? "Ubah produk" : "Produk baru"}</DialogTitle></DialogHeader>
          {editing && <ProductForm key={editing.id || "new"} initial={editing} onSave={save} busy={busy} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
