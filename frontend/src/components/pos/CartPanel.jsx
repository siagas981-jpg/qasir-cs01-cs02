import SaldoShiftCard from "../saldo/SaldoShiftCard.jsx"
import Laci5InfoKasir from "../laci/Laci5InfoKasir.jsx"
import { Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { rupiah } from "@/lib/format";

function CartLine({ item, max, setQty, remove }) {
  const id = item.product_id;
  return (
    <div className="py-1.5 border-b last:border-b-0" data-testid={`cart-item-${id}`}>
      <div className="flex items-start justify-between gap-1 leading-none">
        <div className="min-w-0">
          <p className="font-bold text-[11px] truncate leading-tight">{item.name}</p>
          <p className="text-[9px] font-mono text-slate-500">{rupiah(item.price)} x {item.qty}</p>
        </div>
        <button onClick={() => remove(id)} className="text-slate-400 hover:text-rose-600 p-0.5"><X className="h-3 w-3" /></button>
      </div>
      <div className="flex items-center justify-between mt-1">
        <div className="flex items-center gap-0.5">
          <button onClick={() => setQty(id, item.qty - 1, max)} className="grid h-6 w-6 place-items-center rounded border text-[10px] hover:bg-black hover:text-white"><Minus className="h-3 w-3" /></button>
          <span className="w-6 text-center font-mono font-bold text-[11px]">{item.qty}</span>
          <button onClick={() => setQty(id, item.qty + 1, max)} disabled={item.qty >= max} className="grid h-6 w-6 place-items-center rounded border text-[10px] hover:bg-black hover:text-white disabled:opacity-30"><Plus className="h-3 w-3" /></button>
        </div>
        <span className="font-mono font-bold text-[11px]">{rupiah(item.price * item.qty)}</span>
      </div>
    </div>
  );
}

export function CartPanel({ cart, stockOf, onCheckout, disabled }) {
  return (
    <div className="flex flex-col h-full gap-1" data-testid="cart-panel">
      {/* HEADER MINI */}
      <div className="flex items-center justify-between pb-1 border-b leading-none">
        <h2 className="font-bold text-[11px] flex items-center gap-1"><ShoppingBag className="h-3 w-3" /> Keranjang ({cart.count})</h2>
        {cart.items.length > 0 && (
          <button onClick={cart.clear} className="text-[9px] font-bold text-slate-500 hover:text-rose-600 inline-flex items-center gap-0.5"><Trash2 className="h-3 w-3" /> Kosongkan</button>
        )}
      </div>
      
      <SaldoShiftCard />
      <Laci5InfoKasir />

      {/* LIST - INI KUNCI BIAR MUAT */}
      <div className="flex-1 overflow-y-auto min-h-[60px] max-h-[22vh]">
      {cart.items.length === 0? (
          <div className="h-full grid place-items-center text-center py-4">
            <p className="text-[10px] text-slate-400">Ketuk produk untuk menambah.</p>
          </div>
        ) : cart.items.map((i) => (
          <CartLine key={i.product_id} item={i} max={stockOf(i.product_id)} setQty={cart.setQty} remove={cart.remove} />
        ))}
      </div>

      {/* TOTAL + BAYAR MINI */}
      <div className="pt-2 border-t space-y-1.5 mt-auto">
        <div className="flex items-center justify-between leading-none">
          <span className="text-[9px] font-bold uppercase text-slate-400">Total {cart.count} item</span>
          <span className="font-mono text-[14px] font-black text-emerald-700">{rupiah(cart.total)}</span>
        </div>
        <Button onClick={onCheckout} disabled={disabled || cart.items.length === 0}
          className="h-8 w-full bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-bold rounded-full">
          Bayar
        </Button>
      </div>
    </div>
  );
}
