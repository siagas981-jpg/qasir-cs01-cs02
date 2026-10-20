// src/hooks/usePermission.js - FIX FINAL ANTI SELALU DIIZINKAN
import { useAuth } from "@/context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";

export function usePermission(permission_key) {
  const { user } = useAuth();
  
  // Ambil role dengan benar - cek semua kemungkinan
  const rawRole = user?.role || user?.user_metadata?.role || user?.app_metadata?.role || 'cashier';
  // Normalisasi role: staff/karyawan/cashier semua dianggap cashier
  const role = rawRole === 'owner' ? 'owner' : 'cashier';

  const { data: allowed, isLoading } = useQuery({
    queryKey: ["perm", role, permission_key],
    enabled: !!role && !!permission_key && !!user,
    staleTime: 5000,
    queryFn: async () => {
      // Owner selalu TRUE - bypass
      if (role === 'owner') return true;

      const { data, error } = await supabase
        .from("role_permissions")
        .select("allowed")
        .eq("role", role)
        .eq("permission_key", permission_key)
        .maybeSingle();

      if (error) {
        console.error(`Perm error ${permission_key}:`, error);
        return false; // ERROR = TOLAK! Bukan diizinkan!
      }

      if (!data) {
        console.warn(`Permission ${permission_key} untuk ${role} tidak ada di DB -> default FALSE (TOLAK)`);
        return false; // GAK ADA DI DB = TOLAK!
      }

      console.log(`ROLE_PERMS CHECK: ${role} - ${permission_key} = ${data.allowed}`);
      return !!data.allowed;
    },
  });

  if (role === 'owner') return true;
  if (isLoading) return false; // LOADING = TOLAK DULU, biar gak kedip izin!

  return !!allowed;
}
