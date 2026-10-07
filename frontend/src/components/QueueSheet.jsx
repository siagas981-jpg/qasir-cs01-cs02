import { CloudOff, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { flushQueue, removeFromQueue, retryEntry } from "@/lib/offlineQueue";
import { rupiah, dateTime } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";

export function QueueSheet({ queue, online }) {
  const { user } = useAuth();
  const mine = queue.filter((e) => e.user_id === user?.id);
  const pending = mine.filter((e) => e.status === "pending").length;

  const sync = async () => {
    const r = await flushQueue(user?.id);
    if (r.synced) toast.success(`${r.synced} transaksi offline tersinkron`);
    if (r.failed) toast.error(`${r.failed} transaksi gagal — cek antrean`);
  };

  return (
    <Sheet>
      <SheetTrigger asChild>
        <button data-testid="offline-queue-panel-trigger" className="relative inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium hover:bg-slate-900 hover:text-white transition-colors">
          <CloudOff className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Antrean</span>
          {mine.length > 0 && (
            <span data-testid="offline-queue-count" className="ml-1 rounded-full bg-amber-500 px-1.5 text-[10px] font-bold text-white">{mine.length}</span>
          )}
        </button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md bg-background" data-testid="offline-queue-sheet">
        <SheetHeader>
          <SheetTitle className="font-heading">Antrean Offline</SheetTitle>
          <SheetDescription>Transaksi yang dibuat saat offline akan dikirim otomatis saat koneksi kembali.</SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-3">
          {mine.length === 0 && <p className="text-sm text-muted-foreground" data-testid="offline-queue-empty">Tidak ada transaksi tertunda.</p>}
          {mine.map((e) => (
            <div key={e.client_ref} data-testid={`queue-entry-${e.client_ref}`} className="rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold">{rupiah(e.total)}</span>
                <span className={`text-xs font-semibold uppercase ${e.status === "failed" ? "text-rose-600" : "text-amber-600"}`}>{e.status === "failed" ? "Gagal" : "Menunggu"}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">{dateTime(e.created_at)} · {e.items.length} item</p>
              {e.error && <p className="text-xs text-rose-600 mt-1">{e.error}</p>}
              {e.status === "failed" && (
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" data-testid={`queue-retry-${e.client_ref}`} onClick={() => retryEntry(e.client_ref)}>Coba lagi</Button>
                  <Button size="sm" variant="ghost" data-testid={`queue-discard-${e.client_ref}`} onClick={() => removeFromQueue(e.client_ref)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              )}
            </div>
          ))}
          {pending > 0 && (
            <Button className="w-full" disabled={!online} onClick={sync} data-testid="offline-queue-sync-button">
              <RefreshCw className="h-4 w-4 mr-2" /> Sinkronkan sekarang
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
