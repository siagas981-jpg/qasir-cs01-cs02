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
import { usePermission } from "@/hooks/usePermission";

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

  const canViewLaci = usePermission("pembukuan_laci", activeOutletId);
const canBankTx = usePermission("pembukuan_bank", activeOutletId);
const canCheckout = usePermission("cashier_checkout", activeOutletId);
const canDiscount = usePermission("cashier_discount", activeOutletId);

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
  const stockOf = (id) => products.find((p) => p.id === id)?.stock ?? 0;
  const filteredProducts = products.filter(p=>{
    if(filterCat!=="all" && p.category_id!==filterCat) return false;
    if(filterBrand!=="all" && p.brand_id!==filterBrand) return false;
    if(filterColl!=="all" && p.collection_id!==filterColl) return false;
    return true;
  });
  const applyStock = () => qc.setQueryData(key, (old = []) => old.map((p) => ({...p, stock: p.stock - (inCart[p.id] || 0) })));

  const submit = async (paid, client_ref, discount = 0, discountReason = "") => {
    setPayError("");
    const d = Number(discount) || 0;
    // === TAMBAHAN VALIDASI ALASAN DISKON ===
    if (d > 0 && (!discountReason || discountReason.trim().length < 3)) {
      setPayError("Wajib isi alasan diskon min 3 huruf!");
      toast.error("Wajib isi alasan diskon!");
      return;
    }
    const finalTotal = Math.max(0, cart.total - d);
    if (paid < finalTotal) {
      setPayError("Uang bayar kurang dari total. Kurang Rp " + (finalTotal - paid).toLocaleString("id-ID"));
      return;
    }
    const payload = {
      outlet_id: activeOutletId,
      items: cart.items,
      paid: paid,
      discount: d,
      discount_reason: discountReason, // BARU
      discount_by: user?.email, // BARU
      client_ref: client_ref,
      user_id: user.id,
      total: finalTotal,
      original_total: cart.total,
      created_at: new Date().toISOString()
    };
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
      setReceipt({ queued: true, total: payload.total, paid: paid, change: paid - payload.total });
      return;
    }
    const detail = res.short ? res.short.map(function(s){ return s.name + ": diminta " + s.requested + ", tersisa " + s.available; }).join(" - ") : "";
    setPayError(detail ? res.message + ". " + detail : res.message);
    toast.error(res.message);
    qc.invalidateQueries({ queryKey: ["products", activeOutletId] });
  };

    const handleBankTx = async () => {
    if (!bankLaciId || !bankJumlah) { toast.error("Pilih bank & isi jumlah"); return; }
    setBankLoading(true);
    try {
      const nowShift = shift?.currentShift || shift?.shiftName || "MALAM";
      const jumlahNum = unformatRupiah(bankJumlah);
      const selectedLaci = laciBank.find((b) => b.id === bankLaciId);
      if (!selectedLaci) { toast.error("Bank tidak ditemukan"); return; }

      // === KHUSUS 5 BANK AUTO CASH BANK BOLAK-BALIK ===
      const KHUSUS_AUTO_CASHBANK = ['BRI', 'BNI', 'MANDIRI', 'DANA', 'BUKU AGEN'];
      const namaUpper = (selectedLaci.nama || "").toUpperCase();
      const isKhususBank = KHUSUS_AUTO_CASHBANK.some(k => namaUpper.includes(k));
      
      const cashBankLaci = laciBank.find(l => {
        const n = (l.nama || "").toUpperCase();
        const k = (l.kode || "").toUpperCase();
        return k === "LACI_5_CASHBANK" || k.includes("CASHBANK") || (n.includes("CASH") && n.includes("BANK"));
      });

      // Validasi saldo cashbank kalau MASUK
      if (bankTipe === "masuk" && isKhususBank && cashBankLaci && (cashBankLaci.saldo || 0) < jumlahNum) {
        toast.error(`Saldo CASH BANK tidak cukup! Sisa Rp ${Number(cashBankLaci.saldo).toLocaleString()}`);
        setBankLoading(false);
        return;
      }

      console.log("BANK TX:", selectedLaci.nama, "JUMLAH:", jumlahNum, "TIPE:", bankTipe, "IS KHUSUS?", isKhususBank);

      const { error } = await supabase.from("bank_transactions").insert({
        outlet_id: activeOutletId,
        laci_id: bankLaciId,
        shift: nowShift,
        kasir_email: user?.email,
        tipe: bankTipe,
        jumlah: jumlahNum,
        keterangan: bankKet || (bankTipe + " " + (selectedLaci?.nama || "")),
      });
      if (error) throw error;

      // === LOGIC AUTO BOLAK-BALIK ===
      if (isKhususBank && cashBankLaci && cashBankLaci.id !== selectedLaci.id) {
        if (bankTipe === "keluar") {
          // KELUAR: BRI berkurang, CASH BANK nambah
          const { error: e1 } = await supabase.from("laci").update({ saldo: (selectedLaci.saldo || 0) - jumlahNum }).eq("id", selectedLaci.id);
          if (e1) throw e1;
          const { error: e2 } = await supabase.from("laci").update({ saldo: (cashBankLaci.saldo || 0) + jumlahNum }).eq("id", cashBankLaci.id);
          if (e2) throw e2;
          toast.success(`AUTO: ${selectedLaci.nama} KELUAR -> CASH BANK +Rp ${bankJumlah}`);
        } else {
          // MASUK (KEBALIKAN): BRI nambah, CASH BANK berkurang
          const { error: e1 } = await supabase.from("laci").update({ saldo: (selectedLaci.saldo || 0) + jumlahNum }).eq("id", selectedLaci.id);
          if (e1) throw e1;
          const { error: e2 } = await supabase.from("laci").update({ saldo: (cashBankLaci.saldo || 0) - jumlahNum }).eq("id", cashBankLaci.id);
          if (e2) throw e2;
          toast.success(`AUTO: CASH BANK -> ${selectedLaci.nama} +Rp ${bankJumlah}`);
        }
      } else {
        // Bank biasa
        const newSaldo = bankTipe === "keluar" ? (selectedLaci.saldo||0) - jumlahNum : (selectedLaci.saldo||0) + jumlahNum;
        const { error: e1 } = await supabase.from("laci").update({ saldo: newSaldo }).eq("id", selectedLaci.id);
        if (e1) throw e1;
        toast.success(`Transaksi ${bankTipe} ${selectedLaci.nama} Rp ${bankJumlah} berhasil!`);
      }

      setBankJumlah(""); setBankKet(""); setBankLaciId("");
      qc.invalidateQueries({ queryKey: ["laci-bank"] });
      qc.invalidateQueries({ queryKey: ["laci"] });
      qc.invalidateQueries({ queryKey: ["laci-mutasi"] });
      qc.invalidateQueries({ queryKey: ["laci-all"] });
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
        {canBankTx ? (
          <div className="rounded-xl border-2 border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
            <h3 className="font-bold text-sm text-emerald-900">Transaksi Bank (Auto Saldo Laci 5)</h3>
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
              {bankLoading? "Menyimpan..." : "Simpan " + bankTipe.toUpperCase() + " - Shift " + (shift?.currentShift||"")}
            </button>
            <p className="text-[11px] text-emerald-800">Auto catat: {user?.email} | Shift {shift?.currentShift} | Saldo LACI_5 auto nambah/kurang</p>
          </div>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-center text-slate-500">
            Transaksi Bank hanya untuk Owner (atur di Menu Akses - pembukuan_bank)
          </div>
        )}
        <CartPanel cart={cart} stockOf={stockOf} canCheckout={canCheckout} canDiscount={canDiscount} onCheckout={() => { setPayError(""); setPayOpen(true); }} />
        {canViewLaci ? <Laci5InfoKasir outletId={activeOutletId} /> : null}
      </aside>
      <PayDialog open={payOpen} onOpenChange={setPayOpen} total={cart.total} onSubmit={submit} error={payError} canCheckout={canCheckout} canDiscount={canDiscount} />
      <ReceiptDialog receipt={receipt} onClose={() => setReceipt(null)} />
    </div>
  );
}
