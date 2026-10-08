import { CheckCircle2, CloudOff } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { rupiah } from "@/lib/format";

export function ReceiptDialog({ receipt, onClose }) {
  const queued = receipt?.queued;
  return (
    <Dialog open={!!receipt} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm bg-background text-center" data-testid="receipt-dialog">
        <DialogHeader className="items-center">
          {queued ? <CloudOff className="h-12 w-12 text-amber-500" /> : <CheckCircle2 className="h-12 w-12 text-emerald-600 animate-in zoom-in duration-300" />}
          <DialogTitle className="font-heading text-xl mt-2">{queued ? "Disimpan offline" : "Transaksi berhasil"}</DialogTitle>
          <DialogDescription>{queued ? "Akan dikirim otomatis saat online." : <span className="font-mono text-xs" data-testid="receipt-transaction-id">#{receipt?.transaction_id?.slice(0, 8)}</span>}</DialogDescription>
        </DialogHeader>
        {receipt && (
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span>Total</span><span className="font-mono font-bold">{rupiah(receipt.total)}</span></div>
            <div className="flex justify-between"><span>Dibayar</span><span className="font-mono">{rupiah(receipt.paid)}</span></div>
            <div className="flex justify-between items-baseline pt-2 border-t"><span className="font-semibold">Kembalian</span><span className="font-mono text-2xl font-extrabold text-emerald-700" data-testid="receipt-change">{rupiah(receipt.change)}</span></div>
          </div>
        )}
        <Button onClick={onClose} className="w-full h-12 mt-2" data-testid="receipt-close-button">Transaksi baru</Button>
      </DialogContent>
    </Dialog>
  );
}
