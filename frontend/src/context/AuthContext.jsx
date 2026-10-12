// di AuthContext.jsx
useEffect(() => {
  let mounted = true;
  const timeout = setTimeout(() => {
    if(mounted) {
      console.log("Auth timeout - forcing logout");
      setLoading(false);
    }
  }, 5000); // paksa keluar loading setelah 5 detik

  const init = async () => {
    try {
      const { data, error } = await supabase.auth.getSession();
      if(error) throw error;
      if(mounted) setSession(data.session);
    } catch (err) {
      console.error("Auth error:", err);
    } finally {
      if(mounted) {
        clearTimeout(timeout);
        setLoading(false);
      }
    }
  };
  init();
  return () => { mounted = false; clearTimeout(timeout); }
}, [])
