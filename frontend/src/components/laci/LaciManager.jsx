import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  
  const { data: lacis = [] } = useQuery({ 
    queryKey: ["laci-all", outletId], 
    queryFn: () => fetchAllLaci(outletId), 
    enabled: !!outletId 
  });
  
  // FIX: JANGAN FILTER outlet_id BIAR PASTI MUNCUL (2x) JADI (3x)
  const { data: riwayatTransfer = [] } = useQuery({
    queryKey: ["transfer-laci", outletId],
    queryFn: async () => {
      const { data } = await supabase.from("transfer_laci").select("*").order("created_at", { ascending: false }).limit(100);
      return data || [];
    },
    enabled: !!outletId,
  });

  const handleAdd = async (e) => {
    e.preventDefault();
    const { error } = await supabase.from("laci").insert({ outlet_id: outletId, kode: form.kode.toUpperCase(), nama: form.nama, jenis: form.jenis, saldo: form.saldo });
    if (error) return toast.error(error.message);
    toast.success(`${form.nama} berhasil!`);
    setOpenAdd(false);
    setForm({ kode: "", nama: "", jenis: "CASH", saldo: 0 });
    qc.invalidateQueries({ queryKey: ["laci-all"] });
  };

  const handleEditFull = async () => {
    if (!openEdit) return;
    const { error } = await supabase.from("laci").update({ kode: openEdit.kode.toUpperCase(), nama: openEdit.nama, jenis: openEdit.jenis, saldo: openEdit.saldo }).eq("id", openEdit.id);
    if (error) return toast.error(error.message);
    toast.success(`Berhasil diupdate`);
    setOpenEdit(null);
    qc.invalidateQueries({ queryKey: ["laci-all"] });
  };

  const handleDelete = async (laci) => {
    if (!confirm(`Hapus ${laci.nama}?`)) return;
    const { error } = await supabase.from("laci").delete().eq("id", laci.id);
    if (error) return toast.error(error.message);
    toast.success(`Dihapus`);
    qc.invalidateQueries({ queryKey: ["laci-all"] });
  };

  const handleTransfer = async (e) => {
    e.preventDefault();
    try {
      const fromLaci = lacis.find(l => l.id === transfer.from);
      const finalTo = lacis.find(l => l.id === transfer.to);
      if (!fromLaci || !finalTo) return toast.error("Pilih laci!");
      if (fromLaci.id === finalTo.id) return toast.error("Asal dan tujuan sama!");
      const jumlah = Number(transfer.amount) || 0;
      if (jumlah <= 0) return toast.error("Jumlah 0!");

        const realOutletId = outletId || fromLaci.outlet_id || '87aab4db-13a9-4fed-b00c-495fbdb46965';

  console.log("COBA INSERT:", { realOutletId, dari: fromLaci.nama, ke: finalTo.nama, jumlah });

  const { data, error: errTransfer } = await supabase.from("transfer_laci").insert({
    outlet_id: realOutletId,
    dari_nama: fromLaci.nama,
    ke_nama: finalTo.nama,
    jumlah: jumlah,
  }).select();
  
  if (errTransfer) {
    console.error("GAGAL INSERT:", errTransfer);
    toast.error("GAGAL: " + errTransfer.message);
    return;
  }

  console.log("BERHASIL INSERT:", data);
toast.success("Transfer " + jumlah + " berhasil!");

// INI YANG BIKIN RIWAYAT LANGSUNG KEBACA
qc.invalidateQueries({ queryKey: ["transfer-laci"] });
qc.invalidateQueries({ queryKey: ["laci-all"] });
qc.invalidateQueries({ queryKey: ["riwayat-transfer"] });
      }

      await supabase.from("laci").update({ saldo: Number(fromLaci.saldo||0) - jumlah }).eq("id", fromLaci.id);
      await supabase.from("laci").update({ saldo: Number(finalTo.saldo||0) + jumlah }).eq("id", finalTo.id);

      toast.success(`Berhasil ${fromLaci.nama} → ${finalTo.nama} ${rupiah(jumlah)}`);
      setOpenTransfer(false);
      setTransfer({ from: "", to: "", amount: 0 });
qc.invalidateQueries({ queryKey: ["laci-all"] });
qc.invalidateQueries({ queryKey: ["transfer-laci"] });
// TAMBAHKAN 2 BARIS INI BIAR SEMUA RIWAYAT KE REFRESH
qc.invalidateQueries({ queryKey: ["riwayat-transfer-laci"] });
qc.invalidateQueries({ queryKey: ["transaksi"] });
    } catch (err) {
      toast.error("ERROR: " + err.message);
    }
  };

  const formatWita = (row) => {
    if (!row?.created_at) return '-';
    return new Date(row.created_at).toLocaleString('id-ID', { timeZone: 'Asia/Makassar', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) + ' WITA';
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
          <div key={laci.id} className="border rounded-lg p-2.5 bg-white">
            <p className="text-[9px] uppercase text-slate-400 font-bold truncate">{laci.kode} • {laci.jenis}</p>
            <p className="font-bold text-[12px] mt-1 truncate">{laci.nama}</p>
            <p className="text-[13px] font-black mt-1">{rupiah(laci.saldo||0)}</p>
            {isOwner && (
              <div className="flex gap-1 mt-2">
                <Button size="sm" variant="outline" className="h-6 text-[9px] flex-1" onClick={()=>setOpenEdit(laci)}>Edit</Button>
                <Button size="sm" variant="outline" className="h-6 text-[9px] flex-1 text-red-600" onClick={()=>handleDelete(laci)}>Hapus</Button>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="border rounded-lg p-3 bg-white mt-4">
        <div className="flex justify-between items-center mb-2"><p className="font-bold text-[12px]">Riwayat Transfer Laci ({riwayatTransfer.length}x)</p><Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={()=>qc.invalidateQueries({ queryKey: ["transfer-laci"] })}>Refresh</Button></div>
        <div className="space-y-1 max-h-[350px] overflow-auto">
          {riwayatTransfer.length === 0 && <p className="text-[11px] text-slate-400">Belum ada transfer</p>}
          {riwayatTransfer.map((r) => (
            <div key={r.id} className="flex justify-between items-center text-[11px] border-b py-1.5">
              <div className="flex flex-col"><span className="font-semibold">{r.dari_nama} → {r.ke_nama}</span><span className="text-[9px] text-slate-400">{formatWita(r)} • {r.keterangan}</span></div>
              <span className="font-black">{rupiah(r.jumlah)}</span>
            </div>
          ))}
        </div>
      </div>
      <Dialog open={openAdd} onOpenChange={setOpenAdd}><DialogContent className="bg-white"><DialogHeader><DialogTitle>Tambah Laci</DialogTitle></DialogHeader><form onSubmit={handleAdd} className="space-y-3"><Input value={form.kode} onChange={e=>setForm({...form, kode: e.target.value})} placeholder="Kode" /><Input value={form.nama} onChange={e=>setForm({...form, nama: e.target.value})} placeholder="Nama" /><Input value={rupiah(form.saldo)} onChange={e=>setForm({...form, saldo: parseRupiah(e.target.value)})} /><Button type="submit" className="w-full bg-black text-white">Simpan</Button></form></DialogContent></Dialog>
      <Dialog open={!!openEdit} onOpenChange={()=>setOpenEdit(null)}><DialogContent className="bg-white"><DialogHeader><DialogTitle>Edit Laci</DialogTitle></DialogHeader>{openEdit && <div className="space-y-3"><Input value={openEdit.kode} onChange={e=>setOpenEdit({...openEdit, kode: e.target.value})} /><Input value={openEdit.nama} onChange={e=>setOpenEdit({...openEdit, nama: e.target.value})} /><Input value={rupiah(openEdit.saldo)} onChange={e=>setOpenEdit({...openEdit, saldo: parseRupiah(e.target.value)})} /><Button onClick={handleEditFull} className="w-full bg-black text-white">Update</Button></div>}</DialogContent></Dialog>
      <Dialog open={openTransfer} onOpenChange={setOpenTransfer}><DialogContent className="bg-white"><DialogHeader><DialogTitle>Transfer Laci</DialogTitle></DialogHeader><form onSubmit={handleTransfer} className="space-y-3"><div><Label className="text-xs">Dari</Label><Select value={transfer.from} onValueChange={v=>setTransfer({...transfer, from: v})}><SelectTrigger><SelectValue placeholder="Dari"/></SelectTrigger><SelectContent>{lacis.map(l=><SelectItem key={l.id} value={l.id}>{l.nama} - {rupiah(l.saldo||0)}</SelectItem>)}</SelectContent></Select></div><div><Label className="text-xs">Ke</Label><Select value={transfer.to} onValueChange={v=>setTransfer({...transfer, to: v})}><SelectTrigger><SelectValue placeholder="Ke"/></SelectTrigger><SelectContent>{lacis.map(l=><SelectItem key={l.id} value={l.id}>{l.nama}</SelectItem>)}</SelectContent></Select></div><div><Label className="text-xs">Jumlah</Label><Input value={rupiah(transfer.amount)} onChange={e=>setTransfer({...transfer, amount: parseRupiah(e.target.value)})} /></div><Button type="submit" className="w-full bg-blue-600">Proses Transfer</Button></form></DialogContent></Dialog>
    </div>
  );
}
