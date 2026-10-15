import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase/client.js"

export default function SaldoShiftCard({ outletId }) {
  const [saldo, setSaldo] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSaldo = async () => {
      setLoading(true)
      const { data } = await supabase
       .from("saldo_saat_ini")
       .select("jumlah, shift")
       .eq("outlet_id", outletId)
       .order("created_at", { ascending: false })
       .limit(1)
       .maybeSingle()

      setSaldo(data || { jumlah: 0, shift: "Malam" })
      setLoading(false)
    }
    if (outletId) fetchSaldo()
  }, [outletId])

  if (loading) return <div className="p-3 bg-gray-100 rounded-lg text-sm">Memuat saldo...</div>

  return (
    <div className="p-3 mb-3 rounded-xl bg-slate-900 text-white">
      <div className="flex justify-between text-[11px] opacity-70 tracking-widest">
        <span>SALDO SHIFT: {saldo.shift}</span>
        <span>{new Date().toLocaleDateString("id-ID")}</span>
      </div>
      <div className="text-2xl font-bold mt-1">Rp {Number(saldo.jumlah).toLocaleString("id-ID")}</div>
    </div>
  )
}
