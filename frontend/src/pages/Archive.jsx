import { useState } from "react"

const API_URL = import.meta.env.VITE_API_URL || "" // kosong = pakai domain vercel yang sama

export default function Archive() {
  const [info, setInfo] = useState(null)
  const [loading, setLoading] = useState(false)

  const getToken = async () => {
    // ambil token dari supabase session
    const { supabase } = await import("../lib/supabase") // sesuaikan path supabase kamu
    const { data } = await supabase.auth.getSession()
    return data?.session?.access_token
  }

  const preview = async () => {
    setLoading(true)
    try {
      const token = await getToken()
      const res = await fetch(`${API_URL}/api/archives/preview?days=60`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      const json = await res.json()
      setInfo(json)
    } catch(e) { alert(e.message) }
    setLoading(false)
  }

  const download = async (hapus = false) => {
    if(!confirm(hapus ? "Download & HAPUS data lama dari database? Pastikan sudah backup!" : "Download Excel arsip 2 bulanan?")) return
    setLoading(true)
    try {
      const token = await getToken()
      const res = await fetch(`${API_URL}/api/archives/run?days=60&delete_original=${hapus}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      })
      if(!res.ok) {
        const err = await res.json()
        alert(err.detail || "Gagal")
        return
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `arsip_2bulan_${new Date().toISOString().slice(0,10)}.xlsx`
      a.click()
    } catch(e) { alert(e.message) }
    setLoading(false)
  }

  return (
    <div style={{padding:20, maxWidth:600}}>
      <h2 style={{fontWeight:'bold', fontSize:22}}>📦 Arsip Transaksi 2 Bulanan</h2>
      <p style={{color:'#666', marginTop:8}}>Transaksi lebih dari 60 hari otomatis dipindah ke Excel biar database tidak berat.</p>
      
      <div style={{display:'flex', gap:10, marginTop:20}}>
        <button onClick={preview} disabled={loading} style={{padding:'10px 16px', background:'#000', color:'#fff', borderRadius:8}}>
          {loading ? "..." : "1. Preview"}
        </button>
        <button onClick={()=>download(false)} disabled={loading} style={{padding:'10px 16px', background:'#16a34a', color:'#fff', borderRadius:8}}>
          2. Download Excel
        </button>
        <button onClick={()=>download(true)} disabled={loading} style={{padding:'10px 16px', background:'#dc2626', color:'#fff', borderRadius:8}}>
          3. Arsip & Hapus
        </button>
      </div>

      {info && (
        <div style={{marginTop:20, background:'#f5f5f5', padding:16, borderRadius:12}}>
          <pre style={{fontSize:13, whiteSpace:'pre-wrap'}}>{JSON.stringify(info, null, 2)}</pre>
        </div>
      )}

      <div style={{marginTop:30, fontSize:12, color:'#888'}}>
        Otomatis tiap 2 bulan: Atur Vercel Cron ke POST /api/archives/run?days=60
      </div>
    </div>
  )
}
