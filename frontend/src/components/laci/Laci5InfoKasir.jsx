import { useEffect, useState, useCallback } from "react"
import { supabase } from "@/lib/supabase/client"

// 1. TERIMA outletId DARI DROPDOWN INDUK
export default function Laci5InfoKasir({ outletId }) {
  const [total, setTotal] = useState(0)
  const [rincian, setRincian] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchLaci5 = useCallback(async () => {
    // 2. KALAU BELUM PILIH OUTLET, JANGAN LOAD
    if (!outletId) { 
      setLoading(false); 
      setRincian([]);
      setTotal(0);
      return 
    }

    // 3. LANGSUNG PAKAI outletId DARI PROP (HAPUS fetch profile)
    const { data: laci } = await supabase
      .from("laci")
      .select("*")
      .eq("outlet_id", outletId)
      .order("kode", {ascending: true})
      
    if (!laci) { setLoading(false); return }
    
    const laci5 = laci.find(l => l.kode === 'LACI_5')
    if (!laci5) { 
      setRincian([]);
      setTotal(0);
      setLoading(false); 
      return 
    }

    // Ambil semua anak Laci 5, termasuk yang saldo 0 (DANA)
    const anak = laci.filter(l => l.parent_id === laci5.id)
    
    const sum = anak.reduce((s, a) => s + Number(a.saldo || 0), 0)
    setTotal(sum)
    setRincian(anak)
    setLoading(false)
  }, [outletId]) // 4. DEPENDENCY JADI outletId

  useEffect(() => {
    fetchLaci5()
    const interval = setInterval(fetchLaci5, 10000)
    return () => clearInterval(interval)
  }, [fetchLaci5])

  if (loading) return <div className="text-[10px] p-2 opacity-50">Memuat Laci 5...</div>
  if (rincian.length === 0) return null

  return (
    <div className="mt-3 border rounded-xl p-3 bg-blue-50 border-blue-200">
      <div className="flex justify-between items-center">
        <div className="text-[10px] font-bold tracking-widest text-blue-800">LACI 5 - BANK (READ-ONLY)</div>
        <div className="text-[8px] bg-blue-600 text-white px-2 py-0.5 rounded-full">SEMUA SHIFT - HANYA LIHAT</div>
      </div>
      <div className="text-lg font-black mt-1 text-blue-900">Rp {total.toLocaleString("id-ID")}</div>
      <div className="space-y-1 mt-2 pt-2 border-t border-blue-100">
        {rincian.map(bank => (
          <div key={bank.id} className="flex justify-between bg-white p-2 rounded-lg text-[11px] border border-blue-100">
            <span className="font-bold">{bank.nama}</span>
            <span className="font-black">Rp {Number(bank.saldo).toLocaleString("id-ID")}</span>
          </div>
        ))}
      </div>
      <div className="text-[9px] text-blue-400 mt-2 text-center">🔒 Tidak bisa edit. Auto update. (Termasuk saldo 0)</div>
    </div>
  )
}
