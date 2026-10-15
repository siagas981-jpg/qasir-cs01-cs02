import { useEffect, useState } from "react"
import { createClient } from "../../lib/supabaseClient" // sesuaikan kalau beda

export default function SaldoShiftCard({ outletId }) {
  const [saldo, setSaldo] = useState(null)

  useEffect(() => {
    const supabase = createClient()
    const fetchSaldo = async () => {
      const { data } = await supabase.from("saldo_saat_ini")
       .select("jumlah, shift")
       .eq("outlet_id", outletId)
       .order("created_at", { ascending: false })
       .limit(1).single()
      setSaldo(data || { jumlah: 0, shift: "Malam" })
    }
    if(outletId) fetchSaldo()
  }, [outletId])

  if(!saldo) return <div className="p-3 bg-gray-100 rounded">Memuat saldo...</div>

  return (
    <div className="p-3 mb-3 rounded-xl bg-slate-900 text-white">
      <div className="flex justify-between text-xs opacity-70">
        <span>SALDO SHIFT: {saldo.shift}</span>
        <span>{new Date().toLocaleDateString("id-ID")}</span>
      </div>
      <div className="text-2xl font-bold mt-1">Rp {Number(saldo.jumlah).toLocaleString("id-ID")}</div>
    </div>
  )
}
