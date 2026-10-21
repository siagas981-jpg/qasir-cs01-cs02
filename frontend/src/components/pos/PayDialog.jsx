import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { rupiah, parseRupiah } from "@/lib/format";
import { usePermission } from "@/hooks/usePermission";
import { useAuth } from "@/context/AuthContext";

const QUICK = [5000, 10000, 20000, 50000, 100000];
const ALASAN_DISKON = [
  "Pelanggan Langganan",
  "Barang Cacat / Rusak",
  "Promo Owner",
  "Salah Input Harga",
  "Lainnya"
];

export function PayDialog({ open, onOpenChange, total, onSubmit, error, activeOutletId: propOutletId, canDiscount: propCanDiscount, canCheckout: propCanCheckout }) {
  const [paid, setPaid] = useState(0);
  const [busy, setBusy] = useState(false);
  const [discount, setDiscount] = useState(0);
  const [discountReason, setDiscountReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const ref = useRef(null);

  const { activeOutletId: authOutletId } = useAuth();
  const outletId = propOutletId || authOutletId;

  // === FIX PER OUTLET ===
  const permDiscount = usePermission("cashier_discount", outletId);
  const permCheckout = usePermission("cashier_checkout", outletId);
  const canDiscount = propCanDiscount !== undefined ? propCanDiscount : permDiscount;
  const canCheckout = propCanCheckout !== undefined ? propCanCheckout : permCheckout;

  useEffect(() => {
    if (open) {
      setPaid(0);
      setDiscount(0);
      setDiscountReason("");
      setCustomReason("");
      ref.current = crypto.randomUUID();
    }
  }, [open]);

  const activeDiscount = canDiscount ? discount : 0;
  const finalTotal = Math.max(0, total - activeDiscount);
  const change = paid - finalTotal;
  const kurangBayar = paid > 0 && paid < finalTotal;

  // Validasi alasan wajib
  const finalReason = discountReason === "Lainnya" ? customReason : discountReason;
  const needReason = activeDiscount > 0;
  const reasonValid = !needReason || (finalReason && finalReason.trim().length >= 3);

  const submit = async () => {
    if (busy || !canCheckout || paid < finalTotal) return;
    if (needReason && !reasonValid) return;
    setBusy(true);
    await onSubmit(paid, ref.current, activeDiscount, finalReason);
    setBusy(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="sm:max-w-md bg-background" data-testid="pay-dialog">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Pembayaran Tunai</DialogTitle>
          <DialogDescription>
            Total belanja <span className="font-mono font-bold text-foreground" data-testid="pay-dialog-total">{rupiah(total)}</span>
            {activeDiscount > 0 && (
              <span className="ml-2 text-rose-600">- Diskon {rupiah(activeDiscount)} = {rupiah(finalTotal)}</span>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* FITUR DISKON - KUNCI SENDIRI */}
          {canDiscount ? (
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-amber-600">Diskon (Diizinkan)</label>
              <Input 
                inputMode="numeric" 
                value={discount ? rupiah(discount) : ""} 
                placeholder="Rp 0 - Diskon" 
                onChange={(e) => setDiscount(parseRupiah(e.target.value))} 
                className="h-10 mt-1 font-mono text-sm font-bold border-amber-200" 
              />
              {/* === FITUR BARU: ALASAN DISKON WAJIB === */}
              {needReason && (
                <div className="rounded-lg border-2 border-amber-200 bg-amber-50 p-3 space-y-2">
                  <label className="text-xs font-bold text-amber-800">* Wajib Pilih Alasan Diskon (Rp {rupiah(activeDiscount).replace("Rp","").trim()})</label>
                  <select
                    value={discountReason}
                    onChange={(e) => setDiscountReason(e.target.value)}
                    className="w-full h-10 px-3 rounded-md border bg-white text-sm font-semibold"
                  >
                    <option value="">-- Pilih Alasan --</option>
                    {ALASAN_DISKON.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                  {discountReason === "Lainnya" && (
                    <Input
                      value={customReason}
                      onChange={(e) => setCustomReason(e.target.value)}
                      placeholder="Tulis alasan detail min 3 huruf..."
                      className="h-10 bg-white"
                    />
                  )}
                  {!reasonValid && (
                    <p className="text-[11px] text-rose-600 font-bold">⚠️ Alasan wajib diisi kalau kasih diskon!</p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-md bg-slate-100 border border-slate-200 p-2.5 text-[11px] text-slate-600 text-center">
              🔒 Diskon dinonaktifkan untuk role ini (atur di Menu Akses → cashier_discount)
            </div>
          )}

          <div>
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Uang diterima</label>
            <Input autoFocus inputMode="numeric" value={paid ? rupiah(paid) : ""} placeholder="Rp 0"
              onChange={(e) => setPaid(parseRupiah(e.target.value))} onKeyDown={(e) => e.key === "Enter" && submit()}
              className="h-14 mt-1 font-mono text-2xl font-bold" data-testid="pay-dialog-cash-input" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" onClick={() => setPaid(finalTotal)} data-testid="quick-cash-button-exact" className="h-11 font-semibold hover:bg-slate-900 hover:text-white">Uang pas</Button>
            {QUICK.map((q) => (
              <Button key={q} variant="outline" onClick={() => setPaid(q)} data-testid={`quick-cash-button-${q}`} className="h-11 font-mono text-sm hover:bg-slate-900 hover:text-white">{rupiah(q)}</Button>
            ))}
          </div>
          <div className={`rounded-lg p-4 flex items-baseline justify-between ${change >= 0 ? "bg-emerald-50" : "bg-rose-50"}`}>
            <span className="text-xs font-semibold uppercase tracking-wider">{change >= 0 ? "Kembalian" : "Uang bayar kurang dari total"}</span>
            <span className={`font-mono text-2xl font-extrabold ${change >= 0 ? "text-emerald-700" : "text-rose-600"}`} data-testid="change-amount-display">{rupiah(Math.abs(change))}</span>
          </div>
          {kurangBayar && error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700" data-testid="pay-dialog-error">{error}</div>}
          {kurangBayar && !error && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">Uang bayar kurang dari total. Kurang {rupiah(finalTotal - paid)}</div>}
          
          <Button onClick={submit} disabled={busy || !canCheckout || paid < finalTotal || (needReason && !reasonValid)} data-testid="pay-submit-button"
            className={`h-14 w-full text-base font-bold text-white ${!canCheckout ? "bg-slate-400" : kurangBayar ? "bg-rose-400" : (needReason && !reasonValid) ? "bg-amber-400" : "bg-emerald-600 hover:bg-emerald-700"}`}>
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : !canCheckout ? "Akses Bayar Dinonaktifkan" : kurangBayar ? "Uang Bayar Kurang Dari Total" : (needReason && !reasonValid) ? "Isi Alasan Diskon Dulu" : `Bayar Rp ${rupiah(finalTotal).replace("Rp","").trim()}`}
          </Button>
          {!canCheckout && (
            <p className="text-[11px] text-center text-slate-500">
              🔒 Akses bayar hanya untuk Owner (atur di Menu Akses → cashier_checkout)
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
