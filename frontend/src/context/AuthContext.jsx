import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase/client';
const AuthContext = createContext();

const getTodayWITA = () => {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Makassar" });
};
const getNowWITAMinutes = () => {
  const now = new Date();
  return (now.getUTCHours()*60 + now.getUTCMinutes() + 8*60) % 1440;
};
const hmToMin = (hm) => {
  if(!hm) return 0;
  const [h,m] = hm.split(':').map(Number);
  return h*60 + (m||0);
};
const diffMasuk = (nowMin, jadwalMasuk) => {
  let d = nowMin - jadwalMasuk;
  if (d > 720) d -= 1440;
  if (d < -720) d += 1440;
  return d;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [outlets, setOutlets] = useState([]);
  const [activeOutletId, setActiveOutletIdState] = useState(() => {
    try { return localStorage.getItem('activeOutletId') || null; } catch { return null; }
  });
  const loggedTodayRef = useRef(false);

  useEffect(() => {
  let mounted = true;
  const init = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!mounted) return;
    setSession(session);
    setUser(session?.user?? null);
  };
  init();
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    setSession(session);
    setUser(session?.user?? null);
    if (!session) {
      setLoading(false);
    }
  });
  return () => { mounted = false; subscription.unsubscribe(); };
}, []);

  useEffect(() => {
  if (!user) { setProfile(null); return; }
  const fetchData = async () => {
    try {
      const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      if (profileData) setProfile(profileData);
      const { data: outletsData } = await supabase.from('outlets').select('*').order('name');
      if (outletsData?.length) {
        setOutlets(outletsData);
        const savedId = localStorage.getItem('activeOutletId');
        if (!savedId) {
          const defaultId = profileData?.outlet_id || outletsData[0].id;
          setActiveOutletIdState(defaultId);
          localStorage.setItem('activeOutletId', defaultId);
        }
      }
    } finally {
      setLoading(false);
    }
  };
  fetchData();
}, [user]);

  // VERSI FINAL - MULTI LOGIN SEHARI + DEBUG
  useEffect(() => {
    const doAttendance = async () => {
      try {
        if (!user ||!profile) return;
        if (loggedTodayRef.current) {
          console.log('ABSENSI SKIP: sudah logged hari ini');
          return;
        }
        if (profile?.role === 'owner' || user.email === 'siagas981@gmail.com') return;
        const outletId = profile.outlet_id || activeOutletId || localStorage.getItem('activeOutletId');
        if (!outletId) {
          console.log('ABSENSI SKIP: outletId kosong');
          return;
        }

        const today = getTodayWITA();
        const employeeName = profile?.full_name || profile?.username || user.email?.split('@')[0] || 'Unknown';
        console.log('ABSENSI START login:', employeeName, 'tanggal', today);

        // 1. Cek ada yang masih kebuka gak (pulang null) - tutup dulu kalau ada
        const { data: openLog } = await supabase
         .from('attendance_logs')
         .select('id, jam_asli_masuk')
         .eq('employee_id', user.id)
         .is('jam_asli_pulang', null)
         .order('jam_asli_masuk', { ascending: false })
         .limit(1)
         .maybeSingle();

        if (openLog) {
          const diffMin = (new Date() - new Date(openLog.jam_asli_masuk)) / 60000;
          console.log('ABSENSI found openLog', openLog.id, 'diff', diffMin);
          if (diffMin < 2) {
            loggedTodayRef.current = true;
            console.log('ABSENSI skip karena baru 2 menit');
            return;
          }
          const { error: closeErr } = await supabase.from('attendance_logs').update({
            jam_asli_pulang: new Date().toISOString(),
            durasi_asli_menit: Math.floor(diffMin)
          }).eq('id', openLog.id);
          if (closeErr) console.error('ABSENSI close error', closeErr);
        }

        // 2. Selalu bikin BARU setiap login
        const { data: shift } = await supabase.from('shifts').select('*').eq('outlet_id', outletId).eq('employee_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
        const now = new Date();
        const nowWitaMin = getNowWITAMinutes();
        let status = 'Tepat';
        if (shift?.jam_masuk) {
          const diff = diffMasuk(nowWitaMin, hmToMin(shift.jam_masuk));
          if (diff > 15) status = `Telat ${diff}m`;
          else if (diff < -15) status = `Lebih Awal ${Math.abs(diff)}m`;
        }

        const payload = {
          outlet_id: outletId,
          employee_id: user.id,
          employee_name: employeeName,
          tanggal: today,
          jam_jadwal_masuk: shift?.jam_masuk || null,
          jam_jadwal_pulang: shift?.jam_pulang || null,
          shift_name: shift?.nama_shift || 'Tanpa Jadwal',
          jam_asli_masuk: now.toISOString(),
          status: status
        };
        console.log('ABSENSI insert payload', payload);
        const { data: inserted, error: insErr } = await supabase.from('attendance_logs').insert(payload).select().single();
        if (insErr) {
          console.error('ABSENSI INSERT GAGAL', insErr);
        } else {
          console.log('ABSENSI BERHASIL', inserted);
        }
        loggedTodayRef.current = true;
      } catch (e) {
        console.error('ABSENSI exception', e);
      }
    };
    doAttendance();
  }, [user, profile, activeOutletId]);

  const isOwner = profile?.role === 'owner' || user?.email === 'siagas981@gmail.com' || user?.email === 'owner@qasir.com';
  const activeOutlet = outlets.find(o => o.id === activeOutletId) || outlets[0] || null;
  const setActiveOutletId = (id) => {
    setActiveOutletIdState(id);
    try { localStorage.setItem('activeOutletId', id); } catch {}
  };

  const signIn = async (email, password) => {
    loggedTodayRef.current = false;
    console.log('SIGNIN reset loggedTodayRef');
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
  try {
    if (user && profile && profile.role!== 'owner') {
      const today = getTodayWITA();
      const { data: openLog } = await supabase.from('attendance_logs').select('*').eq('employee_id', user.id).is('jam_asli_pulang', null).order('jam_asli_masuk', { ascending: false }).limit(1).maybeSingle();
      if (openLog) {
        const now = new Date();
        const masuk = new Date(openLog.jam_asli_masuk);
        let durMenit = Math.floor((now - masuk) / 60000);
        if (durMenit < 1) durMenit = 1;
        let statusAkhir = openLog.status || 'Tepat';
        const jamKerja = `${Math.floor(durMenit/60)}j ${durMenit%60}m`;
        if (durMenit < 10) {
          statusAkhir = `Test - Kerja ${jamKerja}`;
        } else if (openLog.jam_jadwal_pulang && openLog.jam_jadwal_masuk) {
          const nowMin = getNowWITAMinutes();
          const pulangMin = hmToMin(openLog.jam_jadwal_pulang);
          const masukMin = hmToMin(openLog.jam_jadwal_masuk);
          let nowAdj = nowMin; let pulangAdj = pulangMin;
          const crossMidnight = pulangMin <= masukMin;
          if (crossMidnight) {
            pulangAdj = pulangMin + 1440;
            if (nowMin < masukMin) nowAdj = nowMin + 1440;
          }
          const jadwalDur = crossMidnight? (1440 - masukMin + pulangMin) : (pulangMin - masukMin);
          if (nowAdj < pulangAdj - 15 && durMenit > jadwalDur * 0.5) {
            statusAkhir += ` | Pulang Cepat ${pulangAdj - nowAdj}m`;
          } else if (nowAdj > pulangAdj + 15) {
            statusAkhir += ` | Lembur ${nowAdj - pulangAdj}m`;
          }
          statusAkhir += ` | Kerja ${jamKerja}`;
        } else {
          statusAkhir += ` | Kerja ${jamKerja}`;
        }
        await supabase.from('attendance_logs').update({ jam_asli_pulang: now.toISOString(), durasi_asli_menit: durMenit, status: statusAkhir }).eq('id', openLog.id);
      }
    }
  } catch (e) { console.error(e); }
  localStorage.removeItem('activeOutletId'); loggedTodayRef.current = false;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

  const value = { user, session, loading, profile, outlets, activeOutlet, activeOutletId, setActiveOutletId, isOwner, signIn, signUp: async (e,p)=>{const {data,error}=await supabase.auth.signUp({email:e,password:p}); if(error) throw error; return data;}, signOut, login: signIn };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
export const useAuth = () => useContext(AuthContext);
