function ShiftTabB({ outletId }) {
  const qc=useQueryClient(); const [open,setOpen]=useState(false);
  const [form,setForm]=useState({nama_shift:"Shift Pagi",jam_masuk:"09:00",jam_pulang:"17:00",employee_id:""});
  const { data:employees=[] } = useQuery({ queryKey:["employees-list",outletId], queryFn:async()=>{ const {data}=await supabase.from("profiles").select("id, full_name").eq("outlet_id",outletId); return data||[]; }, enabled:!!outletId });
  const { data:shifts=[] } = useQuery({ queryKey:["shifts-template",outletId], queryFn:async()=>{ const {data,error}=await supabase.from("shifts").select("*, profiles(full_name)").eq("outlet_id",outletId).order("created_at",{ascending:false}); if(error) throw error; const map=new Map(); for(const s of data||[]){ if(!map.has(s.employee_id)) map.set(s.employee_id,s); } return Array.from(map.values()); }, enabled:!!outletId });

  // FIX: BACA DARI attendance_logs BUKAN absensi_log
  const { data:absenToday=[] } = useQuery({
    queryKey:["absen-log-today",outletId, getTodayWITA()],
    queryFn:async()=>{
      const today = getTodayWITA();
      const {data,error}=await supabase.from("attendance_logs")
       .select("*")
       .eq("outlet_id",outletId)
       .eq("tanggal",today)
       .order("jam_asli_masuk",{ascending:false});
      if(error){ console.log(error); return []; } return data||[];
    },
    enabled:!!outletId,
    refetchInterval: 10000
  });

  const nowInfo = getNowWITA();

  // FIX: mapping kolom attendance_logs
  const merged = useMemo(()=>{
    return shifts.map(s=>{
      const log = absenToday.find(a=>a.employee_id===s.employee_id);
      // jam_asli_masuk = ISO string, ambil jamnya
      const jamMasukAktual = log?.jam_asli_masuk? new Date(log.jam_asli_masuk).toLocaleTimeString("en-GB",{timeZone:"Asia/Makassar", hour12:false}) : null;
      const jamPulangAktual = log?.jam_asli_pulang? new Date(log.jam_asli_pulang).toLocaleTimeString("en-GB",{timeZone:"Asia/Makassar", hour12:false}) : null;

      const terlambat = jamMasukAktual? diffMenit(s.jam_masuk, jamMasukAktual) : null;
      const pulangCepat = jamPulangAktual? diffMenit(jamPulangAktual, s.jam_pulang) : null;

      // status dari kolom status (sudah ada Terlambat / Tepat)
      return {...s, log, jamMasukAktual, jamPulangAktual, terlambat, pulangCepat };
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
          <thead><tr className="text-[11px]">
            <th className="p-3 text-center">Karyawan</th>
            <th className="p-3 text-center">Shift</th>
            <th className="p-3 text-center">Jadwal</th>
            <th className="p-3 text-center">Masuk Aktual</th>
            <th className="p-3 text-center">Pulang Aktual</th>
            <th className="p-3 text-center">Total Jam</th>
            <th className="p-3 text-center">Status</th>
          </tr></thead>
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
                  <td className="p-3 text-center text-xs">
                    {!s.log? <span className="text-slate-400">Off / Belum Login</span> :
                      <div className="flex flex-col">
                        <span className={`font-bold ${s.log.status?.includes('Telat')||s.log.status?.includes('Terlambat')?'text-rose-600':'text-emerald-600'}`}>{s.log.status}</span>
                      </div>
                    }
                  </td>
                </tr>
              )
            })}
          </tbody>
        </TableShell>
        <p className="text-xs text-slate-500 mt-2">* Jam masuk & pulang tercatat otomatis dari tabel attendance_logs saat karyawan Login & Logout. Refresh tiap 10 detik.</p>
      </div>
      <div>
        <div className="flex justify-between mb-4"><h3 className="font-bold flex items-center gap-2"><Clock className="h-5 w-5" /> Atur Shift Tetap</h3><Button onClick={()=>setOpen(true)} className="bg-slate-900 text-white"><Plus className="h-4 w-4" /> Atur Shift</Button></div>
        <TableShell><thead><tr className="text-xs"><th className="p-4 text-center">Karyawan</th><th className="p-4 text-center">Shift</th><th className="p-4 text-center">Masuk</th><th className="p-4 text-center">Pulang</th></tr></thead><tbody>{shifts.map(s=><tr key={s.id} className="border-b"><td className="p-4 text-center">{s.profiles?.full_name}</td><td className="p-4 text-center">{s.nama_shift}</td><td className="p-4 text-center">{s.jam_masuk}</td><td className="p-4 text-center">{s.jam_pulang}</td></tr>)}</tbody></TableShell>
      </div>
      <Dialog open={open} onOpenChange={setOpen}><DialogContent className="bg-background"><DialogHeader><DialogTitle>Atur Shift</DialogTitle></DialogHeader><form onSubmit={save} className="space-y-3"><div><Label>Karyawan</Label><Select value={form.employee_id} onValueChange={v=>setForm({...form,employee_id:v})}><SelectTrigger><SelectValue placeholder="Karyawan" /></SelectTrigger><SelectContent>{employees.map(e=><SelectItem key={e.id} value={e.id}>{e.full_name}</SelectItem>)}</SelectContent></Select></div><div className="grid grid-cols-2 gap-3"><div><Label>Nama Shift</Label><Select value={form.nama_shift} onValueChange={v=>setForm({...form,nama_shift:v})}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Shift Pagi">Shift Pagi (09-17)</SelectItem><SelectItem value="Shift Sore">Shift Sore (17-01)</SelectItem><SelectItem value="Shift Malam">Shift Malam (01-09)</SelectItem></SelectContent></Select></div><div><Label>Jam Masuk</Label><Input type="time" value={form.jam_masuk} onChange={e=>setForm({...form,jam_masuk:e.target.value})} /></div><div><Label>Jam Pulang</Label><Input type="time" value={form.jam_pulang} onChange={e=>setForm({...form,jam_pulang:e.target.value})} /></div></div><Button type="submit" className="w-full">Simpan</Button></form></DialogContent></Dialog>
    </div>
  );
}
