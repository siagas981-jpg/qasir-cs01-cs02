import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";

export function usePermission(key) {
  const { profile } = useAuth();
  const [allowed, setAllowed] = useState(true);
  useEffect(() => {
    if (!profile?.role) return;
    const roleLower = String(profile.role).toLowerCase();
    if (roleLower === 'owner') { setAllowed(true); return; }
    (async () => {
      const { data } = await supabase.from("role_permissions").select("role, allowed").eq("permission_key", key);
      const match = data?.find(r => String(r.role).toLowerCase() === roleLower);
      if (match) setAllowed(!!match.allowed);
      else setAllowed(true);
    })();
  }, [profile?.role, key]);
  return allowed;
}
