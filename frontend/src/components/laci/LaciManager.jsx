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

    const handleTransfer = async (e) => {
    if(e) e.preventDefault();
    try {
      const fromLaci = lacis.find(l => l.id === transfer.from);
      const toLaci = lacis.find(l => l.id === transfer.to);
      const jumlah = Number(transfer.amount) || 0;
      const realOutletId = outletId || fromLaci?.outlet_id || '87aab4db-13a9-4fed-b00c-495fbdb46965';

      if (!fromLaci || !toLaci || jumlah <= 0) return toast.error("Lengkapi data!");
      if (fromLaci.id === toLaci.id) return toast.error("Tidak bisa transfer ke laci sama!");

      // INI FIX NYA OWY - WAJIB ADA dari_laci_id & ke_laci_id
      const { data, error } = await supabase.from("transfer_laci").insert({
        outlet_id: realOutletId,
        dari_laci_id: fromLaci.id,
        ke_laci_id: toLaci.id,
        dari_nama: fromLaci.nama,
        ke_nama: toLaci.nama,
        jumlah: jumlah,
        kasir_email: profile?.email || 'owner',
        keterangan: `Transfer ${fromLaci.nama} ke ${toLaci.nama}`
      }).select();

      if (error) {
        alert("GAGAL: " + error.message);
        console.error(error);
        return toast.error("Gagal: " + error.message);
      }

      await supabase.from("laci").update({ saldo: Number(fromLaci.saldo||0) - jumlah }).eq("id", fromLaci.id);
      await supabase.from("laci").update({ saldo: Number(toLaci.saldo||0) + jumlah }).eq("id", toLaci.id);

      toast.success(`Berhasil ${fromLaci.nama} → ${toLaci.nama} ${rupiah(jumlah)}`);
      setOpenTransfer(false);
      setTransfer({ from: "", to: "", amount: 0 });
      qc.invalidateQueries({ queryKey: ["laci-all"] });
      qc.invalidateQueries({ queryKey: ["riwayat-transfer"] });
      qc.invalidateQueries({ queryKey: ["transfer-laci"] });
    } catch (err) {
      toast.error("ERROR: " + err.message);
    }
  };

      // 2. BARU UPDATE SALDO KALAU RIWAYAT SUKSES
      await supabase.from("laci").update({ saldo: Number(fromLaci.saldo||0) - jumlah }).eq("id", fromLaci.id);
      await supabase.from("laci").update({ saldo: Number(toLaci.saldo||0) + jumlah }).eq("id", toLaci.id);

      toast.success(`Berhasil ${fromLaci.nama} → ${toLaci.nama} ${rupiah(jumlah)}`);
      setOpenTransfer(false);
      setTransfer({ from: "", to: "", amount: 0 });
      qc.invalidateQueries({ queryKey: ["laci-all"] });
      qc.invalidateQueries({ queryKey: ["riwayat-transfer"] });
      qc.invalidateQueries({ queryKey: ["transfer-laci"] });
    } catch (err) {
      toast.error("ERROR: " + err.message);
    }
  };

  // ... (handleAdd, handleEdit, handleDelete tetap seperti sebelumnya)
  const handleAdd = async (e) => { e.preventDefault(); const { error } = await supabase.from("laci").insert({ outlet_id: outletId, kode: form.kode.toUpperCase(), nama: form.nama, jenis: form.jenis, saldo: form.saldo }); if (error) return toast.error(error.message); toast.success(`${form.nama} berhasil!`); setOpenAdd(false); setForm({ kode: "", nama: "", jenis: "CASH", saldo: 0 }); qc.invalidateQueries({ queryKey: ["laci-all"] }); };
  const handleEditFull = async () => { const { error } = await supabase.from("laci").update({ kode: openEdit.kode, nama: openEdit.nama, saldo: openEdit.saldo }).eq("id", openEdit.id); if (error) return toast.error(error.message); toast.success("Updated!"); setOpenEdit(null); qc.invalidateQueries({ queryKey: ["laci-all"] }); };
  const handleDelete = async (laci) => { if (!confirm(`Hapus ${laci.nama}?`)) return; const { error } = await supabase.from("laci").delete().eq("id", laci.id); if (error) return toast.error(error.message); toast.success("Dihapus"); qc.invalidateQueries({ queryKey: ["laci-all"] }); };
  const formatWita = (row) => { if (!row?.created_at) return '-'; return new Date(row.created_at).toLocaleString('id-ID', { timeZone: 'Asia/Makassar', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }) + ' WITA'; };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {isOwner && <Button size="sm" onClick={() => setOpenAdd(true)} className="bg-black text-white">+ Laci</Button>}
        <Button size="sm" onClick={() => setOpenTransfer(true)} className="bg-blue-600 text-white">Transfer Laci</Button>
        <BackupFull outletId={outletId} />
      </div>
      <Dialog open={openTransfer} onOpenChange={setOpenTransfer}><DialogContent className="bg-white"><DialogHeader><DialogTitle>Transfer Laci</DialogTitle></DialogHeader><form onSubmit={handleTransfer} className="space-y-3"><div><Label className="text-xs">Dari</Label><Select value={transfer.from} onValueChange={v=>setTransfer({...transfer, from: v})}><SelectTrigger><SelectValue placeholder="Dari"/></SelectTrigger><SelectContent>{lacis.map(l=><SelectItem key={l.id} value={l.id}>{l.nama} - {rupiah(l.saldo||0)}</SelectItem>)}</SelectContent></Select></div><div><Label className="text-xs">Ke</Label><Select value={transfer.to} onValueChange={v=>setTransfer({...transfer, to: v})}><SelectTrigger><SelectValue placeholder="Ke"/></SelectTrigger><SelectContent>{lacis.map(l=><SelectItem key={l.id} value={l.id}>{l.nama}</SelectItem>)}</SelectContent></Select></div><div><Label className="text-xs">Jumlah</Label><Input value={rupiah(transfer.amount)} onChange={e=>setTransfer({...transfer, amount: parseRupiah(e.target.value)})} /></div><Button type="submit" className="w-full bg-blue-600">Proses Transfer</Button></form></DialogContent></Dialog>
      {/* ... sisa dialog add/edit sama seperti file kamu ... */}
    </div>
  );
}
