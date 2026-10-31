import "./lib/supabase/patch.js";
import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@/index.css";

// [ANTI-PUTIH V5] Patch console.error
if (typeof window !== 'undefined') {
  const origError = console.error;
  console.error = function(...args) {
    const txt = args.map(a => String(a)).join(' ').toLowerCase();
    if (txt.includes('supabaseurl is required')) {
      console.warn('[ANTI-PUTIH V5] console.error blocked');
      return;
    }
    return origError.apply(this, args);
  };
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  },
});

// Load App secara dynamic biar crash gak bikin putih
function SafeAppLoader() {
  const [AppComponent, setAppComponent] = React.useState(null);
  const [loadError, setLoadError] = React.useState(null);

  React.useEffect(() => {
    import("@/App")
      .then((mod) => {
        console.log('[ANTI-PUTIH V5] App loaded successfully');
        setAppComponent(() => mod.default);
      })
      .catch((err) => {
        console.error('[ANTI-PUTIH V5] App load failed:', err);
        setLoadError(err.message);
      });
  }, []);

  if (loadError) {
    return (
      <div style={{ padding: 20, fontFamily: 'sans-serif' }}>
        <h2>Loading Error (Anti-Putih caught it)</h2>
        <pre style={{ background: '#fee', padding: 10, overflow: 'auto' }}>{loadError}</pre>
        <p>ENV URL Length: {process.env.REACT_APP_SUPABASE_URL?.length}</p>
        <button onClick={() => window.location.reload()}>Reload</button>
      </div>
    );
  }

  if (!AppComponent) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontFamily: 'sans-serif' }}>
        <div>Loading Qasir CS01 CS02...<br/>Anti-Putih V5 Active</div>
      </div>
    );
  }

  return <AppComponent />;
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <SafeAppLoader />
    </QueryClientProvider>
  </React.StrictMode>,
);
