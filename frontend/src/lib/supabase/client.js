import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

console.log("CHECK ENV:", { hasUrl: !!supabaseUrl, hasKey: !!supabaseAnonKey });

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
