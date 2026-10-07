import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { rupiah, dateTime } from "@/lib/format";

async function fetchTx(outletId) {
  let q = supabase.from("transactions").select("*, outlets(name), transaction_items(*)").order("created_at", { ascending: false }).limit(100);
  if (outletId !== "all") q = q.eq("outlet_id", outletId);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

function TxRow({ tx }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b last:border-b-0" data-testid={`transaction-row-${tx.id}`}>
      <button onClick={() => setOpen(!open)} className="w-full grid grid-cols-12 items-center gap-2 px-4 py-3 text-left hover:bg-slate-50 transition-colors" data-testid={`transaction-toggle-${tx.id}`}>
        <span className="col-span-5 sm:col-span-3 text-sm">{dateTime(tx.created_at)}</span>
        <span className="hidden sm:block col-span-3 text-sm text-slate-600 truncate">{tx.outlets?.name}</span>
        <span className="hidden sm:block col-span-2 text-xs font-mono text-slate-400">#{tx.id.slice(0, 8)}</span>
        <span className="col-span-6 sm:col-span-3 text-right font-mono font-bold" data-testid={`transaction-total-${tx.id}`}>{rupiah(tx.total)}</span>
        <ChevronDown className={`col-span-1 h-4 w-4 justify-self-end transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 text-sm animate-in fade-in slide-in-from-top-1 duration-200" data-testid={`transaction-items-${tx.id}`}>
          {tx.transaction_items.map((i) => (
            <div key={i.id} className="flex justify-between py-1"><span>{i.qty} × {i.product_name} <span className="text-slate-400 font-mono">@ {rupiah(i.price_each)}</span></span><span className="font-mono">{rupiah(i.qty * i.price_each)}</span></div>
          ))}
          <div className="flex justify-between pt-2 mt-2 border-t text-slate-600"><span>Dibayar {rupiah(tx.paid)}</span><span>Kembalian {rupiah(tx.change)}</span></div>
        </div>
      )}
    </div>
  );
}

export default function Transactions() {
  const { isOwner, outlets, activeOutletId } = useAuth();
  const [filter, setFilter] = useState(isOwner ? "all" : activeOutletId);
  const { data = [], isLoading, error } = useQuery({ queryKey: ["transactions", filter], queryFn: () => fetchTx(filter), enabled: !!filter, staleTime: 5_000 });
  const today = new Date().toDateString();
  const todays = data.filter((t) => new Date(t.created_at).toDateString() === today);

  return (
    <div className="p-4 md:p-8 max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Riwayat</p>
          <h1 className="font-heading text-3xl sm:text-4xl font-extrabold tracking-tight">Transaksi</h1>
        </div>
        {isOwner && (
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[220px] bg-white" data-testid="transactions-outlet-filter"><SelectValue /></SelectTrigger>
            <SelectContent className="backdrop-blur-xl bg-background/95">
              <SelectItem value="all">Semua outlet</SelectItem>
              {outlets.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl border bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Penjualan hari ini</p><p className="font-mono text-2xl font-extrabold text-emerald-700 mt-1" data-testid="transactions-today-total">{rupiah(todays.reduce((s, t) => s + t.total, 0))}</p></div>
        <div className="rounded-xl border bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Transaksi hari ini</p><p className="font-mono text-2xl font-extrabold mt-1" data-testid="transactions-today-count">{todays.length}</p></div>
      </div>
      <div className="rounded-xl border bg-white" data-testid="transactions-list">
        {isLoading && <p className="p-4 text-sm text-muted-foreground">Memuat…</p>}
        {error && <p className="p-4 text-sm text-rose-600">{error.message}</p>}
        {!isLoading && data.length === 0 && <p className="p-4 text-sm text-muted-foreground" data-testid="transactions-empty">Belum ada transaksi.</p>}
        {data.map((t) => <TxRow key={t.id} tx={t} />)}
      </div>
    </div>
  );
}
