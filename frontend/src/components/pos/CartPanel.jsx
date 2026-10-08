import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { rupiah } from "@/lib/format";

function CartLine({ item, max, setQty, remove }) {
  const id = item.product_id;
  return (
    <div className="py-3 border-b last:border-b-0 animate-in fade-in slide-in-from-right-2 duration-200" data-testid={`cart-item-${id}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate">{item.name}</p>
          <p className="text-xs font-mono text-slate-500">{rupiah(item.price)}</p>
        </div>
        <button onClick={() => remove(id)} data-testid={`cart-item-remove-${id}`} className="text-slate-400 hover:text-rose-600 transition-colors p-1" aria-label="Hapus"><X className="h-4 w-4" /></button>
      </div>
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-1">
          <button onClick={() => setQty(id, item.qty - 1, max)} data-testid={`cart-qty-decrease-${id}`} className="grid h-11 w-11 place-items-center rounded-md border hover:bg-slate-900 hover:text-white transition-colors active:scale-95"><Minus className="h-4 w-4" /></button>
          <span className="w-10 text-center font-mono font-bold" data-testid={`cart-qty-${id}`}>{item.qty}</span>
          <button onClick={() => setQty(id, item.qty + 1, max)} disabled={item.qty >= max} data-testid={`cart-qty-increase-${id}`} className="grid h-11 w-11 place-items-center rounded-md border hover:bg-slate-900 hover:text-white transition-colors active:scale-95 disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-current"><Plus className="h-4 w-4" /></button>
        </div>
        <span className="font-mono font-bold" data-testid={`cart-line-total-${id}`}>{rupiah(item.price * item.qty)}</span>
      </div>
    </div>
  );
}

export function CartPanel({ cart, stockOf, onCheckout, disabled }) {
  return (
    <div className="flex flex-col h-full" data-testid="cart-panel">
      <div className="flex items-center justify-between pb-3 border-b">
        <h2 className="font-heading text-lg font-bold flex items-center gap-2"><ShoppingBag className="h-5 w-5" /> Keranjang</h2>
        {cart.items.length > 0 && (
          <button onClick={cart.clear} data-testid="cart-clear-button" className="text-xs font-semibold text-slate-500 hover:text-rose-600 inline-flex items-center gap-1"><Trash2 className="h-3.5 w-3.5" /> Kosongkan</button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto min-h-[120px]">
        {cart.items.length === 0 ? (
          <div className="h-full grid place-items-center text-center py-10" data-testid="cart-empty">
            <p className="text-sm text-muted-foreground">Ketuk produk untuk menambah ke keranjang.</p>
          </div>
        ) : cart.items.map((i) => (
          <CartLine key={i.product_id} item={i} max={stockOf(i.product_id)} setQty={cart.setQty} remove={cart.remove} />
        ))}
      </div>
      <div className="pt-4 border-t space-y-3">
        <div className="flex items-baseline justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Total · {cart.count} item</span>
          <span className="font-mono text-2xl font-extrabold text-emerald-700" data-testid="cart-total">{rupiah(cart.total)}</span>
        </div>
        <Button onClick={onCheckout} disabled={disabled || cart.items.length === 0} data-testid="cart-checkout-button"
          className="h-14 w-full bg-emerald-600 hover:bg-emerald-700 text-white text-base font-bold active:scale-[0.98] transition-transform">
          Bayar
        </Button>
      </div>
    </div>
  );
}
