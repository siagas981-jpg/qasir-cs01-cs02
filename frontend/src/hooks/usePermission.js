// src/hooks/usePermission.js - FIX FULL 42 BARIS - UNTUK TABLE allowed TRUE/FALSE
import { useAuth } from "@/context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";

export function usePermission(permission_key) {
  const { user } = useAuth();
  // Ambil role dari user metadata atau profiles
  const role = user?.role || user?.user_metadata?.role || user?.app_metadata?.role || 'cashier';

  const { data: allowed, isLoading } = useQuery({
    queryKey: ["perm", role, permission_key],
    enabled: !!role && !!permission_key,
    staleTime: 30_000,
    cacheTime: 60_000,
    queryFn: async () => {
      try {
        // Owner selalu TRUE
        if (role === 'owner') return true;

        const { data, error } = await supabase
          .from("role_permissions")
          .select("allowed")
          .eq("role", role)
          .eq("permission_key", permission_key)
          .maybeSingle();

        // Kalau gak ada row di DB, anggap TRUE (default boleh)
        if (error || !data) {
          console.warn(`Permission ${permission_key} untuk ${role} tidak ditemukan, default TRUE`);
          return true;
        }

        return !!data.allowed;
      } catch (err) {
        console.error("usePermission error:", err);
        return true;
      }
    },
  });

  // Owner bypass - selalu boleh
  if (role === 'owner') return true;

  // Saat loading, anggap true dulu biar gak kedip lock
  if (isLoading) return true;

  return !!allowed;
}

// Helper tambahan kalau butuh cek banyak permission sekaligus
export function usePermissions(permission_keys = []) {
  const { user } = useAuth();
  const role = user?.role || user?.user_metadata?.role || 'cashier';
  
  return permission_keys.map(key => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return usePermission(key);
  });
}
