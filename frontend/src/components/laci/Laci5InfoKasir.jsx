import { useEffect, useState, useCallback } from "react"
import { supabase } from "@/lib/supabase/client"

export default function Laci5InfoKasir({ outletId }) {
  const [total, setTotal] = useState(0)
  const [rincian, setRincian] = useState([])
  const [open, setOpen] = useState(false)

  const fetchLaci5 = useCallback(async () => {
    if (!outletId) return
    const { data: laci } = await supabase.from("laci").select("*").eq("outlet_id", outletId).order("kode")
    if (!laci || laci.length === 0) {
      setTotal(0); setRincian([]); return
    }
    const laci5 = laci.find((l) => l.kode === "LACI_5")
    if (!laci5) { setTotal(0); setRincian([]); return }
    const anak = laci.filter((l) => l.parent_id === laci5.id || l.kode?.startsWith("LACI_5_"))
    setTotal(anak.reduce((s, a) => s + Number(a.saldo || 0), 0))
    setRincian(anak)
  }, [outletId])

  useEffect(() => {
    fetchLaci5()
    const interval = setInterval(fetchLaci5, 8000)
    return () => clearInterval(interval)
  }, [fetchLaci5])

  if (rincian.length === 0) return null

  return (
    <>
      {/* Tombol Floating - ENAK DIPANDANG */}
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white rounded-full px-4 py-2.5 text-[11px] font-bold flex items-center gap-2 shadow-lg hover:bg-black transition-all"
      >
        <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
        LACI 5 • Rp {total.toLocaleString("id-ID")}
        <span className="opacity-60">{open ? "▼" : "▲"}</span>
      </button>

      {/* Panel - VERSI SEDANG 3 KOLOM ENAK */}
      {open && (
        <div className="fixed bottom-[70px] right-5 z-50 w-[380px] bg-white border border-slate-200 rounded-xl shadow-[0_16px_40px_rgba(0,0,0,0.12)] p-3">
          <div className="flex justify-between items-center mb-2.5">
            <h3 className="text-[11px] font-bold tracking-wide">LACI 5 - BANK • Laci ({rincian.length})</h3>
            <span className="text-[8px] bg-slate-100 px-2 py-0.5 rounded-full font-bold">READ-ONLY</span>
          </div>
          <div className="font-black text-[15px] mb-2.5">Rp {total.toLocaleString("id-ID")}</div>
          
          {/* INI KUNCINYA - 3 KOLOM SEDANG ENAK DIPANDANG */}
          <div className="grid grid-cols-3 gap-2">
            {rincian.map((bank) => (
              <div key={bank.id} className="bg-slate-50 rounded-lg p-2 border">
                <div className="text-[8px] text-slate-500 font-bold uppercase truncate leading-none">{bank.kode?.replace('LACI_5_','')}</div>
                <div className="text-[10px] font-bold truncate mt-1 leading-tight">{bank.nama}</div>
                <div className="text-[11px] font-black mt-0.5">Rp {Number(bank.saldo||0).toLocaleString("id-ID")}</div>
              </div>
            ))}
          </div>
          <div className="text-[9px] text-slate-400 mt-2.5 text-center">Auto update 8 detik • Semua Shift</div>
        </div>
      )}
    </>
  )
}
