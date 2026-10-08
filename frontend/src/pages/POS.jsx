import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useCart } from "@/lib/useCart";
import { runCheckout } from "@/lib/checkout";
import { enqueue } from "@/lib/offlineQueue";
import { ProductGrid } from "@/components/pos/ProductGrid";
import { CartPanel } from "@/components/pos/CartPanel";
import { PayDialog } from "@/components/pos/PayDialog";
import { ReceiptDialog } from "@/components/pos/ReceiptDialog";

export const fetchProducts = async (outletId) => {
  const { data, error } = await supabase.from("products").select("*").eq("outlet_id", outletId).order("name");
  if (error) throw error;
  return data;
};

export default function POS() {
  const { user, activeOutletId, activeOutlet } = useAuth();
  const qc = useQueryClient();
  const key = ["products", activeOutletId];
  const { data: products = [], isLoading } = useQuery({ queryKey: key, queryFn: () => fetchProducts(activeOutletId), enabled: !!activeOutletId, staleTime: 10_000 });
  const cart = useCart(user?.id, activeOutletId);
  const [search, setSearch] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [payError, setPayError] = useState("");
  const [receipt, setReceipt] = useState(null);

  const inCart = Object.fromEntries(cart.items.map((i) => [i.product_id, i.qty]));
  const stockOf = (id) => products.find((p) => p.id === id)?.stock ?? 0;

  const applyStock = () => qc.setQueryData(key, (old = []) => old.map((p) => ({ ...p, stock: p.stock - (inCart[p.id] || 0) })));

  const submit = async (paid, client_ref) => {
    setPayError("");
    const payload = { outlet_id: activeOutletId, items: cart.items, paid, client_ref, user_id: user.id, total: cart.total, created_at: new Date().toISOString() };
    const res = navigator.onLine ? await runCheckout(payload) : { ok: false, network: true };
    if (res.ok) {
      applyStock();
      cart.clear();
      setPayOpen(false);
      setReceipt(res.data);
      qc.invalidateQueries({ queryKey: ["products", activeOutletId] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      return;
    }
    if (res.network) {
      enqueue(payload);
      applyStock();
      cart.clear();
      setPayOpen(false);
      setReceipt({ queued: true, total: payload.total, paid, change: paid - payload.total });
      return;
    }
    const detail = res.short?.map((s) => `${s.name}: diminta ${s.requested}, tersisa ${s.available}`).join(" · ");
    setPayError(detail ? `${res.message}. ${detail}` : res.message);
    toast.error(res.message);
    qc.invalidateQueries({ queryKey: ["products", activeOutletId] });
  };

  if (!activeOutletId) {
    return <div className="p-10 text-sm text-muted-foreground" data-testid="pos-no-outlet">Akun ini belum ditugaskan ke outlet. Hubungi owner.</div>;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 lg:h-[calc(100vh-4rem)]">
      <section className="lg:col-span-7 xl:col-span-8 lg:overflow-y-auto p-4 md:p-6">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Kasir</p>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight" data-testid="pos-outlet-name">{activeOutlet?.name}</h1>
        </div>
        <ProductGrid products={products} loading={isLoading} inCart={inCart} onAdd={cart.add} search={search} setSearch={setSearch} />
      </section>
      <aside className="lg:col-span-5 xl:col-span-4 bg-white border-t lg:border-t-0 lg:border-l p-4 md:p-6 lg:h-full">
        <CartPanel cart={cart} stockOf={stockOf} onCheckout={() => { setPayError(""); setPayOpen(true); }} />
      </aside>
      <PayDialog open={payOpen} onOpenChange={setPayOpen} total={cart.total} onSubmit={submit} error={payError} />
      <ReceiptDialog receipt={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
}
