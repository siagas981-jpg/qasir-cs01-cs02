import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);

  useEffect(() => {
    console.log('Auth: getting session...');
    
    // Timeout darurat - kalau 5 detik gak kelar, paksa kelar
    const timeout = setTimeout(() => {
      console.log('Auth: TIMEOUT - force finish loading');
      setLoading(false);
    }, 5000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Auth: session', !!session);
      clearTimeout(timeout);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      console.log('Auth: loading finished');
    }).catch(err => {
      console.error('Auth error', err);
      clearTimeout(timeout);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const value = { user, session, loading, signOut: () => supabase.auth.signOut() };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
