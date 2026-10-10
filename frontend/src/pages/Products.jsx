import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, PackagePlus, PackageMinus, SlidersHorizontal, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { rupiah, parseRupiah } from "@/lib/format";
import { fetchProducts } from "@/pages/POS";
import { recordStockMovement, movementError } from "@/lib/inventory";
import imageCompression from "browser-image-compression";
const EMPTY = { name: "", sku: "", price: 0, stock: 0, min_stock: 0, cost_price: 0, image_url: "" };
function ProductForm({ initial, onSave, busy }) {
  const [f, setF] = useState(initial);
  const isEdit = !!f.id;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const handleImageUpload = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    toast.loading("Kompres gambar...");
    const compressed = await imageCompression(file, {
      maxSizeMB: 0.15,
      maxWidthOrHeight: 800,
      useWebWorker: true,
    });
    const fileName = `${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from('produk').upload(fileName, compressed);
    if (error) throw error;
    const { data } = supabase.storage.from('produk').getPublicUrl(fileName);
    setF({...f, image_url: data.publicUrl });
    toast.dismiss();
    toast.success("Foto siap! ~150KB");
  } catch (err) {
    toast.dismiss();
    toast.error(err.message);
  }
};
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSave(f); }}>
      <div className="space-y-1.5"><Label>Nama</Label><Input required value={f.name} onChange={set("name")} data-testid="product-form-name-input" /></div>
      <div className="space-y-1.5"><Label>SKU</Label><Input value={f.sku || ""} onChange={set("sku")} data-testid="product-form-sku-input" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>Harga Jual</Label><Input inputMode="numeric" className="font-mono" value={rupiah(f.price)} onChange={(e) => setF({ ...f, price: parseRupiah(e.target.value) })} data-testid="product-form-price-input" /></div>
        <div className="space-y-1.5"><Label>Harga Modal</Label><Input inputMode="numeric" className="font-mono" value={rupiah(f.cost_price)} onChange={(e) => setF({ ...f, cost_price: parseRupiah(e.target.value) })} data-testid="product-form-cost-input" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label>Stok Saat Ini</Label>
          <Input type="number" min="0" disabled={isEdit} className="font-mono disabled:opacity-60" value={f.stock} onChange={(e) => setF({ ...f, stock: Math.max(0, parseInt(e.target.value, 10) || 0) })} data-testid="product-form-stock-input" />
          {isEdit && <p className="text-[11px] text-muted-foreground">Ubah lewat tombol stok agar tercatat.</p>}
        </div>
        <div className="space-y-1.5"><Label>Stok Minimum</Label><Input type="number" min="0" className="font-mono" value={f.min_stock} onChange={(e) => setF({ ...f, min_stock: Math.max(0, parseInt(e.target.value, 10) || 0) })} data-testid="product-form-min-stock-input" /></div>
      </div>
      <Button type="submit" disabled={busy} className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="product-form-submit-button">Simpan</Button>
    </form>
  );
}

const STOCK_MODE = {
  add: { title: "Tambah Stok", desc: "Catat stok masuk (pembelian/restok).", type: "purchase" },
  reduce: { title: "Kurangi Stok", desc: "Catat stok keluar." },
  adjust: { title: "Sesuaikan Stok", desc: "Setel stok ke hasil hitung fisik.", type: "adjustment" },
};

function StockForm({ action, busy, onSubmit }) {
  const { product, mode } = action;
  const cfg = STOCK_MODE[mode];
  const [qty, setQty] = useState("");
  const [target, setTarget] = useState(String(product.stock));
  const [reason, setReason] = useState("adjustment");
  const [notes, setNotes] = useState("");

  const submit = (e) => {
    e.preventDefault();
    if (mode === "adjust") {
      const t = Math.max(0, parseInt(target, 10) || 0);
      const delta = t - product.stock;
      if (delta === 0) return toast.error("Nilai sama dengan stok saat ini");
      return onSubmit({ type: "adjustment", delta, notes: notes || "Penyesuaian stok" });
    }
    const n = Math.max(0, parseInt(qty, 10) || 0);
    if (n <= 0) return toast.error("Masukkan jumlah lebih dari 0");
    if (mode === "add") return onSubmit({ type: "purchase", delta: n, notes });
    return onSubmit({ type: reason, delta: -n, notes });
  };

  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="rounded-lg bg-slate-50 border px-3 py-2 text-sm">
        <span className="font-semibold">{product.name}</span>
        <span className="text-muted-foreground"> · Stok saat ini: </span>
        <span className="font-mono font-bold" data-testid="stock-current-value">{product.stock}</span>
      </div>

      {mode === "adjust" ? (
        <div className="space-y-1.5">
          <Label>Stok hasil hitung fisik</Label>
          <Input type="number" min="0" className="font-mono" value={target} onChange={(e) => setTarget(e.target.value)} data-testid="stock-target-input" />
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label>{mode === "add" ? "Jumlah masuk" : "Jumlah keluar"}</Label>
          <Input type="number" min="1" className="font-mono" value={qty} onChange={(e) => setQty(e.target.value)} data-testid="stock-qty-input" autoFocus />
        </div>
      )}

      {mode === "reduce" && (
        <div className="space-y-1.5">
          <Label>Alasan</Label>
          <Select value={reason} onValueChange={setReason}>
            <SelectTrigger data-testid="stock-reason-select"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="adjustment" data-testid="stock-reason-adjustment">Penyesuaian</SelectItem>
              <SelectItem value="return" data-testid="stock-reason-return">Retur</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1.5">
        <Label>Catatan (opsional)</Label>
        <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} data-testid="stock-notes-input" />
      </div>

      <Button type="submit" disabled={busy} className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="stock-submit-button">Simpan</Button>
    </form>
  );
}

export default function Products() {
  const { activeOutletId, activeOutlet } = useAuth();
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["products", activeOutletId], queryFn: () => fetchProducts(activeOutletId), enabled: !!activeOutletId });
  const [editing, setEditing] = useState(null);
  const [stockAction, setStockAction] = useState(null);
  const [busy, setBusy] = useState(false);

  const save = async (f) => {
    setBusy(true);
    try {
      if (f.id) {
        const { error } = await supabase.from("products").update({
          name: f.name.trim(), sku: f.sku || null, price: f.price, cost_price: f.cost_price, min_stock: f.min_stock,
        }).eq("id", f.id);
        if (error) throw error;
      } else {
        const { data: row, error } = await supabase.from("products").insert({
          name: f.name.trim(), sku: f.sku || null, price: f.price, cost_price: f.cost_price, min_stock: f.min_stock, stock: 0, outlet_id: activeOutletId,
        }).select("id").single();
        if (error) throw error;
        if (f.stock > 0) await recordStockMovement({ product_id: row.id, type: "purchase", delta: f.stock, notes: "Stok awal" });
      }
      toast.success("Produk disimpan");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["products", activeOutletId] });
    } catch (e) {
      toast.error(movementError(e));
    } finally { setBusy(false); }
  };

  const del = async (p) => {
    if (!window.confirm(`Hapus ${p.name}?`)) return;
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["products", activeOutletId] });
  };

  const runStock = async ({ type, delta, notes }) => {
    setBusy(true);
    try {
      await recordStockMovement({ product_id: stockAction.product.id, type, delta, notes });
      toast.success("Stok diperbarui");
      setStockAction(null);
      qc.invalidateQueries({ queryKey: ["products", activeOutletId] });
      qc.invalidateQueries({ queryKey: ["movements"] });
    } catch (e) {
      toast.error(movementError(e));
    } finally { setBusy(false); }
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
          <thead><tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
            <th className="p-4">Nama</th><th className="p-4">SKU</th>
            <th className="p-4 text-right">Modal</th><th className="p-4 text-right">Harga</th>
            <th className="p-4 text-right">Stok Min</th><th className="p-4 text-right">Stok</th>
            <th className="p-4 text-right">Aksi Stok</th><th className="p-4" />
          </tr></thead>
          <tbody>
            {isLoading && <tr><td className="p-4 text-muted-foreground" colSpan={8}>Memuat…</td></tr>}
            {data.map((p) => {
              const minStock = p.min_stock ?? 0;
              const low = p.stock <= minStock;
              return (
              <tr key={p.id} className={`border-b last:border-b-0 ${low ? "bg-rose-50/70 hover:bg-rose-50" : "hover:bg-slate-50"}`} data-testid={`product-row-${p.id}`}>
                <td className="p-4 font-semibold">
                  <div className="flex items-center gap-2">
                    {p.name}
                    {low && <Badge variant="outline" className="border-rose-200 bg-rose-100 text-rose-700 gap-1" data-testid={`product-low-badge-${p.id}`}><AlertTriangle className="h-3 w-3" /> Stok rendah</Badge>}
                  </div>
                </td>
                <td className="p-4 font-mono text-slate-500">{p.sku}</td>
                <td className="p-4 text-right font-mono text-slate-500">{rupiah(p.cost_price ?? 0)}</td>
                <td className="p-4 text-right font-mono">{rupiah(p.price)}</td>
                <td className="p-4 text-right font-mono text-slate-500" data-testid={`product-row-minstock-${p.id}`}>{minStock}</td>
                <td className={`p-4 text-right font-mono font-bold ${low ? "text-rose-600" : ""}`} data-testid={`product-row-stock-${p.id}`}>{p.stock}</td>
                <td className="p-4 text-right whitespace-nowrap">
                  <button onClick={() => setStockAction({ product: p, mode: "add" })} title="Tambah stok" className="p-2 rounded-md hover:bg-emerald-600 hover:text-white" data-testid={`product-add-stock-${p.id}`}><PackagePlus className="h-4 w-4" /></button>
                  <button onClick={() => setStockAction({ product: p, mode: "reduce" })} title="Kurangi stok" className="p-2 rounded-md hover:bg-rose-600 hover:text-white" data-testid={`product-reduce-stock-${p.id}`}><PackageMinus className="h-4 w-4" /></button>
                  <button onClick={() => setStockAction({ product: p, mode: "adjust" })} title="Sesuaikan stok" className="p-2 rounded-md hover:bg-amber-500 hover:text-white" data-testid={`product-adjust-stock-${p.id}`}><SlidersHorizontal className="h-4 w-4" /></button>
                </td>
                <td className="p-4 text-right whitespace-nowrap">
                  <button onClick={() => setEditing(p)} title="Ubah" className="p-2 rounded-md hover:bg-slate-900 hover:text-white" data-testid={`product-edit-${p.id}`}><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => del(p)} title="Hapus" className="p-2 rounded-md hover:bg-rose-600 hover:text-white" data-testid={`product-delete-${p.id}`}><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="sm:max-w-md bg-background" data-testid="product-form-dialog">
          <DialogHeader><DialogTitle className="font-heading">{editing?.id ? "Ubah produk" : "Produk baru"}</DialogTitle></DialogHeader>
          {editing && <ProductForm key={editing.id || "new"} initial={editing} onSave={save} busy={busy} />}
        </DialogContent>
      </Dialog>
      <Dialog open={!!stockAction} onOpenChange={(v) => !v && setStockAction(null)}>
        <DialogContent className="sm:max-w-md bg-background" data-testid="stock-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading">{stockAction ? STOCK_MODE[stockAction.mode].title : ""}</DialogTitle>
            <DialogDescription>{stockAction ? STOCK_MODE[stockAction.mode].desc : ""}</DialogDescription>
          </DialogHeader>
          {stockAction && <StockForm key={stockAction.product.id + stockAction.mode} action={stockAction} busy={busy} onSubmit={runStock} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
