import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [outlets, setOutlets] = useState([]);
  const [activeOutletId, setActiveOutletId] = useState(localStorage.getItem("active_outlet_id") || null);
  const [loading, setLoading] = useState(true);

  const activeOutlet = outlets.find(o => o.id === activeOutletId) || outlets[0] || null;

  const clockIn = async (userProfile) => {
    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const yesterday = new Date(now.getTime() - 86400000).toISOString().split('T')[0];

      // 1. Cari shift hari ini untuk karyawan ini
      let shift = null;
      const { data: todayShifts } = await supabase
       .from("shifts")
       .select("*")
       .eq("employee_id", userProfile.id)
       .eq("tanggal", today)
       .limit(1);

      if (todayShifts && todayShifts.length > 0) {
        shift = todayShifts[0];
      } else {
        // 2. Kalau tidak ada, cek shift kemarin yang pulangnya lewat tengah malam (Shift Malam 01:00)
        const { data: yShifts } = await supabase
         .from("shifts")
         .select("*")
         .eq("employee_id", userProfile.id)
         .eq("tanggal", yesterday)
         .limit(1);

        if (yShifts && yShifts.length > 0) {
          const jamPulang = parseInt(yShifts[0].jam_pulang.split(":")[0]);
          // kalau jam pulang kemarin pagi (01:00 - 09:00), berarti masih relevan sampai pagi ini
          if (jamPulang <= 9) shift = yShifts[0];
        }
      }

      // 3. Fallback: cari di tabel shifts hari ini by nama (jaga-jaga kalau employee_id beda)
      if (!shift) {
        const { data: allToday } = await supabase
         .from("shifts")
         .select("*, profiles(full_name)")
         .eq("tanggal", today);

        const found = allToday?.find(s => s.profiles?.full_name?.toLowerCase() === userProfile.full_name?.toLowerCase());
        if (found) shift = found;
      }

      // Cek sudah absen hari ini belum biar tidak dobel
      const { data: existing } = await supabase
       .from("attendance_logs")
       .select("id")
       .eq("employee_id", userProfile.id)
       .eq("tanggal", today)
       .is("jam_asli_pulang", null)
       .limit(1);

      if (existing && existing.length > 0) {
        console.log("SUDAH CLOCKIN HARI INI, SKIP");
        return;
      }

      const payload = {
        employee_id: userProfile.id,
        employee_name: userProfile.full_name,
        outlet_id: userProfile.outlet_id,
        tanggal: today,
        jam_jadwal_masuk: shift?.jam_masuk || null,
        jam_jadwal_pulang: shift?.jam_pulang || null,
        jam_asli_masuk: now.toISOString(),
        shift_name: shift? `${shift.nama_shift} ${shift.jam_masuk}-${shift.jam_pulang}` : "Tanpa Jadwal",
        status: "Sedang Kerja"
      };

      const { error } = await supabase.from("attendance_logs").insert(payload);
      if (error) console.error("CLOCKIN GAGAL", error);
      else console.log("CLOCKIN SUKSES", payload);

    } catch (e) {
      console.error("CLOCKIN ERROR", e);
    }
  };

  const clockOut = async (userProfile) => {
    try {
      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const { data: logs } = await supabase
       .from("attendance_logs")
       .select("*")
       .eq("employee_id", userProfile.id)
       .eq("tanggal", today)
       .is("jam_asli_pulang", null)
       .order("jam_asli_masuk", { ascending: false })
       .limit(1);

      if (!logs || logs.length === 0) return;

      const log = logs[0];
      const masuk = new Date(log.jam_asli_masuk);
      const diffMenit = Math.floor((now - masuk) / 60000);

      // Hitung selisih vs jadwal
      let selisih = null;
      let statusFinal = "Tepat";
      if (log.jam_jadwal_masuk) {
        const [jh, jm] = log.jam_jadwal_masuk.split(":").map(Number);
        const jadwalMasuk = new Date(masuk);
        jadwalMasuk.setHours(jh, jm, 0, 0);
        const telatMenit = Math.floor((masuk - jadwalMasuk) / 60000);

        if (telatMenit > 15) statusFinal = `Telat ${telatMenit}m`;
        else if (telatMenit < -15) statusFinal = `Lebih Awal ${Math.abs(telatMenit)}m`;

        if (log.jam_jadwal_pulang) {
          const [jhP, jmP] = log.jam_jadwal_pulang.split(":").map(Number);
          const jadwalPulang = new Date(masuk);
          jadwalPulang.setHours(jhP, jmP, 0, 0);
          // handle lewat tengah malam
          if (jhP < jh) jadwalPulang.setDate(jadwalPulang.getDate() + 1);

          const durJadwal = Math.floor((jadwalPulang - jadwalMasuk)/60000);
          selisih = diffMenit - durJadwal;

          if (selisih < -15) statusFinal = `${statusFinal} | Kurang ${Math.abs(selisih)}m`;
          else if (selisih > 15) statusFinal = `${statusFinal} | Lembur ${selisih}m`;
          else if (statusFinal === "Tepat") statusFinal = "Tepat";
        }
      }

      await supabase.from("attendance_logs").update({
        jam_asli_pulang: now.toISOString(),
        durasi_asli_menit: diffMenit,
        selisih_menit: selisih,
        status: statusFinal
      }).eq("id", log.id);

      console.log("CLOCKOUT SUKSES", statusFinal);

    } catch (e) {
      console.error("CLOCKOUT ERROR", e);
    }
  };

  const fetchProfileAndOutlets = useCallback(async (authUser) => {
    if (!authUser) { setProfile(null); setOutlets([]); setLoading(false); return; }
    try {
      const { data: prof } = await supabase.from("profiles").select("*").eq("id", authUser.id).single();
      if (prof) {
        setProfile(prof);
        // Auto clock in setelah profile ketemu
        setTimeout(() => clockIn(prof), 1000);

        if (prof.role === 'owner') {
          const { data: outletData } = await supabase.from("outlets").select("*");
          setOutlets(outletData || []);
          if (!activeOutletId && outletData?.[0]) {
            setActiveOutletId(outletData[0].id);
            localStorage.setItem("active_outlet_id", outletData[0].id);
          }
        } else if (prof.outlet_id) {
          const { data: outletData } = await supabase.from("outlets").select("*").eq("id", prof.outlet_id);
          setOutlets(outletData || []);
          if (!activeOutletId) {
            setActiveOutletId(prof.outlet_id);
            localStorage.setItem("active_outlet_id", prof.outlet_id);
          }
        }
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [activeOutletId]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user?? null);
      if (session?.user) fetchProfileAndOutlets(session.user);
      else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user?? null);
      if (session?.user) await fetchProfileAndOutlets(session.user);
      else { setProfile(null); setOutlets([]); setLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, [fetchProfileAndOutlets]);

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const logout = async () => {
    if (profile) await clockOut(profile);
    await supabase.auth.signOut();
    localStorage.removeItem("active_outlet_id");
    setActiveOutletId(null);
  };

  return (
    <AuthContext.Provider value={{ user, profile, outlets, activeOutlet, activeOutletId, setActiveOutletId, loading, login, logout, clockIn, clockOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
