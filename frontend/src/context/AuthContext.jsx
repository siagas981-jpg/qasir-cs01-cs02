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
      setActiveOutletId(p?.role === "cashier" ? p.outlet_id : list[0]?.id ?? null);
      setLoading(false);
    })();
  }, [uid, session, loadOutlets]);

  const value = {
    session, user: session?.user ?? null, profile, outlets, loading,
    isOwner: profile?.role === "owner",
    activeOutletId, setActiveOutletId,
    activeOutlet: outlets.find((o) => o.id === activeOutletId) || null,
    reloadOutlets: loadOutlets,
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    signOut: () => supabase.auth.signOut(),
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
