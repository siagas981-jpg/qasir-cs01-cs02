import { useCallback, useEffect, useState } from "react";

// Draft cart lives locally only (per user + outlet). Server is source of truth after checkout.
export function useCart(userId, outletId) {
  const key = userId && outletId ? `qasir.cart.${userId}.${outletId}` : null;
  const [items, setItems] = useState([]);

  useEffect(() => {
    if (!key) return setItems([]);
    try { setItems(JSON.parse(localStorage.getItem(key) || "[]")); } catch { setItems([]); }
  }, [key]);

  const update = useCallback((fn) => {
    setItems((prev) => {
      const next = fn(prev).filter((i) => i.qty > 0);
      if (key) localStorage.setItem(key, JSON.stringify(next));
      return next;
    });
  }, [key]);

  const add = (p) => update((prev) => {
    const found = prev.find((i) => i.product_id === p.id);
    if (found) return prev.map((i) => (i.product_id === p.id ? { ...i, qty: Math.min(i.qty + 1, p.stock) } : i));
    return [...prev, { product_id: p.id, name: p.name, price: p.price, qty: 1 }];
  });
  const setQty = (id, qty, max) => update((prev) => prev.map((i) => (i.product_id === id ? { ...i, qty: Math.max(0, Math.min(qty, max ?? qty)) } : i)));
  const remove = (id) => update((prev) => prev.filter((i) => i.product_id !== id));
  const clear = () => update(() => []);
  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  const count = items.reduce((s, i) => s + i.qty, 0);

  return { items, add, setQty, remove, clear, total, count };
}
