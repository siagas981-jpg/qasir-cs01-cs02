// src/hooks/usePermission.js - FINAL LENGKAP PER OUTLET + ANTI KUNCI OWNER
import { useAuth } from "@/context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";

/**
 * Hook untuk cek izin kasir per outlet
 * @param {string} permission_key - contoh: cashier_checkout, pembukuan_bank
 * @returns {boolean} true = diizinkan, false = ditolak
 */
export function usePermission(permission_key) {
  const { user, currentOutlet, selectedOutlet } = useAuth();
  
  // 1. CEK OWNER BY EMAIL - INI PALING PENTING!
  const email = (user?.email || "").toLowerCase().trim();
  const isOwnerByEmail = email === "siagas981@gmail.com" || email.includes("owner");
  
  // 2. CEK ROLE DARI USER
  const rawRole = user?.role || user?.user_metadata?.role || user?.app_metadata?.role || 'cashier';
  const isOwnerByRole = rawRole === 'owner';
  
  // FINAL: Kalau owner by email ATAU by role = OWNER
  const isOwner = isOwnerByEmail || isOwnerByRole;
  const role = isOwner ? 'owner' : 'cashier';

  // 3. AMBIL OUTLET ID YANG SEDANG DIPILIH DI HEADER (CS Qasir 01)
  // Coba ambil dari context, kalau gak ada ambil dari localStorage
  const outletId = 
    currentOutlet?.id || 
    selectedOutlet?.id || 
    localStorage.getItem("selectedOutletId") || 
    localStorage.getItem("outlet_id") || 
    null;

  const outletName = currentOutlet?.name || localStorage.getItem("selectedOutletName") || "Outlet";

  // 4. QUERY KE SUPABASE PER OUTLET
  const { data: allowed, isLoading, error } = useQuery({
    queryKey: ["perm", role, permission_key, outletId, email],
    enabled: !!permission_key && !!user && !!email,
    staleTime: 1000 * 60 * 5, // cache 5 menit
    retry: 1,
    queryFn: async () => {
      // OWNER SELALU TRUE - BYPASS TOTAL, GAK USAH QUERY!
      if (isOwner) {
        console.log(`[PERM] ${email} is OWNER -> ${permission_key} = TRUE (bypass)`);
        return true;
      }

      // KASIR - CEK PER OUTLET
      try {
        let query = supabase
          .from("role_permissions")
          .select("allowed, outlet_id")
          .eq("role", "cashier")
          .eq("permission_key", permission_key);

        // JIKA ADA OUTLET ID, FILTER SESUAI OUTLET YANG DIPILIH!
        if (outletId) {
          query = query.eq("outlet_id", outletId);
        }

        const { data, error: dbError } = await query.maybeSingle();

        if (dbError) {
          console.error(`[PERM] DB Error ${permission_key} @ ${outletName}:`, dbError);
          return true; // ERROR = IZINKAN DULU BIAR GAK NGUNCI KASIR!
        }

        if (!data) {
          console.log(`[PERM] ${permission_key} @ ${outletName} belum ada setting -> default TRUE`);
          return true; // BELUM ADA SETTING = IZINKAN!
        }

        console.log(`[PERM] CHECK: ${role} - ${permission_key} @ ${outletName} = ${data.allowed}`);
        return !!data.allowed;

      } catch (e) {
        console.error(`[PERM] Exception ${permission_key}:`, e);
        return true; // EXCEPTION = IZINKAN!
      }
    },
  });

  // 5. RETURN LOGIC FINAL - ANTI KUNCI!
  
  // OWNER = SELALU TRUE!
  if (isOwner) {
    return true;
  }

  // KALAU MASIH LOADING = IZINKAN DULU! BIAR TOMBOL GAK HILANG!
  if (isLoading) {
    return true;
  }

  // KALAU ERROR = IZINKAN DULU!
  if (error) {
    return true;
  }

  // KASIR - KEMBALIKAN HASIL DB
  return !!allowed;
}

// Export tambahan kalau mau cek outlet aktif
export function useCurrentOutletId() {
  const { currentOutlet, selectedOutlet } = useAuth();
  return currentOutlet?.id || selectedOutlet?.id || localStorage.getItem("selectedOutletId") || null;
}
