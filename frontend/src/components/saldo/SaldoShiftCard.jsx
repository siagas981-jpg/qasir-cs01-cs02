import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase/client.js"

export default function SaldoShiftCard() {
  const [saldo, setSaldo] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSaldo = async () => {
      setLoading(true)
      // ambil outlet aktif dari user yang login
      const { data: { user } } = await supabase.auth.getUser()
      let outletId = null
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("outlet_id").eq("id", user.id).maybeSingle()
        outletId = profile?.outlet_id
      }

      let q = supabase.from("saldo_saat_ini").select("jumlah, shift").order("created_at", { ascending: false }).limit(1)
      if (outletId) q = q.eq("outlet_id", outletId)

      const { data } = await q.maybeSingle()
      setSaldo(data || { jumlah: 0, shift: "Malam" })
      setLoading(false)
    }
    fetchSaldo()
  }, [])

  if (loading) return null

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
