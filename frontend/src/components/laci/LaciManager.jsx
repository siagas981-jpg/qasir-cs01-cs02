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
import BackupFull from "@/components/BackupFull";

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
  const [openEdit, setOpenEdit] = useState(null);
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

  const handleEditFull = async () => {
    if (!openEdit) return;
    const { error } = await supabase.from("laci").update({ 
      kode: openEdit.kode.toUpperCase(), 
      nama: openEdit.nama, 
      jenis: openEdit.jenis, 
      saldo: openEdit.saldo 
    }).eq("id", openEdit.id);
    if (error) return toast.error(error.message);
    toast.success(`Laci ${openEdit.nama} berhasil diupdate`);
    setOpenEdit(null);
    qc.invalidateQueries({ queryKey: ["laci-all", outletId] });
  };

  const handleDelete = async (laci) => {
    if (!confirm(`Hapus ${laci.nama} (${laci.kode}) ?`)) return;
    const { error } = await supabase.from("laci").delete().eq("id", laci.id);
    if (error) return toast.error(error.message);
    toast.success(`${laci.nama} dihapus`);
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

  if (isLoading) return <div className="p-2 text-[10px]">Memuat...</div>;

  return (
    <div className="space-y-2">
      <BackupFull outletId={outletId} />
      {/* HEADER COMPACT */}
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-[11px] flex items-center gap-1">Laci ({lacis.length}) {isOwner && <Badge className="bg-amber-500 text-white text-[8px] h-4 px-1">OWNER</Badge>}</h3>
        <div className="flex gap-1">
          <Button onClick={() => setOpenTransfer(true)} variant="outline" className="h-6 rounded-full text-[10px] px-2">Transfer</Button>
          <Button onClick={() => setOpenAdd(true)} className="bg-black text-white h-6 rounded-full text-[10px] px-2">+ Tambah</Button>
        </div>
      </div>

      {/* GRID COMPACT 2 KOLOM - KUNCI BIAR MUAT 1 LAYAR */}
      <div className="grid grid-cols-2 gap-2">
        {lacis.map((laci) => (
          <div key={laci.id} className="border rounded-lg p-2 bg-white relative hover:shadow-sm transition-all">
            <div className="flex justify-between items-start leading-none">
              <p className="text-[7px] uppercase text-slate-400 font-bold tracking-widest truncate">{laci.kode} • {laci.jenis}</p>
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shrink-0 ml-1"></div>
            </div>
            <p className="font-bold text-[11px] mt-1 leading-tight truncate">{laci.nama}</p>
            <p className="text-[13px] font-black mt-0.5 leading-none">{rupiah(laci.saldo||0)}</p>
            
            {isOwner ? (
              <div className="mt-1.5 flex gap-1">
                <Button size="sm" className="flex-1 bg-amber-500 hover:bg-amber-600 text-white text-[8px] h-5 px-1 rounded" onClick={() => setOpenEdit(laci)}>
                  ✏️ Edit
                </Button>
                <Button size="sm" variant="outline" className="text-[8px] h-5 px-1.5 rounded text-red-600 border-red-200" onClick={() => handleDelete(laci)}>
                  🗑️
                </Button>
              </div>
            ) : (
              <p className="text-[7px] text-slate-400 mt-1">Karyawan: transfer only</p>
            )}
          </div>
        ))}
      </div>

      {/* Dialogs tetap sama */}
      <Dialog open={!!openEdit} onOpenChange={(v)=>!v && setOpenEdit(null)}>
        <DialogContent className="bg-white">
          <DialogHeader><DialogTitle className="text-sm">Edit Laci - OWNER</DialogTitle></DialogHeader>
          {openEdit && (
            <div className="space-y-3">
              <div><Label className="text-xs">Kode</Label><Input value={openEdit.kode} onChange={e=>setOpenEdit({...openEdit, kode: e.target.value})} className="h-8 text-sm" /></div>
              <div><Label className="text-xs">Nama</Label><Input value={openEdit.nama} onChange={e=>setOpenEdit({...openEdit, nama: e.target.value})} className="h-8 text-sm" /></div>
              <div><Label className="text-xs">Jenis</Label>
                <Select value={openEdit.jenis} onValueChange={v=>setOpenEdit({...openEdit, jenis: v})}>
                  <SelectTrigger className="h-8"><SelectValue/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CASH">CASH</SelectItem>
                    <SelectItem value="BRANKAS">BRANKAS</SelectItem>
                    <SelectItem value="BANK">BANK</SelectItem>
                    <SelectItem value="DIGITAL">DIGITAL</SelectItem>
                    <SelectItem value="EWALLET">EWALLET</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Saldo</Label><Input value={rupiah(openEdit.saldo||0)} onChange={e=>setOpenEdit({...openEdit, saldo: parseRupiah(e.target.value)})} className="h-8 text-sm" /></div>
              <Button onClick={handleEditFull} className="w-full bg-amber-500 text-white h-8 text-sm">Simpan</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={openAdd} onOpenChange={setOpenAdd}>
        <DialogContent className="bg-white">
          <DialogHeader><DialogTitle className="text-sm">+ Tambah Laci</DialogTitle></DialogHeader>
          <form onSubmit={handleAdd} className="space-y-3">
            <div><Label className="text-xs">Kode</Label><Input value={form.kode} onChange={e=>setForm({...form, kode: e.target.value})} placeholder="GOPAY" className="h-8 text-sm" /></div>
            <div><Label className="text-xs">Nama</Label><Input value={form.nama} onChange={e=>setForm({...form, nama: e.target.value})} placeholder="GoPay" className="h-8 text-sm" /></div>
            <div><Label className="text-xs">Tipe</Label>
              <Select value={form.jenis} onValueChange={v=>setForm({...form, jenis: v})}>
                <SelectTrigger className="h-8"><SelectValue/></SelectTrigger>
                <SelectContent>
                  <SelectItem value="CASH">CASH</SelectItem>
                  <SelectItem value="BRANKAS">BRANKAS</SelectItem>
                  <SelectItem value="BANK">BANK</SelectItem>
                  <SelectItem value="DIGITAL">DIGITAL</SelectItem>
                  <SelectItem value="EWALLET">EWALLET</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Saldo Awal</Label><Input value={rupiah(form.saldo)} onChange={e=>setForm({...form, saldo: parseRupiah(e.target.value)})} className="h-8 text-sm" /></div>
            <Button type="submit" className="w-full bg-black text-white h-8 text-sm">Simpan</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={openTransfer} onOpenChange={setOpenTransfer}>
        <DialogContent className="bg-white">
          <DialogHeader><DialogTitle className="text-sm">Transfer Laci</DialogTitle></DialogHeader>
          <form onSubmit={handleTransfer} className="space-y-3">
            <Select value={transfer.from} onValueChange={v=>setTransfer({...transfer, from: v})}><SelectTrigger className="h-8"><SelectValue placeholder="Dari Laci"/></SelectTrigger><SelectContent>{lacis.map(l=><SelectItem key={l.id} value={l.id}>{l.nama} - {rupiah(l.saldo||0)}</SelectItem>)}</SelectContent></Select>
            <Select value={transfer.to} onValueChange={v=>setTransfer({...transfer, to: v})}><SelectTrigger className="h-8"><SelectValue placeholder="Ke Laci"/></SelectTrigger><SelectContent>{lacis.map(l=><SelectItem key={l.id} value={l.id}>{l.nama}</SelectItem>)}</SelectContent></Select>
            <Input value={rupiah(transfer.amount)} onChange={e=>setTransfer({...transfer, amount: parseRupiah(e.target.value)})} className="h-8 text-sm" />
            <Button type="submit" className="w-full bg-blue-600 text-white h-8 text-sm">Transfer</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
