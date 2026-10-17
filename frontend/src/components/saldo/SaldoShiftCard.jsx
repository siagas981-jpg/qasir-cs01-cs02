import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase/client.js"

export default function SaldoShiftCard() {
  const [saldo, setSaldo] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSaldo = async () => {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      let outletId = null
      if (user) {
        const { data: profile } = await supabase.from("profiles").select("outlet_id").eq("id", user.id).maybeSingle()
        outletId = profile?.outlet_id
      }

      if (!outletId) { setLoading(false); return }

      // FIX: Ambil langsung dari Laci 1, bukan dari view saldo_saat_ini yang masih 0
      const { data: laci1 } = await supabase.from("laci").select("saldo, nama").eq("outlet_id", outletId).eq("kode", "LACI_1").maybeSingle()
      
      // Kalau mau shift nya dinamis, ambil dari shifts aktif
      const { data: shiftAktif } = await supabase.from("shifts").select("shift").eq("outlet_id", outletId).eq("status", "aktif").order("created_at", {ascending: false}).limit(1).maybeSingle()

      setSaldo({ 
        jumlah: laci1?.saldo || 0, 
        shift: shiftAktif?.shift || "Malam" 
      })
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
