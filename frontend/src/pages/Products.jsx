import { useState, useEffect } from "react";
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

const EMPTY = { name: "", sku: "", price: 0, stock: 0, min_stock: 0, cost_price: 0, image_url: "", category_id: "", brand_id: "", collection_id: "" };

function useMasters() {
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: async () => { const { data } = await supabase.from("categories").select("*").order("name"); return data||[] } });
  const { data: brands = [] } = useQuery({ queryKey: ["brands"], queryFn: async () => { const { data } = await supabase.from("brands").select("*").order("name"); return data||[] } });
  const { data: collections = [] } = useQuery({ queryKey: ["collections"], queryFn: async () => { const { data } = await supabase.from("collections").select("*").order("name"); return data||[] } });
  return { categories, brands, collections };
}

function ProductForm({ initial, onSave, busy }) {
  const [f, setF] = useState(initial);
  const { categories, brands, collections } = useMasters();
  const isEdit =!!f.id;
  const set = (k) => (e) => setF({...f, [k]: e.target.value });
  const handleImageUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return;
    try {
      toast.loading("Kompres gambar...");
      const compressed = await imageCompression(file, { maxSizeMB: 0.15, maxWidthOrHeight: 800, useWebWorker: true });
      const fileName = `${Date.now()}-${file.name}`;
      const { error } = await supabase.storage.from('produk').upload(fileName, compressed);
      if (error) throw error;
      const { data } = supabase.storage.from('produk').getPublicUrl(fileName);
      setF({...f, image_url: data.publicUrl });
      toast.dismiss(); toast.success("Foto siap!");
    } catch (err) { toast.dismiss(); toast.error(err.message); }
  };
  return (
    <form className="space-y-4 max-h-[80vh] overflow-y-auto pr-1" onSubmit={(e) => { e.preventDefault(); onSave(f); }}>
      <div className="space-y-1.5"><Label>Nama</Label><Input required value={f.name} onChange={set("name")} /></div>
      <div className="space-y-1.5"><Label>SKU</Label><Input value={f.sku || ""} onChange={set("sku")} /></div>
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1.5"><Label>Kategori</Label><Select value={f.category_id || "none"} onValueChange={(v)=>setF({...f, category_id: v==="none"?"":v})}><SelectTrigger><SelectValue placeholder="Pilih" /></SelectTrigger><SelectContent><SelectItem value="none">Tanpa Kategori</SelectItem>{categories.map(c=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1.5"><Label>Brand</Label><Select value={f.brand_id || "none"} onValueChange={(v)=>setF({...f, brand_id: v==="none"?"":v})}><SelectTrigger><SelectValue placeholder="Pilih" /></SelectTrigger><SelectContent><SelectItem value="none">Tanpa Brand</SelectItem>{brands.map(c=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-1.5"><Label>Koleksi</Label><Select value={f.collection_id || "none"} onValueChange={(v)=>setF({...f, collection_id: v==="none"?"":v})}><SelectTrigger><SelectValue placeholder="Pilih" /></SelectTrigger><SelectContent><SelectItem value="none">Tanpa Koleksi</SelectItem>{collections.map(c=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>Harga Jual</Label><Input inputMode="numeric" className="font-mono" value={rupiah(f.price)} onChange={(e) => setF({...f, price: parseRupiah(e.target.value) })} /></div>
        <div className="space-y-1.5"><Label>Harga Modal</Label><Input inputMode="numeric" className="font-mono" value={rupiah(f.cost_price)} onChange={(e) => setF({...f, cost_price: parseRupiah(e.target.value) })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>Stok</Label><Input type="number" min="0" disabled={isEdit} value={f.stock} onChange={(e) => setF({...f, stock: Math.max(0, parseInt(e.target.value, 10) || 0) })} /></div>
        <div className="space-y-1.5"><Label>Stok Minimum</Label><Input type="number" min="0" value={f.min_stock} onChange={(e) => setF({...f, min_stock: Math.max(0, parseInt(e.target.value, 10) || 0) })} /></div>
      </div>
      <div className="space-y-1.5"><Label>Foto</Label><Input type="file" accept="image/*" onChange={handleImageUpload} />{f.image_url && <img src={f.image_url} className="w-24 h-24 object-cover mt-2 rounded-lg border" alt="preview" />}</div>
      <Button type="submit" disabled={busy} className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white">Simpan</Button>
    </form>
  );
}

const STOCK_MODE = { add: { title: "Tambah Stok", desc: "Catat stok masuk." }, reduce: { title: "Kurangi Stok", desc: "Catat stok keluar." }, adjust: { title: "Sesuaikan Stok", desc: "Setel stok ke hasil hitung fisik." } };

function StockForm({ action, busy, onSubmit }) {
  const { product, mode } = action;
  const [qty, setQty] = useState(""); const [target, setTarget] = useState(String(product.stock)); const [reason, setReason] = useState("adjustment"); const [notes, setNotes] = useState("");
  const submit = (e) => { e.preventDefault(); if (mode === "adjust") { const t = Math.max(0, parseInt(target, 10) || 0); const delta = t - product.stock; if (delta === 0) return toast.error("Nilai sama"); return onSubmit({ type: "adjustment", delta, notes: notes || "Penyesuaian stok" }); } const n = Math.max(0, parseInt(qty, 10) || 0); if (n <= 0) return toast.error("Masukkan jumlah"); if (mode === "add") return onSubmit({ type: "purchase", delta: n, notes }); return onSubmit({ type: reason, delta: -n, notes }); };
  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="rounded-lg bg-slate-50 border px-3 py-2 text-sm"><span className="font-semibold">{product.name}</span><span className="text-muted-foreground"> - Stok: </span><span className="font-mono font-bold">{product.stock}</span></div>
      {mode === "adjust"? (<div className="space-y-1.5"><Label>Stok fisik</Label><Input type="number" min="0" value={target} onChange={(e) => setTarget(e.target.value)} /></div>) : (<div className="space-y-1.5"><Label>{mode === "add"? "Jumlah masuk" : "Jumlah keluar"}</Label><Input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} autoFocus /></div>)}
      {mode === "reduce" && (<div className="space-y-1.5"><Label>Alasan</Label><Select value={reason} onValueChange={setReason}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="adjustment">Penyesuaian</SelectItem><SelectItem value="return">Retur</SelectItem></SelectContent></Select></div>)}
      <div className="space-y-1.5"><Label>Catatan</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
      <Button type="submit" disabled={busy} className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white">Simpan</Button>
    </form>
  );
}

function MasterManager({ table, label }){
  const [items, setItems] = useState([]); const [name, setName] = useState(""); const qc = useQueryClient();
  useEffect(()=>{ const load = async () => { const { data } = await supabase.from(table).select("*").order("created_at", {ascending:false}); setItems(data||[])}; load() }, [table])
  const add = async () => { if(!name.trim()) return; const { error } = await supabase.from(table).insert({ name: name.trim() }); if(error) return toast.error(error.message); setName(""); const { data } = await supabase.from(table).select("*").order("created_at", {ascending:false}); setItems(data||[]); qc.invalidateQueries({queryKey:[table]}); toast.success(`${label} ditambahkan`) }
  const del = async (id) => { if(!confirm(`Hapus ${label} ini?`)) return; const { error } = await supabase.from(table).delete().eq("id", id); if(error) return toast.error(error.message); setItems(items.filter(i=>i.id!==id)); qc.invalidateQueries({queryKey:[table]}); qc.invalidateQueries({queryKey:["products"]}) }
  return (
    <div className="bg-white rounded-xl border p-4">
      <h3 className="font-bold mb-3">{label}</h3>
      <div className="flex gap-2 mb-4"><Input placeholder={`Nama ${label} baru`} value={name} onChange={e=>setName(e.target.value)} className="h-10" /><Button onClick={add} className="bg-emerald-600 hover:bg-emerald-700"><Plus className="h-4 w-4 mr-1"/>Tambah</Button></div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">{items.map(it=>(<div key={it.id} className="flex justify-between items-center border rounded-lg px-3 py-2 bg-slate-50"><span className="text-sm font-medium truncate">{it.name}</span><button onClick={()=>del(it.id)} className="text-rose-500 hover:text-rose-700 ml-2 p-1"><Trash2 className="h-4 w-4"/></button></div>))}{items.length===0 && <p className="text-sm text-slate-400">Belum ada {label}</p>}</div>
    </div>
  )
}

export default function Products() {
  const { activeOutletId, activeOutlet } = useAuth(); const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["products", activeOutletId], queryFn: () => fetchProducts(activeOutletId), enabled:!!activeOutletId });
  const [editing, setEditing] = useState(null); const [stockAction, setStockAction] = useState(null); const [busy, setBusy] = useState(false);
  const [mainTab, setMainTab] = useState("produk"); const [masterTab, setMasterTab] = useState("kategori");
  const [filterCat, setFilterCat] = useState("all"); const [filterBrand, setFilterBrand] = useState("all"); const [filterColl, setFilterColl] = useState("all");
  const { categories, brands, collections } = useMasters();
  const save = async (f) => { setBusy(true); try { if (f.id) { const { error } = await supabase.from("products").update({ name: f.name.trim(), sku: f.sku || null, price: f.price, cost_price: f.cost_price, min_stock: f.min_stock, image_url: f.image_url, category_id: f.category_id || null, brand_id: f.brand_id || null, collection_id: f.collection_id || null }).eq("id", f.id); if (error) throw error; } else { const { data: row, error } = await supabase.from("products").insert({ outlet_id: activeOutletId, name: f.name.trim(), sku: f.sku || null, price: f.price, cost_price: f.cost_price, min_stock: f.min_stock, image_url: f.image_url, stock: 0, category_id: f.category_id || null, brand_id: f.brand_id || null, collection_id: f.collection_id || null }).select("id").single(); if (error) throw error; if (f.stock > 0) await recordStockMovement({ product_id: row.id, type: "purchase", delta: f.stock, notes: "Stok awal" }); } toast.success("Produk disimpan"); setEditing(null); qc.invalidateQueries({ queryKey: ["products", activeOutletId] }); } catch (e) { toast.error(movementError(e)); } finally { setBusy(false); } };
  const del = async (p) => { if (!window.confirm(`Hapus ${p.name}?`)) return; const { error } = await supabase.from("products").delete().eq("id", p.id); if (error) return toast.error(error.message); qc.invalidateQueries({ queryKey: ["products", activeOutletId] }); };
  const runStock = async ({ type, delta, notes }) => { setBusy(true); try { await recordStockMovement({ product_id: stockAction.product.id, type, delta, notes }); toast.success("Stok diperbarui"); setStockAction(null); qc.invalidateQueries({ queryKey: ["products", activeOutletId] }); qc.invalidateQueries({ queryKey: ["movements"] }); } catch (e) { toast.error(movementError(e)); } finally { setBusy(false); } };
  const filtered = data.filter(p=>{ if(filterCat!=="all" && p.category_id!==filterCat) return false; if(filterBrand!=="all" && p.brand_id!==filterBrand) return false; if(filterColl!=="all" && p.collection_id!==filterColl) return false; return true; })
  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6"><div><p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">{activeOutlet?.name}</p><h1 className="font-heading text-3xl sm:text-4xl font-extrabold tracking-tight">Produk</h1></div>{mainTab==="produk" && <Button onClick={() => setEditing(EMPTY)} disabled={!activeOutletId} className="bg-slate-900 hover:bg-emerald-700 text-white"><Plus className="h-4 w-4 mr-1" /> Tambah produk</Button>}</div>
      <div className="flex gap-2 mb-6"><Button variant={mainTab==="produk"?"default":"outline"} onClick={()=>setMainTab("produk")} className={mainTab==="produk"?"bg-emerald-600 hover:bg-emerald-700":""}>Semua Produk</Button><Button variant={mainTab==="master"?"default":"outline"} onClick={()=>setMainTab("master")} className={mainTab==="master"?"bg-emerald-600 hover:bg-emerald-700":""}>Kategori / Brand / Koleksi</Button></div>
      {mainTab==="master"? (<div className="space-y-4"><div className="flex gap-2"><Button size="sm" variant={masterTab==="kategori"?"default":"outline"} onClick={()=>setMasterTab("kategori")} className={masterTab==="kategori"?"bg-slate-900":""}>Kategori</Button><Button size="sm" variant={masterTab==="brand"?"default":"outline"} onClick={()=>setMasterTab("brand")} className={masterTab==="brand"?"bg-slate-900":""}>Brand</Button><Button size="sm" variant={masterTab==="koleksi"?"default":"outline"} onClick={()=>setMasterTab("koleksi")} className={masterTab==="koleksi"?"bg-slate-900":""}>Koleksi</Button></div>{masterTab==="kategori" && <MasterManager table="categories" label="Kategori" />}{masterTab==="brand" && <MasterManager table="brands" label="Brand" />}{masterTab==="koleksi" && <MasterManager table="collections" label="Koleksi" />}</div>) : (<><div className="flex flex-wrap gap-2 mb-4"><Select value={filterCat} onValueChange={setFilterCat}><SelectTrigger className="w-[160px]"><SelectValue placeholder="Kategori" /></SelectTrigger><SelectContent><SelectItem value="all">Semua Kategori</SelectItem>{categories.map(c=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select><Select value={filterBrand} onValueChange={setFilterBrand}><SelectTrigger className="w-[160px]"><SelectValue placeholder="Brand" /></SelectTrigger><SelectContent><SelectItem value="all">Semua Brand</SelectItem>{brands.map(c=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select><Select value={filterColl} onValueChange={setFilterColl}><SelectTrigger className="w-[160px]"><SelectValue placeholder="Koleksi" /></SelectTrigger><SelectContent><SelectItem value="all">Semua Koleksi</SelectItem>{collections.map(c=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div><div className="rounded-xl border bg-white overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="p-4">Produk</th><th className="p-4">SKU</th><th className="p-4">Kategori/Brand</th><th className="p-4 text-right">Modal</th><th className="p-4 text-right">Harga</th><th className="p-4 text-right">Min</th><th className="p-4 text-right">Stok</th><th className="p-4 text-right">Aksi Stok</th><th className="p-4" /></tr></thead><tbody>{isLoading && <tr><td className="p-4 text-muted-foreground" colSpan={10}>Memuat…</td></tr>}{filtered.map((p) => {const minStock = p.min_stock?? 0; const low = p.stock <= minStock; const catName = categories.find(c=>c.id===p.category_id)?.name; const brandName = brands.find(c=>c.id===p.brand_id)?.name; return (<tr key={p.id} className={`border-b last:border-b-0 ${low? "bg-rose-50/70 hover:bg-rose-50" : "hover:bg-slate-50"}`}><td className="p-4"><div className="flex items-center gap-2">{p.image_url? (<img src={p.image_url} alt={p.name} className="h-10 w-10 rounded object-cover border" />) : (<div className="h-10 w-10 rounded bg-slate-100 border flex items-center justify-center text-[10px] text-slate-400">No</div>)}<span className="font-semibold">{p.name}{low && <Badge variant="outline" className="border-rose-200 bg-rose-100 text-rose-700 gap-1 ml-2"><AlertTriangle className="h-3 w-3" /> rendah</Badge>}</span></div></td><td className="p-4 font-mono text-slate-500">{p.sku}</td><td className="p-4"><div className="flex flex-col gap-1"><span className="text-xs px-2 py-0.5 rounded bg-slate-100 border w-fit">{catName||"-"}</span><span className="text-xs px-2 py-0.5 rounded bg-blue-50 border w-fit">{brandName||"-"}</span></div></td><td className="p-4 text-right font-mono text-slate-500">{rupiah(p.cost_price?? 0)}</td><td className="p-4 text-right font-mono">{rupiah(p.price)}</td><td className="p-4 text-right font-mono text-slate-500">{minStock}</td><td className="p-4 text-right font-mono font-bold">{p.stock}</td><td className="p-4 text-right whitespace-nowrap"><button onClick={() => setStockAction({ product: p, mode: "add" })} className="p-2 rounded-md hover:bg-emerald-600 hover:text-white"><PackagePlus className="h-4 w-4" /></button><button onClick={() => setStockAction({ product: p, mode: "reduce" })} className="p-2 rounded-md hover:bg-rose-600 hover:text-white"><PackageMinus className="h-4 w-4" /></button><button onClick={() => setStockAction({ product: p, mode: "adjust" })} className="p-2 rounded-md hover:bg-amber-500 hover:text-white"><SlidersHorizontal className="h-4 w-4" /></button></td><td className="p-4 text-right whitespace-nowrap"><button onClick={() => setEditing(p)} className="p-2 rounded-md hover:bg-slate-900 hover:text-white"><Pencil className="h-4 w-4" /></button><button onClick={() => del(p)} className="p-2 rounded-md hover:bg-rose-600 hover:text-white"><Trash2 className="h-4 w-4" /></button></td></tr>);})}</tbody></table></div></>)}
      <Dialog open={!!editing} onOpenChange={(v) =>!v && setEditing(null)}><DialogContent className="sm:max-w-lg bg-background"><DialogHeader><DialogTitle>{editing?.id? "Ubah produk" : "Produk baru"}</DialogTitle></DialogHeader>{editing && <ProductForm key={editing.id || "new"} initial={editing} onSave={save} busy={busy} />}</DialogContent></Dialog>
      <Dialog open={!!stockAction} onOpenChange={(v) =>!v && setStockAction(null)}><DialogContent className="sm:max-w-md bg-background"><DialogHeader><DialogTitle>{stockAction? STOCK_MODE[stockAction.mode].title : ""}</DialogTitle><DialogDescription>{stockAction? STOCK_MODE[stockAction.mode].desc : ""}</DialogDescription></DialogHeader>{stockAction && <StockForm key={stockAction.product.id + stockAction.mode} action={stockAction} busy={busy} onSubmit={runStock} />}</DialogContent></Dialog>
    </div>
  );
}
