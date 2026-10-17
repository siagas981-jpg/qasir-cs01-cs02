import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { LogOut, Store, Users, Boxes, BarChart3, BookOpen, Truck, ShoppingCart, Archive } from "lucide-react";
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
  { to: "/dashboard/suppliers", label: "Supplier", id: "nav-suppliers", owner: true, icon: Truck },
  { to: "/dashboard/purchases", label: "Pembelian", id: "nav-purchases", owner: true, icon: ShoppingCart },
  { to: "/reports", label: "Laporan", id: "nav-reports", owner: true, icon: BarChart3 },
  { to: "/bookkeeping", label: "Pembukuan", id: "nav-bookkeeping", owner: true, icon: BookOpen },
  { to: "/outlets", label: "Outlet", id: "nav-outlets", owner: true },
  { to: "/employees", label: "Kelola Karyawan", id: "nav-employees", owner: true, icon: Users },
  { to: "/dashboard/arsip", label: "Arsip", id: "nav-archive", owner: true, icon: Archive },
];

function StatusBadge({ online, healthy }) {
  try {
    const ok = online && healthy !== false;
    return (
      <span data-testid="supabase-sync-status-badge" className="inline-flex items-center gap-1.5 text-xs font-medium">
        <span className={`h-2 w-2 rounded-full ${ok ? "bg-emerald-500" : "bg-rose-500"} ${ok ? "" : "animate-pulse"}`} />
        <span className="hidden sm:inline">{!online ? "Offline" : healthy === false ? "Supabase error" : "Online"}</span>
      </span>
    );
  } catch { return <span className="text-xs">Online</span>; }
}

function SafeOutlet() {
  try {
    return <Outlet />;
  } catch (e) {
    return <div className="p-10 text-center">Gagal load halaman, coba refresh.<br/><button onClick={()=>window.location.reload()} className="mt-4 px-4 py-2 bg-black text-white rounded">Refresh</button></div>;
  }
}

export default function AppShell() {
  const { user, profile, isOwner } = useAuth();
  const { online, healthy, queue } = useConnection();
  const scrollRef = useRef(null);
  const [showTrack, setShowTrack] = useState(false);
  const [thumb, setThumb] = useState({ width: 0, left: 0 });
  const [dragging, setDragging] = useState(false);

  // FIX ANTI-CACHE PUTIH MODE BIASA = MODE SAMARAN
  useEffect(() => {
    try {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
      }
      const ver = localStorage.getItem('qasir.cache.version');
      if (ver !== 'v3-final') {
        localStorage.removeItem('qasir.offlineQueue.v1');
        try { indexedDB.deleteDatabase('qasir_offline_db'); } catch {}
        localStorage.setItem('qasir.cache.version', 'v3-final');
      }
      const appVer = localStorage.getItem('app_version');
      if (appVer !== 'v2-fix-filter') {
        localStorage.setItem('app_version', 'v2-fix-filter');
      }
    } catch {}
  }, []);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        if (!online || !user?.id) return;
        const r = await flushQueue(user.id);
        if (cancelled) return;
        if (r?.synced) toast.success(`${r.synced} transaksi offline tersinkron`);
        if (r?.failed) toast.error(`${r.failed} transaksi offline ditolak`);
      } catch (e) {
        console.warn("flushQueue diamankan:", e?.message);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [online, user?.id]);

  const updateThumb = () => {
    try {
      const el = scrollRef.current;
      if (!el) return;
      const { scrollWidth, clientWidth, scrollLeft } = el;
      if (scrollWidth <= clientWidth) { setShowTrack(false); return; }
      setShowTrack(true);
      const trackWidth = el.clientWidth;
      const thumbWidth = Math.max((clientWidth / scrollWidth) * trackWidth, 40);
      const maxScroll = scrollWidth - clientWidth;
      const maxThumb = trackWidth - thumbWidth;
      const thumbLeft = maxScroll > 0 ? (scrollLeft / maxScroll) * maxThumb : 0;
      setThumb({ width: thumbWidth, left: thumbLeft });
    } catch {}
  };

  useEffect(() => {
    try {
      updateThumb();
      const el = scrollRef.current;
      if (!el) return;
      el.addEventListener("scroll", updateThumb);
      window.addEventListener("resize", updateThumb);
      return () => {
        try {
          el.removeEventListener("scroll", updateThumb);
          window.removeEventListener("resize", updateThumb);
        } catch {}
      };
    } catch {}
  }, []);

  const onTrackMouseDown = (e) => {
    const el = scrollRef.current;
    if (!el) return;
    try {
      const trackRect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - trackRect.left;
      const { scrollWidth, clientWidth } = el;
      const ratio = clickX / trackRect.width;
      el.scrollLeft = ratio * (scrollWidth - clientWidth);
    } catch {}
  };

  const onThumbMouseDown = (e) => {
    e.stopPropagation();
    setDragging(true);
    const startX = e.clientX;
    const startLeft = thumb.left;
    const el = scrollRef.current;
    if (!el) return;
    const trackWidth = el?.clientWidth || 0;
    const { scrollWidth, clientWidth } = el;
    const onMove = (ev) => {
      try {
        const dx = ev.clientX - startX;
        const newLeft = Math.min(Math.max(startLeft + dx, 0), trackWidth - thumb.width);
        const maxThumb = trackWidth - thumb.width;
        const ratio = maxThumb > 0 ? newLeft / maxThumb : 0;
        el.scrollLeft = ratio * (scrollWidth - clientWidth);
      } catch {}
    };
    const onUp = () => {
      setDragging(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const isDownRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);
  const { signOut } = useAuth();

  if (!user) {
    return <div className="min-h-screen grid place-items-center p-10">Loading akun...</div>;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <header className="sticky top-0 z-50 border-b bg-background/90 backdrop-blur-md">
        <div className="flex h-16 items-center gap-2 sm:gap-4 px-3 md:px-6">
          <div className="flex items-center gap-2 shrink-0">
            <div className="grid h-9 w-9 place-items-center rounded-md bg-emerald-600 text-white"><Store className="h-5 w-5" /></div>
            <span className="font-heading text-lg font-extrabold tracking-tight hidden sm:block">CS Qasir</span>
          </div>
          <div className="flex-1 min-w-0 flex flex-col justify-center">
            <nav
              ref={scrollRef}
              className="flex items-center gap-1 overflow-x-auto scrollbar-none select-none cursor-grab active:cursor-grabbing"
              style={{ scrollbarWidth: "none" }}
              onMouseDown={(e) => {
                try {
                  const cur = scrollRef.current;
                  if (!cur) return;
                  isDownRef.current = true;
                  startXRef.current = e.pageX - (cur.offsetLeft || 0);
                  scrollLeftRef.current = cur.scrollLeft;
                } catch {}
              }}
              onMouseLeave={() => (isDownRef.current = false)}
              onMouseUp={() => (isDownRef.current = false)}
              onMouseMove={(e) => {
                if (!isDownRef.current) return;
                try {
                  e.preventDefault();
                  const cur = scrollRef.current;
                  if (!cur) return;
                  const x = e.pageX - (cur.offsetLeft || 0);
                  const walk = (x - startXRef.current) * 1.5;
                  cur.scrollLeft = scrollLeftRef.current - walk;
                } catch {}
              }}
            >
              {/* FIX UTAMA ANTI PUTIH - LOGIKA DIBALIK! */}
              {(Array.isArray(NAV) ? NAV : []).filter((n) => n && (!n.owner || isOwner)).map((n) => (
                <NavLink key={n.to} to={n.to} end={n.end} data-testid={n.id}
                  className={({ isActive }) => `whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold transition-colors inline-flex items-center gap-1.5 shrink-0 ${isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}>
                  {n.icon && <n.icon className="h-4 w-4" />}{n.label}
                </NavLink>
              ))}
            </nav>
            {showTrack && (
              <div onMouseDown={onTrackMouseDown} className="relative mt-1 h-2 w-full bg-slate-200 rounded-full cursor-pointer group">
                <div onMouseDown={onThumbMouseDown} className={`absolute top-0 h-full bg-slate-900 rounded-full hover:bg-black transition-colors ${dragging ? "bg-black h-[8px] -top-[1px]" : ""}`} style={{ width: `${thumb.width}px`, left: `${thumb.left}px` }} />
              </div>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="hidden md:block"><OutletSwitcher /></div>
            <StatusBadge online={online} healthy={healthy} />
            <QueueSheet queue={queue || []} online={!!online} />
            <div className="hidden lg:flex flex-col items-end leading-tight">
              <span className="text-xs font-semibold" data-testid="header-user-email">{user?.email || "-"}</span>
              <span className="text-[10px] uppercase tracking-wider text-emerald-700 font-bold" data-testid="header-user-role">{profile?.role || "loading..."}</span>
            </div>
            <button onClick={signOut} data-testid="logout-button" className="rounded-md p-2 text-slate-600 hover:bg-slate-900 hover:text-white transition-colors" aria-label="Keluar">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="md:hidden border-t px-4 py-2"><OutletSwitcher /></div>
      </header>
      <main><SafeOutlet /></main>
    </div>
  );
}
