import "./lib/supabase/patch.js";
import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@/index.css";
import App from "@/App";

// [ANTI-PUTIH V5] Extra protection after patch.js loaded
if (typeof window !== 'undefined') {
  const origError = console.error;
  console.error = function(...args) {
    const txt = args.map(a => String(a)).join(' ').toLowerCase();
    if (txt.includes('supabaseurl is required')) {
      console.warn('[ANTI-PUTIH V5] console.error supabaseUrl blocked - app continues');
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

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
