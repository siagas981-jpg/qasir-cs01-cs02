// CLIENT V11 - ANTI KEPOTONG & ANTI SPASI OWY!
const rawUrl = 
  import.meta.env.VITE_SUPABASE_URL || 
  import.meta.env.REACT_APP_SUPABASE_URL || 
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL || 
  process.env.REACT_APP_SUPABASE_URL ||
  "https://fqmhxedhluaekg1m1gnt.supabase.co";

const rawKey = 
  import.meta.env.VITE_SUPABASE_ANON_KEY || 
  import.meta.env.REACT_APP_SUPABASE_ANON_KEY || 
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
  process.env.REACT_APP_SUPABASE_ANON_KEY ||
  "sb_publishable_ru5Gx..."; // <-- GANTI DENGAN KEY FULL Owy!

// BERSIHIN ENTER DAN SPASI OWY! INI OBAT NYA!
const cleanUrl = rawUrl.toString().replace(/\s/g, "").replace(/\/+$/, "").trim();
const cleanKey = rawKey.toString().replace(/\s/g, "").trim();

console.log("[CLIENT V11] URL:", cleanUrl);
console.log("[CLIENT V11] Key length:", cleanKey.length);

import { createClient } from "@supabase/supabase-js";
export const supabase = createClient(cleanUrl, cleanKey);
export default supabase;
