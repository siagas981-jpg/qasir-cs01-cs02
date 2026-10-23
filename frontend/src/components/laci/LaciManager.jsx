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
  const { data: lacis = [] } = useQuery({ queryKey: ["laci-all", outletId], queryFn: () => fetchAllLaci(outletId), enabled: !!outletId });
  
  const KHUSUS = ['BRI', 'BNI', 'MANDIRI', 'DANA', 'BUKU AGEN', 'AGEN'];

  useEffect(() => {
    if (!outletId) return;
    const channel = supabase.channel(`laci-${outletId}`).on("postgres_changes", { event: "*", schema: "public", table: "laci", filter: `outlet_id=eq.${outletId}` }, () => {
      qc.invalidateQueries({ queryKey: ["laci-all", outletId] });
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
    const { error } = await supabase.from("laci").update({ kode: openEdit.kode.toUpperCase(), nama: openEdit.nama, jenis: openEdit.jenis, saldo: openEdit.saldo }).eq("id", openEdit.id);
    if (error) return toast.error(error.message);
    toast.success(`Berhasil diupdate`);
    setOpenEdit(null);
    qc.invalidateQueries({ queryKey: ["laci-all", outletId] });
  };

  const handleDelete = async (laci) => {
    if (!confirm(`Hapus ${laci.nama}?`)) return;
    const { error } = await supabase.from("laci").delete().eq("id", laci.id);
    if (error) return toast.error(error.message);
    toast.success(`Dihapus`);
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    try {
      const fromLaci = lacis.find(l => l.id === transfer.from);
      if (!fromLaci) { toast.error("Pilih laci asal!"); return; }
      if (!transfer.amount || Number(transfer.amount) <= 0) { toast.error("Jumlah harus > 0"); return; }

      const namaFromUpper = (fromLaci.nama || "").toUpperCase();
      const isKhusus = KHUSUS.some(k => namaFromUpper.includes(k));
      const cashBankLaci = lacis.find(l => (l.nama||"").toUpperCase().includes("CASH") && (l.nama||"").toUpperCase().includes("BANK"));

      let toLaci = lacis.find(l => l.id === transfer.to);
      let finalTo = toLaci;

      if (isKhusus) {
        if (!cashBankLaci) { toast.error("CASH BANK tidak ketemu!"); return; }
        finalTo = cashBankLaci;
      } else {
        if (!toLaci) { toast.error("Pilih laci tujuan!"); return; }
      }

      const jumlah = Number(transfer.amount);

      const { error: err1 } = await supabase.from("laci").update({ saldo: Number(fromLaci.saldo||0) - jumlah }).eq("id", fromLaci.id);
      if (err1) { toast.error("err1: " + err1.message); return; }

      const { error: err2 } = await supabase.from("laci").update({ saldo: Number(finalTo.saldo||0) + jumlah }).eq("id", finalTo.id);
      if (err2) { toast.error("err2: " + err2.message); return; }

      // FIX UTAMA: TAMBAH outlet_id BIAR RIWAYAT KEBACA
      const kasirEmail = profile?.email || "siagas981@gmail.com";
      const { data: insData, error: err3 } = await supabase.from("transfer_laci").insert({
        outlet_id: outletId,
        dari_nama: String(fromLaci.nama),
        ke_nama: String(finalTo.nama),
        jumlah: Number(jumlah),
        keterangan: `${fromLaci.nama} → ${finalTo.nama}`,
        kasir_email: String(kasirEmail)
      }).select();

      console.log("DEBUG FINAL transfer_laci:", { err3, insData, outletId });

        if (err3) toast.error("Gagal simpan riwayat: " + err3.message);
  else toast.success(`Berhasil ${fromLaci.nama} → ${finalTo.nama} ${rupiah(jumlah)}`);

  setOpenTransfer(false);
  setTransfer({ from: "", to: "", amount: 0 });
  qc.invalidateQueries();
} catch (err) {
      console.error(err);
      toast.error("Error: " + err.message);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {isOwner && <Button size="sm" onClick={() => setOpenAdd(true)} className="bg-black text-white">+ Laci</Button>}
        <Button size="sm" onClick={() => setOpenTransfer(true)} className="bg-blue-600 text-white">Transfer Laci</Button>
        <BackupFull outletId={outletId} />
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {lacis.map((laci) => (
          <div key={laci.id} className="border rounded-lg p-2.5 bg-white hover:shadow-sm transition-all">
            <p className="text-[9px] uppercase text-slate-400 font-bold tracking-wide truncate">{laci.kode} • {laci.jenis}</p>
            <p className="font-bold text-[12px] mt-1 leading-tight truncate">{laci.nama}</p>
            <p className="text-[13px] font-black mt-1 leading-none">{rupiah(laci.saldo||0)}</p>
            {isOwner && (
              <div className="mt-2 flex gap-1">
                <Button size="sm" className="flex-1 bg-amber-500 hover:bg-amber-600 text-white text-[10px] h-6 px-2 rounded-md" onClick={() => setOpenEdit(laci)}>Edit</Button>
                <Button size="sm" variant="outline" className="text-[10px] h-6 w-6 p-0 rounded-md" onClick={() => handleDelete(laci)}>X</Button>
              </div>
            )}
          </div>
        ))}
      </div>

      <Dialog open={!!openEdit} onOpenChange={(v)=>!v && setOpenEdit(null)}>
        <DialogContent className="bg-white"><DialogHeader><DialogTitle className="text-sm">Edit Laci</DialogTitle></DialogHeader>
          {openEdit && (<div className="space-y-3"><div><Label className="text-xs">Kode</Label><Input value={openEdit.kode} onChange={e=>setOpenEdit({...openEdit, kode: e.target.value})} className="h-8" /></div><div><Label className="text-xs">Nama</Label><Input value={openEdit.nama} onChange={e=>setOpenEdit({...openEdit, nama: e.target.value})} className="h-8" /></div><div><Label className="text-xs">Saldo</Label><Input value={rupiah(openEdit.saldo||0)} onChange={e=>setOpenEdit({...openEdit, saldo: parseRupiah(e.target.value)})} className="h-8" /></div><Button onClick={handleEditFull} className="w-full bg-amber-500">Simpan</Button></div>)}</DialogContent>
      </Dialog>

      <Dialog open={openAdd} onOpenChange={setOpenAdd}><DialogContent className="bg-white"><DialogHeader><DialogTitle>Tambah Laci</DialogTitle></DialogHeader><form onSubmit={handleAdd} className="space-y-3"><Input value={form.kode} onChange={e=>setForm({...form, kode: e.target.value})} placeholder="Kode" className="h-8" /><Input value={form.nama} onChange={e=>setForm({...form, nama: e.target.value})} placeholder="Nama" className="h-8" /><Input value={rupiah(form.saldo)} onChange={e=>setForm({...form, saldo: parseRupiah(e.target.value)})} className="h-8" /><Button type="submit" className="w-full bg-black text-white">Simpan</Button></form></DialogContent></Dialog>
      
      <Dialog open={openTransfer} onOpenChange={setOpenTransfer}><DialogContent className="bg-white"><DialogHeader><DialogTitle>Transfer / Transaksi Keluar</DialogTitle>
        <p className="text-[11px] text-slate-500">Jika pilih BRI/BNI/MANDIRI/DANA/BUKU AGEN, otomatis masuk ke CASH BANK.</p>
        <p className="text-[10px] text-slate-400">Laci ada: {lacis.map(l=>l.nama).join(", ")}</p>
      </DialogHeader>
      <form onSubmit={handleTransfer} className="space-y-3">
        <div><Label className="text-xs">Dari (Sumber Keluar)</Label>
        <Select value={transfer.from} onValueChange={v=>setTransfer({...transfer, from: v})}><SelectTrigger><SelectValue placeholder="Dari"/></SelectTrigger><SelectContent>{lacis.map(l=><SelectItem key={l.id} value={l.id}>{l.nama} - {rupiah(l.saldo||0)}</SelectItem>)}</SelectContent></Select></div>
        <div><Label className="text-xs">Ke (Jika bukan 5 bank khusus)</Label>
        <Select value={transfer.to} onValueChange={v=>setTransfer({...transfer, to: v})}><SelectTrigger><SelectValue placeholder="Ke"/></SelectTrigger><SelectContent>{lacis.map(l=><SelectItem key={l.id} value={l.id}>{l.nama}</SelectItem>)}</SelectContent></Select></div>
        <div><Label className="text-xs">Jumlah Keluar</Label><Input value={rupiah(transfer.amount)} onChange={e=>setTransfer({...transfer, amount: parseRupiah(e.target.value)})} /></div>
        <Button type="submit" className="w-full bg-blue-600">Proses Transfer</Button>
      </form></DialogContent></Dialog>
    </div>
  );
}
