import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";
import { rupiah, parseRupiah } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

async function fetchAllLaci(outletId) {
  if (!outletId) return [];
  const { data, error } = await supabase.from("laci").select("*").eq("outlet_id", outletId).order("kode", { ascending: true });
  if (error) throw error;
  return data || [];
}

export default function LaciManager({ outletId }) {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const [openTransfer, setOpenTransfer] = useState(false);
  const [transfer, setTransfer] = useState({ from: "", to: "", amount: 0 });

  const { data: lacis = [] } = useQuery({
    queryKey: ["laci-all", outletId],
    queryFn: () => fetchAllLaci(outletId),
    enabled: !!outletId,
  });

  const handleTransfer = async (e) => {
    if (e) e.preventDefault();
    try {
      const fromLaci = lacis.find((l) => l.id === transfer.from);
      const toLaci = lacis.find((l) => l.id === transfer.to);
      const jumlah = Number(transfer.amount) || 0;
      const realOutletId = outletId || fromLaci?.outlet_id;

      if (!fromLaci || !toLaci || jumlah <= 0) return toast.error("Lengkapi data!");
      if (fromLaci.id === toLaci.id) return toast.error("Tidak bisa ke laci sama!");
      if ((fromLaci.saldo || 0) < jumlah) return toast.error("Saldo tidak cukup!");

      // PAKAI FUNGSI ATOMIK - SALDO + RIWAYAT JADI 1 PAKET, TIDAK BISA GAGAL SEPARUH
      const { error } = await supabase.rpc('transfer_laci_atomic', {
        p_outlet_id: realOutletId,
        p_dari_id: fromLaci.id,
        p_ke_id: toLaci.id,
        p_dari_nama: fromLaci.nama,
        p_ke_nama: toLaci.nama,
        p_jumlah: jumlah,
        p_email: profile?.email || "owner"
      });

      if (error) {
        console.error(error);
        return toast.error("GAGAL INSERT: " + error.message);
      }

      toast.success(`Berhasil ${fromLaci.nama} → ${toLaci.nama} ${rupiah(jumlah)}`);
      setOpenTransfer(false);
      setTransfer({ from: "", to: "", amount: 0 });
      qc.invalidateQueries({ queryKey: ["laci-all"] });
      qc.invalidateQueries({ queryKey: ["riwayat-transfer-laci-final"] });
      qc.invalidateQueries({ queryKey: ["riwayat-transfer"] });

    } catch (err) {
      console.error(err);
      toast.error("ERROR: " + err.message);
    }
  };

  return (
    <div className="space-y-3">
      <Button size="sm" onClick={() => setOpenTransfer(true)} className="bg-blue-600 text-white">Transfer Laci</Button>

      <Dialog open={openTransfer} onOpenChange={setOpenTransfer}>
        <DialogContent className="bg-white">
          <DialogHeader><DialogTitle>Transfer Laci</DialogTitle></DialogHeader>
          <form onSubmit={handleTransfer} className="space-y-3">
            <div><Label>Dari</Label>
              <Select value={transfer.from} onValueChange={(v) => setTransfer({ ...transfer, from: v })}>
                <SelectTrigger><SelectValue placeholder="Dari" /></SelectTrigger>
                <SelectContent>{lacis.map((l) => <SelectItem key={l.id} value={l.id}>{l.nama} - {rupiah(l.saldo || 0)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Ke</Label>
              <Select value={transfer.to} onValueChange={(v) => setTransfer({ ...transfer, to: v })}>
                <SelectTrigger><SelectValue placeholder="Ke" /></SelectTrigger>
                <SelectContent>{lacis.map((l) => <SelectItem key={l.id} value={l.id}>{l.nama}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Jumlah</Label><Input value={rupiah(transfer.amount)} onChange={(e) => setTransfer({ ...transfer, amount: parseRupiah(e.target.value) })} /></div>
            <Button type="submit" className="w-full bg-blue-600">Proses Transfer</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
