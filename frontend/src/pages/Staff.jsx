import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function OutletSelect({ value, onChange, outlets, testId }) {
  return (
    <Select value={value || ""} onValueChange={onChange}>
      <SelectTrigger className="bg-white" data-testid={testId}><SelectValue placeholder="Pilih outlet" /></SelectTrigger>
      <SelectContent className="backdrop-blur-xl bg-background/95">
        {outlets.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

function NewCashierDialog({ open, onOpenChange, outlets, onCreated }) {
  const [f, setF] = useState({ email: "", password: "", full_name: "", outlet_id: "" });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!f.outlet_id) return toast.error("Pilih outlet");
    setBusy(true);
    const { data: { session } } = await supabase.auth.getSession();
    try {
      await axios.post(`${API}/staff`, f, { headers: { Authorization: `Bearer ${session.access_token}` } });
      toast.success("Kasir dibuat");
      setF({ email: "", password: "", full_name: "", outlet_id: "" });
      onCreated();
    } catch (err) {
      toast.error(err.response?.data?.detail?.[0]?.msg || err.response?.data?.detail || "Gagal membuat kasir");
    }
    setBusy(false);
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-background" data-testid="staff-form-dialog">
        <DialogHeader><DialogTitle className="font-heading">Kasir baru</DialogTitle><DialogDescription>Akun dibuat di server (/api) — kunci admin tidak pernah ada di browser.</DialogDescription></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5"><Label>Nama</Label><Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} data-testid="staff-form-name-input" /></div>
          <div className="space-y-1.5"><Label>Email</Label><Input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} data-testid="staff-form-email-input" /></div>
          <div className="space-y-1.5"><Label>Password (min. 8)</Label><Input type="password" required minLength={8} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} data-testid="staff-form-password-input" /></div>
          <div className="space-y-1.5"><Label>Outlet</Label><OutletSelect value={f.outlet_id} onChange={(v) => setF({ ...f, outlet_id: v })} outlets={outlets} testId="staff-form-outlet-select" /></div>
          <Button type="submit" disabled={busy} className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="staff-form-submit-button">Buat akun</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Staff() {
  const { outlets } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data = [] } = useQuery({
    queryKey: ["profiles"],
    queryFn: async () => (await supabase.from("profiles").select("*").order("created_at")).data || [],
  });

  const assign = async (id, outlet_id) => {
    const { error } = await supabase.from("profiles").update({ outlet_id }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Outlet diperbarui");
    qc.invalidateQueries({ queryKey: ["profiles"] });
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Owner</p>
          <h1 className="font-heading text-3xl sm:text-4xl font-extrabold tracking-tight">Staf</h1>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-slate-900 hover:bg-emerald-700 text-white" data-testid="staff-add-button"><Plus className="h-4 w-4 mr-1" /> Tambah kasir</Button>
      </div>
      <div className="rounded-xl border bg-white overflow-x-auto">
        <table className="w-full text-sm" data-testid="staff-table">
          <thead><tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="p-4">Nama / Email</th><th className="p-4">Peran</th><th className="p-4">Outlet</th></tr></thead>
          <tbody>
            {data.map((p) => (
              <tr key={p.id} className="border-b last:border-b-0" data-testid={`staff-row-${p.id}`}>
                <td className="p-4"><p className="font-semibold">{p.full_name || "—"}</p><p className="text-xs text-slate-500">{p.email}</p></td>
                <td className="p-4"><span className={`text-xs font-bold uppercase tracking-wider rounded-full px-2 py-1 ${p.role === "owner" ? "bg-slate-900 text-white" : "bg-emerald-100 text-emerald-800"}`}>{p.role}</span></td>
                <td className="p-4 w-[240px]">
                  {p.role === "owner" ? <span className="text-slate-500">Semua outlet</span> : <OutletSelect value={p.outlet_id} onChange={(v) => assign(p.id, v)} outlets={outlets} testId={`staff-outlet-select-${p.id}`} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <NewCashierDialog open={open} onOpenChange={setOpen} outlets={outlets} onCreated={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["profiles"] }); }} />
    </div>
  );
}
