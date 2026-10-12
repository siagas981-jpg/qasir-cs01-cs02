import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase/client';
const AuthContext = createContext();
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
  useEffect(() => {
    const doAttendance = async () => {
      if (!user ||!profile || loggedTodayRef.current) return;
      const isOwner = profile?.role === 'owner' || user.email === 'siagas981@gmail.com';
      if (isOwner) return;
      const outletId = profile.outlet_id || activeOutletId || localStorage.getItem('activeOutletId');
      if (!outletId) return;
      const today = new Date().toISOString().split('T')[0];
      const { data: existing } = await supabase.from('attendance_logs').select('id').eq('employee_id', user.id).eq('tanggal', today).is('jam_asli_pulang', null).maybeSingle();
      if (existing) { loggedTodayRef.current = true; return; }
      let shift = null;
      const { data: shiftToday } = await supabase.from('shifts').select('*').eq('outlet_id', outletId).eq('employee_id', user.id).eq('tanggal', today).maybeSingle();
      if (shiftToday) shift = shiftToday;
      else {
        const { data: shiftAny } = await supabase.from('shifts').select('*').eq('outlet_id', outletId).eq('employee_id', user.id).order('tanggal', { ascending: false }).limit(1).maybeSingle();
        shift = shiftAny;
      }
      const now = new Date();
      let status = 'Tepat';
      if (shift) {
        const [h, m] = shift.jam_masuk.split(':').map(Number);
        const jadwalMasuk = new Date(); jadwalMasuk.setHours(h, m, 0, 0);
        const diff = Math.floor((now - jadwalMasuk) / 60000);
        if (diff > 15) status = `Telat ${diff}m`;
        else if (diff < -15) status = `Lebih Awal ${Math.abs(diff)}m`;
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
  const signOut = async () => {
    try {
      if (user && profile && profile.role!== 'owner') {
        const today = new Date().toISOString().split('T')[0];
        const { data: openLog } = await supabase.from('attendance_logs').select('*').eq('employee_id', user.id).eq('tanggal', today).is('jam_asli_pulang', null).order('jam_asli_masuk', { ascending: false }).limit(1).maybeSingle();
        if (openLog) {
          const now = new Date();
          const masuk = new Date(openLog.jam_asli_masuk);
          let durMenit = Math.floor((now - masuk) / 60000);
          if (durMenit < 1) durMenit = 1;
          let statusAkhir = openLog.status || 'Tepat';
          if (openLog.jam_jadwal_pulang) {
            const [h,m] = openLog.jam_jadwal_pulang.split(':').map(Number);
            const jadwalPulang = new Date(); jadwalPulang.setHours(h,m,0,0);
            const selisih = Math.floor((now - jadwalPulang)/60000);
            if (selisih < -15) statusAkhir = `Kurang Jam ${Math.abs(selisih)}m`;
            else if (selisih > 15) statusAkhir = `Lembur ${selisih}m`;
          }
          await supabase.from('attendance_logs').update({ jam_asli_pulang: now.toISOString(), durasi_asli_menit: durMenit, selisih_menit: openLog.jam_jadwal_pulang? Math.floor((now - new Date(new Date().setHours(...openLog.jam_jadwal_pulang.split(':').map(Number),0,0)))/60000) : null, status: statusAkhir }).eq('id', openLog.id);
        }
      }
    } catch (e) { console.error(e); }
    localStorage.removeItem('activeOutletId'); loggedTodayRef.current = false; const { error } = await supabase.auth.signOut(); if (error) throw error;
  };
  const value = { user, session, loading, profile, outlets, activeOutlet, activeOutletId, setActiveOutletId, isOwner, signIn, signUp: async (e,p)=>{const {data,error}=await supabase.auth.signUp({email:e,password:p}); if(error) throw error; return data;}, signOut, login: signIn };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
export const useAuth = () => useContext(AuthContext);