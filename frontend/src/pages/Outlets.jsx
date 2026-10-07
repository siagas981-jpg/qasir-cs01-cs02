import { useState } from "react";
import { MapPin, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";

export default function Outlets() {
  const { outlets, reloadOutlets, setActiveOutletId, activeOutletId } = useAuth();
  const [editing, setEditing] = useState(null);

  const save = async (e) => {
    e.preventDefault();
    const row = { name: editing.name.trim(), address: editing.address || null };
    const { data, error } = editing.id
      ? await supabase.from("outlets").update(row).eq("id", editing.id).select().single()
      : await supabase.from("outlets").insert(row).select().single();
    if (error) return toast.error(error.message);
    toast.success("Outlet disimpan");
    setEditing(null);
    await reloadOutlets();
    if (!activeOutletId) setActiveOutletId(data.id);
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Owner</p>
          <h1 className="font-heading text-3xl sm:text-4xl font-extrabold tracking-tight">Outlet</h1>
        </div>
        <Button onClick={() => setEditing({ name: "", address: "" })} className="bg-slate-900 hover:bg-emerald-700 text-white" data-testid="outlet-add-button"><Plus className="h-4 w-4 mr-1" /> Tambah outlet</Button>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="outlets-list">
        {outlets.map((o) => (
          <div key={o.id} className="rounded-xl border bg-white p-6 hover:border-emerald-500 transition-colors" data-testid={`outlet-card-${o.id}`}>
            <div className="flex items-start justify-between">
              <MapPin className="h-5 w-5 text-emerald-600" />
              <button onClick={() => setEditing(o)} className="p-2 rounded-md hover:bg-slate-900 hover:text-white" data-testid={`outlet-edit-${o.id}`}><Pencil className="h-4 w-4" /></button>
            </div>
            <p className="font-heading text-lg font-bold mt-4">{o.name}</p>
            <p className="text-sm text-slate-500 mt-1">{o.address || "—"}</p>
          </div>
        ))}
      </div>
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="sm:max-w-md bg-background" data-testid="outlet-form-dialog">
          <DialogHeader><DialogTitle className="font-heading">{editing?.id ? "Ubah outlet" : "Outlet baru"}</DialogTitle></DialogHeader>
          {editing && (
            <form onSubmit={save} className="space-y-4">
              <div className="space-y-1.5"><Label>Nama</Label><Input required value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} data-testid="outlet-form-name-input" /></div>
              <div className="space-y-1.5"><Label>Alamat</Label><Input value={editing.address || ""} onChange={(e) => setEditing({ ...editing, address: e.target.value })} data-testid="outlet-form-address-input" /></div>
              <Button type="submit" className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="outlet-form-submit-button">Simpan</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
