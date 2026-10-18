import { useEffect, useState, useCallback } from "react"
import { supabase } from "@/lib/supabase/client"

export default function Laci5InfoKasir({ outletId }) {
  const [total, setTotal] = useState(0)
  const [rincian, setRincian] = useState([])
  const [open, setOpen] = useState(false) // untuk floating

  const fetchLaci5 = useCallback(async () => {
    if (!outletId) return
    const { data: laci } = await supabase.from("laci").select("*").eq("outlet_id", outletId).order("kode")
    if (!laci) return
    const laci5 = laci.find((l) => l.kode === "LACI_5")
    if (!laci5) return
    const anak = laci.filter((l) => l.parent_id === laci5.id)
    setTotal(anak.reduce((s, a) => s + Number(a.saldo || 0), 0))
    setRincian(anak)
  }, [outletId])

  useEffect(() => {
    fetchLaci5()
    const interval = setInterval(fetchLaci5, 5000)
    return () => clearInterval(interval)
  }, [fetchLaci5])

  if (rincian.length === 0) return null

  return (
    <>
      {/* Tombol Floating Kecil */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 bg-white/90 backdrop-blur-xl border border-white/50 shadow-[0_8px_32px_rgba(0,0,0,0.12)] rounded-full px-5 py-3 text-xs font-bold flex items-center gap-2 hover:scale-105 transition-all"
      >
        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
        LACI 5 • Rp {total.toLocaleString("id-ID")} 
        <span className="text-[10px] ml-1">{open ? "▼" : "▲"}</span>
      </button>

      {/* Panel Melayang Elegan */}
      {open && (
        <div className="fixed bottom-20 right-6 z-50 w-[340px] bg-white/80 backdrop-blur-2xl border border-white/60 rounded-[20px] shadow-[0_20px_60px_rgba(0,0,0,0.15)] p-4 animate-in slide-in-from-bottom-2">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-[11px] font-black tracking-widest text-slate-700">LACI 5 - BANK (READ-ONLY)</h3>
            <span className="text-[8px] bg-slate-900 text-white px-2 py-1 rounded-full">SEMUA SHIFT</span>
          </div>
          <div className="text-xl font-black text-slate-900 mb-3">Rp {total.toLocaleString("id-ID")}</div>
          <div className="grid grid-cols-2 gap-2">
            {rincian.map((bank) => (
              <div key={bank.id} className="bg-white rounded-xl p-3 border border-slate-100 shadow-sm">
                <div className="text-[9px] text-slate-400 font-bold tracking-wide">{bank.nama}</div>
                <div className="text-[12px] font-black mt-1">Rp {Number(bank.saldo).toLocaleString("id-ID")}</div>
              </div>
            ))}
          </div>
          <div className="text-[9px] text-slate-400 mt-3 text-center">🔒 Auto update setiap 5 detik</div>
        </div>
      )}
    </>
  )
}
