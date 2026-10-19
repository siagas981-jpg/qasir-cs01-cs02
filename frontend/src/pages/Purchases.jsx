import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, PackageCheck, ShoppingCart, Loader2, Calendar, X, Search } from "lucide-react";
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

const today = () => new Date().toISOString().slice(0, 10);
const STATUS = {
  Draft: "border-amber-200 bg-amber-100 text-amber-700",
  Diterima: "border-emerald-200 bg-emerald-100 text-emerald-700",
  Dibatalkan: "border-slate-200 bg-slate-100 text-slate-600",
};
const fmtDate = (d) => new Date(d).toLocaleDateString("id-ID", { dateStyle: "medium" });
const toDateInput = (d) => d.toISOString().slice(0, 10);

// HELPER ANTI s.map ERROR
const asArray = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw?.data)) return raw.data;
  if (Array.isArray(raw?.purchases)) return raw.purchases;
  if (Array.isArray(raw?.suppliers)) return raw.suppliers;
  if (Array.isArray(raw?.products)) return raw.products;
  return [];
};

function PurchaseBuilder({ outletId, suppliersRaw, productsRaw, onDone }) {
  const suppliers = asArray(suppliersRaw);
  const products = asArray(productsRaw);

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
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-[11px]">Supplier</Label>
          <Select value={supplierId} onValueChange={setSupplierId}>
            <SelectTrigger className="h-9 text-[12px]" data-testid="purchase-supplier-select"><SelectValue placeholder="Pilih supplier" /></SelectTrigger>
            <SelectContent>{suppliers.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1"><Label className="text-[11px]">No. Invoice</Label><Input value={invoice} onChange={(e) => setInvoice(e.target.value)} placeholder="INV-001" className="h-9 text-[12px]" /></div>
        <div className="space-y-1"><Label className="text-[11px]">Tanggal</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 text-[12px]" /></div>
      </div>

      <div className="rounded-lg border divide-y bg-white">
        <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[10px] uppercase tracking-wider text-slate-500 bg-slate-50">
          <div className="col-span-5">Produk</div><div className="col-span-2 text-right">Qty</div>
          <div className="col-span-3 text-right">Harga Beli</div><div className="col-span-2 text-right">Subtotal</div>
        </div>
        {items.map((it, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 px-3 py-1.5 items-center">
            <div className="col-span-5">
              <Select value={it.product_id} onValueChange={(v) => setItem(i, { product_id: v })}>
                <SelectTrigger className="h-8 text-[11px]"><SelectValue placeholder="Pilih produk" /></SelectTrigger>
                <SelectContent>{products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="col-span-2"><Input type="number" min="1" className="h-8 text-right font-mono text-[11px]" value={it.qty} onChange={(e) => setItem(i, { qty: Math.max(1, parseInt(e.target.value, 10) || 1) })} /></div>
            <div className="col-span-3"><Input inputMode="numeric" className="h-8 text-right font-mono text-[11px]" value={rupiah(it.buy_price)} onChange={(e) => setItem(i, { buy_price: parseRupiah(e.target.value) })} /></div>
            <div className="col-span-1 text-right font-mono text-[11px]">{rupiah((it.qty || 0) * (it.buy_price || 0))}</div>
            <div className="col-span-1 text-right"><button onClick={() => removeRow(i)} className="p-1.5 rounded hover:bg-rose-600 hover:text-white"><Trash2 className="h-3.5 w-3.5" /></button></div>
          </div>
        ))}
        <div className="px-3 py-1.5"><Button variant="outline" size="sm" onClick={addRow} className="h-8 text-[11px] gap-1"><Plus className="h-3.5 w-3.5" /> Tambah produk</Button></div>
      </div>

      <div className="space-y-1"><Label className="text-[11px]">Catatan</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className="text-[12px]" /></div>

      <div className="flex items-center justify-between rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
        <span className="text-[11px] font-semibold text-emerald-800">Total Pembelian</span>
        <span className="text-xl font-extrabold font-mono text-emerald-700">{rupiah(total)}</span>
      </div>
      <Button onClick={submit} disabled={busy} className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white text-[12px]">
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
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [q, setQ] = useState("");

  const { data: purchasesRaw, isLoading } = useQuery({ queryKey: ["purchases", activeOutletId], queryFn: () => api.get(`/purchases?outlet_id=${activeOutletId}`), enabled: !!activeOutletId });
  const { data: suppliersRaw } = useQuery({ queryKey: ["suppliers"], queryFn: () => api.get("/suppliers") });
  const { data: productsRaw } = useQuery({ queryKey: ["products", activeOutletId], queryFn: () => fetchProducts(activeOutletId), enabled: !!activeOutletId });

  const purchases = useMemo(() => asArray(purchasesRaw), [purchasesRaw]);

  const filtered = useMemo(() => {
    return purchases.filter(p => {
      if (from) { const f = new Date(from); f.setHours(0,0,0,0); if (new Date(p.date) < f) return false; }
      if (to) { const t = new Date(to); t.setHours(23,59,59,999); if (new Date(p.date) > t) return false; }
      if (q) { const s = q.toLowerCase(); return (p.invoice_no||"").toLowerCase().includes(s) || (p.suppliers?.name||"").toLowerCase().includes(s); }
      return true;
    });
  }, [purchases, from, to, q]);

  const setPreset = (p) => {
    const now = new Date();
    if (p === "today") { setFrom(toDateInput(now)); setTo(toDateInput(now)); }
    if (p === "7d") { const d = new Date(); d.setDate(d.getDate()-6); setFrom(toDateInput(d)); setTo(toDateInput(now)); }
    if (p === "month") { const d = new Date(now.getFullYear(), now.getMonth(), 1); setFrom(toDateInput(d)); setTo(toDateInput(now)); }
    if (p === "reset") { setFrom(""); setTo(""); setQ(""); }
  };

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
    <div className="w-full max-w-none px-4 md:px-6 py-4 space-y-3 bg-[#fbfbfb] min-h-screen">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700">{activeOutlet?.name}</p>
          <h1 className="text-2xl font-extrabold tracking-tight">Pembelian</h1>
          <p className="text-[11px] text-slate-500 mt-0.5">{purchases.length} pembelian • {filtered.length} tampil — Saat Diterima, stok & HPP otomatis update.</p>
        </div>
        <Button onClick={() => setOpen(true)} disabled={!activeOutletId} className="h-9 bg-slate-900 hover:bg-emerald-700 text-white text-[12px]"><Plus className="h-4 w-4 mr-1" /> Buat Pembelian</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2.5 h-9 w-full max-w-[200px]">
          <Search className="h-4 w-4 text-slate-400" />
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Cari invoice / supplier" className="w-full outline-none text-[11px] bg-transparent" />
          {q && <button onClick={()=>setQ("")}><X className="h-3 w-3" /></button>}
        </div>
        <div className="h-6 w-px bg-slate-200" />
        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-2 h-9">
          <Calendar className="h-3.5 w-3.5 text-slate-400" />
          <input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="text-[11px] outline-none w-[120px]" />
          <span className="text-[10px] text-slate-400">-</span>
          <input type="date" value={to} onChange={e=>setTo(e.target.value)} className="text-[11px] outline-none w-[120px]" />
        </div>
        <button onClick={()=>setPreset("today")} className="h-9 px-2.5 text-[11px] rounded-lg border bg-white hover:bg-slate-50">Hari ini</button>
        <button onClick={()=>setPreset("7d")} className="h-9 px-2.5 text-[11px] rounded-lg border bg-white hover:bg-slate-50">7 Hari</button>
        <button onClick={()=>setPreset("month")} className="h-9 px-2.5 text-[11px] rounded-lg border bg-white hover:bg-slate-50">Bulan ini</button>
        {(from||to||q) && <button onClick={()=>setPreset("reset")} className="h-9 px-2.5 text-[11px] rounded-lg bg-slate-900 text-white">Reset</button>}
      </div>

      <div className="w-full bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b bg-slate-50/80 text-left text-[10px] uppercase tracking-wider text-slate-500">
                <th className="py-2.5 px-3 font-bold">Tanggal</th>
                <th className="py-2.5 px-3 font-bold">Invoice</th>
                <th className="py-2.5 px-3 font-bold">Supplier</th>
                <th className="py-2.5 px-3 text-right font-bold">Total</th>
                <th className="py-2.5 px-3 font-bold">Status</th>
                <th className="py-2.5 px-3 text-right font-bold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td className="py-6 px-3 text-slate-500" colSpan={6}>Memuat…</td></tr>}
              {!isLoading && filtered.length === 0 && <tr><td className="py-10 text-center text-slate-500" colSpan={6}><ShoppingCart className="h-5 w-5 mx-auto mb-1.5 opacity-50" /><span className="text-[11px]">Belum ada pembelian di rentang ini.</span></td></tr>}
              {filtered.map((p) => (
                <tr key={p.id} className="border-b last:border-b-0 hover:bg-slate-50/70 transition">
                  <td className="py-2.5 px-3 whitespace-nowrap text-slate-500">{fmtDate(p.date)}</td>
                  <td className="py-2.5 px-3 font-mono font-semibold">{p.invoice_no || "—"}</td>
                  <td className="py-2.5 px-3 font-semibold text-slate-900">{p.suppliers?.name || "—"}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold">{rupiah(p.total_cost)}</td>
                  <td className="py-2.5 px-3"><Badge variant="outline" className={`text-[10px] h-5 px-1.5 border ${STATUS[p.status]}`}>{p.status}</Badge></td>
                  <td className="py-1.5 px-3 text-right whitespace-nowrap">
                    {p.status === "Draft" && (
                      <>
                        <button onClick={() => receive(p)} disabled={receiving === p.id} title="Terima" className="p-1.5 rounded-md hover:bg-emerald-600 hover:text-white disabled:opacity-50 transition">
                          {receiving === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PackageCheck className="h-3.5 w-3.5" />}
                        </button>
                        <button onClick={() => del(p)} title="Hapus" className="p-1.5 rounded-md hover:bg-rose-600 hover:text-white transition ml-1"><Trash2 className="h-3.5 w-3.5" /></button>
                      </>
                    )}
                    {p.status === "Diterima" && <span className="text-[11px] text-emerald-600 font-medium">✓ {p.received_at ? fmtDate(p.received_at) : ""}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl bg-background max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-heading text-[14px]">Buat Pembelian</DialogTitle>
            <DialogDescription className="text-[11px]">Pilih supplier & produk. Total dihitung otomatis. Terapkan stok lewat tombol Terima.</DialogDescription>
          </DialogHeader>
          {open && <PurchaseBuilder outletId={activeOutletId} suppliersRaw={suppliersRaw} productsRaw={productsRaw} onDone={refresh} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
