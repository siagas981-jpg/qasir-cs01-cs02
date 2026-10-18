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
import BackupFull from "@/components/pembukuan/BackupFull";
async function fetchAllLaci(outletId) {
  if (!outletId) return [];
  const { data, error } = await supabase.from("laci").select("*").eq("outlet_id", outletId).order("kode", { ascending: true });
  if (error) throw error;
  return data || [];
}

export default function LaciManager({ outletId }) {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const isOwner = profile?.role === "owner" || profile?.role === "OWNER" || profile?.is_owner === true;

  const [openAdd, setOpenAdd] = useState(false);
  const [openTransfer, setOpenTransfer] = useState(false);
  const [openEdit, setOpenEdit] = useState(null); // untuk edit full: nama, kode, jenis, saldo
  const [form, setForm] = useState({ kode: "", nama: "", jenis: "CASH", saldo: 0 });
  const [transfer, setTransfer] = useState({ from: "", to: "", amount: 0 });

  const { data: lacis = [], isLoading } = useQuery({
    queryKey: ["laci-all", outletId],
    queryFn: () => fetchAllLaci(outletId),
    enabled: !!outletId,
  });

  useEffect(() => {
    if (!outletId) return;
    const channel = supabase.channel(`laci-${outletId}`).on("postgres_changes", { event: "*", schema: "public", table: "laci", filter: `outlet_id=eq.${outletId}` }, () => {
      qc.invalidateQueries({ queryKey: ["laci-all", outletId] });
      qc.invalidateQueries({ queryKey: ["laci-kasir", outletId] });
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [outletId, qc]);

  const handleAdd = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from("laci").insert({ outlet_id: outletId, kode: form.kode.toUpperCase(), nama: form.nama, jenis: form.jenis, saldo: form.saldo });
    if (error) return toast.error(error.message);
    toast.success(`${form.nama} berhasil!`);
    setOpenAdd(false);
    setForm({ kode: "", nama: "", jenis: "CASH", saldo: 0 });
  };

  // === FITUR BARU: OWNER EDIT NAMA, KODE, JENIS, SALDO ===
  const handleEditFull = async () => {
    if (!openEdit) return;
    const { error } = await supabase.from("laci").update({ 
      kode: openEdit.kode.toUpperCase(), 
      nama: openEdit.nama, 
      jenis: openEdit.jenis, 
      saldo: openEdit.saldo 
    }).eq("id", openEdit.id);
    if (error) return toast.error(error.message);
    toast.success(`Laci ${openEdit.nama} berhasil diupdate - Owner Access`);
    setOpenEdit(null);
    qc.invalidateQueries({ queryKey: ["laci-all", outletId] });
  };

  // === FITUR BARU: OWNER HAPUS LACI ===
  const handleDelete = async (laci) => {
    if (!confirm(`Hapus ${laci.nama} (${laci.kode}) ? Saldo Rp ${Number(laci.saldo||0).toLocaleString()} akan hilang. Yakin owner?`)) return;
    const { error } = await supabase.from("laci").delete().eq("id", laci.id);
    if (error) return toast.error(error.message);
    toast.success(`${laci.nama} berhasil dihapus`);
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
        {lacis.map((laci) => (
          <div key={laci.id} className="border rounded-xl p-4 bg-white relative">
            <div className="flex justify-between items-start">
              <p className="text-[10px] uppercase text-slate-500">{laci.kode} • {laci.jenis}</p>
              <Badge className="text-[9px] bg-emerald-600 text-white">BISA INPUT</Badge>
            </div>
            <p className="font-bold text-sm mt-1">{laci.nama}</p>
            <p className="text-lg font-extrabold mt-1">{rupiah(laci.saldo||0)}</p>
            
            {isOwner ? (
              <div className="mt-3 space-y-1.5">
                <Button size="sm" className="w-full bg-amber-500 hover:bg-amber-600 text-white text-[11px] h-7" onClick={() => setOpenEdit(laci)}>
                  ✏️ Edit Nama / Saldo / Jenis
                </Button>
                <Button size="sm" variant="outline" className="w-full text-[11px] h-7 text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleDelete(laci)}>
                  🗑️ Hapus Laci
                </Button>
              </div>
            ) : (
              <p className="text-[11px] text-slate-400 mt-3">Karyawan: hanya bisa transfer</p>
            )}
          </div>
        ))}
      </div>

      {/* Dialog Edit FULL - Nama, Kode, Jenis, Saldo */}
      <Dialog open={!!openEdit} onOpenChange={(v)=>!v && setOpenEdit(null)}>
        <DialogContent className="bg-white">
          <DialogHeader><DialogTitle>Edit Laci - OWNER FULL ACCESS</DialogTitle></DialogHeader>
          {openEdit && (
            <div className="space-y-3">
              <div><Label>Kode Laci</Label><Input value={openEdit.kode} onChange={e=>setOpenEdit({...openEdit, kode: e.target.value})} /></div>
              <div><Label>Nama Laci (Bisa diganti)</Label><Input value={openEdit.nama} onChange={e=>setOpenEdit({...openEdit, nama: e.target.value})} placeholder="Contoh: GoPay jadi DANA" /></div>
              <div><Label>Jenis</Label>
                <Select value={openEdit.jenis} onValueChange={v=>setOpenEdit({...openEdit, jenis: v})}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">CASH - Laci Fisik</SelectItem>
                    <SelectItem value="BRANKAS">BRANKAS</SelectItem>
                    <SelectItem value="BANK">BANK</SelectItem>
                    <SelectItem value="DIGITAL">DIGITAL</SelectItem>
                    <SelectItem value="EWALLET">EWALLET</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Saldo</Label><Input value={rupiah(openEdit.saldo||0)} onChange={e=>setOpenEdit({...openEdit, saldo: parseRupiah(e.target.value)})} /></div>
              <Button onClick={handleEditFull} className="w-full bg-amber-500 text-white">Simpan Perubahan - Owner</Button>
              <p className="text-[10px] text-slate-500">* Nama, Kode, Jenis, Saldo bisa diubah kapanpun sebagai owner.</p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={openAdd} onOpenChange={setOpenAdd}>
        <DialogContent className="bg-white">
          <DialogHeader><DialogTitle>+ Tambah Laci Baru</DialogTitle></DialogHeader>
          <form onSubmit={handleAdd} className="space-y-3">
            <div><Label>Kode</Label><Input value={form.kode} onChange={e=>setForm({...form, kode: e.target.value})} placeholder="GOPAY" /></div>
            <div><Label>Nama</Label><Input value={form.nama} onChange={e=>setForm({...form, nama: e.target.value})} placeholder="GoPay" /></div>
            <div><Label>Tipe</Label>
              <Select value={form.jenis} onValueChange={v=>setForm({...form, jenis: v})}>
                <SelectTrigger><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">CASH</SelectItem>
                  <SelectItem value="BRANKAS">BRANKAS</SelectItem>
                  <SelectItem value="BANK">BANK</SelectItem>
                  <SelectItem value="DIGITAL">DIGITAL</SelectItem>
                  <SelectItem value="EWALLET">EWALLET</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Saldo Awal</Label><Input value={rupiah(form.saldo)} onChange={e=>setForm({...form, saldo: parseRupiah(e.target.value)})} /></div>
            <Button type="submit" className="w-full bg-black text-white">Simpan</Button>
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
