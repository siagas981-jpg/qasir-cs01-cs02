import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2, Phone, MapPin, Truck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { PageHeader, TableShell } from "@/components/reports/parts";

const EMPTY = { name: "", phone: "", address: "" };

function SupplierForm({ initial, onSave, busy }) {
  const [f, setF] = useState(initial);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSave(f); }}>
      <div className="space-y-1.5"><Label>Nama Supplier</Label><Input required value={f.name} onChange={set("name")} data-testid="supplier-name-input" /></div>
      <div className="space-y-1.5"><Label>No. Telepon</Label><Input value={f.phone || ""} onChange={set("phone")} data-testid="supplier-phone-input" /></div>
      <div className="space-y-1.5"><Label>Alamat</Label><Textarea rows={2} value={f.address || ""} onChange={set("address")} data-testid="supplier-address-input" /></div>
      <Button type="submit" disabled={busy} className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="supplier-submit-button">Simpan</Button>
    </form>
  );
}

export default function Suppliers() {
  const { activeOutlet } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState(false);
  const { data = [], isLoading } = useQuery({ queryKey: ["suppliers"], queryFn: () => api.get("/suppliers") });

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
    <div className="p-4 md:p-8 max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <PageHeader outlet={activeOutlet} title="Supplier" subtitle="Kelola data pemasok barang." />
        <Button onClick={() => setEditing(EMPTY)} className="bg-slate-900 hover:bg-emerald-700 text-white" data-testid="supplier-add-button"><Plus className="h-4 w-4 mr-1" /> Tambah supplier</Button>
      </div>
      <TableShell testId="suppliers-table">
        <thead><tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
          <th className="p-4">Nama</th><th className="p-4">Telepon</th><th className="p-4">Alamat</th><th className="p-4" />
        </tr></thead>
        <tbody>
          {isLoading && <tr><td className="p-4 text-muted-foreground" colSpan={4}>Memuat…</td></tr>}
          {!isLoading && data.length === 0 && <tr><td className="p-8 text-center text-muted-foreground" colSpan={4}><Truck className="h-6 w-6 mx-auto mb-2 opacity-50" />Belum ada supplier.</td></tr>}
          {data.map((s) => (
            <tr key={s.id} className="border-b last:border-b-0 hover:bg-slate-50" data-testid={`supplier-row-${s.id}`}>
              <td className="p-4 font-semibold">{s.name}</td>
              <td className="p-4 text-slate-600">{s.phone ? <span className="inline-flex items-center gap-1"><Phone className="h-3.5 w-3.5 text-slate-400" />{s.phone}</span> : "—"}</td>
              <td className="p-4 text-slate-600">{s.address ? <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-slate-400" />{s.address}</span> : "—"}</td>
              <td className="p-4 text-right whitespace-nowrap">
                <button onClick={() => setEditing(s)} title="Ubah" className="p-2 rounded-md hover:bg-slate-900 hover:text-white" data-testid={`supplier-edit-${s.id}`}><Pencil className="h-4 w-4" /></button>
                <button onClick={() => del(s)} title="Hapus" className="p-2 rounded-md hover:bg-rose-600 hover:text-white" data-testid={`supplier-delete-${s.id}`}><Trash2 className="h-4 w-4" /></button>
              </td>
            </tr>
          ))}
        </tbody>
      </TableShell>
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="sm:max-w-md bg-background" data-testid="supplier-dialog">
          <DialogHeader><DialogTitle className="font-heading">{editing?.id ? "Ubah supplier" : "Supplier baru"}</DialogTitle></DialogHeader>
          {editing && <SupplierForm key={editing.id || "new"} initial={editing} onSave={save} busy={busy} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
