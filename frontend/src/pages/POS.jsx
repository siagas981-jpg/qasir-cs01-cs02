import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";

export default function Laci5InfoKasir() {
  const activeOutletId = localStorage.getItem("active_outlet_id") || "87aab4db-13a9-4fed-b00c-495fbdb46965";
  const shift = { currentShift: "SHIFT_1", shiftName: "SHIFT_1" };
  const qc = useQueryClient();

  const [bankLaciId, setBankLaciId] = useState("");
  const [bankTipe, setBankTipe] = useState("masuk");
  const [bankJumlah, setBankJumlah] = useState("");
  const [bankKet, setBankKet] = useState("");
  const [bankLoading, setBankLoading] = useState(false);

  const unformatRupiah = (val) => {
    if (!val) return 0;
    return parseInt(val.toString().replace(/[^0-9]/g, "")) || 0;
  };

  const formatRupiahInput = (val) => {
    const num = unformatRupiah(val);
    return num.toLocaleString("id-ID");
  };

  const { data: laciBank = [] } = useQuery({
    queryKey: ["laci-bank", activeOutletId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("laci")
        .select("*")
        .eq("outlet_id", activeOutletId)
        .order("nama", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeOutletId,
  });

  const totalLaci5 = laciBank.reduce((acc, cur) => acc + (cur.saldo || 0), 0);

  const handleBankTx = async () => {
    if (!bankLaciId || !bankJumlah) {
      toast.error("Pilih bank & isi jumlah");
      return;
    }
    setBankLoading(true);
    try {
      const jumlahNum = unformatRupiah(bankJumlah);
      if (jumlahNum <= 0) {
        toast.error("Jumlah harus > 0");
        setBankLoading(false);
        return;
      }

      const { data: freshLaci, error: freshErr } = await supabase
        .from("laci")
        .select("*")
        .eq("id", bankLaciId)
        .single();

      if (freshErr || !freshLaci) {
        toast.error("Bank tidak ditemukan di DB");
        setBankLoading(false);
        return;
      }
      const selectedLaci = freshLaci;

      const KHUSUS_AUTO_CASHBANK = ["BRI", "BNI", "MANDIRI", "DANA", "BUKU AGEN"];
      const namaUpper = (selectedLaci.nama || "").toUpperCase();
      const isKhususBank = KHUSUS_AUTO_CASHBANK.some((k) => namaUpper.includes(k));

      const { data: allLaciFresh } = await supabase.from("laci").select("*").eq("outlet_id", activeOutletId);
      const cashBankLaci = allLaciFresh?.find((l) => {
        const n = (l.nama || "").toUpperCase();
        const k = (l.kode || "").toUpperCase();
        return k === "LACI_5_CASHBANK" || k.includes("CASHBANK") || (n.includes("CASH") && n.includes("BANK"));
      });

      if (bankTipe === "keluar" && (selectedLaci.saldo || 0) < jumlahNum) {
        toast.error(`Saldo ${selectedLaci.nama} tidak cukup! Sisa Rp ${Number(selectedLaci.saldo || 0).toLocaleString("id-ID")}`);
        setBankLoading(false);
        return;
      }

      const { data: userData } = await supabase.auth.getUser();
      const emailUser = userData?.user?.email || "system";

      const { error } = await supabase.from("bank_transactions").insert({
        outlet_id: activeOutletId,
        laci_id: bankLaciId,
        shift: shift.currentShift,
        kasir_email: emailUser,
        tipe: bankTipe,
        jumlah: jumlahNum,
        keterangan: bankKet || bankTipe + " " + (selectedLaci?.nama || ""),
      });
      if (error) throw error;

      if (isKhususBank && cashBankLaci && cashBankLaci.id !== selectedLaci.id) {
        const { error: rpcErr } = await supabase.rpc("transfer_laci_atomic", {
          p_outlet_id: activeOutletId,
          p_dari_id: bankTipe === "keluar" ? selectedLaci.id : cashBankLaci.id,
          p_ke_id: bankTipe === "keluar" ? cashBankLaci.id : selectedLaci.id,
          p_dari_nama: bankTipe === "keluar" ? selectedLaci.nama : cashBankLaci.nama,
          p_ke_nama: bankTipe === "keluar" ? cashBankLaci.nama : selectedLaci.nama,
          p_jumlah: jumlahNum,
          p_email: emailUser,
        });
        if (rpcErr) throw rpcErr;
      } else {
        const newSaldo = bankTipe === "keluar" ? (selectedLaci.saldo || 0) - jumlahNum : (selectedLaci.saldo || 0) + jumlahNum;
        await supabase.from("laci").update({ saldo: newSaldo }).eq("id", selectedLaci.id);
      }

      toast.success("Berhasil!");
      setBankJumlah(""); setBankKet(""); setBankLaciId("");
      qc.invalidateQueries({ queryKey: ["laci-bank"] });
    } catch (e) {
      toast.error("Gagal: " + e.message);
    } finally {
      setBankLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="border border-green-200 rounded-xl p-4 bg-green-50/50">
        <h3 className="font-semibold text-sm mb-3">Transaksi Bank (Auto Saldo Laci 5)</h3>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <Select value={bankLaciId} onValueChange={setBankLaciId}>
            <SelectTrigger><SelectValue placeholder="Pilih Bank" /></SelectTrigger>
            <SelectContent>
              {laciBank.map((l) => (
                <SelectItem key={l.id} value={l.id}>{l.nama} - Rp {(l.saldo || 0).toLocaleString("id-ID")}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={bankTipe} onValueChange={setBankTipe}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="masuk">Masuk (+)</SelectItem>
              <SelectItem value="keluar">Keluar (-)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Input placeholder="Jumlah Rp" value={bankJumlah} onChange={(e) => setBankJumlah(formatRupiahInput(e.target.value))} className="mb-2" />
        <Input placeholder="Keterangan" value={bankKet} onChange={(e) => setBankKet(e.target.value)} className="mb-3" />
        <Button onClick={handleBankTx} disabled={bankLoading} className="w-full bg-green-700 text-white">
          {bankLoading ? "Menyimpan..." : `Simpan ${bankTipe.toUpperCase()}`}
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {laciBank.map((l) => (
          <div key={l.id} className="border rounded-lg p-3 bg-white">
            <p className="text-[10px] text-gray-400">{l.kode}</p>
            <p className="font-bold text-sm">{l.nama}</p>
            <p className={`font-bold ${l.saldo < 0 ? "text-red-600" : "text-green-700"}`}>Rp {(l.saldo || 0).toLocaleString("id-ID")}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
