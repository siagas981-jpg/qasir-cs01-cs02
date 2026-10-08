import { useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { LogOut, Store, Users, Boxes, BarChart3, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { useConnection } from "@/hooks/useConnection";
import { flushQueue } from "@/lib/offlineQueue";
import { QueueSheet } from "@/components/QueueSheet";
import { OutletSwitcher } from "@/components/OutletSwitcher";

const NAV = [
  { to: "/", label: "Kasir", id: "nav-pos", end: true },
  { to: "/transactions", label: "Transaksi", id: "nav-transactions" },
  { to: "/products", label: "Produk", id: "nav-products", owner: true },
  { to: "/inventory", label: "Inventaris", id: "nav-inventory", owner: true, icon: Boxes },
  { to: "/reports", label: "Laporan", id: "nav-reports", owner: true, icon: BarChart3 },
  { to: "/bookkeeping", label: "Pembukuan", id: "nav-bookkeeping", owner: true, icon: BookOpen },
  { to: "/outlets", label: "Outlet", id: "nav-outlets", owner: true },
  { to: "/employees", label: "Kelola Karyawan", id: "nav-employees", owner: true, icon: Users },
];

function StatusBadge({ online, healthy }) {
  const ok = online && healthy !== false;
  return (
    <span data-testid="supabase-sync-status-badge" className="inline-flex items-center gap-1.5 text-xs font-medium">
      <span className={`h-2 w-2 rounded-full ${ok ? "bg-emerald-500" : "bg-rose-500"} ${ok ? "" : "animate-pulse"}`} />
      <span className="hidden sm:inline">{!online ? "Offline" : healthy === false ? "Supabase error" : "Online"}</span>
    </span>
  );
}

export default function AppShell() {
  const { user, profile, isOwner, signOut } = useAuth();
  const { online, healthy, queue } = useConnection();

  useEffect(() => {
    if (!online || !user) return;
    flushQueue(user.id).then((r) => {
      if (r.synced) toast.success(`${r.synced} transaksi offline tersinkron`);
      if (r.failed) toast.error(`${r.failed} transaksi offline ditolak — cek antrean`);
    });
  }, [online, user]);

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="sticky top-0 z-50 border-b bg-background/90 backdrop-blur-md">
        <div className="flex h-16 items-center gap-2 sm:gap-4 px-3 md:px-6">
          <div className="flex items-center gap-2 shrink-0">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-emerald-600 text-white"><Store className="h-5 w-5" /></div>
            <span className="font-heading text-lg font-extrabold tracking-tight hidden sm:block">CS Qasir</span>
          </div>
          <nav className="flex items-center gap-1 overflow-x-auto no-scrollbar">
            {NAV.filter((n) => !n.owner || isOwner).map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} data-testid={n.id}
                className={({ isActive }) => `whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold transition-colors inline-flex items-center gap-1.5 ${isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}>
                {n.icon && <n.icon className="h-4 w-4" />}{n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="hidden md:block"><OutletSwitcher /></div>
            <StatusBadge online={online} healthy={healthy} />
            <QueueSheet queue={queue} online={online} />
            <div className="hidden lg:flex flex-col items-end leading-tight">
              <span className="text-xs font-semibold" data-testid="header-user-email">{user?.email}</span>
              <span className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold" data-testid="header-user-role">{profile?.role}</span>
            </div>
            <button onClick={signOut} data-testid="logout-button" className="rounded-md p-2 text-slate-600 hover:bg-slate-900 hover:text-white transition-colors" aria-label="Keluar">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="md:hidden border-t px-4 py-2"><OutletSwitcher /></div>
      </header>
      <main><Outlet /></main>
    </div>
  );
}
