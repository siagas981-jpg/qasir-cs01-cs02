import { useAuth } from "@/context/AuthContext";
import { ROLE_DEFAULTS } from "@/lib/permissions";

export function usePermission() {
  const { userRole, customPermissions } = useAuth(); // customPermissions dari DB

  const can = (permission) => {
    if (userRole === 'owner') return true; // owner bypass
    // cek custom yg di-set owner di DB, kalau gak ada pakai default role
    const allowed = customPermissions?.[userRole] || ROLE_DEFAULTS[userRole] || [];
    return allowed.includes(permission);
  };

  return { can, role: userRole };
}
