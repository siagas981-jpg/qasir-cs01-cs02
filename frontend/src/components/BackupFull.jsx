import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase/client";
import { toast } from "sonner";
import * as XLSX from "xlsx";

export default function BackupFull({ outletId }) {
  const [loading, setLoading] = useState(false);

  const handleBackupFull = async () => {
    if (!outletId) return toast.error("Outlet ID kosong!");
    setLoading(true);
    toast.info("Sedang backup full... tunggu owy");

    try {
      const [laciRes, productsRes, outletsRes, banksRes, purchasesRes] = await Promise.all([
        supabase.from("laci").select("*").eq("outlet_id", outletId),
        supabase.from("products").select("*").eq("outlet_id", outletId),
        supabase.from("outlets").select("*").eq("id", outletId),
        supabase.from("outlet_banks").select("*").eq("outlet_id", outletId),
        supabase.from("purchases").select("*").eq("outlet_id", outletId).limit(2000),
      ]);

      const wb = XLSX.utils.book_new();
      if (productsRes.data?.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(productsRes.data), "PRODUCTS");
      if (laciRes.data?.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(laciRes.data), "LACI");
      if (outletsRes.data?.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(outletsRes.data), "OUTLETS");
      if (banksRes.data?.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(banksRes.data), "OUTLET_BANKS");
      if (purchasesRes.data?.length) XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(purchasesRes.data), "PURCHASES");

      const info = [
        { KETERANGAN: "Tanggal Backup", VALUE: new Date().toLocaleString("id-ID") },
        { KETERANGAN: "Total Products", VALUE: productsRes.data?.length || 0 },
        { KETERANGAN: "Total Laci", VALUE: laciRes.data?.length || 0 },
      ];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(info), "INFO");

      XLSX.writeFile(wb, `BACKUP-FULL-${productsRes.data?.length || 0}PRODUK-${new Date().toISOString().slice(0,10)}.xlsx`);
      toast.success(`SUKSES! ${productsRes.data?.length} produk ter-backup!`);
    } catch (err) {
      toast.error(`Gagal: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleBackupFull} disabled={loading} className="h-9 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4">
      {loading ? "⏳ Membackup..." : "📥 BACKUP FULL (Semua Produk)"}
    </Button>
  );
}
