import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Plus, Wallet, Receipt, TrendingUp, Clock, Timer } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { rupiah, parseRupiah, dateTime } from "@/lib/format";
import { useDateRange, fetchSales, fetchPurchases, toDateStr } from "@/lib/reports";
import { fetchExpenses, addExpense, fetchProfitSummary, fetchProfitSeries, EXPENSE_CATEGORIES } from "@/lib/bookkeeping";
import { PageHeader, RangeBar, ExportButtons, StatCard, TableShell, shortId, formatShort } from "@/components/reports/parts";
import { supabase } from "@/lib/supabase/client";

const getTodayWITA = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Makassar" });

const TIME_SHIFT_PRESETS = {
  income: [
    { id: "all", label: "Semua Jam" },
    { id: "pagi", label: "Pagi (09:00-17:00)", start: "09:00", end: "17:00" },
    { id: "sore", label: "Sore (17:00-01:00)", start: "17:00", end: "01:00" },
    { id: "malam", label: "Malam (01:00-09:00)", start: "01:00", end: "09:00" },
  ],
  expense: [
    { id: "all", label: "Semua Jam" },
    { id: "pagi", label: "Pagi (09:00-17:00)", start: "09:00", end: "17:00" },
    { id: "sore", label: "Sore (17:00-01:00)", start: "17:00", end: "01:00" },
    { id: "malam", label: "Malam (01:00-09:00)", start: "01:00", end: "09:00" },
  ],
  profit: [
    { id: "all", label: "Semua Jam" },
    { id: "pagi", label: "Pagi (09:00-17:00)", start: "09:00", end: "17:00" },
    { id: "sore", label: "Sore (17:00-01:00)", start: "17:00", end: "01:00" },
    { id: "malam", label: "Malam (01:00-09:00)", start: "01:00", end: "09:00" },
  ],
};

const toMin = (t) => { const [h,m]=t.split(":").map(Number); return h*60+m; };
const isTimeInShift = (dateStr, shift) => {
  if (!shift || shift.id==="all" ||!dateStr) return true;
  const d=new Date(dateStr); if(isNaN(d.getTime())) return true;
  const cur=d.getHours()*60+d.getMinutes(); const s=toMin(shift.start); const e=toMin(shift.end);
  if(e<=s) return cur>=s || cur<e; return cur>=s && cur<e;
};
const fetchShiftTemplates = async (outletId) => {
  const { data, error } = await supabase.from("shifts").select("*, profiles(full_name)").eq("outlet_id", outletId).order("created_at", { ascending: false });
  if (error) throw error; const map=new Map(); for(const s of data||[]){ if(!map.has(s.employee_id)) map.set(s.employee_id,s); } return Array.from(map.values());
};

function IncomeTab({ outletId }) {
  const range = useDateRange("all"); const [shiftId, setShiftId] = useState("all");
  const { data=[] } = useQuery({ queryKey:["bk-income",outletId,range.from,range.to], queryFn:()=>fetchSales(outletId,range.from,range.to), enabled:!!outletId });
  const activeShift = useMemo(()=>TIME_SHIFT_PRESETS.income.find(s=>s.id===shiftId),[shiftId]);
  const filtered = useMemo(()=> data.filter(r=>isTimeInShift(r.created_at,activeShift)), [data,activeShift]);
  const total = filtered.reduce((s,r)=>s+(r.total||0),0);
  return (
    <div>
      <RangeBar range={range}><ExportButtons idPrefix="income" /></RangeBar>
      <div className="flex gap-2 mb-4 p-3 bg-slate-50 border rounded-lg">
        <span className="text-xs font-bold flex items-center gap-1"><Timer className="h-3 w-3" /> FILTER SHIFT:</span>
        <Select value={shiftId} onValueChange={setShiftId}><SelectTrigger className="w-[280px] h-8 bg-white"><SelectValue /></SelectTrigger><SelectContent>{TIME_SHIFT_PRESETS.income.map(s=><SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent></Select>
      </div>
      <StatCard label="Total Pemasukan" value={rupiah(total)} accent="emerald" />
      <TableShell>
        <thead><tr className="text-xs"><th className="p-4 text-center">Tanggal</th><th className="p-4 text-center">Nota</th><th className="p-4 text-center">Jumlah</th></tr></thead>
        <tbody>{filtered.map(r=><tr key={r.id} className="border-b"><td className="p-4 text-center">{dateTime(r.created_at)}</td><td className="p-4 text-center">{shortId(r.id)}</td><td className="p-4 text-center font-bold">{rupiah(r.total)}</td></tr>)}</tbody>
      </TableShell>
    </div>
  );
}

function ExpenseTab({ outletId, userId }) {
  const range = useDateRange("all"); const qc=useQueryClient(); const [open,setOpen]=useState(false); const [shiftId,setShiftId]=useState("all");
  const { data:purchases=[] } = useQuery({ queryKey:["bk-purch",outletId,range.from,range.to], queryFn:()=>fetchPurchases(outletId,range.from,range.to), enabled:!!outletId });
  const { data:expenses=[] } = useQuery({ queryKey:["bk-exp",outletId,range.from,range.to], queryFn:()=>fetchExpenses(outletId,range.from,range.to), enabled:!!outletId });
  const activeShift = useMemo(()=>TIME_SHIFT_PRESETS.expense.find(s=>s.id===shiftId),[shiftId]);
  const rows = useMemo(()=>{ let a=purchases.map(p=>({key:`p-${p.id}`, sortable:new Date(p.created_at), dateLabel:dateTime(p.created_at), rawDate:p.created_at, source:"Pembelian", label:p.name, amount:p.nilai})); let b=expenses.map(e=>({key:`e-${e.id}`, sortable:new Date(e.date), dateLabel:new Date(e.date).toLocaleDateString("id-ID"), rawDate:e.date, source:"Operasional", label:e.category, amount:e.amount})); let all=[...a,...b].sort((x,y)=>y.sortable-x.sortable); return all.filter(r=>isTimeInShift(r.rawDate,activeShift)); },[purchases,expenses,activeShift]);
  const total=rows.reduce((s,r)=>s+r.amount,0);
  return (
    <div>
      <RangeBar range={range}><Button onClick={()=>setOpen(true)} className="bg-rose-600 text-white"><Plus className="h-4 w-4" /> Pengeluaran</Button></RangeBar>
      <div className="flex gap-2 mb-4 p-3 bg-slate-50 border rounded-lg">
        <span className="text-xs font-bold flex items-center gap-1"><Timer className="h-3 w-3" /> FILTER SHIFT:</span>
        <Select value={shiftId} onValueChange={setShiftId}><SelectTrigger className="w-[300px] h-8 bg-white"><SelectValue /></SelectTrigger><SelectContent>{TIME_SHIFT_PRESETS.expense.map(s=><SelectItem key={s.id} value={s.id}>{s.label}</SelectItem>)}</SelectContent></Select>
        <Badge>{rupiah(total)}</Badge>
      </div>
      <TableShell>
        <thead><tr className="text-xs"><th className="p-4 text-center">Tanggal</th><th className="p-4 text-center">Sumber</th><th className="p-4 text-center">Jumlah</th></tr></thead>
        <tbody>{rows.map(r=><tr key={r.key} className="border-b"><td className="p-4 text-center">{r.dateLabel}</td><td className="p-4 text-center">{r.source}</td><td className="p-4 text-center font-bold">{rupiah(r.amount)}</td></tr>)}</tbody>
      </TableShell>
      <Dialog open={open} onOpenChange={setOpen}><DialogContent className="bg-background"><DialogHeader><DialogTitle>Tambah Pengeluaran</DialogTitle></DialogHeader><ExpenseForm outletId={outletId} userId={userId} onDone={()=>{setOpen(false); qc.invalidateQueries({queryKey:["bk-exp",outletId]});}} /></DialogContent></Dialog>
    </div>
  );
}

function ExpenseForm({ outletId, userId, onDone }) {
  const [f,setF]=useState({date:toDateStr(new Date()), category:EXPENSE_CATEGORIES[0], amount:0, description:""}); const [busy,setBusy]=useState(false);
  const submit=async(e)=>{ e.preventDefault(); if(f.amount<=0) return toast.error("Jumlah >0"); setBusy(true); try{ await addExpense({outlet_id:outletId,date:f.date,category:f.category,amount:f.amount,description:f.description||null,created_by:userId}); toast.success("Ditambahkan"); onDone(); }catch(err){toast.error(err.message);}finally{setBusy(false);} };
  return (<form className="space-y-4" onSubmit={submit}><div><Label>Tanggal</Label><Input type="date" value={f.date} onChange={e=>setF({...f,date:e.target.value})} /></div><div><Label>Kategori</Label><Select value={f.category} onValueChange={v=>setF({...f,category:v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{EXPENSE_CATEGORIES.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div><div><Label>Jumlah</Label><Input value={rupiah(f.amount)} onChange={e=>setF({...f,amount:parseRupiah(e.target.value)})} /></div><div><Label>Keterangan</Label><Textarea value={f.description} onChange={e=>setF({...f,description:e.target.value})} /></div><Button type="submit" disabled={busy} className="w-full bg-rose-600 text-white">Simpan</Button></form>);
}

function ProfitTab({ outletId }) {
  const range=useDateRange("all"); const [shiftId,setShiftId]=useState("all");
  const { data:sum } = useQuery({ queryKey:["bk-profit",outletId,range.from,range.to], queryFn:()=>fetchProfitSummary(outletId,range.from,range.to), enabled:!!outletId });
  const { data:series=[] } = useQuery({ queryKey:["bk-profit-series",outletId], queryFn:()=>fetchProfitSeries(outletId,6), enabled:!!outletId });
  const { data:sales=[] } = useQuery({ queryKey:["bk-income-profit",outletId,range.from,range.to], queryFn:()=>fetchSales(outletId,range.from,range.to), enabled:!!outletId });
  const activeShift = useMemo(()=>TIME_SHIFT_PRESETS.profit.find(s=>s.id===shiftId),[shiftId]);
  const filteredStats = useMemo(()=>{ if(!sum) return {pemasukan:0,hpp:0,pengeluaran:0,laba:0}; if(shiftId==="all") return sum; const fs=sales.filter(s=>isTimeInShift(s.created_at,activeShift)); const pf=fs.reduce((a,b)=>a+(b.total||0),0); const ratio=sum.pemasukan>0?pf/sum.pemasukan:0; return {pemasukan:pf, hpp:Math.round((sum.hpp||0)*ratio), pengeluaran:Math.round((sum.pengeluaran||0)*ratio), laba:Math.round(pf-(sum.hpp||0)*ratio-(sum.pengeluaran||0)*ratio)}; },[sum,sales,shiftId,activeShift]);
  return (<div><RangeBar range={range} /><div className="flex gap-2 mb-4 p-3 bg-slate-50 border rounded-lg"><span className="text-xs font-bold flex items-center gap-1"><Timer className="h-3 w-3" /> FILTER SHIFT:</span><Select value={shiftId} onValueChange={setShiftId}><SelectTrigger className="w-[300px] h-8 bg-white"><SelectValue /></SelectTrigger><SelectContent>{TIME_SHIFT_PRESETS.profit.map(sh=><SelectItem key={sh.id} value={sh.id}>{sh.label}</SelectItem>)}</SelectContent></Select><Badge className="bg-slate-900 text-white">{activeShift?.label}</Badge></div>
  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6"><StatCard label="Pemasukan" value={rupiah(filteredStats.pemasukan)} accent="emerald" /><StatCard label="HPP" value={rupiah(filteredStats.hpp)} accent="amber" /><StatCard label="Pengeluaran" value={rupiah(filteredStats.pengeluaran)} accent="rose" /><StatCard label="Laba" value={rupiah(filteredStats.laba)} accent="sky" /></div>
  <div className="rounded-xl border bg-white p-4"><div className="h-72"><ResponsiveContainer width="100%" height="100%"><BarChart data={series}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis tickFormatter={formatShort} /><Tooltip formatter={v=>rupiah(v)} /><Legend /><Bar dataKey="pemasukan" fill="#10b981" /><Bar dataKey="pengeluaran" fill="#f43f5e" /><Bar dataKey="laba" fill="#0ea5e9" /></BarChart></ResponsiveContainer></div></div></div>);
}

function ShiftTab({ outletId }) {
  const qc=useQueryClient(); const [open,setOpen]=useState(false); const [form,setForm]=useState({nama_shift:"Shift Pagi",jam_masuk:"09:00",jam_pulang:"17:00",employee_id:""});
  const { data:employees=[] } = useQuery({ queryKey:["employees-list",outletId], queryFn:async()=>{ const {data}=await supabase.from("profiles").select("id, full_name").eq("outlet_id",outletId); return data||[]; }, enabled:!!outletId });
  const { data:shifts=[] } = useQuery({ queryKey:["shifts-template",outletId], queryFn:()=>fetchShiftTemplates(outletId), enabled:!!outletId });
  const nowInfo = useMemo(()=>{
    const now = new Date().toLocaleString("en-GB",{timeZone:"Asia/Makassar", hour12:false});
    const timePart = now.split(",")[1]?.trim() || "00:00:00";
    const [h,m] = timePart.split(":").map(Number);
    const curMin = h*60+m;
    return { timeStr: timePart, curMin, full: now };
  }, []);
  const todayAbsen = useMemo(()=>{
    return shifts.filter(s=>{
      const sMin = toMin(s.jam_masuk.slice(0,5));
      const eMin = toMin(s.jam_pulang.slice(0,5));
      if(eMin <= sMin) return nowInfo.curMin >= sMin || nowInfo.curMin < eMin;
      return nowInfo.curMin >= sMin && nowInfo.curMin < eMin;
    });
  }, [shifts, nowInfo]);
  const save=async(e)=>{ e.preventDefault(); if(!form.employee_id) return toast.error("Pilih karyawan"); await supabase.from("shifts").delete().eq("outlet_id",outletId).eq("employee_id",form.employee_id); const {error}=await supabase.from("shifts").insert({outlet_id:outletId,employee_id:form.employee_id,tanggal:getTodayWITA(),nama_shift:form.nama_shift,jam_masuk:form.jam_masuk,jam_pulang:form.jam_pulang}); if(error) return toast.error(error.message); toast.success("Shift disimpan"); setOpen(false); qc.invalidateQueries({queryKey:["shifts-template",outletId]}); };
  return (
    <div className="space-y-10">
      <div>
        <div className="flex justify-between mb-4"><h3 className="font-bold flex items-center gap-2"><Timer className="h-5 w-5 text-emerald-600" /> Absen Otomatis Hari Ini - {getTodayWITA()} | Jam WITA: {nowInfo.timeStr}</h3><Badge className="bg-emerald-600 text-white">{todayAbsen.length} hadir sekarang</Badge></div>
        <TableShell><thead><tr className="text-xs"><th className="p-4 text-center">Karyawan</th><th className="p-4 text-center">Shift</th><th className="p-4 text-center">Masuk</th><th className="p-4 text-center">Pulang</th><th className="p-4 text-center">Status Kehadiran</th></tr></thead><tbody>{shifts.map(s=>{ const isHadir = todayAbsen.some(t=>t.id===s.id); return <tr key={s.id} className={`border-b ${isHadir?'bg-emerald-50':''}`}><td className="p-4 text-center font-medium">{s.profiles?.full_name}</td><td className="p-4 text-center"><Badge variant={isHadir?"default":"outline"} className={isHadir?"bg-emerald-600 text-white":""}>{s.nama_shift}</Badge></td><td className="p-4 text-center">{s.jam_masuk}</td><td className="p-4 text-center">{s.jam_pulang}</td><td className="p-4 text-center">{isHadir? <span className="text-emerald-600 font-bold">● Hadir - Jam {nowInfo.timeStr}</span> : <span className="text-slate-400">Off Shift</span>}</td></tr>})}</tbody></TableShell>
      </div>
      <div>
        <div className="flex justify-between mb-4"><h3 className="font-bold flex items-center gap-2"><Clock className="h-5 w-5" /> Shift Karyawan Tetap - 09-17 / 17-01 / 01-09</h3><Button onClick={()=>setOpen(true)} className="bg-slate-900 text-white"><Plus className="h-4 w-4" /> Atur Shift</Button></div>
        <TableShell><thead><tr className="text-xs"><th className="p-4 text-center">Karyawan</th><th className="p-4 text-center">Shift</th><th className="p-4 text-center">Masuk</th><th className="p-4 text-center">Pulang</th></tr></thead><tbody>{shifts.map(s=><tr key={s.id} className="border-b"><td className="p-4 text-center">{s.profiles?.full_name}</td><td className="p-4 text-center">{s.nama_shift}</td><td className="p-4 text-center">{s.jam_masuk}</td><td className="p-4 text-center">{s.jam_pulang}</td></tr>)}</tbody></TableShell>
      </div>
      <Dialog open={open} onOpenChange={setOpen}><DialogContent className="bg-background"><DialogHeader><DialogTitle>Atur Shift</DialogTitle></DialogHeader><form onSubmit={save} className="space-y-3"><div><Label>Karyawan</Label><Select value={form.employee_id} onValueChange={v=>setForm({...form,employee_id:v})}><SelectTrigger><SelectValue placeholder="Karyawan" /></SelectTrigger><SelectContent>{employees.map(e=><SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent></Select></div><div className="grid grid-cols-2 gap-3"><div><Label>Nama Shift</Label><Select value={form.nama_shift} onValueChange={v=>setForm({...form,nama_shift:v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Shift Pagi">Shift Pagi (09-17)</SelectItem><SelectItem value="Shift Sore">Shift Sore (17-01)</SelectItem><SelectItem value="Shift Malam">Shift Malam (01-09)</SelectItem></SelectContent></Select></div><div><Label>Jam Masuk</Label><Input type="time" value={form.jam_masuk} onChange={e=>setForm({...form,jam_masuk:e.target.value})} /></div><div><Label>Jam Pulang</Label><Input type="time" value={form.jam_pulang} onChange={e=>setForm({...form,jam_pulang:e.target.value})} /></div></div><Button type="submit" className="w-full">Simpan</Button></form></DialogContent></Dialog>
    </div>
  );
}

export default function Bookkeeping() {
  const { activeOutletId, activeOutlet, user } = useAuth();
  return (<div className="p-4 md:p-8 max-w-6xl"><PageHeader outlet={activeOutlet} title="Pembukuan" subtitle="Filter shift: Pagi 09-17, Sore 17-01, Malam 01-09" />
  <Tabs defaultValue="income"><TabsList className="mb-6"><TabsTrigger value="income"><Wallet className="h-4 w-4 mr-1.5" /> Pemasukan</TabsTrigger><TabsTrigger value="expense"><Receipt className="h-4 w-4 mr-1.5" /> Pengeluaran</TabsTrigger><TabsTrigger value="profit"><TrendingUp className="h-4 w-4 mr-1.5" /> Laba Rugi</TabsTrigger><TabsTrigger value="shift"><Clock className="h-4 w-4 mr-1.5" /> Shift</TabsTrigger></TabsList>
  <TabsContent value="income"><IncomeTab outletId={activeOutletId} /></TabsContent><TabsContent value="expense"><ExpenseTab outletId={activeOutletId} userId={user?.id} /></TabsContent><TabsContent value="profit"><ProfitTab outletId={activeOutletId} /></TabsContent><TabsContent value="shift"><ShiftTab outletId={activeOutletId} /></TabsContent></Tabs></div>);
}
