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
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useShift } from "@/hooks/useShift";
import ShiftStartModal from "@/components/ShiftStartModal";
import Laci5InfoKasir from "@/components/laci/Laci5InfoKasir";
import { usePermission } from "@/hooks/usePermission"; // <-- KUNCI LACI

export const fetchProducts = async (outletId) => {
  const { data, error } = await supabase.from("products").select("*").eq("outlet_id", outletId).order("name");
  if (error) throw error;
  return data;
};

function useMasters() {
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => { const { data } = await supabase.from("categories").select("*").order("name"); return data||[] }
  });
  const { data: brands = [] } = useQuery({
    queryKey: ["brands"],
    queryFn: async () => { const { data } = await supabase.from("brands").select("*").order("name"); return data||[] }
  });
  const { data: collections = [] } = useQuery({
    queryKey: ["collections"],
    queryFn: async () => { const { data } = await supabase.from("collections").select("*").order("name"); return data||[] }
  });
  return { categories, brands, collections };
}

function useLaciBank(outletId) {
  return useQuery({
    queryKey: ["laci-bank", outletId],
    enabled: !!outletId,
    queryFn: async () => {
      try {
        const { data, error } = await supabase.from("laci").select("*").eq("outlet_id", outletId).ilike("kode", "LACI_5_%").order("kode");
        if (error) throw error;
        return data || [];
      } catch (e) {
        console.error("useLaciBank error", e);
        return [];
      }
    }
  });
}

export default function POS() {
  const { user, activeOutletId, activeOutlet } = useAuth();
  const qc = useQueryClient();
  const key = ["products", activeOutletId];
  const { data: products = [], isLoading } = useQuery({ queryKey: key, queryFn: () => fetchProducts(activeOutletId), enabled:!!activeOutletId, staleTime: 10_000 });
  const cart = useCart(user?.id, activeOutletId);
  const [search, setSearch] = useState("");
  const [payOpen, setPayOpen] = useState(false);
  const [payError, setPayError] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [filterCat, setFilterCat] = useState("all");
  const [filterBrand, setFilterBrand] = useState("all");
  const [filterColl, setFilterColl] = useState("all");
  const { categories, brands, collections } = useMasters();
  const shift = useShift(activeOutletId);
  const { data: laciBank = [] } = useLaciBank(activeOutletId);

  // === KUNCI LACI OPSI A ===
  const canViewLaci = usePermission("pembukuan_laci");
  const canBankTx = usePermission("pembukuan_bank");

  const formatRupiah = (angka) => {
    if (angka === "" || angka === null || angka === undefined) return "";
    const str = String(angka);
    const numberString = str.replace(/\D/g, "");
    if (!numberString) return "";
    return parseInt(numberString, 10).toLocaleString("id-ID");
  };
  const unformatRupiah = (formatted) => {
    if (!formatted) return 0;
    return Number(String(formatted).replace(/\./g, "").replace(/[^0-9]/g, "")) || 0;
  };

  const [bankLaciId, setBankLaciId] = useState("");
  const [bankTipe, setBankTipe] = useState("masuk");
  const [bankJumlah, setBankJumlah] = useState("");
  const [bankKet, setBankKet] = useState("");
  const [bankLoading, setBankLoading] = useState(false);

  const inCart = Object.fromEntries(cart.items.map((i) => [i.product_id, i.qty]));
  const stockOf = (id) => products.find((p) => p.id === id)?.stock?? 0;
  const filteredProducts = products.filter(p=>{
    if(filterCat!=="all" && p.category_id!==filterCat) return false;
    if(filterBrand!=="all" && p.brand_id!==filterBrand) return false;
    if(filterColl!=="all" && p.collection_id!==filterColl) return false;
    return true;
  });
  const applyStock = () => qc.setQueryData(key, (old = []) => old.map((p) => ({...p, stock: p.stock - (inCart[p.id] || 0) })));

  const submit = async (paid, client_ref, discount = 0) => {
    setPayError("");
    const finalTotal = Math.max(0, cart.total - discount);
    const payload = { outlet_id: activeOutletId, items: cart.items, paid, client_ref, user_id: user.id, total: finalTotal, discount, original_total: cart.total, created_at: new Date().toISOString() };
    const res = navigator.onLine? await runCheckout(payload) : { ok: false, network: true };
    if (res.ok) {
      applyStock(); cart.clear(); setPayOpen(false); setReceipt(res.data);
      qc.invalidateQueries({ queryKey: ["products", activeOutletId] }); qc.invalidateQueries({ queryKey: ["transactions"] }); return;
    }
    if (res.network) {
      enqueue(payload); applyStock(); cart.clear(); setPayOpen(false);
      setReceipt({ queued: true, total: payload.total, paid, change: paid - payload.total }); return;
    }
    const detail = res.short?.map((s) => `${s.name}: diminta ${s.requested}, tersisa ${s.available}`).join(" · ");
    setPayError(detail? `${res.message}. ${detail}` : res.message); toast.error(res.message);
    qc.invalidateQueries({ queryKey: ["products", activeOutletId] });
  };

  const handleBankTx = async () => {
    if (!bankLaciId ||!bankJumlah) { toast.error("Pilih bank & isi jumlah"); return; }
    setBankLoading(true);
    try {
      const nowShift = shift?.currentShift || shift?.shiftName || "MALAM";
      const { error } = await supabase.from("bank_transactions").insert({
        outlet_id: activeOutletId,
        laci_id: bankLaciId,
        shift: nowShift,
        kasir_email: user?.email,
        tipe: bankTipe,
        jumlah: unformatRupiah(bankJumlah),
        keterangan: bankKet || `${bankTipe} ${laciBank.find(b=>b.id===bankLaciId)?.nama}`,
      });
      if (error) throw error;
      toast.success(`Transaksi ${bankTipe} ${laciBank.find(b=>b.id===bankLaciId)?.nama} Rp ${bankJumlah} berhasil!`);
      setBankJumlah(""); setBankKet(""); setBankLaciId("");
      qc.invalidateQueries({ queryKey: ["laci-bank"] });
      qc.invalidateQueries({ queryKey: ["laci"] });
      qc.invalidateQueries({ queryKey: ["laci-mutasi"] });
    } catch (e) {
      toast.error("Gagal: " + e.message);
    } finally { setBankLoading(false); }
  };

  if (!activeOutletId) return <div className="p-10 text-sm text-muted-foreground">Akun ini belum ditugaskan ke outlet. Hubungi owner.</div>;
  if (shift.loading) return <div className="p-10 text-sm text-muted-foreground">Loading shift...</div>;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 lg:h-[calc(100vh-4rem)]">
      <ShiftStartModal open={shift.needsInput} onSubmit={shift.startShift} loading={shift.loading} outletId={activeOutletId} />
      <section className="lg:col-span-7 xl:col-span-8 lg:overflow-y-auto p-4 md:p-6">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Kasir - Shift {shift?.currentShift || "-"}</p>
          <h1 className="font-heading text-2xl sm:text-3xl font-extrabold tracking-tight">{activeOutlet?.name}</h1>
          <p className="text-xs text-muted-foreground mt-1">Login: {user?.email}</p>
        </div>
        <div className="flex flex-wrap gap-2 mb-4">
          <Select value={filterCat} onValueChange={setFilterCat}><SelectTrigger className="w-[140px] h-9 bg-white"><SelectValue placeholder="Kategori" /></SelectTrigger><SelectContent><SelectItem value="all">Semua Kategori</SelectItem>{categories.map(c=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
          <Select value={filterBrand} onValueChange={setFilterBrand}><SelectTrigger className="w-[140px] h-9 bg-white"><SelectValue placeholder="Brand" /></SelectTrigger><SelectContent><SelectItem value="all">Semua Brand</SelectItem>{brands.map(c=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
          <Select value={filterColl} onValueChange={setFilterColl}><SelectTrigger className="w-[140px] h-9 bg-white"><SelectValue placeholder="Koleksi" /></SelectTrigger><SelectContent><SelectItem value="all">Semua Koleksi</SelectItem>{collections.map(c=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
          {(filterCat!=="all"||filterBrand!=="all"||filterColl!=="all") && (<button onClick={()=>{setFilterCat("all");setFilterBrand("all");setFilterColl("all")}} className="text-xs px-3 h-9 rounded-md border bg-white">Reset</button>)}
        </div>
        <ProductGrid products={filteredProducts} loading={isLoading} inCart={inCart} onAdd={cart.add} search={search} setSearch={setSearch} />
      </section>
      <aside className="lg:col-span-5 xl:col-span-4 bg-white border-t lg:border-t-0 lg:border-l p-4 md:p-6 lg:h-full lg:overflow-y-auto space-y-6">
        {/* TRANSAKSI BANK - HANYA OWNER */}
        {canBankTx ? (
          <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
            <h3 className="font-bold text-sm text-emerald-900">🏦 Transaksi Bank (Auto Saldo Laci 5)</h3>
            <div className="grid grid-cols-2 gap-2">
              <Select value={bankLaciId} onValueChange={setBankLaciId}>
                <SelectTrigger className="h-9 bg-white"><SelectValue placeholder="Pilih Bank" /></SelectTrigger>
                <SelectContent>{laciBank.map(b=><SelectItem key={b.id} value={b.id}>{b.nama} - Rp {Number(b.saldo||0).toLocaleString()}</SelectItem>)}</SelectContent>
              </Select>
              <Select value={bankTipe} onValueChange={setBankTipe}>
                <SelectTrigger className="h-9 bg-white"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="masuk">Masuk (+)</SelectItem><SelectItem value="keluar">Keluar (-)</SelectItem></SelectContent>
              </Select>
            </div>
            <input type="text" value={formatRupiah(bankJumlah)} onChange={e=>setBankJumlah(formatRupiah(e.target.value))} placeholder="Jumlah Rp (contoh 50000)" className="w-full h-9 px-3 rounded-md border bg-white text-sm" />
            <input type="text" value={bankKet} onChange={e=>setBankKet(e.target.value)} placeholder="Keterangan (opsional)" className="w-full h-9 px-3 rounded-md border bg-white text-sm" />
            <button onClick={handleBankTx} disabled={bankLoading} className="w-full h-10 rounded-md bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 disabled:opacity-50">
              {bankLoading? "Menyimpan..." : `Simpan ${bankTipe.toUpperCase()} - Shift ${shift?.currentShift||""}`}
            </button>
            <p className="text-[11px] text-emerald-800">Auto catat: {user?.email} | Shift {shift?.currentShift} | Saldo LACI_5 auto nambah/kurang</p>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-center text-slate-500">
            🔒 Transaksi Bank hanya untuk Owner (atur di Menu Akses → pembukuan_bank)
          </div>
        )}

        <CartPanel cart={cart} stockOf={stockOf} onCheckout={() => { setPayError(""); setPayOpen(true); }} />

        {/* LACI 5 - HANYA OWNER */}
        {canViewLaci ? <Laci5InfoKasir outletId={activeOutletId} /> : null}

      </aside>
      <PayDialog open={payOpen} onOpenChange={setPayOpen} total={cart.total} onSubmit={submit} error={payError} />
      <ReceiptDialog receipt={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
}
