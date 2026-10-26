import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@supabase/supabase-js";
import { toast } from "sonner";

// FIX TOTAL: bikin supabase client langsung di sini, gak import dari file lain lagi!
const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

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
      const { data, error } = await supabase.from("laci").select("*").eq("outlet_id", activeOutletId).order("nama");
      if (error) throw error;
      return data || [];
    },
    enabled: !!activeOutletId,
  });

  const totalLaci5 = laciBank.reduce((acc, cur) => acc + (cur.saldo || 0), 0);

  const handleBankTx = async () => {
    if (!bankLaciId || !bankJumlah) { toast.error("Pilih bank & isi jumlah"); return; }
    setBankLoading(true);
    try {
      const jumlahNum = unformatRupiah(bankJumlah);
      const { data: freshLaci } = await supabase.from("laci").select("*").eq("id", bankLaciId).single();
      if (!freshLaci) { toast.error("Laci tidak ditemukan"); setBankLoading(false); return; }
      
      if (bankTipe === "keluar" && (freshLaci.saldo || 0) < jumlahNum) {
        toast.error(`Saldo ${freshLaci.nama} tidak cukup! Sisa ${freshLaci.saldo}`);
        setBankLoading(false); return;
      }

      const { data: userData } = await supabase.auth.getUser();
      const emailUser = userData?.user?.email || "system";
      const { data: allFresh } = await supabase.from("laci").select("*").eq("outlet_id", activeOutletId);
      const cashBank = allFresh?.find(l => (l.kode||"").toUpperCase().includes("CASHBANK"));

      await supabase.from("bank_transactions").insert({
        outlet_id: activeOutletId,
        laci_id: bankLaciId,
        shift: shift.currentShift,
        kasir_email: emailUser,
        tipe: bankTipe,
        jumlah: jumlahNum,
        keterangan: bankKet || bankTipe,
      });

      const isKhusus = ["BRI","BNI","MANDIRI","DANA"].some(k => (freshLaci.nama||"").toUpperCase().includes(k));
      if (isKhusus && cashBank) {
        await supabase.rpc("transfer_laci_atomic", {
          p_outlet_id: activeOutletId,
          p_dari_id: bankTipe === "keluar" ? freshLaci.id : cashBank.id,
          p_ke_id: bankTipe === "keluar" ? cashBank.id : freshLaci.id,
          p_dari_nama: bankTipe === "keluar" ? freshLaci.nama : cashBank.nama,
          p_ke_nama: bankTipe === "keluar" ? cashBank.nama : freshLaci.nama,
          p_jumlah: jumlahNum,
          p_email: emailUser,
        });
      } else {
        const newSaldo = bankTipe === "keluar" ? (freshLaci.saldo||0) - jumlahNum : (freshLaci.saldo||0) + jumlahNum;
        await supabase.from("laci").update({ saldo: newSaldo }).eq("id", freshLaci.id);
      }

      toast.success("Berhasil!");
      setBankJumlah(""); setBankKet(""); setBankLaciId("");
      qc.invalidateQueries({ queryKey: ["laci-bank"] });
    } catch (e) { toast.error("Gagal: " + e.message); }
    finally { setBankLoading(false); }
  };

  return (
    <div className="space-y-4 p-4">
      <div className="border border-green-200 rounded-xl p-4 bg-green-50">
        <h3 className="font-semibold text-sm mb-3">Transaksi Bank</h3>
        <select value={bankLaciId} onChange={e=>setBankLaciId(e.target.value)} className="w-full border p-2 rounded mb-2">
          <option value="">Pilih Bank</option>
          {laciBank.map(l=><option key={l.id} value={l.id}>{l.nama} - Rp {(l.saldo||0).toLocaleString("id-ID")}</option>)}
        </select>
        <select value={bankTipe} onChange={e=>setBankTipe(e.target.value)} className="w-full border p-2 rounded mb-2">
          <option value="masuk">Masuk (+)</option>
          <option value="keluar">Keluar (-)</option>
        </select>
        <input placeholder="Jumlah Rp" value={bankJumlah} onChange={e=>setBankJumlah(formatRupiahInput(e.target.value))} className="w-full border p-2 rounded mb-2" />
        <input placeholder="Keterangan" value={bankKet} onChange={e=>setBankKet(e.target.value)} className="w-full border p-2 rounded mb-3" />
        <button onClick={handleBankTx} disabled={bankLoading} className="w-full bg-green-700 text-white p-2 rounded">
          {bankLoading ? "Menyimpan..." : `Simpan ${bankTipe.toUpperCase()}`}
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {laciBank.map(l=>(
          <div key={l.id} className="border rounded-lg p-3 bg-white">
            <p className="text-[10px] text-gray-400">{l.kode}</p>
            <p className="font-bold text-sm">{l.nama}</p>
            <p className={`font-bold ${l.saldo<0?"text-red-600":"text-green-700"}`}>Rp {(l.saldo||0).toLocaleString("id-ID")}</p>
          </div>
        ))}
      </div>
      <div className="fixed bottom-4 right-4 bg-gray-900 text-white text-xs px-4 py-2 rounded-full">
        LACI 5 • Rp {totalLaci5.toLocaleString("id-ID")}
      </div>
    </div>
  );
}
