import { useState } from "react"
import { supabase } from "@/lib/supabase"

const API_URL = import.meta.env.VITE_API_URL || ""

export default function Archive() {
  const [info, setInfo] = useState(null)
  const [loading, setLoading] = useState(false)

  const getToken = async () => {
    const { data } = await supabase.auth.getSession()
    return data?.session?.access_token
  }

  const handleArchive = async () => {
    if (!confirm("Yakin mau arsipkan transaksi hari ini? Data di kasir akan dikosongkan setelah di-download.")) return
    setLoading(true)
    try {
      const token = await getToken()
      const res = await fetch(`${API_URL}/api/archive/run`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || "Gagal arsip")
      
      setInfo(result)
      alert(`Sukses! ${result.count} transaksi diarsip. File Excel siap download.`)
      
      // download otomatis
      window.open(`${API_URL}/api/archive/download/${result.filename}?token=${token}`, "_blank")
      
    } catch (e) {
      alert(e.message)
    }
    setLoading(false)
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">📦 Arsip Harian</h1>
      <p className="text-slate-500 mb-6">Arsipkan transaksi hari ini ke Excel & kosongkan kasir untuk besok.</p>
      
      <button 
        onClick={handleArchive} 
        disabled={loading}
        className="bg-slate-900 text-white px-6 py-3 rounded-md font-semibold hover:bg-slate-800 disabled:opacity-50"
      >
        {loading ? "Memproses..." : "Arsipkan & Download Excel Hari Ini"}
      </button>

      {info && (
        <div className="mt-6 p-4 bg-emerald-50 border border-emerald-200 rounded-md">
          <p className="font-semibold text-emerald-800">Berhasil diarsip: {info.count} transaksi</p>
          <p className="text-sm text-emerald-700">File: {info.filename}</p>
        </div>
      )}
    </div>
  )
}
