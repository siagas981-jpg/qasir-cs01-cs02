import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase/client"

const API_URL = import.meta.env.VITE_API_URL || ""

function getCurrentBimonthly() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1 // 1-12
  const startMonth = month % 2 === 1 ? month : month - 1
  const endMonth = startMonth + 1
  const months = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"]
  return {
    label: `${months[startMonth-1]}-${months[endMonth-1]} ${year}`,
    start: `${year}-${String(startMonth).padStart(2,'0')}-01`,
    end: new Date(year, endMonth, 0).toISOString().split('T')[0],
    filename: `arsip_${year}_${String(startMonth).padStart(2,'0')}-${String(endMonth).padStart(2,'0')}.xlsx`
  }
}

export default function Archive() {
  const [loading, setLoading] = useState(false)
  const [period, setPeriod] = useState(getCurrentBimonthly())

  const getToken = async () => {
    const { data } = await supabase.auth.getSession()
    return data?.session?.access_token
  }

  const handleArchive = async () => {
    if (!confirm(`Yakin arsipkan transaksi periode ${period.label}? Setelah diarsip, laporan periode ini akan dikosongkan untuk periode baru.`)) return
    setLoading(true)
    try {
      const token = await getToken()
      const res = await fetch(`${API_URL}/api/archive/run`, {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ start: period.start, end: period.end, label: period.label })
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      alert(`Sukses! ${json.count} transaksi periode ${period.label} diarsip.`)
      if (json.filename) {
        window.open(`${API_URL}/api/archive/download/${json.filename}?token=${token}`, "_blank")
      }
    } catch (e) {
      alert(e.message)
    }
    setLoading(false)
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">📦 Arsip 2 Bulanan</h1>
      <p className="text-slate-500 mb-2">Periode saat ini: <span className="font-bold text-slate-900">{period.label}</span></p>
      <p className="text-slate-500 mb-6 text-sm">Sistem akan otomatis mengarsipkan tiap akhir periode (Feb, Apr, Jun, Agu, Okt, Des) ke Excel dan mengosongkan data untuk periode baru.</p>
      
      <div className="bg-white border rounded-lg p-4 mb-6">
        <div className="flex justify-between items-center">
          <div>
            <p className="font-semibold">{period.label}</p>
            <p className="text-xs text-slate-500">{period.start} s/d {period.end}</p>
          </div>
          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-bold">Periode Aktif</span>
        </div>
      </div>

      <button onClick={handleArchive} disabled={loading} className="bg-slate-900 text-white px-6 py-3 rounded-md font-semibold w-full sm:w-auto">
        {loading ? "Memproses..." : `Arsipkan & Download Excel ${period.label}`}
      </button>

      <p className="text-xs text-slate-400 mt-4">*File Excel: {period.filename}</p>
    </div>
  )
}
