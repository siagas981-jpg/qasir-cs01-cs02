import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
const AuthContext = createContext();
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [outlets, setOutlets] = useState([]);
  const [activeOutletId, setActiveOutletId] = useState(localStorage.getItem("active_outlet_id") || null);
  const [loading, setLoading] = useState(true);
  const activeOutlet = outlets.find(o => o.id === activeOutletId) || outlets[0] || null;

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUser(session?.user || null);
      if (session?.user) {
        const { data: prof } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
        setProfile(prof);
        if (prof) {
          const { data: out } = await supabase.from("outlets").select("*");
          setOutlets(out || []);
          if (prof.outlet_id &&!activeOutletId) {
            setActiveOutletId(prof.outlet_id);
            localStorage.setItem("active_outlet_id", prof.outlet_id);
          }
        }
      }
      setLoading(false);
    };
    init();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user || null);
      if (session?.user) {
        const { data: prof } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
        setProfile(prof);
      } else {
        setProfile(null);
      }
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const login = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };
  const logout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("active_outlet_id");
    setActiveOutletId(null);
    setProfile(null);
    setUser(null);
  };
  return (
    <AuthContext.Provider value={{ user, profile, outlets, activeOutlet, activeOutletId, setActiveOutletId, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};
export const useAuth = () => useContext(AuthContext);
