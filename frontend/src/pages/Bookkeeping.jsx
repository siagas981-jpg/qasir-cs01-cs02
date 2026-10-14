import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Plus, Wallet, Receipt, TrendingUp, Clock, Timer, LogIn, LogOut } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { rupiah, parseRupiah, dateTime } from "@/lib/format";
import { useDateRange, fetchSales, fetchPurchases, toDateStr } from "@/lib/reports";
import { fetchExpenses, addExpense, fetchProfitSummary, fetchProfitSeries, EXPENSE_CATEGORIES } from "@/lib/bookkeeping";
import { PageHeader, RangeBar, ExportButtons, StatCard, TableShell, shortId, formatShort } from "@/components/reports/parts";
import { supabase } from "@/lib/supabase/client";

const getTodayWITA = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Makassar" });
const getNowWITA = () => {
  const now = new Date().toLocaleString("en-GB",{timeZone:"Asia/Makassar", hour12:false});
  const parts = now.split(","); const timePart = parts[1]?.trim() || "00:00:00";
  return { date: getTodayWITA(), time: timePart, full: now };
};
const toMin = (t) => { if(!t) return 0; const [h,m,s]=t.split(":").map(Number); return h*60+(m||0); };
const diffMenit = (jadwal, aktual) => { if(!jadwal||!aktual) return 0; return toMin(aktual)-toMin(jadwal); };
const hitungTotalJam = (masuk, pulang) => {
  if(!masuk||!pulang) return "-";
  let m=toMin(masuk); let p=toMin(pulang); if(p<=m) p+=24*60; const d=p-m;
  const j=Math.floor(d/60); const men=d%60; return `${j}j ${men}m`;
};

function ShiftTabB({ outletId }) {
  const qc=useQueryClient(); const [open,setOpen]=useState(false);
  const [form,setForm]=useState({nama_shift:"Shift Pagi",jam_masuk:"09:00",jam_pulang:"17:00",employee_id:""});
  const { data:employees=[] } = useQuery({ queryKey:["employees-list",outletId], queryFn:async()=>{ const {data}=await supabase.from("profiles").select("id, full_name").eq("outlet_id",outletId); return data||[]; }, enabled:!!outletId });
  const { data:shifts=[] } = useQuery({ queryKey:["shifts-template",outletId], queryFn:async()=>{ const {data,error}=await supabase.from("shifts").select("*, profiles(full_name)").eq("outlet_id",outletId).order("created_at",{ascending:false}); if(error) throw error; const map=new Map(); for(const s of data||[]){ if(!map.has(s.employee_id)) map.set(s.employee_id,s); } return Array.from(map.values()); }, enabled:!!outletId });
  const { data:absenToday=[] } = useQuery({
    queryKey:["absen-log-today",outletId, getTodayWITA()],
    queryFn:async()=>{
      const {data,error}=await supabase.from("attendance_logs").select("*").eq("outlet_id",outletId).eq("tanggal",getTodayWITA()).order("jam_asli_masuk",{ascending:false});
      if(error) return []; return data||[];
    },
    enabled:!!outletId,
    refetchInterval: 10000
  });
  const nowInfo = getNowWITA();
  const merged = useMemo(()=>{
    return shifts.map(s=>{
      const log = absenToday.find(a=>a.employee_id===s.employee_id);
      const jamMasukAktual = log?.jam_asli_masuk? new Date(log.jam_asli_masuk).toLocaleTimeString("en-GB",{timeZone:"Asia/Makassar", hour12:false}) : null;
      const jamPulangAktual = log?.jam_asli_pulang? new Date(log.jam_asli_pulang).toLocaleTimeString("en-GB",{timeZone:"Asia/Makassar", hour12:false}) : null;
      return {...s, log, jamMasukAktual, jamPulangAktual };
    });
  },[shifts, absenToday]);
  const save=async(e)=>{ e.preventDefault(); if(!form.employee_id) return toast.error("Pilih karyawan"); await supabase.from("shifts").delete().eq("outlet_id",outletId).eq("employee_id",form.employee_id); const {error}=await supabase.from("shifts").insert({outlet_id:outletId,employee_id:form.employee_id,tanggal:getTodayWITA(),nama_shift:form.nama_shift,jam_masuk:form.jam_masuk,jam_pulang:form.jam_pulang}); if(error) return toast.error(error.message); toast.success("Shift disimpan"); setOpen(false); qc.invalidateQueries({queryKey:["shifts-template",outletId]}); };
  return (
    <div className="space-y-8">
      <div>
        <div className="flex justify-between mb-4 flex-wrap gap-2">
          <h3 className="font-bold flex items-center gap-2"><Timer className="h-5 w-5 text-emerald-600" /> Absen Real Hari Ini - {nowInfo.date} | Jam WITA: {nowInfo.time}</h3>
          <Badge className="bg-emerald-600 text-white">{absenToday.length} sudah login</Badge>
        </div>
        <TableShell>
          <thead><tr className="text-[11px]"><th className="p-3 text-center">Karyawan</th><th className="p-3 text-center">Shift</th><th className="p-3 text-center">Jadwal</th><th className="p-3 text-center">Masuk Aktual</th><th className="p-3 text-center">Pulang Aktual</th><th className="p-3 text-center">Total Jam</th><th className="p-3 text-center">Status</th></tr></thead>
          <tbody>
            {merged.length===0? <tr><td colSpan={7} className="p-6 text-center text-slate-400">Belum ada shift</td></tr> :
            merged.map(s=>{
              const isHadir=!!s.log;
              return (
                <tr key={s.id} className={`border-b ${isHadir?'bg-emerald-50':''}`}>
                  <td className="p-3 text-center font-medium">{s.profiles?.full_name}</td>
                  <td className="p-3 text-center"><Badge variant={isHadir?"default":"outline"} className={isHadir?"bg-emerald-600 text-white":""}>{s.nama_shift}</Badge></td>
                  <td className="p-3 text-center text-xs">{s.jam_masuk.slice(0,5)} - {s.jam_pulang.slice(0,5)}</td>
                  <td className="p-3 text-center font-bold text-xs">{s.jamMasukAktual? <span className="flex items-center justify-center gap-1"><LogIn className="h-3 w-3" />{s.jamMasukAktual}</span> : <span className="text-slate-400">-</span>}</td>
                  <td className="p-3 text-center font-bold text-xs">{s.jamPulangAktual? <span className="flex items-center justify-center gap-1"><LogOut className="h-3 w-3" />{s.jamPulangAktual}</span> : <span className="text-slate-400">Belum pulang</span>}</td>
                  <td className="p-3 text-center text-xs">{s.log?.durasi_asli_menit? `${Math.floor(s.log.durasi_asli_menit/60)}j ${s.log.durasi_asli_menit%60}m` : hitungTotalJam(s.jamMasukAktual, s.jamPulangAktual)}</td>
                  <td className="p-3 text-center text-xs">{!s.log? <span className="text-slate-400">Off / Belum Login</span> : <span className={`font-bold ${s.log.status?.includes('Telat')?'text-rose-600':'text-emerald-600'}`}>{s.log.status}</span>}</td>
                </tr>
              )
            })}
          </tbody>
        </TableShell>
      </div>
      <div>
        <div className="flex justify-between mb-4"><h3 className="font-bold flex items-center gap-2"><Clock className="h-5 w-5" /> Atur Shift Tetap</h3><Button onClick={()=>setOpen(true)} className="bg-slate-900 text-white"><Plus className="h-4 w-4" /> Atur Shift</Button></div>
        <TableShell><thead><tr className="text-xs"><th className="p-4 text-center">Karyawan</th><th className="p-4 text-center">Shift</th><th className="p-4 text-center">Masuk</th><th className="p-4 text-center">Pulang</th></tr></thead><tbody>{shifts.map(s=><tr key={s.id} className="border-b"><td className="p-4 text-center">{s.profiles?.full_name}</td><td className="p-4 text-center">{s.nama_shift}</td><td className="p-4 text-center">{s.jam_masuk}</td><td className="p-4 text-center">{s.jam_pulang}</td></tr>)}</tbody></TableShell>
      </div>
      <Dialog open={open} onOpenChange={setOpen}><DialogContent className="bg-background"><DialogHeader><DialogTitle>Atur Shift</DialogTitle></DialogHeader><form onSubmit={save} className="space-y-3"><div><Label>Karyawan</Label><Select value={form.employee_id} onValueChange={v=>setForm({...form,employee_id:v})}><SelectTrigger><SelectValue placeholder="Karyawan" /></SelectTrigger><SelectContent>{employees.map(e=><SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent></Select></div><div className="grid grid-cols-2 gap-3"><div><Label>Nama Shift</Label><Select value={form.nama_shift} onValueChange={v=>setForm({...form,nama_shift:v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Shift Pagi">Shift Pagi (09-17)</SelectItem><SelectItem value="Shift Sore">Shift Sore (17-01)</SelectItem><SelectItem value="Shift Malam">Shift Malam (01-09)</SelectItem></SelectContent></Select></div><div><Label>Jam Masuk</Label><Input type="time" value={form.jam_masuk} onChange={e=>setForm({...form,jam_masuk:e.target.value})} /></div><div><Label>Jam Pulang</Label><Input type="time" value={form.jam_pulang} onChange={e=>setForm({...form,jam_pulang:e.target.value})} /></div></div><Button type="submit" className="w-full">Simpan</Button></form></DialogContent></Dialog>
    </div>
  );
}

export default function Bookkeeping() {
  const { activeOutlet } = useAuth();
  const outletId = activeOutlet?.id;
  const { dateRange, setDateRange } = useDateRange();
  if (!outletId) return <div className="p-6 text-center text-slate-500">Pilih outlet dulu</div>;
  return (
    <div className="p-4 space-y-6">
      <PageHeader title="Pembukuan & Absensi" />
      <Tabs defaultValue="absensi" className="w-full">
        <TabsList>
          <TabsTrigger value="absensi">Absensi</TabsTrigger>
          <TabsTrigger value="laporan">Laporan</TabsTrigger>
        </TabsList>
        <TabsContent value="absensi" className="mt-4">
          <ShiftTabB outletId={outletId} />
        </TabsContent>
        <TabsContent value="laporan" className="mt-4">
          <RangeBar dateRange={dateRange} setDateRange={setDateRange} />
          <div className="text-center text-slate-400 py-10">Laporan penjualan / pengeluaran tetap di sini (tidak diubah)</div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
