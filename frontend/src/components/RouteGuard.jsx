import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

export const FullScreenLoader = () => (
  <div className="min-h-screen grid place-items-center bg-background" data-testid="app-loading">
    <Loader2 className="h-6 w-6 animate-spin text-primary" />
  </div>
);

// UI convenience only — RLS in Postgres is the real enforcement.
export function RouteGuard({ children, ownerOnly = false }) {
  const { session, profile, loading } = useAuth();
  const loc = useLocation();
  if (session === undefined || loading) return <FullScreenLoader />;
  if (!session) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (ownerOnly && profile?.role !== "owner") return <Navigate to="/" replace />;
  return children;
}
