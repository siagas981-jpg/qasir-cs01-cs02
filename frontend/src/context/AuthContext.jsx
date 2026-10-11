import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";

const AuthCtx = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [outlets, setOutlets] = useState([]);
  const [activeOutletId, setActiveOutletId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const loadOutlets = useCallback(async () => {
    const { data } = await supabase.from("outlets").select("*").order("name");
    setOutlets(data || []);
    return data || [];
  }, []);

  const uid = session?.user?.id;

  // --- FUNGSI AUTO ABSENSI ---
  const clockIn = useCallback(async (userProfile) => {
    if (!userProfile) return;
    const today = new Date().toISOString().split('T')[0];

    // cek sudah absen hari ini belum
    const { data: existing } = await supabase
     .from("attendance_logs")
     .select("id")
     .eq("employee_id", userProfile.id)
     .eq("tanggal", today)
     .is("jam_asli_pulang", null)
     .maybeSingle();

    if (existing) return; // sudah clock-in, jangan dobel

    // ambil jadwal shift hari ini untuk karyawan ini
    const { data: shiftToday } = await supabase
     .from("shifts")
     .select("*")
     .eq("tanggal", today)
     .or(`employee_id.eq.${userProfile.id},outlet_id.eq.${userProfile.outlet_id}`)
     .maybeSingle();

    const now = new Date();
    await supabase.from("attendance_logs").insert({
      employee_id: userProfile.id,
      employee_name: userProfile.full_name,
      outlet_id: userProfile.outlet_id,
      tanggal: today,
      shift_name: shiftToday?.shift_name || shiftToday?.nama_shift || 'Tanpa Jadwal',
      jam_jadwal_masuk: shiftToday?.start_time || shiftToday?.jam_masuk,
      jam_jadwal_pulang: shiftToday?.end_time || shiftToday?.jam_pulang,
      jam_asli_masuk: now.toISOString(),
      status: 'Hadir'
    });
  }, []);

  const clockOut = useCallback(async (userId) => {
    if (!userId) return;
    const today = new Date().toISOString().split('T')[0];
    const { data: openLog } = await supabase
     .from("attendance_logs")
     .select("*")
     .eq("employee_id", userId)
     .eq("tanggal", today)
     .is("jam_asli_pulang", null)
     .order("jam_asli_masuk", { ascending: false })
     .limit(1)
     .maybeSingle();

    if (!openLog) return;

    const masuk = new Date(openLog.jam_asli_masuk);
    const pulang = new Date();
    const durasiAsli = Math.round((pulang - masuk) / 60000); // menit

    let durasiJadwal = null;
    let selisih = null;
    if (openLog.jam_jadwal_masuk && openLog.jam_jadwal_pulang) {
      const [sh, sm] = openLog.jam_jadwal_masuk.split(':').map(Number);
      const [eh, em] = openLog.jam_jadwal_pulang.split(':').map(Number);
      durasiJadwal = (eh*60+em) - (sh*60+sm);
      if (durasiJadwal < 0) durasiJadwal += 24*60; // shift malam
      selisih = durasiAsli - durasiJadwal;
    }

    let status = 'Tepat';
    if (selisih!== null) {
      if (selisih < -15) status = `Kurang ${Math.abs(selisih)}m`;
      else if (selisih > 15) status = `Lembur ${selisih}m`;
      else status = 'Tepat';
    }
    // cek telat masuk
    if (openLog.jam_jadwal_masuk) {
      const [jh, jm] = openLog.jam_jadwal_masuk.split(':').map(Number);
      const jadwalMasuk = new Date(masuk); jadwalMasuk.setHours(jh, jm, 0, 0);
      const telat = Math.round((masuk - jadwalMasuk)/60000);
      if (telat > 10) status = `Telat ${telat}m`;
    }

    await supabase.from("attendance_logs").update({
      jam_asli_pulang: pulang.toISOString(),
      durasi_asli_menit: durasiAsli,
      durasi_jadwal_menit: durasiJadwal,
      selisih_menit: selisih,
      status: status
    }).eq("id", openLog.id);
  }, []);

  useEffect(() => {
    if (session === undefined) return;
    if (!uid) { setProfile(null); setOutlets([]); setActiveOutletId(null); setLoading(false); return; }
    (async () => {
      setLoading(true);
      const { data: p } = await supabase.from("profiles").select("*").eq("id", uid).single();
      if (p && p.is_active === false) {
        toast.error("Akun Anda dinonaktifkan. Hubungi owner.");
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }
      setProfile(p);
      const list = await loadOutlets();
      setActiveOutletId(p?.role === "cashier"? p.outlet_id : list[0]?.id?? null);
      setLoading(false);

      // AUTO CLOCK IN setelah profile ketemu
      if (p) clockIn(p);
    })();
  }, [uid, session, loadOutlets, clockIn]);

  const value = {
    session, user: session?.user?? null, profile, outlets, loading,
    isOwner: profile?.role === "owner",
    activeOutletId, setActiveOutletId,
    activeOutlet: outlets.find((o) => o.id === activeOutletId) || null,
    reloadOutlets: loadOutlets,
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signOut: async () => {
      try { if (uid) await clockOut(uid); } catch {}
      return supabase.auth.signOut();
    },
    clockIn, clockOut
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
