import { useState } from "react"
import { supabase } from "@/lib/supabase/client"

const API_URL = import.meta.env.VITE_API_URL || ""

export default function Archive() {
  const [loading, setLoading] = useState(false)

  const getToken = async () => {
    const { data } = await supabase.auth.getSession()
    return data?.session?.access_token
  }

  const handleArchive = async () => {
    if (!confirm("Yakin mau arsipkan transaksi hari ini? Data kasir akan dikosongkan.")) return
    setLoading(true)
    try {
      const token = await getToken()
      const res = await fetch(`${API_URL}/api/archive/run`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      alert(`Sukses! ${json.count} transaksi diarsip.`)
      window.open(`${API_URL}/api/archive/download/${json.filename}?token=${token}`, "_blank")
    } catch (e) {
      alert(e.message)
    }
    setLoading(false)
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">📦 Arsip Harian</h1>
      <p className="text-slate-500 mb-6">Arsipkan transaksi hari ini ke Excel & kosongkan untuk besok.</p>
      <button onClick={handleArchive} disabled={loading} className="bg-slate-900 text-white px-6 py-3 rounded-md font-semibold">
        {loading ? "Memproses..." : "Arsipkan & Download Excel Hari Ini"}
      </button>
    </div>
  )
}
