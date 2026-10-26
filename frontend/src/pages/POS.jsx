  const handleBankTx = async () => {
    if (!bankLaciId || !bankJumlah) { toast.error("Pilih bank & isi jumlah"); return; }
    setBankLoading(true);
    try {
      const nowShift = shift?.currentShift || shift?.shiftName || "MALAM";
      const jumlahNum = unformatRupiah(bankJumlah);
      const selectedLaci = laciBank.find((b) => b.id === bankLaciId);
      if (!selectedLaci) { toast.error("Bank tidak ditemukan"); return; }

      const KHUSUS_AUTO_CASHBANK = ['BRI', 'BNI', 'MANDIRI', 'DANA', 'BUKU AGEN'];
      const namaUpper = (selectedLaci.nama || "").toUpperCase();
      const isKhususBank = KHUSUS_AUTO_CASHBANK.some(k => namaUpper.includes(k));
      
      const cashBankLaci = laciBank.find(l => {
        const n = (l.nama || "").toUpperCase();
        const k = (l.kode || "").toUpperCase();
        return k === "LACI_5_CASHBANK" || k.includes("CASHBANK") || (n.includes("CASH") && n.includes("BANK"));
      });

      if (bankTipe === "masuk" && isKhususBank && cashBankLaci && (cashBankLaci.saldo || 0) < jumlahNum) {
        toast.error(`Saldo CASH BANK tidak cukup! Sisa Rp ${Number(cashBankLaci.saldo).toLocaleString()}`);
        setBankLoading(false);
        return;
      }

      // 1. SIMPAN KE BANK TRANSACTIONS DULU
      const { error } = await supabase.from("bank_transactions").insert({
        outlet_id: activeOutletId,
        laci_id: bankLaciId,
        shift: nowShift,
        kasir_email: user?.email,
        tipe: bankTipe,
        jumlah: jumlahNum,
        keterangan: bankKet || (bankTipe + " " + (selectedLaci?.nama || "")),
      });
      if (error) throw error;

      // 2. UPDATE SALDO PAKAI RPC ATOMIK (BIAR MASUK RIWAYAT TRANSFER_LACI JUGA)
      if (isKhususBank && cashBankLaci && cashBankLaci.id !== selectedLaci.id) {
        if (bankTipe === "keluar") {
          // BRI KELUAR -> CASH BANK MASUK
          const { error: rpcErr } = await supabase.rpc('transfer_laci_atomic', {
            p_outlet_id: activeOutletId,
            p_dari_id: selectedLaci.id,
            p_ke_id: cashBankLaci.id,
            p_dari_nama: selectedLaci.nama,
            p_ke_nama: cashBankLaci.nama,
            p_jumlah: jumlahNum,
            p_email: user?.email
          });
          if (rpcErr) throw rpcErr;
          toast.success(`AUTO: ${selectedLaci.nama} KELUAR -> CASH BANK +Rp ${bankJumlah}`);
        } else {
          // MASUK: CASH BANK KELUAR -> BRI MASUK
          const { error: rpcErr } = await supabase.rpc('transfer_laci_atomic', {
            p_outlet_id: activeOutletId,
            p_dari_id: cashBankLaci.id,
            p_ke_id: selectedLaci.id,
            p_dari_nama: cashBankLaci.nama,
            p_ke_nama: selectedLaci.nama,
            p_jumlah: jumlahNum,
            p_email: user?.email
          });
          if (rpcErr) throw rpcErr;
          toast.success(`AUTO: CASH BANK -> ${selectedLaci.nama} +Rp ${bankJumlah}`);
        }
      } else {
        // BANK BIASA - UPDATE MANUAL TAPI SUDAH ADA BANK_TRANSACTIONS
        const newSaldo = bankTipe === "keluar" ? (selectedLaci.saldo||0) - jumlahNum : (selectedLaci.saldo||0) + jumlahNum;
        const { error: e1 } = await supabase.from("laci").update({ saldo: newSaldo }).eq("id", selectedLaci.id);
        if (e1) throw e1;
        toast.success(`Transaksi ${bankTipe} ${selectedLaci.nama} Rp ${bankJumlah} berhasil!`);
      }

      setBankJumlah(""); setBankKet(""); setBankLaciId("");
      qc.invalidateQueries({ queryKey: ["laci-bank"] });
      qc.invalidateQueries({ queryKey: ["riwayat-transfer-laci-final"] });
      qc.invalidateQueries({ queryKey: ["riwayat-transfer"] });
      qc.invalidateQueries({ queryKey: ["laci-all"] });
    } catch (e) {
      console.error(e);
      toast.error("Gagal: " + e.message);
    } finally { setBankLoading(false); }
  };
