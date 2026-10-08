import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, PackageCheck, ShoppingCart, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { fetchProducts } from "@/pages/POS";
import { rupiah, parseRupiah } from "@/lib/format";
import { PageHeader, TableShell } from "@/components/reports/parts";

const today = () => new Date().toISOString().slice(0, 10);
const STATUS = {
  Draft: "border-amber-200 bg-amber-100 text-amber-700",
  Diterima: "border-emerald-200 bg-emerald-100 text-emerald-700",
  Dibatalkan: "border-slate-200 bg-slate-100 text-slate-600",
};
const fmtDate = (d) => new Date(d).toLocaleDateString("id-ID", { dateStyle: "medium" });

function PurchaseBuilder({ outletId, suppliers, products, onDone }) {
  const [supplierId, setSupplierId] = useState("");
  const [invoice, setInvoice] = useState("");
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState([{ product_id: "", qty: 1, buy_price: 0 }]);
  const [busy, setBusy] = useState(false);

  const setItem = (i, patch) => setItems((xs) => xs.map((x, idx) => (idx === i ? { ...x, ...patch } : x)));
  const addRow = () => setItems((xs) => [...xs, { product_id: "", qty: 1, buy_price: 0 }]);
  const removeRow = (i) => setItems((xs) => (xs.length > 1 ? xs.filter((_, idx) => idx !== i) : xs));
  const total = items.reduce((s, it) => s + (it.qty || 0) * (it.buy_price || 0), 0);

  const submit = async () => {
    const valid = items.filter((it) => it.product_id && it.qty > 0);
    if (!valid.length) return toast.error("Tambahkan minimal 1 produk dengan qty > 0");
    setBusy(true);
    try {
      await api.post("/purchases", {
        supplier_id: supplierId || null, outlet_id: outletId, invoice_no: invoice || null,
        date, notes: notes || null, items: valid.map((it) => ({ product_id: it.product_id, qty: Number(it.qty), buy_price: Number(it.buy_price) })),
      });
      toast.success("Pembelian dibuat (Draft)");
      onDone();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label>Supplier</Label>
          <Select value={supplierId} onValueChange={setSupplierId}>
            <SelectTrigger data-testid="purchase-supplier-select"><SelectValue placeholder="Pilih supplier" /></SelectTrigger>
            <SelectContent>{suppliers.map((s) => <SelectItem key={s.id} value={s.id} data-testid={`purchase-supplier-${s.id}`}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5"><Label>No. Invoice</Label><Input value={invoice} onChange={(e) => setInvoice(e.target.value)} placeholder="INV-001" data-testid="purchase-invoice-input" /></div>
        <div className="space-y-1.5"><Label>Tanggal</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} data-testid="purchase-date-input" /></div>
      </div>

      <div className="rounded-lg border divide-y">
        <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs uppercase tracking-wider text-muted-foreground bg-slate-50">
          <div className="col-span-5">Produk</div><div className="col-span-2 text-right">Qty</div>
          <div className="col-span-3 text-right">Harga Beli</div><div className="col-span-2 text-right">Subtotal</div>
        </div>
        {items.map((it, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 px-3 py-2 items-center" data-testid={`purchase-item-row-${i}`}>
            <div className="col-span-5">
              <Select value={it.product_id} onValueChange={(v) => setItem(i, { product_id: v })}>
                <SelectTrigger data-testid={`purchase-item-product-${i}`}><SelectValue placeholder="Pilih produk" /></SelectTrigger>
                <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Input type="number" min="1" className="text-right font-mono" value={it.qty} onChange={(e) => setItem(i, { qty: Math.max(1, parseInt(e.target.value, 10) || 1) })} data-testid={`purchase-item-qty-${i}`} /></div>
            <div className="col-span-3"><Input inputMode="numeric" className="text-right font-mono" value={rupiah(it.buy_price)} onChange={(e) => setItem(i, { buy_price: parseRupiah(e.target.value) })} data-testid={`purchase-item-price-${i}`} /></div>
            <div className="col-span-1 text-right font-mono text-sm">{rupiah((it.qty || 0) * (it.buy_price || 0))}</div>
            <div className="col-span-1 text-right"><button onClick={() => removeRow(i)} className="p-1.5 rounded hover:bg-rose-600 hover:text-white" data-testid={`purchase-item-remove-${i}`}><Trash2 className="h-4 w-4" /></button></div>
          </div>
        ))}
        <div className="px-3 py-2"><Button variant="outline" size="sm" onClick={addRow} className="gap-1" data-testid="purchase-add-item"><Plus className="h-4 w-4" /> Tambah produk</Button></div>
      </div>

      <div className="space-y-1.5"><Label>Catatan</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} data-testid="purchase-notes-input" /></div>

      <div className="flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3">
        <span className="font-semibold text-emerald-800">Total Pembelian</span>
        <span className="text-2xl font-extrabold font-mono text-emerald-700" data-testid="purchase-total">{rupiah(total)}</span>
      </div>
      <Button onClick={submit} disabled={busy} className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="purchase-submit-button">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Simpan Pembelian"}
      </Button>
    </div>
  );
}

export default function Purchases() {
  const { activeOutletId, activeOutlet } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [receiving, setReceiving] = useState(null);

  const { data: purchases = [], isLoading } = useQuery({ queryKey: ["purchases", activeOutletId], queryFn: () => api.get(`/purchases?outlet_id=${activeOutletId}`), enabled: !!activeOutletId });
  const { data: suppliers = [] } = useQuery({ queryKey: ["suppliers"], queryFn: () => api.get("/suppliers") });
  const { data: products = [] } = useQuery({ queryKey: ["products", activeOutletId], queryFn: () => fetchProducts(activeOutletId), enabled: !!activeOutletId });

  const refresh = () => { setOpen(false); qc.invalidateQueries({ queryKey: ["purchases", activeOutletId] }); };

  const receive = async (p) => {
    if (!window.confirm(`Terima pembelian ${p.invoice_no || ""}? Stok & HPP produk akan diperbarui.`)) return;
    setReceiving(p.id);
    try {
      await api.post(`/purchases/${p.id}/receive`);
      toast.success("Pembelian diterima — stok & HPP diperbarui");
      qc.invalidateQueries({ queryKey: ["purchases", activeOutletId] });
      qc.invalidateQueries({ queryKey: ["products", activeOutletId] });
      qc.invalidateQueries({ queryKey: ["movements"] });
    } catch (e) { toast.error(e.message); } finally { setReceiving(null); }
  };

  const del = async (p) => {
    if (!window.confirm("Hapus pembelian ini?")) return;
    try { await api.del(`/purchases/${p.id}`); qc.invalidateQueries({ queryKey: ["purchases", activeOutletId] }); toast.success("Dihapus"); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader outlet={activeOutlet} title="Pembelian" subtitle="Buat pembelian ke supplier. Saat Diterima, stok & HPP rata-rata otomatis diperbarui." />
        <Button onClick={() => setOpen(true)} disabled={!activeOutletId} className="bg-slate-900 hover:bg-emerald-700 text-white" data-testid="purchase-create-button"><Plus className="h-4 w-4 mr-1" /> Buat Pembelian</Button>
      </div>
      <TableShell testId="purchases-table">
        <thead><tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
          <th className="p-4">Tanggal</th><th className="p-4">Invoice</th><th className="p-4">Supplier</th>
          <th className="p-4 text-right">Total</th><th className="p-4">Status</th><th className="p-4 text-right">Aksi</th>
        </tr></thead>
        <tbody>
          {isLoading && <tr><td className="p-4 text-muted-foreground" colSpan={6}>Memuat…</td></tr>}
          {!isLoading && purchases.length === 0 && <tr><td className="p-8 text-center text-muted-foreground" colSpan={6}><ShoppingCart className="h-6 w-6 mx-auto mb-2 opacity-50" />Belum ada pembelian.</td></tr>}
          {purchases.map((p) => (
            <tr key={p.id} className="border-b last:border-b-0 hover:bg-slate-50" data-testid={`purchase-row-${p.id}`}>
              <td className="p-4 whitespace-nowrap text-slate-500">{fmtDate(p.date)}</td>
              <td className="p-4 font-mono">{p.invoice_no || "—"}</td>
              <td className="p-4 font-semibold">{p.suppliers?.name || "—"}</td>
              <td className="p-4 text-right font-mono font-bold">{rupiah(p.total_cost)}</td>
              <td className="p-4"><Badge variant="outline" className={STATUS[p.status]} data-testid={`purchase-status-${p.id}`}>{p.status}</Badge></td>
              <td className="p-4 text-right whitespace-nowrap">
                {p.status === "Draft" && (
                  <>
                    <button onClick={() => receive(p)} disabled={receiving === p.id} title="Terima" className="p-2 rounded-md hover:bg-emerald-600 hover:text-white disabled:opacity-50" data-testid={`purchase-receive-${p.id}`}>
                      {receiving === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}
                    </button>
                    <button onClick={() => del(p)} title="Hapus" className="p-2 rounded-md hover:bg-rose-600 hover:text-white" data-testid={`purchase-delete-${p.id}`}><Trash2 className="h-4 w-4" /></button>
                  </>
                )}
                {p.status === "Diterima" && <span className="text-xs text-emerald-600 font-medium">✓ {p.received_at ? fmtDate(p.received_at) : ""}</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </TableShell>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl bg-background max-h-[90vh] overflow-y-auto" data-testid="purchase-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading">Buat Pembelian</DialogTitle>
            <DialogDescription>Pilih supplier & produk. Total dihitung otomatis. Terapkan stok lewat tombol Terima.</DialogDescription>
          </DialogHeader>
          {open && <PurchaseBuilder outletId={activeOutletId} suppliers={suppliers} products={products} onDone={refresh} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
