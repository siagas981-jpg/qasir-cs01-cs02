import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase/client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [outlets, setOutlets] = useState([]);
  const [activeOutletId, setActiveOutletIdState] = useState(() => {
    return localStorage.getItem('activeOutletId') || null;
  });

  useEffect(() => {
    const timeout = setTimeout(() => setLoading(false), 5000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(timeout);
      setSession(session);
      setUser(session?.user?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user?? null);
      setLoading(false);
    });

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  // Ambil profile & outlets
  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    const fetchData = async () => {
      const { data: profileData } = await supabase
       .from('profiles')
       .select('*')
       .eq('id', user.id)
       .single();

      if (profileData) setProfile(profileData);

      const { data: outletsData } = await supabase
       .from('outlets')
       .select('*')
       .order('name');

      if (outletsData && outletsData.length > 0) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const isOwner = profile?.role === 'owner' || user?.email === 'siagas981@gmail.com' || user?.email === 'owner@qasir.com';

  const activeOutlet = outlets.find(o => o.id === activeOutletId) || outlets[0] || null;

  const setActiveOutletId = (id) => {
    setActiveOutletIdState(id);
    localStorage.setItem('activeOutletId', id);
  };

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  };

  const signUp = async (email, password) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    localStorage.removeItem('activeOutletId');
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const value = {
    user,
    session,
    loading,
    profile,
    outlets,
    activeOutlet,
    activeOutletId,
    setActiveOutletId,
    isOwner,
    signIn,
    signUp,
    signOut,
    login: signIn
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);