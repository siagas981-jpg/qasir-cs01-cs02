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

    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!mounted) return;
        setUser(session?.user || null);
        if (session?.user) {
          try {
            const { data: prof } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
            if (mounted) setProfile(prof || null);
          } catch (e) { console.warn("profile load skip", e?.message) }
          try {
            const { data: out } = await supabase.from("outlets").select("*").limit(20);
            if (mounted && out?.length) {
              setOutlets(out);
              if (!activeOutletId) {
                const firstId = out[0].id;
                setActiveOutletId(firstId);
                if (typeof window!== "undefined") localStorage.setItem("active_outlet_id", firstId);
              }
            }
          } catch (e) { console.warn("outlets load skip", e?.message) }
        }
      } catch (e) {
        console.warn("initial load error", e?.message);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_e, session) => {
      if (!mounted) return;
      try {
        setUser(session?.user || null);
        if (!session?.user) {
          setProfile(null);
          setOutlets([]);
          return;
        }
        try {
          const { data: prof } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
          if (mounted) setProfile(prof || null);
        } catch {}
        try {
          const { data: out } = await supabase.from("outlets").select("*").limit(20);
          if (mounted && out?.length) {
            setOutlets(out);
            if (!localStorage.getItem("active_outlet_id")) {
               const firstId = out[0].id;
               setActiveOutletId(firstId);
               localStorage.setItem("active_outlet_id", firstId);
            }
          }
        } catch {}
      } finally {
        if (mounted) setLoading(false);
      }
    });

    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  const login = async (email, password) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data;
    } finally {
      // onAuthStateChange akan set loading false, tapi jaga-jaga
      setTimeout(() => setLoading(false), 1500);
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
