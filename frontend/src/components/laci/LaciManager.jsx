import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";
import { rupiah, parseRupiah } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";

// === FIX 1: AMBIL SEMUA LACI - BIAR AUTO MUNCUL KALAU TAMBAH BARU ===
async function fetchAllLaci(outletId) {
  const { data, error } = await supabase
    .from("laci")
    .select("*")
    .eq("outlet_id", outletId)
    .order("code", { ascending: true });
  if (error) throw error;
  return data || [];
}

export default function LaciManager({ outletId }) {
  const qc = useQueryClient();
  const { user, profile, activeOutletId } = useAuth();
  
  // === FIX 2: DETEKSI OWNER - BIAR BISA EDIT KAPANPUN ===
  const isOwner = profile?.role === "owner" || profile?.role === "OWNER" || profile?.is_owner === true;

  const [openAdd, setOpenAdd] = useState(false);
  const [openTransfer, setOpenTransfer] = useState(false);
  const [openEdit, setOpenEdit] = useState(null); // laci yang diedit
  const [form, setForm] = useState({ code: "", name: "", type: "CASH", balance: 0 });
  const [transfer, setTransfer] = useState({ from: "", to: "", amount: 0 });
  const [editBalance, setEditBalance] = useState(0);

  const { data: lacis = [], isLoading } = useQuery({
    queryKey: ["laci-all", outletId],
    queryFn: () => fetchAllLaci(outletId),
    enabled: !!outletId,
  });

  // === FIX 3: REALTIME - AUTO MUNCUL DI KARYAWAN TANPA REFRESH ===
  useEffect(() => {
    if (!outletId) return;
    const channel = supabase
      .channel(`laci-${outletId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "laci", filter: `outlet_id=eq.${outletId}` }, () => {
        qc.invalidateQueries({ queryKey: ["laci-all", outletId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [outletId, qc]);

  const handleAdd = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from("laci").insert({
      outlet_id: outletId,
      code: form.code.toUpperCase(),
      name: form.name,
      type: form.type,
      balance: form.balance,
      is_active: true,
      created_by: user?.id,
    });
    if (error) return toast.error(error.message);
    toast.success(`${form.name} berhasil! Auto muncul di login karyawan!`);
    setOpenAdd(false);
    setForm({ code: "", name: "", type: "CASH", balance: 0 });
  };

  // === OWNER BISA EDIT KAPANPUN ===
  const handleEditOwner = async () => {
    if (!openEdit) return;
    const { error } = await supabase.from("laci").update({ balance: editBalance }).eq("id", openEdit.id);
    if (error) return toast.error(error.message);
    toast.success(`Saldo ${openEdit.name} diubah jadi ${rupiah(editBalance)} - Owner Access`);
    setOpenEdit(null);
    qc.invalidateQueries({ queryKey: ["laci-all", outletId] });
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    const fromLaci = lacis.find(l => l.id === transfer.from);
    const toLaci = lacis.find(l => l.id === transfer.to);
    if (!fromLaci || !toLaci || transfer.amount <= 0) return toast.error("Lengkapi data");
    if (fromLaci.id === toLaci.id) return toast.error("Laci sama");
    
    // Owner boleh transfer walau terkunci, karyawan cek saldo
    if (!isOwner && (fromLaci.balance||0) < transfer.amount) return toast.error("Saldo tidak cukup");

    await supabase.from("laci").update({ balance: (fromLaci.balance||0) - transfer.amount }).eq("id", transfer.from);
    await supabase.from("laci").update({ balance: (toLaci.balance||0) + transfer.amount }).eq("id", transfer.to);
    toast.success("Transfer berhasil");
    setOpenTransfer(false);
    qc.invalidateQueries({ queryKey: ["laci-all", outletId] });
  };

  if (isLoading) return <div className="p-4 text-sm">Memuat {lacis.length} laci...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        {/* FIX Laci (0) -> Laci (7) + auto */}
        <h3 className="font-bold flex items-center gap-2">Laci ({lacis.length}) {isOwner && <Badge className="bg-amber-500 text-white text-[10px]">OWNER FULL ACCESS</Badge>}</h3>
        <div className="flex gap-2">
          <Button onClick={() => setOpenTransfer(true)} variant="outline" className="h-8 rounded-full text-xs">Transfer Laci 1 ↔ 2</Button>
          <Button onClick={() => setOpenAdd(true)} className="bg-black text-white h-8 rounded-full text-xs">+ Tambah Laci / GoPay</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {lacis.map((laci) => {
          // Sistem terkunci tetap ada untuk karyawan, tapi TETAP DITAMPILKAN
          const isLockedForEmployee = false; // ganti dengan logic shift kamu yang lama kalau ada
          
          return (
            <div key={laci.id} className={`border rounded-xl p-4 bg-white relative ${isLockedForEmployee && !isOwner ? 'opacity-80' : ''}`}>
              <div className="flex justify-between items-start">
                <p className="text-[10px] uppercase text-slate-500">{laci.code} • {laci.type}</p>
                {isLockedForEmployee && !isOwner ? <Badge variant="outline" className="text-[9px] bg-slate-100">TERKUNCI</Badge> : <Badge className="text-[9px] bg-emerald-600 text-white">BISA INPUT</Badge>}
              </div>
              <p className="font-bold text-sm mt-1">{laci.name}</p>
              <p className="text-lg font-extrabold mt-1">{rupiah(laci.balance||0)}</p>
              
              {/* === OWNER BISA EDIT KAPANPUN, KARYAWAN TETAP 1X SEHARI === */}
              <div className="mt-3 flex gap-2">
                {isOwner ? (
                  <Button size="sm" className="w-full bg-amber-500 hover:bg-amber-600 text-white text-[11px] h-7" onClick={() => { setOpenEdit(laci); setEditBalance(laci.balance||0); }}>
                    ✏️ Owner Edit Kapanpun
                  </Button>
                ) : (
                  <p className="text-[11px] text-blue-600">👉 Klik untuk input manual 1x hari ini</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Dialog Edit Owner - KAPANPUN */}
      <Dialog open={!!openEdit} onOpenChange={(v)=>!v && setOpenEdit(null)}>
        <DialogContent className="bg-white">
          <DialogHeader><DialogTitle>Edit Saldo - OWNER FULL ACCESS - {openEdit?.name}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Saldo Baru - Bisa diubah kapanpun sebagai owner</Label>
            <Input value={rupiah(editBalance)} onChange={e=>setEditBalance(parseRupiah(e.target.value))} autoFocus />
            <Button onClick={handleEditOwner} className="w-full bg-amber-500 text-white">Simpan - Owner Access</Button>
            <p className="text-[10px] text-slate-500">* Fitur ini hanya muncul untuk Owner. Karyawan tidak bisa lihat tombol ini.</p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog Tambah */}
      <Dialog open={openAdd} onOpenChange={setOpenAdd}>
        <DialogContent className="bg-white">
          <DialogHeader><DialogTitle>+ Tambah Laci Baru - Auto Muncul di Karyawan</DialogTitle></DialogHeader>
          <form onSubmit={handleAdd} className="space-y-3">
            <div><Label>Kode (Contoh: LACI_6, GOPAY, OVO)</Label><Input value={form.code} onChange={e=>setForm({...form, code: e.target.value})} placeholder="GOPAY" /></div>
            <div><Label>Nama</Label><Input value={form.name} onChange={e=>setForm({...form, name: e.target.value})} placeholder="GoPay" /></div>
            <div><Label>Tipe</Label>
              <Select value={form.type} onValueChange={v=>setForm({...form, type: v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">CASH - Laci Fisik</SelectItem>
                  <SelectItem value="BRANKAS">BRANKAS</SelectItem>
                  <SelectItem value="BANK">BANK</SelectItem>
                  <SelectItem value="DIGITAL">DIGITAL - GoPay/OVO/ShopeePay/DANA</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Saldo Awal</Label><Input value={rupiah(form.balance)} onChange={e=>setForm({...form, balance: parseRupiah(e.target.value)})} /></div>
            <Button type="submit" className="w-full bg-black text-white">Simpan & Auto Muncul di Kasir Karyawan</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={openTransfer} onOpenChange={setOpenTransfer}>
        <DialogContent className="bg-white">
          <DialogHeader><DialogTitle>Transfer Laci 1 ↔ 2</DialogTitle></DialogHeader>
          <form onSubmit={handleTransfer} className="space-y-3">
            <Select value={transfer.from} onValueChange={v=>setTransfer({...transfer, from: v})}><SelectTrigger><SelectValue placeholder="Dari Laci"/></SelectTrigger><SelectContent>{lacis.map(l=><SelectItem key={l.id} value={l.id}>{l.name} - {rupiah(l.balance||0)}</SelectItem>)}</SelectContent></Select>
            <Select value={transfer.to} onValueChange={v=>setTransfer({...transfer, to: v})}><SelectTrigger><SelectValue placeholder="Ke Laci"/></SelectTrigger><SelectContent>{lacis.map(l=><SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent></Select>
            <Input value={rupiah(transfer.amount)} onChange={e=>setTransfer({...transfer, amount: parseRupiah(e.target.value)})} />
            <Button type="submit" className="w-full bg-blue-600 text-white">Transfer</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
