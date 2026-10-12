import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [outlets, setOutlets] = useState([]);
  const [activeOutletId, setActiveOutletId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const saved = typeof window!== "undefined"? localStorage.getItem("active_outlet_id") : null;
    if (saved) setActiveOutletId(saved);

    // PAKSA MATI LOADING SETELAH 6 DETIK - JANGAN MUTER SELAMANYA
    const safetyTimer = setTimeout(() => {
      if (mounted) {
        console.warn("Auth safety timeout - forcing loading=false");
        setLoading(false);
      }
    }, 6000);

    const load = async () => {
      try {
        console.log("Auth: getting session...");
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        const session = data?.session;
        console.log("Auth: session",!!session);
        if (!mounted) return;
        setUser(session?.user || null);

        if (session?.user) {
          const { data: prof } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
          if (mounted) setProfile(prof || null);

          const { data: out } = await supabase.from("outlets").select("*").limit(20);
          if (mounted && out) {
            setOutlets(out);
            if (!saved && out[0]) {
              setActiveOutletId(out[0].id);
              localStorage.setItem("active_outlet_id", out[0].id);
            }
          }
        }
      } catch (e) {
        console.error("Auth load error:", e);
      } finally {
        if (mounted) {
          clearTimeout(safetyTimer);
          setLoading(false);
          console.log("Auth: loading finished");
        }
      }
    };
    load();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_e, session) => {
      if (!mounted) return;
      setUser(session?.user || null);
      if (!session?.user) {
        setProfile(null);
        setOutlets([]);
        setLoading(false);
        return;
      }
      try {
        const { data: prof } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
        if (mounted) setProfile(prof || null);
        const { data: out } = await supabase.from("outlets").select("*").limit(20);
        if (mounted && out?.length) {
          setOutlets(out);
          const cur = localStorage.getItem("active_outlet_id");
          if (!cur) {
            setActiveOutletId(out[0].id);
            localStorage.setItem("active_outlet_id", out[0].id);
          }
        }
      } catch (e) {
        console.error("Auth state change error", e);
      } finally {
        if (mounted) setLoading(false);
      }
    });

    return () => { mounted = false; clearTimeout(safetyTimer); subscription.unsubscribe(); };
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data;
    } catch (e) {
      setLoading(false);
      throw e;
    }
  };

  const logout = async () => {
    await supabase.auth.signOut();
    if (typeof window!== "undefined") localStorage.removeItem("active_outlet_id");
    setUser(null); setProfile(null); setOutlets([]); setActiveOutletId(null);
  };

  const activeOutlet = outlets.find(o => o.id === activeOutletId) || outlets[0] || null;

  return (
    <AuthContext.Provider value={{ user, profile, outlets, activeOutlet, activeOutletId, setActiveOutletId, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
