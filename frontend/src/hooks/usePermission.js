import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";

export function usePermission(key) {
  const { profile } = useAuth();
  const [allowed, setAllowed] = useState(false); // <-- DEFAULT FALSE SEKARANG

  useEffect(() => {
    if (!profile?.role) return;
    const roleLower = String(profile.role).toLowerCase();
    if (roleLower === 'owner') {
      setAllowed(true);
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from("role_permissions")
        .select("role, allowed")
        .eq("permission_key", key);
      
      if (error) {
        console.error("Permission error:", error);
        return;
      }
      
      const match = data?.find(r => String(r.role).toLowerCase() === roleLower);
      if (match) {
        console.log(`[CEK HAK AKSES] ${roleLower} - ${key} = ${match.allowed}`);
        setAllowed(!!match.allowed);
      }
    })();
  }, [profile?.role, key]);

  return allowed;
}
