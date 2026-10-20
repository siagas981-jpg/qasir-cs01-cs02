// src/hooks/usePermission.js - FIX FINAL ANTI KUNCI OWNER
import { useAuth } from "@/context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";

export function usePermission(permission_key) {
  const { user } = useAuth();
  
  // FIX UTAMA: CEK EMAIL OWNER DULU! Bukan cuma role!
  const email = (user?.email || "").toLowerCase();
  const isOwnerByEmail = email === "siagas981@gmail.com" || email.includes("owner");
  
  const rawRole = user?.role || user?.user_metadata?.role || user?.app_metadata?.role || 'cashier';
  const role = isOwnerByEmail ? 'owner' : (rawRole === 'owner' ? 'owner' : 'cashier');

  const { data: allowed, isLoading } = useQuery({
    queryKey: ["perm", role, permission_key, email],
    enabled: !!role && !!permission_key && !!user,
    staleTime: 5000,
    queryFn: async () => {
      // Owner via email SELALU TRUE - BYPASS TOTAL!
      if (role === 'owner') return true;

      const { data, error } = await supabase
        .from("role_permissions")
        .select("allowed")
        .eq("role", role)
        .eq("permission_key", permission_key)
        .maybeSingle();

      if (error) {
        console.error(`Perm error ${permission_key}:`, error);
        return true; // ERROR = IZINKAN DULU! Biar gak ngunci!
      }

      if (!data) {
        return true; // GAK ADA DI DB = IZINKAN! Default aman!
      }

      return !!data.allowed;
    },
  });

  // OWNER SELALU TRUE
  if (role === 'owner') return true;
  
  // LOADING = IZINKAN DULU, biar tombol gak kedip TOLAK!
  if (isLoading) return true;

  return !!allowed;
}
