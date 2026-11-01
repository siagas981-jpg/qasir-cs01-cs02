import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://fqmhxedhluaekg1m1gnt.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxbWh4ZWRobHVhZWtnbG1sZ250Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEzNTMzOTcsImV4cCI6MjEwNjkyOTM5N30.gKSsyOWDx7TGmZuUoR2hQjmW1paGfeB1fTM51ccsNOU";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export default supabase;
