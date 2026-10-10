import { createClient } from '@supabase/supabase-js';
import * as XLSX from 'xlsx';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

export default async function handler(req, res) {
  // Biar hanya Vercel Cron yang bisa akses
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const twoMonthsAgo = new Date();
  twoMonthsAgo.setDate(twoMonthsAgo.getDate() - 60);

  // 1. Ambil transaksi lama
  const { data: oldData, error } = await supabase
    .from('transactions')
    .select('*')
    .lt('created_at', twoMonthsAgo.toISOString());

  if (error) return res.status(500).json({ error: error.message });
  if (!oldData || oldData.length === 0) {
    return res.status(200).json({ message: 'Tidak ada data lama untuk diarsip' });
  }

  // 2. Bikin Excel
  const ws = XLSX.utils.json_to_sheet(oldData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Arsip');
  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const fileName = `arsip-transaksi-${new Date().toISOString().slice(0,7)}.xlsx`;

  // 3. Upload ke Supabase Storage folder arsip
  const { error: uploadError } = await supabase.storage
    .from('arsips')
    .upload(fileName, buffer, { contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

  if (uploadError) return res.status(500).json({ error: uploadError.message });

  // 4. Pindah ke tabel archive lalu hapus di tabel utama
  await supabase.from('transactions_archive').insert(oldData);
  await supabase.from('transactions').delete().lt('created_at', twoMonthsAgo.toISOString());

  return res.status(200).json({ message: `Berhasil arsip ${oldData.length} transaksi ke ${fileName}` });
}
