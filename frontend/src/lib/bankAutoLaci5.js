import { supabase } from "./supabase/client";

// BANK YANG KENA AUTO LACI 5
const BANK_AUTO = ["bri", "bni", "mandiri", "dana", "buku_agen"];

// KATA KUNCI YANG BIKIN AUTO MATI (WAJIB MANUAL)
const BLOCK_KEYWORDS = ["admin", "ditransfer", "admin ditransfer"];

const isBlocked = (keterangan) => {
  if (!keterangan) return false;
  const lower = keterangan.toLowerCase();
  return BLOCK_KEYWORDS.some(word => lower.includes(word));
};

export const createBankTransaction = async ({ outlet_id, bank_type, type_transaksi, amount, keterangan }) => {
  const now = new Date().toISOString();
  
  // 1. CEK APAKAH KENA BLOCK
  if (isBlocked(keterangan)) {
    // Simpan transaksi TANPA auto laci 5
    const { data, error } = await supabase.from("bank_transactions").insert([{
      outlet_id,
      bank_type: bank_type.toLowerCase(),
      type: type_transaksi, // masuk / keluar
      amount,
      keterangan,
      is_auto_laci5: false,
      created_at: now
    }]).select().single();
    
    // Tetap simpan riwayat
    await supabase.from("riwayat_transaksi_bank").insert([{
      bank_transaction_id: data?.id,
      outlet_id,
      aksi: `TRANSAKSI BANK ${bank_type.toUpperCase()} ${type_transaksi.toUpperCase()} MANUAL (keterangan: ${keterangan}) - DIBLOCK AUTO`,
      amount,
      created_at: now
    }]);
    
    return { success: true, auto: false, message: "Keterangan mengandung admin/ditransfer, auto dimatikan, wajib manual" };
  }

  // 2. CEK APAKAH BANK TERMASUK AUTO
  if (!BANK_AUTO.includes(bank_type.toLowerCase())) {
    throw new Error("Bank tidak termasuk auto");
  }

  // 3. SIMPAN TRANSAKSI BANK
  const { data: trx, error: trxError } = await supabase.from("bank_transactions").insert([{
    outlet_id,
    bank_type: bank_type.toLowerCase(),
    type: type_transaksi,
    amount,
    keterangan,
    is_auto_laci5: true,
    created_at: now
  }]).select().single();

  if (trxError) throw trxError;

  // 4. LOGIKA AUTO LACI 5 (CASH BANK) - INI INTINYA OWY
  // Ambil saldo laci 5 sekarang
  const { data: laci5 } = await supabase.from("laci").select("*").eq("outlet_id", outlet_id).eq("nama_laci", "laci_5_cash_bank").single();
  let saldoBaru = laci5?.saldo || 0;

  if (type_transaksi === "keluar") {
    // KELUAR DARI BANK -> LACI 5 BERTAMBAH
    saldoBaru += amount;
  } else if (type_transaksi === "masuk") {
    // MASUK KE BANK -> LACI 5 BERKURANG
    saldoBaru -= amount;
  }

  // Update laci 5
  await supabase.from("laci").update({ saldo: saldoBaru, updated_at: now }).eq("id", laci5.id);

  // 5. SIMPAN RIWAYAT LENGKAP REAL TIME - WAJIB ADA
  // Riwayat Bank
  await supabase.from("riwayat_transaksi_bank").insert([{
    bank_transaction_id: trx.id,
    outlet_id,
    bank_type: bank_type.toLowerCase(),
    type: type_transaksi,
    aksi: `AUTO LACI 5: ${type_transaksi.toUpperCase()} ${bank_type.toUpperCase()} Rp ${amount.toLocaleString()} -> Laci 5 Cash Bank jadi Rp ${saldoBaru.toLocaleString()}`,
    amount,
    saldo_laci5_setelah: saldoBaru,
    keterangan,
    created_at: now
  }]);

  // Riwayat Laci 2 & Laci 5 (untuk transfer laci 2 juga)
  await supabase.from("riwayat_laci").insert([{
    outlet_id,
    laci_asal: "BANK_" + bank_type.toUpperCase(),
    laci_tujuan: "LACI_5_CASH_BANK",
    type: type_transaksi === "keluar" ? "TAMBAH" : "KURANG",
    amount,
    saldo_setelah: saldoBaru,
    keterangan: `Auto dari transaksi bank ${bank_type} ${type_transaksi} ${keterangan || ""}`,
    created_at: now
  }]);

  return { success: true, auto: true, saldoBaru, trx };
};

// UNTUK TRANSFER LACI 2 - WAJIB RIWAYAT REAL TIME
export const transferLaci2 = async ({ outlet_id, dari_laci, ke_laci, amount, keterangan }) => {
  const now = new Date().toISOString();
  
  // ... logic transfer kamu yang lama ...
  
  // WAJIB SIMPAN RIWAYAT
  await supabase.from("riwayat_laci").insert([{
    outlet_id,
    laci_asal: dari_laci,
    laci_tujuan: ke_laci,
    type: "TRANSFER",
    amount,
    keterangan,
    created_at: now
  }]);
  
  await supabase.from("riwayat_transaksi_bank").insert([{
    outlet_id,
    aksi: `TRANSFER LACI 2: ${dari_laci} -> ${ke_laci} Rp ${amount.toLocaleString()}`,
    amount,
    created_at: now
  }]);
};
