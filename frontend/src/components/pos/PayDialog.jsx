import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { rupiah, parseRupiah } from "@/lib/format";

const QUICK = [5000, 10000, 20000, 50000, 100000];

export function PayDialog({ open, onOpenChange, total, onSubmit, error }) {
  const [paid, setPaid] = useState(0);
  const [busy, setBusy] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (open) {
      setPaid(0);
      ref.current = crypto.randomUUID();
    }
  }, [open]);

  const change = paid - total;
  const submit = async () => {
    if (busy || paid < total) return;
    setBusy(true);
    await onSubmit(paid, ref.current);
    setBusy(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="sm:max-w-md bg-background" data-testid="pay-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Pembayaran Tunai</DialogTitle>
          <DialogDescription>Total belanja <span className="font-mono font-bold text-foreground" data-testid="pay-dialog-total">{rupiah(total)}</span></DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Uang diterima</label>
            <Input autoFocus inputMode="numeric" value={paid ? rupiah(paid) : ""} placeholder="Rp 0"
              onChange={(e) => setPaid(parseRupiah(e.target.value))} onKeyDown={(e) => e.key === "Enter" && submit()}
              className="h-14 mt-1 font-mono text-2xl font-bold" data-testid="pay-dialog-cash-input" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" onClick={() => setPaid(total)} data-testid="quick-cash-button-exact" className="h-11 font-semibold hover:bg-slate-900 hover:text-white">Uang pas</Button>
            {QUICK.map((q) => (
              <Button key={q} variant="outline" onClick={() => setPaid(q)} data-testid={`quick-cash-button-${q}`} className="h-11 font-mono text-sm hover:bg-slate-900 hover:text-white">{rupiah(q)}</Button>
            ))}
          </div>
          <div className={`rounded-lg p-4 flex items-baseline justify-between ${change >= 0 ? "bg-emerald-50" : "bg-rose-50"}`}>
            <span className="text-xs font-semibold uppercase tracking-wider">{change >= 0 ? "Kembalian" : "Kurang"}</span>
            <span className={`font-mono text-2xl font-extrabold ${change >= 0 ? "text-emerald-700" : "text-rose-600"}`} data-testid="change-amount-display">{rupiah(Math.abs(change))}</span>
          </div>
          {error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700" data-testid="pay-dialog-error">{error}</div>}
          <Button onClick={submit} disabled={busy || paid < total} data-testid="pay-submit-button"
            className="h-14 w-full bg-emerald-600 hover:bg-emerald-700 text-white text-base font-bold">
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : "Selesaikan transaksi"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
