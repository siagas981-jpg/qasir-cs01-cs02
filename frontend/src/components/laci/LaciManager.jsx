import { useState, useEffect } from "react";
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
  const { profile, user } = useAuth();
  const isOwner = profile?.role === "owner" || profile?.role === "OWNER" || profile?.is_owner === true;
  const [openAdd, setOpenAdd] = useState(false);
  const [openTransfer, setOpenTransfer] = useState(false);
  const [openEdit, setOpenEdit] = useState(null);
  const [form, setForm] = useState({ kode: "", nama: "", jenis: "CASH", saldo: 0 });
  const [transfer, setTransfer] = useState({ from: "", to: "", amount: 0 });
  
  const { data: lacis = [] } = useQuery({ queryKey: ["laci-all", outletId], queryFn: () => fetchAllLaci(outletId), enabled: !!outletId });
  
  const { data: riwayatTransfer = [] } = useQuery({
    queryKey: ["transfer-laci", outletId],
    queryFn: async () => {
      if (!outletId) return [];
      const realOutletIdForQuery = lacis[0]?.outlet_id || outletId;
      let { data, error } = await supabase
        .from("transfer_laci")
        .select("*")
        .eq("outlet_id", realOutletIdForQuery)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) {
        console.error(error);
        return [];
      }
      return data || [];
    },
    enabled: !!outletId
  });

  useEffect(() => {
    if (!outletId) return;
    const realId = lacis[0]?.outlet_id || outletId;
    const channel = supabase.channel(`laci-${realId}`).on("postgres_changes", { event: "*", schema: "public", table: "laci", filter: `outlet_id=eq.${realId}` }, () => {
      qc.invalidateQueries({ queryKey: ["laci-all", outletId] });
    }).on("postgres_changes", { event: "INSERT", schema: "public", table: "transfer_laci", filter: `outlet_id=eq.${realId}` }, () => {
      qc.invalidateQueries({ queryKey: ["transfer-laci", outletId] });
    }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [outletId, lacis, qc]);

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
      const finalTo = lacis.find(l => l.id === transfer.to);
      
      if (!fromLaci) { toast.error("Pilih laci asal!"); return; }
      if (!finalTo) { toast.error("Pilih laci tujuan!"); return; }
      if (fromLaci.id === finalTo.id) { toast.error("Asal dan tujuan sama!"); return; }
      
      const jumlah = Number(transfer.amount) || 0;
      if (jumlah <= 0) { toast.error("Jumlah harus > 0"); return; }

      const realOutletId = fromLaci.outlet_id || outletId;

      // 1. Update saldo
      const { error: err1 } = await supabase.from("laci").update({ saldo: Number(fromLaci.saldo||0) - jumlah }).eq("id", fromLaci.id);
      if (err1) { toast.error("err1: " + err1.message); return; }
      
      const { error: err2 } = await supabase.from("laci").update({ saldo: Number(finalTo.saldo||0) + jumlah }).eq("id", finalTo.id);
      if (err2) { 
        await supabase.from("laci").update({ saldo: Number(fromLaci.saldo||0) }).eq("id", fromLaci.id);
        toast.error("err2: " + err2.message); return; 
      }
      
      // 2. SIMPAN RIWAYAT - WAJIB LENGKAP BIAR TIDAK LACI->LACI
      const { data: inserted, error: errTransfer } = await supabase.from("transfer_laci").insert([{
        outlet_id: realOutletId,
        dari_laci_id: fromLaci.id,
        ke_laci_id: finalTo.id,
        dari_nama: fromLaci.nama,
        ke_nama: finalTo.nama,
        jumlah: Number(jumlah),
        keterangan: `${fromLaci.nama} -> ${finalTo.nama}`,
        kasir_email: user?.email || profile?.email || "owner",
      }]).select();
      
      if (errTransfer) {
        console.error("GAGAL INSERT transfer_laci:", errTransfer);
        toast.error("Gagal simpan riwayat: " + errTransfer.message);
      } else {
        console.log("BERHASIL INSERT:", inserted);
      }

      // 3. Mutasi bank
      await supabase.from("laci_mutasi").insert([
        { outlet_id: realOutletId, laci_id: fromLaci.id, tipe: 'keluar', jumlah: Number(jumlah), keterangan: `Transfer ${fromLaci.nama} -> ${finalTo.nama}` },
        { outlet_id: realOutletId, laci_id: finalTo.id, tipe: 'masuk', jumlah: Number(jumlah), keterangan: `Terima dari ${fromLaci.nama}` }
      ]);

      toast.success(`Berhasil ${fromLaci.nama} -> ${finalTo.nama} ${rupiah(jumlah)}`);
      setOpenTransfer(false);
      setTransfer({ from: "", to: "", amount: 0 });
      qc.invalidateQueries({ queryKey: ["transfer-laci", outletId] });
      qc.invalidateQueries({ queryKey: ["riwayat-laci-wita-fix"] });
      qc.invalidateQueries({ queryKey: ["riwayat-bank"] });
      qc.invalidateQueries({ queryKey: ["laci-all", outletId] });
    } catch (err) {
      console.error(err);
      toast.error("Error: " + err.message);
    }
  };

  const formatWita = (rowOrDate) => {
    if (!rowOrDate) return '-';
    if (typeof rowOrDate === 'object' && rowOrDate.jam_wita_text) {
      return rowOrDate.jam_wita_text + ' WITA';
    }
    const utcDate = typeof rowOrDate === 'object' ? (rowOrDate.jam_utc || rowOrDate.created_at) : rowOrDate;
    if (!utcDate) return '-';
    return new Date(utcDate).toLocaleString('id-ID', {
      timeZone: 'Asia/Makassar',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }) + ' WITA';
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

      <div className="border rounded-lg p-3 bg-white mt-4">
        <div className="flex justify-between items-center mb-2">
          <p className="font-bold text-[12px]">Riwayat Transfer Laci (50 terbaru) - WITA Makassar</p>
          <Button size="sm" variant="outline" className="h-6 text-[10px]" onClick={()=>qc.invalidateQueries({ queryKey: ["transfer-laci", outletId] })}>Refresh</Button>
        </div>
        <div className="space-y-1 max-h-[350px] overflow-auto">
          {riwayatTransfer.length === 0 && <p className="text-[11px] text-slate-400 py-4 text-center">Belum ada transfer.</p>}
          {riwayatTransfer.map((r) => (
            <div key={r.id} className="flex justify-between items-center text-[11px] border-b py-1.5">
              <div className="flex flex-col">
                <span className="font-semibold">{r.dari_nama || r.dari_laci_id} → {r.ke_nama || r.ke_laci_id}</span>
                <span className="text-[9px] text-slate-400">{r.jam_wita_text ? r.jam_wita_text + ' WITA' : formatWita(r)} • {r.keterangan}</span>
              </div>
              <span className="font-black">{rupiah(r.jumlah)}</span>
            </div>
          ))}
        </div>
      </div>

      <Dialog open={!!openEdit} onOpenChange={(v)=>!v && setOpenEdit(null)}>
        <DialogContent className="bg-white"><DialogHeader><DialogTitle className="text-sm">Edit Laci</DialogTitle></DialogHeader>
          {openEdit && (<div className="space-y-3"><div><Label className="text-xs">Kode</Label><Input value={openEdit.kode} onChange={e=>setOpenEdit({...openEdit, kode: e.target.value})} className="h-8" /></div><div><Label className="text-xs">Nama</Label><Input value={openEdit.nama} onChange={e=>setOpenEdit({...openEdit, nama: e.target.value})} className="h-8" /></div><div><Label className="text-xs">Saldo</Label><Input value={rupiah(openEdit.saldo||0)} onChange={e=>setOpenEdit({...openEdit, saldo: parseRupiah(e.target.value)})} className="h-8" /></div><Button onClick={handleEditFull} className="w-full bg-amber-500">Simpan</Button></div>)}</DialogContent>
      </Dialog>

      <Dialog open={openAdd} onOpenChange={setOpenAdd}><DialogContent className="bg-white"><DialogHeader><DialogTitle>Tambah Laci</DialogTitle></DialogHeader><form onSubmit={handleAdd} className="space-y-3"><Input value={form.kode} onChange={e=>setForm({...form, kode: e.target.value})} placeholder="Kode" className="h-8" /><Input value={form.nama} onChange={e=>setForm({...form, nama: e.target.value})} placeholder="Nama" className="h-8" /><Input value={rupiah(form.saldo)} onChange={e=>setForm({...form, saldo: parseRupiah(e.target.value)})} className="h-8" /><Button type="submit" className="w-full bg-black text-white">Simpan</Button></form></DialogContent></Dialog>
      
      <Dialog open={openTransfer} onOpenChange={setOpenTransfer}><DialogContent className="bg-white"><DialogHeader><DialogTitle>Transfer Laci (BEBAS)</DialogTitle>
        <p className="text-[11px] text-slate-500">Pilih dari dan ke laci mana saja - bebas tidak auto CASH BANK lagi.</p>
      </DialogHeader>
      <form onSubmit={handleTransfer} className="space-y-3">
        <div><Label className="text-xs">Dari</Label>
        <Select value={transfer.from} onValueChange={v=>setTransfer({...transfer, from: v})}><SelectTrigger><SelectValue placeholder="Dari"/></SelectTrigger><SelectContent>{lacis.map(l=><SelectItem key={l.id} value={l.id}>{l.nama} - {rupiah(l.saldo||0)}</SelectItem>)}</SelectContent></Select></div>
        <div><Label className="text-xs">Ke</Label>
        <Select value={transfer.to} onValueChange={v=>setTransfer({...transfer, to: v})}><SelectTrigger><SelectValue placeholder="Ke"/></SelectTrigger><SelectContent>{lacis.map(l=><SelectItem key={l.id} value={l.id}>{l.nama}</SelectItem>)}</SelectContent></Select></div>
        <div><Label className="text-xs">Jumlah</Label><Input value={rupiah(transfer.amount)} onChange={e=>setTransfer({...transfer, amount: parseRupiah(e.target.value)})} /></div>
        <Button type="submit" className="w-full bg-blue-600">Proses Transfer</Button>
      </form></DialogContent></Dialog>
    </div>
  );
}
