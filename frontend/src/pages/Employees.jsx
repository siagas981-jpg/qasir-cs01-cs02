import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { KeyRound, Pencil, Plus, Power, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const authHeader = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  return { Authorization: `Bearer ${session.access_token}` };
};

const ROLE_STYLE = {
  owner: "bg-slate-900 text-white",
  admin: "bg-slate-900 text-white",
  manager: "bg-sky-100 text-sky-800",
  cashier: "bg-emerald-100 text-emerald-800",
};

function Field({ label, children }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}

function EmployeeForm({ initial, outlets, busy, onSubmit, isEdit }) {
  const [f, setF] = useState(initial);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSubmit(f); }}>
      <Field label="Nama Lengkap">
        <Input required value={f.full_name || ""} onChange={(e) => set("full_name", e.target.value)} data-testid="employee-form-name-input" />
      </Field>
      {!isEdit && (
        <>
          <Field label="Email">
            <Input type="email" required value={f.email} onChange={(e) => set("email", e.target.value)} data-testid="employee-form-email-input" />
          </Field>
          <Field label="Password (min. 6)">
            <Input type="password" required minLength={6} value={f.password} onChange={(e) => set("password", e.target.value)} data-testid="employee-form-password-input" />
          </Field>
        </>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Role">
          <Select value={f.role} onValueChange={(v) => set("role", v)}>
            <SelectTrigger className="bg-white" data-testid="employee-form-role-select"><SelectValue /></SelectTrigger>
            <SelectContent className="backdrop-blur-xl bg-background/95">
              <SelectItem value="cashier">Cashier</SelectItem>
              <SelectItem value="manager">Manager</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Outlet">
          <Select value={f.outlet_id || ""} onValueChange={(v) => set("outlet_id", v)}>
            <SelectTrigger className="bg-white" data-testid="employee-form-outlet-select"><SelectValue placeholder="Pilih outlet" /></SelectTrigger>
            <SelectContent className="backdrop-blur-xl bg-background/95">
              {outlets.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <div className="flex items-center justify-between rounded-lg border p-3">
        <span className="text-sm font-medium">Status Aktif</span>
        <Switch checked={f.is_active !== false} onCheckedChange={(v) => set("is_active", v)} data-testid="employee-form-active-switch" />
      </div>
      <Button type="submit" disabled={busy} className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="employee-form-submit-button">Simpan</Button>
    </form>
  );
}

export default function Employees() {
  const { outlets, user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [outletFilter, setOutletFilter] = useState("all");
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);

  const { data = [], isLoading } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*, outlets(name)").order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const reload = () => qc.invalidateQueries({ queryKey: ["employees"] });

  const rows = useMemo(() => data.filter((p) => {
    const q = search.toLowerCase();
    const matchQ = !q || (p.full_name || "").toLowerCase().includes(q) || (p.email || "").toLowerCase().includes(q);
    return matchQ && (roleFilter === "all" || p.role === roleFilter) && (outletFilter === "all" || p.outlet_id === outletFilter);
  }), [data, search, roleFilter, outletFilter]);

  const protectedRow = (p) => ["owner", "admin"].includes(p.role);

  const createEmployee = async (f) => {
    if (!f.outlet_id) return toast.error("Pilih outlet");
    setBusy(true);
    try {
      await axios.post(`${API}/employees`, f, { headers: await authHeader() });
      toast.success("Karyawan dibuat");
      setModal(null);
      reload();
    } catch (err) {
      toast.error(err.response?.data?.detail?.[0]?.msg || err.response?.data?.detail || "Gagal membuat karyawan");
    }
    setBusy(false);
  };

  const saveEdit = async (f) => {
    setBusy(true);
    const { error } = await supabase.from("profiles").update({
      full_name: f.full_name, role: f.role, outlet_id: f.outlet_id || null, is_active: f.is_active !== false,
    }).eq("id", f.id);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Karyawan diperbarui");
    setModal(null);
    reload();
  };

  const resetPassword = async (f) => {
    setBusy(true);
    try {
      await axios.post(`${API}/employees/${f.id}/password`, { password: f.password }, { headers: await authHeader() });
      toast.success("Password karyawan diubah");
      setModal(null);
    } catch (err) {
      toast.error(err.response?.data?.detail?.[0]?.msg || err.response?.data?.detail || "Gagal reset password");
    }
    setBusy(false);
  };

  const toggleActive = async (p) => {
    const { error } = await supabase.from("profiles").update({ is_active: !p.is_active }).eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success(p.is_active ? "Karyawan dinonaktifkan" : "Karyawan diaktifkan");
    reload();
  };

  const deleteEmployee = async () => {
    setBusy(true);
    try {
      await axios.delete(`${API}/employees/${modal.data.id}`, { headers: await authHeader() });
      toast.success("Karyawan dihapus");
      setModal(null);
      reload();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Gagal menghapus");
    }
    setBusy(false);
  };

  return (
    <div className="p-4 md:p-8 max-w-6xl" data-testid="employees-page">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Owner</p>
          <h1 className="font-heading text-3xl sm:text-4xl font-extrabold tracking-tight">Kelola Karyawan</h1>
        </div>
        <Button onClick={() => setModal({ type: "add" })} className="bg-slate-900 hover:bg-emerald-700 text-white" data-testid="employee-add-button"><Plus className="h-4 w-4 mr-1" /> Tambah Karyawan</Button>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama atau email…" className="pl-10 bg-white" data-testid="employees-search-input" />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[160px] bg-white" data-testid="employees-role-filter"><SelectValue /></SelectTrigger>
          <SelectContent className="backdrop-blur-xl bg-background/95">
            <SelectItem value="all">Semua role</SelectItem>
            <SelectItem value="owner">Owner</SelectItem>
            <SelectItem value="manager">Manager</SelectItem>
            <SelectItem value="cashier">Cashier</SelectItem>
          </SelectContent>
        </Select>
        <Select value={outletFilter} onValueChange={setOutletFilter}>
          <SelectTrigger className="w-[200px] bg-white" data-testid="employees-outlet-filter"><SelectValue /></SelectTrigger>
          <SelectContent className="backdrop-blur-xl bg-background/95">
            <SelectItem value="all">Semua outlet</SelectItem>
            {outlets.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border bg-white overflow-x-auto">
        <table className="w-full text-sm" data-testid="employees-table">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="p-4">Nama</th><th className="p-4">Email</th><th className="p-4">Role</th><th className="p-4">Outlet</th><th className="p-4">Status</th><th className="p-4 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td className="p-4 text-muted-foreground" colSpan={6}>Memuat…</td></tr>}
            {!isLoading && rows.length === 0 && <tr><td className="p-4 text-muted-foreground" colSpan={6} data-testid="employees-empty">Tidak ada karyawan.</td></tr>}
            {rows.map((p) => (
              <tr key={p.id} className="border-b last:border-b-0 hover:bg-slate-50" data-testid={`employee-row-${p.id}`}>
                <td className="p-4 font-semibold">{p.full_name || "—"}</td>
                <td className="p-4 text-slate-600">{p.email}</td>
                <td className="p-4"><span className={`text-xs font-bold uppercase tracking-wider rounded-full px-2 py-1 ${ROLE_STYLE[p.role] || ROLE_STYLE.cashier}`} data-testid={`employee-role-${p.id}`}>{p.role}</span></td>
                <td className="p-4">{p.role === "owner" || p.role === "admin" ? "Semua outlet" : p.outlets?.name || "—"}</td>
                <td className="p-4">
                  <span className={`text-xs font-bold rounded-full px-2 py-1 ${p.is_active !== false ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"}`} data-testid={`employee-status-${p.id}`}>
                    {p.is_active !== false ? "Aktif" : "Tidak Aktif"}
                  </span>
                </td>
                <td className="p-4">
                  {protectedRow(p) ? <span className="text-xs text-slate-400 float-right">—</span> : (
                    <div className="flex justify-end gap-1">
                      <button onClick={() => setModal({ type: "edit", data: p })} title="Edit" className="p-2 rounded-md hover:bg-slate-900 hover:text-white transition-colors" data-testid={`employee-edit-${p.id}`}><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => setModal({ type: "reset", data: p })} title="Reset Password" className="p-2 rounded-md hover:bg-sky-600 hover:text-white transition-colors" data-testid={`employee-reset-password-${p.id}`}><KeyRound className="h-4 w-4" /></button>
                      <button onClick={() => toggleActive(p)} title={p.is_active !== false ? "Nonaktifkan" : "Aktifkan"} className={`p-2 rounded-md transition-colors ${p.is_active !== false ? "hover:bg-amber-500 hover:text-white" : "text-amber-600 hover:bg-emerald-600 hover:text-white"}`} data-testid={`employee-toggle-active-${p.id}`}><Power className="h-4 w-4" /></button>
                      <button onClick={() => setModal({ type: "delete", data: p })} title="Hapus" className="p-2 rounded-md hover:bg-rose-600 hover:text-white transition-colors" data-testid={`employee-delete-${p.id}`}><Trash2 className="h-4 w-4" /></button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={modal?.type === "add" || modal?.type === "edit"} onOpenChange={(v) => !v && setModal(null)}>
        <DialogContent className="sm:max-w-md bg-background" data-testid="employee-form-dialog">
          <DialogHeader>
            <DialogTitle className="font-heading">{modal?.type === "edit" ? "Edit Karyawan" : "Tambah Karyawan"}</DialogTitle>
            {modal?.type === "add" && <DialogDescription>Akun dibuat di server (/api) — kunci admin tidak pernah ada di browser.</DialogDescription>}
          </DialogHeader>
          {modal && (
            <EmployeeForm
              key={modal.data?.id || "new"}
              isEdit={modal.type === "edit"}
              outlets={outlets}
              busy={busy}
              onSubmit={modal.type === "edit" ? saveEdit : createEmployee}
              initial={modal.type === "edit" ? modal.data : { full_name: "", email: "", password: "", role: "cashier", outlet_id: "", is_active: true }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={modal?.type === "reset"} onOpenChange={(v) => !v && setModal(null)}>
        <DialogContent className="sm:max-w-sm bg-background" data-testid="reset-password-modal">
          <DialogHeader>
            <DialogTitle className="font-heading">Reset Password</DialogTitle>
            <DialogDescription>{modal?.data?.full_name || modal?.data?.email} — langsung diubah, tanpa email.</DialogDescription>
          </DialogHeader>
          {modal?.type === "reset" && (
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); resetPassword({ id: modal.data.id, password: new FormData(e.target).get("password") }); }}>
              <Field label="Password baru (min. 6)">
                <Input name="password" type="password" required minLength={6} autoFocus data-testid="reset-password-modal-input" />
              </Field>
              <Button type="submit" disabled={busy} className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="reset-password-modal-submit">Simpan password</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={modal?.type === "delete"} onOpenChange={(v) => !v && setModal(null)}>
        <AlertDialogContent className="bg-background" data-testid="delete-employee-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus karyawan?</AlertDialogTitle>
            <AlertDialogDescription>{modal?.data?.full_name || modal?.data?.email} akan dihapus permanen dari sistem login dan profil. Transaksi yang sudah ada tidak terpengaruh.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="delete-cancel-button">Batal</AlertDialogCancel>
            <AlertDialogAction onClick={deleteEmployee} disabled={busy} className="bg-rose-600 hover:bg-rose-700 text-white" data-testid="delete-confirm-button">Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
