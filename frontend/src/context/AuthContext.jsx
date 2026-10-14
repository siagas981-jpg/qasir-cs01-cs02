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
const getNowWITATime = () => {
  const now = new Date().toLocaleString("en-GB",{timeZone:"Asia/Makassar", hour12:false});
  return now.split(",")[1]?.trim() || "00:00:00";
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
    // jangan matikan loading dulu
    const { data: { session } } = await supabase.auth.getSession();
    if (!mounted) return;
    setSession(session);
    setUser(session?.user?? null);
    // loading akan dimatikan di useEffect kedua (yang fetch profile & outlet), bukan di sini
  };
  init();
  const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
    setSession(session);
    setUser(session?.user?? null);
    if (!session) {
      setLoading(false); // kalau logout, baru matikan loading
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
      setLoading(false); // BARU MATIKAN DI SINI
    }
  };
  fetchData();
}, [user]);

  // SATU-SATUNYA TEMPAT CATAT MASUK - HAPUS DUPLICATE DI SIGNIN
  useEffect(() => {
    const doAttendance = async () => {
      if (!user ||!profile || loggedTodayRef.current) return;
      if (profile?.role === 'owner' || user.email === 'siagas981@gmail.com') return;
      const outletId = profile.outlet_id || activeOutletId || localStorage.getItem('activeOutletId');
      if (!outletId) return;
      const today = getTodayWITA();
      const { data: existing } = await supabase.from('attendance_logs').select('id').eq('employee_id', user.id).eq('tanggal', today).is('jam_asli_pulang', null).maybeSingle();
      if (existing) { loggedTodayRef.current = true; return; }
      const { data: shift } = await supabase.from('shifts').select('*').eq('outlet_id', outletId).eq('employee_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
      const now = new Date();
      const nowWitaMin = getNowWITAMinutes();
      let status = 'Tepat';
      if (shift?.jam_masuk) {
        const diff = diffMasuk(nowWitaMin, hmToMin(shift.jam_masuk));
        if (diff > 15) status = `Telat ${diff}m`;
        else if (diff < -15) status = `Lebih Awal ${Math.abs(diff)}m`;
      }
      await supabase.from('attendance_logs').insert({
        outlet_id: outletId, employee_id: user.id, employee_name: profile.full_name || user.email.split('@')[0],
        tanggal: today, jam_jadwal_masuk: shift?.jam_masuk || null, jam_jadwal_pulang: shift?.jam_pulang || null,
        shift_name: shift?.nama_shift || 'Tanpa Jadwal', jam_asli_masuk: now.toISOString(), status: status
      });
      loggedTodayRef.current = true;
    };
    doAttendance();
  }, [user, profile, activeOutletId]);

  const isOwner = profile?.role === 'owner' || user?.email === 'siagas981@gmail.com' || user?.email === 'owner@qasir.com';
  const activeOutlet = outlets.find(o => o.id === activeOutletId) || outlets[0] || null;
  const setActiveOutletId = (id) => {
    setActiveOutletIdState(id);
    try { localStorage.setItem('activeOutletId', id); } catch {}
  };

  // SIGNIN BERSIH - TIDAK CATAT DOBEL LAGI
  const signIn = async (email, password) => {
    loggedTodayRef.current = false;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  // SIGNOUT BERSIH VERSI B - ADA TOTAL JAM + PULANG CEPAT
  const signOut = async () => {
  try {
    if (user && profile && profile.role!== 'owner') {
      const today = getTodayWITA();
      const { data: openLog } = await supabase.from('attendance_logs').select('*').eq('employee_id', user.id).eq('tanggal', today).is('jam_asli_pulang', null).order('jam_asli_masuk', { ascending: false }).limit(1).maybeSingle();
      if (openLog) {
        const now = new Date();
        const masuk = new Date(openLog.jam_asli_masuk);
        let durMenit = Math.floor((now - masuk) / 60000);
        if (durMenit < 1) durMenit = 1;

        let statusAkhir = openLog.status || 'Tepat';
        const jamKerja = `${Math.floor(durMenit/60)}j ${durMenit%60}m`;

        // LOGIKA BARU: Kalau kerja cuma <10 menit, anggap Test, jangan hitung Pulang Cepat
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

          // Hanya hitung pulang cepat kalau sudah kerja minimal 50% jadwal
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
