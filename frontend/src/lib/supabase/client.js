import { createClient } from "@supabase/supabase-js";

const getEnv = (name) => {
  try {
    if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env[name]) {
      return import.meta.env[name];
    }
  } catch {}
  if (typeof process !== "undefined" && process.env) {
    return process.env[name] || process.env[`REACT_APP_${name}`] || process.env[`VITE_${name}`] || process.env[`NEXT_PUBLIC_${name}`];
  }
  return undefined;
};

const supabaseUrl = getEnv("SUPABASE_URL") || getEnv("VITE_SUPABASE_URL") || getEnv("REACT_APP_SUPABASE_URL") || getEnv("NEXT_PUBLIC_SUPABASE_URL") || import.meta.env.VITE_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = getEnv("SUPABASE_ANON_KEY") || getEnv("VITE_SUPABASE_ANON_KEY") || getEnv("REACT_APP_SUPABASE_ANON_KEY") || getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") || import.meta.env.VITE_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

console.log("CHECK ENV:", { hasUrl: !!supabaseUrl, hasKey: !!supabaseAnonKey });

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("SUPABASE ENV MISSING!", { supabaseUrl, hasKey: !!supabaseAnonKey });
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const healthCheck = async () => {
  try {
    const { error } = await supabase.from("outlets").select("id").limit(1);
    return !error;
  } catch {
    return false;
  }
};

export { supabase };
export default supabase;
