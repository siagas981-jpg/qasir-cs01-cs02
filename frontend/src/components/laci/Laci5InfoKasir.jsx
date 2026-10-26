import { useEffect, useState, useCallback } from "react"
import { supabase } from "@/lib/supabase/client"

export default function Laci5InfoKasir({ outletId }) {
  const [total, setTotal] = useState(0)
  const [rincian, setRincian] = useState([])
  const [open, setOpen] = useState(false)

  const fetchLaci5 = useCallback(async () => {
    if (!outletId) return
    const { data: laci } = await supabase.from("laci").select("*").eq("outlet_id", outletId).order("kode")
    if (!laci) return
    const anak = laci.filter(l => l.kode?.startsWith("LACI_5_"))
    const totalHitung = anak.reduce((s, a) => s + Number(a.saldo || 0), 0)
    setTotal(totalHitung)
    setRincian(anak)
  }, [outletId])

  useEffect(() => {
    fetchLaci5()
    const interval = setInterval(fetchLaci5, 10000)
    return () => clearInterval(interval)
  }, [fetchLaci5])

  if (rincian.length === 0) return null

  return (
    <>
      <button onClick={() => setOpen(!open)}
        className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white rounded-full px-4 py-2.5 text-[11px] font-bold flex items-center gap-2 shadow-lg">
        <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
        LACI 5 • Rp {total.toLocaleString("id-ID")} {open ? "▲" : "▼"}
      </button>
      {open && (
        <div className="fixed bottom-[70px] right-5 z-50 w-[380px] bg-white border rounded-xl shadow-xl p-3">
          <div className="font-black text-[16px] mb-3">Rp {total.toLocaleString("id-ID")}</div>
          <div className="grid grid-cols-3 gap-2">
            {rincian.map((b) => (
              <div key={b.id} className="bg-slate-50 rounded-lg p-2 border">
                <div className="text-[8px] text-slate-400 font-bold truncate">{b.kode?.replace('LACI_5_','')}</div>
                <div className="text-[10px] font-bold truncate">{b.nama}</div>
                <div className="text-[11px] font-black">Rp {Number(b.saldo||0).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
