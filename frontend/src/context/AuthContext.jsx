import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase/client';
const AuthContext = createContext();

// === HELPER WITA MAKASSAR ===
const getTodayWITA = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Makassar' });
const getNowWITA = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Makassar' }));
const getMinutes = (hm) => {
  const [h, m] = hm.split(':').map(Number);
  return h * 60 + m;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [outlets, setOutlets] = useState([]);
  const [activeOutletId, setActiveOutletIdState] = useState(() => localStorage.getItem('activeOutletId') || null);
  const loggedTodayRef = useRef(false);

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 5000);
    supabase.auth.getSession().then(({ data: { session } }) => { clearTimeout(timeout); setSession(session); setUser(session?.user?? null); setLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => { setSession(session); setUser(session?.user?? null); setLoading(false); });
    return () => { clearTimeout(timeout); subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!user) { setProfile(null); return; }
    const fetchData = async () => {
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
    };
    fetchData();
  }, [user]);

  // === ABSEN MASUK - FIX WITA & SHIFT TEMPLATE ===
  useEffect(() => {
    const doAttendance = async () => {
      if (!user ||!profile || loggedTodayRef.current) return;
      const isOwner = profile?.role === 'owner' || user.email === 'siagas981@gmail.com';
      if (isOwner) return;
      const outletId = profile.outlet_id || activeOutletId || localStorage.getItem('activeOutletId');
      if (!outletId) return;

      const today = getTodayWITA();
      const { data: existing } = await supabase.from('attendance_logs').select('id').eq('employee_id', user.id).eq('tanggal', today).is('jam_asli_pulang', null).maybeSingle();
      if (existing) { loggedTodayRef.current = true; return; }

      // FIX: Ambil shift TEMPLATE terbaru, tidak pakai filter tanggal lagi
      const { data: shiftAny } = await supabase.from('shifts').select('*').eq('outlet_id', outletId).eq('employee_id', user.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
      const shift = shiftAny || null;

      const now = new Date(); // simpan ISO tetap UTC untuk DB
      const nowWITA = getNowWITA();
      const nowMenit = nowWITA.getHours() * 60 + nowWITA.getMinutes();

      let status = 'Tepat';
      if (shift?.jam_masuk) {
        const jadwalMenit = getMinutes(shift.jam_masuk);
        const diff = nowMenit - jadwalMenit;
        if (diff > 15) status = `Telat ${diff}m`;
        else if (diff < -15) status = `Lebih Awal ${Math.abs(diff)}m`;
        else status = 'Tepat';
      }

      const { error } = await supabase.from('attendance_logs').insert({
        outlet_id: outletId,
        employee_id: user.id,
        employee_name: profile.full_name || user.email.split('@')[0],
        tanggal: today,
        jam_jadwal_masuk: shift?.jam_masuk || null,
        jam_jadwal_pulang: shift?.jam_pulang || null,
        shift_name: shift?.nama_shift || 'Tanpa Jadwal',
        jam_asli_masuk: now.toISOString(),
        status: status
      });
      if (!error) loggedTodayRef.current = true;
      else console.error('ABSEN ERROR', error);
    };
    doAttendance();
  }, [user, profile, activeOutletId]);

  const isOwner = profile?.role === 'owner' || user?.email === 'siagas981@gmail.com' || user?.email === 'owner@qasir.com';
  const activeOutlet = outlets.find(o => o.id === activeOutletId) || outlets[0] || null;
  const setActiveOutletId = (id) => { setActiveOutletIdState(id); localStorage.setItem('activeOutletId', id); };
  const signIn = async (email, password) => { loggedTodayRef.current = false; const { data, error } = await supabase.auth.signInWithPassword({ email, password }); if (error) throw error; return data; };

  // === ABSEN PULANG - FIX HITUNGAN KURANG JAM ===
  const signOut = async () => {
    try {
      if (user && profile && profile.role!== 'owner') {
        const today = getTodayWITA();
        const { data: openLog } = await supabase.from('attendance_logs').select('*').eq('employee_id', user.id).eq('tanggal', today).is('jam_asli_pulang', null).order('jam_asli_masuk', { ascending: false }).limit(1).maybeSingle();
        if (openLog) {
          const now = new Date();
          const nowWITA = getNowWITA();
          const masuk = new Date(openLog.jam_asli_masuk);
          let durMenit = Math.floor((now - masuk) / 60000);
          if (durMenit < 1) durMenit = 1;

          let statusAkhir = openLog.status || 'Tepat';

          if (!openLog.jam_jadwal_pulang) {
            statusAkhir = 'Hadir - Tanpa Jadwal';
          } else {
            const nowMenit = nowWITA.getHours() * 60 + nowWITA.getMinutes();
            const pulangMenit = getMinutes(openLog.jam_jadwal_pulang);
            const masukMenit = openLog.jam_jadwal_masuk? getMinutes(openLog.jam_jadwal_masuk) : 0;

            // hitung durasi jadwal (handle shift malam 17-01)
            let durasiJadwal = pulangMenit - masukMenit;
            if (durasiJadwal < 0) durasiJadwal += 1440;

            const selisih = nowMenit - pulangMenit;
            // kalau shift malam lewat tengah malam, toleransi
            const selisihNormal = selisih > 720? selisih - 1440 : selisih < -720? selisih + 1440 : selisih;

            if (selisihNormal < -60) statusAkhir = `Pulang Cepat ${Math.abs(selisihNormal)}m`;
            else if (selisihNormal > 15) statusAkhir = `Lembur ${selisihNormal}m`;
            else statusAkhir = `Tepat ${Math.floor(durMenit/60)}j ${durMenit%60}m`;
          }

          await supabase.from('attendance_logs').update({
            jam_asli_pulang: now.toISOString(),
            durasi_asli_menit: durMenit,
            status: statusAkhir
          }).eq('id', openLog.id);
        }
      }
    } catch (e) { console.error(e); }
    localStorage.removeItem('activeOutletId'); loggedTodayRef.current = false; const { error } = await supabase.auth.signOut(); if (error) throw error;
  };

  const value = { user, session, loading, profile, outlets, activeOutlet, activeOutletId, setActiveOutletId, isOwner, signIn, signUp: async (e,p)=>{const {data,error}=await supabase.auth.signUp({email:e,password:p}); if(error) throw error; return data;}, signOut, login: signIn };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
export const useAuth = () => useContext(AuthContext);
