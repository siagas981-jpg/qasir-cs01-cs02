import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, Phone, MapPin, Truck, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const EMPTY = { name: "", phone: "", address: "" };

function SupplierForm({ initial, onSave, busy }) {
  const [f, setF] = useState(initial);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSave(f); }}>
      <div className="space-y-1.5"><Label className="text-[11px]">Nama Supplier</Label><Input required value={f.name} onChange={set("name")} className="h-9 text-[12px]" data-testid="supplier-name-input" /></div>
      <div className="space-y-1.5"><Label className="text-[11px]">No. Telepon</Label><Input value={f.phone || ""} onChange={set("phone")} className="h-9 text-[12px]" data-testid="supplier-phone-input" /></div>
      <div className="space-y-1.5"><Label className="text-[11px]">Alamat</Label><Textarea rows={2} value={f.address || ""} onChange={set("address")} className="text-[12px]" data-testid="supplier-address-input" /></div>
      <Button type="submit" disabled={busy} className="w-full h-9 bg-emerald-600 hover:bg-emerald-700 text-white text-[12px]" data-testid="supplier-submit-button">Simpan</Button>
    </form>
  );
}

export default function Suppliers() {
  const { activeOutlet } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");

  // FIX ANTI o.map ERROR!
  const { data: raw, isLoading } = useQuery({ 
    queryKey: ["suppliers"], 
    queryFn: () => api.get("/suppliers") 
  });

  const data = useMemo(() => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.data)) return raw.data;
    if (Array.isArray(raw?.suppliers)) return raw.suppliers;
    return [];
  }, [raw]);

  const filtered = useMemo(() => {
    if (!q) return data;
    const s = q.toLowerCase();
    return data.filter(x => 
      (x.name||"").toLowerCase().includes(s) ||
      (x.phone||"").includes(s)
    );
  }, [data, q]);

  const save = async (f) => {
    setBusy(true);
    try {
      const payload = { name: f.name.trim(), phone: f.phone || null, address: f.address || null };
      if (f.id) await api.put(`/suppliers/${f.id}`, payload);
      else await api.post("/suppliers", payload);
      toast.success("Supplier disimpan");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["suppliers"] });
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  const del = async (s) => {
    if (!window.confirm(`Hapus supplier ${s.name}?`)) return;
    try { await api.del(`/suppliers/${s.id}`); qc.invalidateQueries({ queryKey: ["suppliers"] }); toast.success("Dihapus"); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <div className="w-full max-w-none px-4 md:px-6 py-4 space-y-3 bg-[#fbfbfb] min-h-screen">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-700">{activeOutlet?.name}</p>
          <h1 className="text-2xl font-extrabold tracking-tight">Supplier</h1>
          <p className="text-[11px] text-slate-500 mt-0.5">{data.length} supplier • {filtered.length} tampil</p>
        </div>
        <Button onClick={() => setEditing(EMPTY)} className="h-9 bg-slate-900 hover:bg-emerald-700 text-white text-[12px]" data-testid="supplier-add-button"><Plus className="h-4 w-4 mr-1" /> Tambah supplier</Button>
      </div>

      <div className="flex gap-2">
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-2.5 h-9 w-full max-w-sm">
          <Search className="h-4 w-4 text-slate-400" />
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Cari nama / hp..." className="w-full outline-none text-[12px] bg-transparent" />
          {q && <button onClick={()=>setQ("")} className="p-1 hover:bg-slate-100 rounded"><X className="h-3.5 w-3.5" /></button>}
        </div>
      </div>

      <div className="w-full bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-[11px]" data-testid="suppliers-table">
            <thead>
              <tr className="border-b bg-slate-50/80 text-left text-[10px] uppercase tracking-wider text-slate-500">
                <th className="py-2.5 px-3 font-bold">Nama</th>
                <th className="py-2.5 px-3 font-bold">Telepon</th>
                <th className="py-2.5 px-3 font-bold">Alamat</th>
                <th className="py-2.5 px-3 font-bold w-[80px]"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr><td className="py-6 px-3 text-slate-500 text-[11px]" colSpan={4}>Memuat…</td></tr>}
              {!isLoading && filtered.length === 0 && <tr><td className="py-10 text-center text-slate-500" colSpan={4}><Truck className="h-5 w-5 mx-auto mb-1.5 opacity-50" /><span className="text-[11px]">Belum ada supplier.</span></td></tr>}
              {filtered.map((s) => (
                <tr key={s.id} className="border-b last:border-b-0 hover:bg-slate-50/70 transition" data-testid={`supplier-row-${s.id}`}>
                  <td className="py-2.5 px-3 font-semibold text-slate-900">{s.name}</td>
                  <td className="py-2.5 px-3 text-slate-600">{s.phone ? <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3 text-slate-400" />{s.phone}</span> : "—"}</td>
                  <td className="py-2.5 px-3 text-slate-600 max-w-[300px] truncate">{s.address ? <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3 text-slate-400" />{s.address}</span> : "—"}</td>
                  <td className="py-1.5 px-3 text-right whitespace-nowrap">
                    <button onClick={() => setEditing(s)} title="Ubah" className="p-1.5 rounded-md hover:bg-slate-900 hover:text-white transition" data-testid={`supplier-edit-${s.id}`}><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => del(s)} title="Hapus" className="p-1.5 rounded-md hover:bg-rose-600 hover:text-white transition ml-1" data-testid={`supplier-delete-${s.id}`}><Trash2 className="h-3.5 w-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="sm:max-w-md bg-background" data-testid="supplier-dialog">
          <DialogHeader><DialogTitle className="font-heading text-[14px]">{editing?.id ? "Ubah supplier" : "Supplier baru"}</DialogTitle></DialogHeader>
          {editing && <SupplierForm key={editing.id || "new"} initial={editing} onSave={save} busy={busy} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
