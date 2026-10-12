import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Plus, Trash2, Wallet, TrendingUp, Receipt, Clock, Timer, AlertTriangle, CheckCircle, LogIn } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { rupiah, parseRupiah, dateTime } from "@/lib/format";
import { useDateRange, fetchSales, fetchPurchases, toDateStr } from "@/lib/reports";
import { fetchExpenses, addExpense, deleteExpense, fetchProfitSummary, fetchProfitSeries, EXPENSE_CATEGORIES } from "@/lib/bookkeeping";
import { PageHeader, RangeBar, ExportButtons, StatCard, TableShell, shortId, formatShort } from "@/components/reports/parts";
import { supabase } from "@/lib/supabase/client";

const fetchShifts = async (outletId, from, to) => {
  let q = supabase.from("shifts").select("*, profiles(full_name)").eq("outlet_id", outletId).order("tanggal", { ascending: false });
  if (from) q = q.gte("tanggal", from);
  if (to) q = q.lte("tanggal", to);
  const { data, error } = await q;
  if (error) throw error;
  return data;
};

// FIX: FILTER BY OUTLET + HIDE OWNER
const fetchAttendance = async (outletId) => {
  if (!outletId) return [];
  const { data, error } = await supabase
   .from("attendance_logs")
   .select("*")
   .eq("outlet_id", outletId)
   .order("tanggal", { ascending: false })
   .order("jam_asli_masuk", { ascending: false })
   .limit(100);
  if (error) {
    console.error("ATT ERROR", error);
    return [];
  }
  // Filter buang Owner yang nyangkut
  return (data || []).filter(l => {
    const name = (l.employee_name || "").toLowerCase();
    return name!== "owner" && name!== "siagas981@gmail.com" &&!name.includes("owner");
  });
};

const isWithinShift = (dateStr, shift) => {
  if (!shift) return true;
  const d = new Date(dateStr);
  const day = d.toISOString().split("T")[0];
  if (day!== shift.tanggal) return false;
  const [h, m] = [d.getHours(), d.getMinutes()];
  const timeVal = h * 60 + m;
  const [hm1, mm1] = shift.jam_masuk.split(":").map(Number);
  const [hm2, mm2] = shift.jam_pulang.split(":").map(Number);
  const start = hm1 * 60 + mm1;
  const end = hm2 * 60 + mm2;
  if (end < start) return timeVal >= start || timeVal <= end;
  return timeVal >= start && timeVal <= end;
};

function IncomeTab({ outletId }) {
  const range = useDateRange("all");
  const [shiftId, setShiftId] = useState("all");
  const { data = [] } = useQuery({
    queryKey: ["bk-income", outletId, range.from, range.to],
    queryFn: () => fetchSales(outletId, range.from, range.to), enabled:!!outletId,
  });
  const { data: shifts = [] } = useQuery({
    queryKey: ["shifts", outletId, range.from, range.to],
    queryFn: () => fetchShifts(outletId, range.from, range.to), enabled:!!outletId,
  });
  const activeShift = shifts.find(s => s.id === shiftId);
  const filtered = useMemo(() => {
    if (shiftId === "all") return data;
    return data.filter(r => isWithinShift(r.created_at, activeShift));
  }, [data, shiftId, activeShift]);
  const total = filtered.reduce((s, r) => s + (r.total || 0), 0);
  return (
    <div>
      <RangeBar range={range}><ExportButtons onExcel={() => {}} onPDF={() => {}} idPrefix="income" /></RangeBar>
      <div className="flex flex-wrap gap-2 mb-4 p-3 bg-slate-50 rounded-lg border">
        <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1"><Timer className="h-3 w-3"/> Filter Shift:</span>
        <Select value={shiftId} onValueChange={setShiftId}>
          <SelectTrigger className="w-[220px] h-8 bg-white"><SelectValue placeholder="Semua Jam" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Jam</SelectItem>
            {shifts.map(s => <SelectItem key={s.id} value={s.id}>{s.tanggal} • {s.nama_shift} ({s.jam_masuk}-{s.jam_pulang}) • {s.profiles?.full_name}</SelectItem>)}
          </SelectContent>
        </Select>
        {activeShift && <Badge className="bg-slate-900 text-white">{activeShift.nama_shift} • {activeShift.jam_masuk}-{activeShift.jam_pulang}</Badge>}
      </div>
      <div className="mb-5"><StatCard label="Total Pemasukan" value={rupiah(total)} accent="emerald" /></div>
      <TableShell>
        <thead><tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="p-4">Tanggal</th><th className="p-4">Nota</th><th className="p-4 text-right">Jumlah</th></tr></thead>
        <tbody>{filtered.map((r) => (<tr key={r.id} className="border-b hover:bg-slate-50"><td className="p-4 text-slate-500">{dateTime(r.created_at)}</td><td className="p-4 font-mono">{shortId(r.id)}</td><td className="p-4 text-right font-mono font-bold text-emerald-700">{rupiah(r.total)}</td></tr>))}</tbody>
      </TableShell>
    </div>
  );
}

function ExpenseForm({ outletId, userId, onDone }) {
  const [f, setF] = useState({ date: toDateStr(new Date()), category: EXPENSE_CATEGORIES[0], amount: 0, description: "" });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (f.amount <= 0) return toast.error("Jumlah harus lebih dari 0");
    setBusy(true);
    try {
      await addExpense({ outlet_id: outletId, date: f.date, category: f.category, amount: f.amount, description: f.description || null, created_by: userId });
      toast.success("Pengeluaran ditambahkan"); onDone();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };
  return (
    <form className="space-y-4" onSubmit={submit}>
      <div className="space-y-1.5"><Label>Tanggal</Label><Input type="date" value={f.date} onChange={(e) => setF({...f, date: e.target.value })} /></div>
      <div className="space-y-1.5"><Label>Kategori</Label><Select value={f.category} onValueChange={(v) => setF({...f, category: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{EXPENSE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-1.5"><Label>Jumlah</Label><Input inputMode="numeric" className="font-mono" value={rupiah(f.amount)} onChange={(e) => setF({...f, amount: parseRupiah(e.target.value) })} /></div>
      <div className="space-y-1.5"><Label>Keterangan</Label><Textarea rows={2} value={f.description} onChange={(e) => setF({...f, description: e.target.value })} /></div>
      <Button type="submit" disabled={busy} className="w-full h-11 bg-rose-600 hover:bg-rose-700 text-white">Simpan Pengeluaran</Button>
    </form>
  );
}

function ExpenseTab({ outletId, userId }) {
  const range = useDateRange("all");
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [shiftId, setShiftId] = useState("all");
  const { data: purchases = [] } = useQuery({ queryKey: ["bk-purch", outletId, range.from, range.to], queryFn: () => fetchPurchases(outletId, range.from, range.to), enabled:!!outletId });
  const { data: expenses = [] } = useQuery({ queryKey: ["bk-exp", outletId, range.from, range.to], queryFn: () => fetchExpenses(outletId, range.from, range.to), enabled:!!outletId });
  const { data: shifts = [] } = useQuery({ queryKey: ["shifts", outletId, range.from, range.to], queryFn: () => fetchShifts(outletId, range.from, range.to), enabled:!!outletId });
  const activeShift = shifts.find(s => s.id === shiftId);
  const rows = useMemo(() => {
    let a = purchases.map((p) => ({ key: `p-${p.id}`, sortable: new Date(p.created_at), dateLabel: dateTime(p.created_at), rawDate: p.created_at, source: "Pembelian", label: p.name, amount: p.nilai, manual: false }));
    let b = expenses.map((e) => ({ key: `e-${e.id}`, id: e.id, sortable: new Date(e.date), dateLabel: new Date(e.date).toLocaleDateString("id-ID", { dateStyle: "medium" }), rawDate: e.date, source: "Operasional", label: e.category, amount: e.amount, manual: true }));
    let all = [...a,...b].sort((x, y) => y.sortable - x.sortable);
    if (shiftId!== "all" && activeShift) all = all.filter(r => isWithinShift(r.rawDate, activeShift));
    return all;
  }, [purchases, expenses, shiftId, activeShift]);
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const onDelete = async (id) => { if (!window.confirm("Hapus?")) return; try { await deleteExpense(id); toast.success("Dihapus"); qc.invalidateQueries({ queryKey: ["bk-exp", outletId] }); } catch (e) { toast.error(e.message); } };
  const refresh = () => { setOpen(false); qc.invalidateQueries({ queryKey: ["bk-exp", outletId] }); };
  return (
    <div>
      <RangeBar range={range}><Button onClick={() => setOpen(true)} className="bg-rose-600 hover:bg-rose-700 text-white gap-1"><Plus className="h-4 w-4" /> Pengeluaran Manual</Button></RangeBar>
      <div className="flex flex-wrap gap-2 mb-4 p-3 bg-slate-50 rounded-lg border"><span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1"><Timer className="h-3 w-3"/> Filter Shift:</span><Select value={shiftId} onValueChange={setShiftId}><SelectTrigger className="w-[220px] h-8 bg-white"><SelectValue placeholder="Semua Jam" /></SelectTrigger><SelectContent><SelectItem value="all">Semua Jam</SelectItem>{shifts.map(s => <SelectItem key={s.id} value={s.id}>{s.tanggal} • {s.nama_shift}</SelectItem>)}</SelectContent></Select></div>
      <div className="mb-5"><StatCard label="Total Pengeluaran" value={rupiah(total)} accent="rose" /></div>
      <TableShell><thead><tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="p-4">Tanggal</th><th className="p-4">Sumber</th><th className="p-4">Kategori</th><th className="p-4 text-right">Jumlah</th><th className="p-4"></th></tr></thead><tbody>{rows.map((r) => (<tr key={r.key} className="border-b hover:bg-slate-50"><td className="p-4">{r.dateLabel}</td><td className="p-4"><Badge variant="outline">{r.source}</Badge></td><td className="p-4 font-semibold">{r.label}</td><td className="p-4 text-right font-mono font-bold text-rose-600">{rupiah(r.amount)}</td><td className="p-4">{r.manual && <button onClick={() => onDelete(r.id)} className="p-2 rounded-md hover:bg-rose-600 hover:text-white"><Trash2 className="h-4 w-4" /></button>}</td></tr>))}</tbody></TableShell>
      <Dialog open={open} onOpenChange={setOpen}><DialogContent className="sm:max-w-md bg-background"><DialogHeader><DialogTitle>Tambah Pengeluaran Manual</DialogTitle><DialogDescription>Biaya operasional</DialogDescription></DialogHeader><ExpenseForm outletId={outletId} userId={userId} onDone={refresh} /></DialogContent></Dialog>
    </div>
  );
}

function ProfitTab({ outletId }) {
  const range = useDateRange("all");
  const { data: sum } = useQuery({ queryKey: ["bk-profit", outletId, range.from, range.to], queryFn: () => fetchProfitSummary(outletId, range.from, range.to), enabled:!!outletId });
  const { data: series = [] } = useQuery({ queryKey: ["bk-profit-series", outletId], queryFn: () => fetchProfitSeries(outletId, 6), enabled:!!outletId });
  const s = sum || { pemasukan: 0, hpp: 0, pengeluaran: 0, laba: 0 };
  const profit = s.laba >= 0;
  return (
    <div>
      <RangeBar range={range} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6"><StatCard label="Pemasukan" value={rupiah(s.pemasukan)} accent="emerald" /><StatCard label="HPP" value={rupiah(s.hpp)} accent="amber" /><StatCard label="Pengeluaran" value={rupiah(s.pengeluaran)} accent="rose" /><StatCard label={profit? "Laba" : "Rugi"} value={rupiah(s.laba)} accent={profit? "sky" : "rose"} /></div>
      <div className="rounded-xl border bg-white p-4"><p className="text-sm font-semibold mb-3">Laba Rugi per Bulan (6 bulan terakhir)</p><div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={series}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef2f7" /><XAxis dataKey="label" tick={{ fontSize: 12 }} /><YAxis tickFormatter={formatShort} tick={{ fontSize: 12 }} width={48} /><Tooltip formatter={(v) => rupiah(v)} /><Legend /><Bar dataKey="pemasukan" name="Pemasukan" fill="#10b981" radius={[4,4,0,0]} /><Bar dataKey="pengeluaran" name="Pengeluaran" fill="#f43f5e" radius={[4,4,0,0]} /><Bar dataKey="laba" name="Laba" fill="#0ea5e9" radius={[4,4,0,0]} /></BarChart></ResponsiveContainer></div></div>
    </div>
  );
}

function ShiftTab({ outletId }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ tanggal: new Date().toISOString().split("T")[0], nama_shift: "Shift Pagi", jam_masuk: "08:00", jam_pulang: "16:00", employee_id: "" });
  const { data: employees = [] } = useQuery({ queryKey: ["employees-list", outletId], queryFn: async () => { const { data } = await supabase.from("profiles").select("id, full_name").eq("outlet_id", outletId); return data || []; }, enabled:!!outletId });
  const { data: shifts = [], isLoading } = useQuery({ queryKey: ["shifts-manage", outletId], queryFn: () => fetchShifts(outletId), enabled:!!outletId });
  const { data: attendance = [], isLoading: attLoading } = useQuery({ queryKey: ["attendance-logs", outletId], queryFn: () => fetchAttendance(outletId), enabled:!!outletId });

  const save = async (e) => {
    e.preventDefault();
    if (!form.employee_id) return toast.error("Pilih karyawan");
    const { error } = await supabase.from("shifts").insert({ outlet_id: outletId, employee_id: form.employee_id, tanggal: form.tanggal, nama_shift: form.nama_shift, jam_masuk: form.jam_masuk, jam_pulang: form.jam_pulang });
    if (error) return toast.error(error.message);
    toast.success("Shift disimpan"); setOpen(false); qc.invalidateQueries({ queryKey: ["shifts"] });
  };
  const del = async (id) => {
    if (!confirm("Hapus shift ini?")) return;
    const { error } = await supabase.from("shifts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Shift dihapus"); qc.invalidateQueries({ queryKey: ["shifts"] });
  };
  const delAtt = async (id) => {
    if (!confirm("Hapus data absensi Owner / data error ini?")) return;
    const { error } = await supabase.from("attendance_logs").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Absensi dihapus"); qc.invalidateQueries({ queryKey: ["attendance-logs", outletId] });
  };

  const getStatusBadge = (log) => {
    if (!log.jam_asli_pulang) return <Badge className="bg-amber-100 text-amber-800 border-amber-200"><LogIn className="h-3 w-3 mr-1"/> Sedang Kerja</Badge>;
    const s = (log.status || "").toLowerCase();
    if (s.includes("telat") || s.includes("kurang")) return <Badge className="bg-rose-100 text-rose-800 border-rose-200"><AlertTriangle className="h-3 w-3 mr-1"/>{log.status}</Badge>;
    if (s.includes("lembur") || s.includes("lebih")) return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200"><TrendingUp className="h-3 w-3 mr-1"/>{log.status}</Badge>;
    return <Badge className="bg-slate-100 text-slate-700"><CheckCircle className="h-3 w-3 mr-1"/>{log.status || "Tepat"}</Badge>;
  };
  const formatTime = (iso) => {
    if (!iso) return "-";
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return iso.slice(0,5);
      return d.toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit' });
    } catch { return "-"; }
  };

  return (
    <div className="space-y-8">
      <div>
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2"><Clock className="h-5 w-5" /><h3 className="font-bold">Kontrol Jam Shift Karyawan</h3></div>
          <Button onClick={() => setOpen(true)} className="bg-slate-900 text-white gap-1"><Plus className="h-4 w-4"/> Atur Shift</Button>
        </div>
        <TableShell>
          <thead><tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="p-4">Tanggal</th><th className="p-4">Shift</th><th className="p-4">Karyawan</th><th className="p-4">Jam Masuk</th><th className="p-4">Jam Pulang</th><th className="p-4">Durasi</th><th className="p-4"></th></tr></thead>
          <tbody>
            {isLoading && <tr><td colSpan={7} className="p-4">Memuat...</td></tr>}
            {shifts.map(s => {
              const dur = (() => { const [h1,m1]=s.jam_masuk.split(":").map(Number); const [h2,m2]=s.jam_pulang.split(":").map(Number); let d=(h2*60+m2)-(h1*60+m1); if(d<0) d+=1440; return `${Math.floor(d/60)}j ${d%60}m`; })();
              return <tr key={s.id} className="border-b hover:bg-slate-50"><td className="p-4">{s.tanggal}</td><td className="p-4"><Badge className="bg-sky-100 text-sky-800">{s.nama_shift}</Badge></td><td className="p-4 font-semibold">{s.profiles?.full_name}</td><td className="p-4 font-mono">{s.jam_masuk}</td><td className="p-4 font-mono">{s.jam_pulang}</td><td className="p-4">{dur}</td><td className="p-4"><button onClick={()=>del(s.id)} className="p-2 hover:bg-rose-600 hover:text-white rounded"><Trash2 className="h-4 w-4"/></button></td></tr>
            })}
            {shifts.length===0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Belum ada shift. Klik Atur Shift.</td></tr>}
          </tbody>
        </TableShell>
      </div>

      <div className="rounded-xl border-2 border-slate-900 bg-white overflow-hidden">
        <div className="bg-slate-900 text-white p-4 flex justify-between items-center">
          <div className="flex items-center gap-2"><Timer className="h-5 w-5"/><h3 className="font-bold">Absensi Otomatis - Realita vs Jadwal</h3></div>
          <Badge className="bg-white text-slate-900">Auto dari Login</Badge>
        </div>
        <div className="p-3 bg-amber-50 border-b text-xs flex gap-4">
          <span className="flex items-center gap-1"><span className="h-2 w-2 bg-rose-500 rounded-full"/> Merah = Telat / Kurang Jam</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 bg-emerald-500 rounded-full"/> Hijau = Lembur / Lebih Jam</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 bg-slate-400 rounded-full"/> Abu = Tepat</span>
        </div>
        <TableShell>
          <thead><tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="p-3">TGL</th><th className="p-3">KARYAWAN</th><th className="p-3">JADWAL</th><th className="p-3">MASUK ASLI</th><th className="p-3">PULANG ASLI</th><th className="p-3">DURASI REAL</th><th className="p-3">STATUS</th><th className="p-3"></th></tr></thead>
          <tbody>
            {attLoading && <tr><td colSpan={8} className="p-4 text-center">Memuat absensi...</td></tr>}
            {attendance.map(log => {
              const durReal = log.durasi_asli_menit? `${Math.floor(log.durasi_asli_menit/60)}j ${log.durasi_asli_menit%60}m` : log.jam_asli_pulang? "hitung..." : "kerja...";
              const rowColor =!log.jam_asli_pulang? "bg-amber-50" : (log.status?.toLowerCase().includes("kurang") || log.status?.toLowerCase().includes("telat"))? "bg-rose-50" : log.status?.toLowerCase().includes("lembur")? "bg-emerald-50" : "";
              return (
                <tr key={log.id} className={`border-b hover:bg-slate-50 ${rowColor}`}>
                  <td className="p-3 text-xs">{log.tanggal}</td>
                  <td className="p-3 font-semibold text-sm">{log.employee_name}</td>
                  <td className="p-3 font-mono text-xs">{log.jam_jadwal_masuk? `${log.jam_jadwal_masuk} - ${log.jam_jadwal_pulang}` : "- Tanpa Jadwal"} <br/><span className="text-[10px] text-muted-foreground">{log.shift_name || ""}</span></td>
                  <td className="p-3 font-mono text-sm font-bold">{formatTime(log.jam_asli_masuk)}</td>
                  <td className="p-3 font-mono text-sm">{formatTime(log.jam_asli_pulang)}</td>
                  <td className="p-3 text-sm">{durReal} {log.selisih_menit? <span className={`text-xs ml-1 ${log.selisih_menit<0?'text-rose-600':'text-emerald-600'}`}>({log.selisih_menit>0?'+':''}{log.selisih_menit}m)</span> : null}</td>
                  <td className="p-3">{getStatusBadge(log)}</td>
                  <td className="p-3"><button onClick={()=>delAtt(log.id)} className="p-1 hover:text-rose-600"><Trash2 className="h-3 w-3"/></button></td>
                </tr>
              )
            })}
            {attendance.length===0 && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground text-sm">Belum ada absensi di outlet ini. Login sebagai karyawan (fitry/eqy/haekal) untuk test.</td></tr>}
          </tbody>
        </TableShell>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md bg-background">
          <DialogHeader><DialogTitle>Atur Jam Shift</DialogTitle><DialogDescription>Tentukan jam kerja karyawan untuk mengontrol laporan per shift</DialogDescription></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div><Label>Tanggal</Label><Input type="date" value={form.tanggal} onChange={e=>setForm({...form, tanggal:e.target.value})} required/></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Nama Shift</Label><Select value={form.nama_shift} onValueChange={v=>setForm({...form, nama_shift:v})}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="Shift Pagi">Shift Pagi</SelectItem><SelectItem value="Shift Sore">Shift Sore</SelectItem><SelectItem value="Shift Malam">Shift Malam</SelectItem></SelectContent></Select></div>
              <div><Label>Karyawan</Label><Select value={form.employee_id} onValueChange={v=>setForm({...form, employee_id:v})}><SelectTrigger><SelectValue placeholder="Pilih"/></SelectTrigger><SelectContent>{employees.map(e=><SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Jam Masuk</Label><Input type="time" value={form.jam_masuk} onChange={e=>setForm({...form, jam_masuk:e.target.value})} required/></div>
              <div><Label>Jam Pulang</Label><Input type="time" value={form.jam_pulang} onChange={e=>setForm({...form, jam_pulang:e.target.value})} required/></div>
            </div>
            <Button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white h-11">Simpan Shift</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function Bookkeeping() {
  const { activeOutletId, activeOutlet, user } = useAuth();
  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <PageHeader outlet={activeOutlet} title="Pembukuan" subtitle="Pemasukan, pengeluaran, dan laba rugi — otomatis dari data penjualan & pembelian." />
      <Tabs defaultValue="shift">
        <TabsList className="mb-6 flex-wrap h-auto">
          <TabsTrigger value="income"><Wallet className="h-4 w-4 mr-1.5" /> Pemasukan</TabsTrigger>
          <TabsTrigger value="expense"><Receipt className="h-4 w-4 mr-1.5" /> Pengeluaran</TabsTrigger>
          <TabsTrigger value="profit"><TrendingUp className="h-4 w-4 mr-1.5" /> Laba Rugi</TabsTrigger>
          <TabsTrigger value="shift" className="data-[state=active]:bg-slate-900 data-[state=active]:text-white"><Clock className="h-4 w-4 mr-1.5" /> Shift Karyawan</TabsTrigger>
        </TabsList>
        <TabsContent value="income"><IncomeTab outletId={activeOutletId} /></TabsContent>
        <TabsContent value="expense"><ExpenseTab outletId={activeOutletId} userId={user?.id} /></TabsContent>
        <TabsContent value="profit"><ProfitTab outletId={activeOutletId} /></TabsContent>
        <TabsContent value="shift"><ShiftTab outletId={activeOutletId} /></TabsContent>
      </Tabs>
    </div>
  );
}