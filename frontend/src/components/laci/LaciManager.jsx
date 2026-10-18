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

// === FIX: SESUAI KOLOM ASLI: kode, nama, jenis, saldo ===
async function fetchAllLaci(outletId) {
  if (!outletId) return [];
  const { data, error } = await supabase
    .from("laci")
    .select("*")
    .eq("outlet_id", outletId)
    .order("kode", { ascending: true });
  if (error) throw error;
  return data || [];
}

export default function LaciManager({ outletId }) {
  const qc = useQueryClient();
  const { user, profile, activeOutletId } = useAuth();
  
  const isOwner = profile?.role === "owner" || profile?.role === "OWNER" || profile?.is_owner === true;

  const [openAdd, setOpenAdd] = useState(false);
  const [openTransfer, setOpenTransfer] = useState(false);
  const [openEdit, setOpenEdit] = useState(null);
  const [form, setForm] = useState({ kode: "", nama: "", jenis: "CASH", saldo: 0 });
  const [transfer, setTransfer] = useState({ from: "", to: "", amount: 0 });
  const [editBalance, setEditBalance] = useState(0);

  const { data: lacis = [], isLoading } = useQuery({
    queryKey: ["laci-all", outletId],
    queryFn: () => fetchAllLaci(outletId),
    enabled: !!outletId,
  });

  useEffect(() => {
    if (!outletId) return;
    const channel = supabase
      .channel(`laci-${outletId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "laci", filter: `outlet_id=eq.${outletId}` }, () => {
        qc.invalidateQueries({ queryKey: ["laci-all", outletId] });
        qc.invalidateQueries({ queryKey: ["laci-kasir", outletId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [outletId, qc]);

  const handleAdd = async (e) => {
    e.preventDefault();
    // FIX: pakai kode, nama, jenis, saldo sesuai DB kamu
    const { error } = await supabase.from("laci").insert({
      outlet_id: outletId,
      kode: form.kode.toUpperCase(),
      nama: form.nama,
      jenis: form.jenis,
      saldo: form.saldo,
    });
    if (error) return toast.error(error.message);
    toast.success(`${form.nama} berhasil! Auto muncul di login karyawan!`);
    setOpenAdd(false);
    setForm({ kode: "", nama: "", jenis: "CASH", saldo: 0 });
  };

  const handleEditOwner = async () => {
    if (!openEdit) return;
    const { error } = await supabase.from("laci").update({ saldo: editBalance }).eq("id", openEdit.id);
    if (error) return toast.error(error.message);
    toast.success(`Saldo ${openEdit.nama} diubah jadi ${rupiah(editBalance)} - Owner Access`);
    setOpenEdit(null);
    qc.invalidateQueries({ queryKey: ["laci-all", outletId] });
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    const fromLaci = lacis.find(l => l.id === transfer.from);
    const toLaci = lacis.find(l => l.id === transfer.to);
    if (!fromLaci || !toLaci || transfer.amount <= 0) return toast.error("Lengkapi data");
    if (fromLaci.id === toLaci.id) return toast.error("Laci sama");
    if (!isOwner && (fromLaci.saldo||0) < transfer.amount) return toast.error("Saldo tidak cukup");

    await supabase.from("laci").update({ saldo: (fromLaci.saldo||0) - transfer.amount }).eq("id", transfer.from);
    await supabase.from("laci").update({ saldo: (toLaci.saldo||0) + transfer.amount }).eq("id", transfer.to);
    toast.success("Transfer berhasil");
    setOpenTransfer(false);
    qc.invalidateQueries({ queryKey: ["laci-all", outletId] });
  };

  if (isLoading) return <div className="p-4 text-sm">Memuat {lacis.length} laci...</div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center flex-wrap gap-2">
        <h3 className="font-bold flex items-center gap-2">Laci ({lacis.length}) {isOwner && <Badge className="bg-amber-500 text-white text-[10px]">OWNER FULL ACCESS</Badge>}</h3>
        <div className="flex gap-2">
          <Button onClick={() => setOpenTransfer(true)} variant="outline" className="h-8 rounded-full text-xs">Transfer Laci 1 ↔ 2</Button>
          <Button onClick={() => setOpenAdd(true)} className="bg-black text-white h-8 rounded-full text-xs">+ Tambah Laci / GoPay</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {lacis.map((laci) => {
          return (
            <div key={laci.id} className="border rounded-xl p-4 bg-white relative">
              <div className="flex justify-between items-start">
                <p className="text-[10px] uppercase text-slate-500">{laci.kode} • {laci.jenis}</p>
                <Badge className="text-[9px] bg-emerald-600 text-white">BISA INPUT</Badge>
              </div>
              <p className="font-bold text-sm mt-1">{laci.nama}</p>
              <p className="text-lg font-extrabold mt-1">{rupiah(laci.saldo||0)}</p>
              
              <div className="mt-3 flex gap-2">
                {isOwner ? (
                  <Button size="sm" className="w-full bg-amber-500 hover:bg-amber-600 text-white text-[11px] h-7" onClick={() => { setOpenEdit(laci); setEditBalance(laci.saldo||0); }}>
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

      <Dialog open={!!openEdit} onOpenChange={(v)=>!v && setOpenEdit(null)}>
        <DialogContent className="bg-white">
          <DialogHeader><DialogTitle>Edit Saldo - OWNER FULL ACCESS - {openEdit?.nama}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <Label>Saldo Baru - Bisa diubah kapanpun sebagai owner</Label>
            <Input value={rupiah(editBalance)} onChange={e=>setEditBalance(parseRupiah(e.target.value))} autoFocus />
            <Button onClick={handleEditOwner} className="w-full bg-amber-500 text-white">Simpan - Owner Access</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={openAdd} onOpenChange={setOpenAdd}>
        <DialogContent className="bg-white">
          <DialogHeader><DialogTitle>+ Tambah Laci Baru - Auto Muncul di Karyawan</DialogTitle></DialogHeader>
          <form onSubmit={handleAdd} className="space-y-3">
            <div><Label>Kode (Contoh: LACI_6, GOPAY, OVO)</Label><Input value={form.kode} onChange={e=>setForm({...form, kode: e.target.value})} placeholder="GOPAY" /></div>
            <div><Label>Nama</Label><Input value={form.nama} onChange={e=>setForm({...form, nama: e.target.value})} placeholder="GoPay" /></div>
            <div><Label>Tipe</Label>
              <Select value={form.jenis} onValueChange={v=>setForm({...form, jenis: v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">CASH - Laci Fisik</SelectItem>
                  <SelectItem value="BRANKAS">BRANKAS</SelectItem>
                  <SelectItem value="BANK">BANK</SelectItem>
                  <SelectItem value="DIGITAL">DIGITAL - GoPay/OVO/ShopeePay/DANA</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Saldo Awal</Label><Input value={rupiah(form.saldo)} onChange={e=>setForm({...form, saldo: parseRupiah(e.target.value)})} /></div>
            <Button type="submit" className="w-full bg-black text-white">Simpan & Auto Muncul di Kasir Karyawan</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={openTransfer} onOpenChange={setOpenTransfer}>
        <DialogContent className="bg-white">
          <DialogHeader><DialogTitle>Transfer Laci 1 ↔ 2</DialogTitle></DialogHeader>
          <form onSubmit={handleTransfer} className="space-y-3">
            <Select value={transfer.from} onValueChange={v=>setTransfer({...transfer, from: v})}><SelectTrigger><SelectValue placeholder="Dari Laci"/></SelectTrigger><SelectContent>{lacis.map(l=><SelectItem key={l.id} value={l.id}>{l.nama} - {rupiah(l.saldo||0)}</SelectItem>)}</SelectContent></Select>
            <Select value={transfer.to} onValueChange={v=>setTransfer({...transfer, to: v})}><SelectTrigger><SelectValue placeholder="Ke Laci"/></SelectTrigger><SelectContent>{lacis.map(l=><SelectItem key={l.id} value={l.id}>{l.nama}</SelectItem>)}</SelectContent></Select>
            <Input value={rupiah(transfer.amount)} onChange={e=>setTransfer({...transfer, amount: parseRupiah(e.target.value)})} />
            <Button type="submit" className="w-full bg-blue-600 text-white">Transfer</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
