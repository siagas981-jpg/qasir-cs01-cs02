import { useState } from "react"
import { supabase } from "@/lib/supabase/client"

const API_URL = import.meta.env.VITE_API_URL || ""

function getBimonthly() {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const sm = m % 2 === 1 ? m : m-1
  const em = sm+1
  const names = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"]
  return {
    label: `${names[sm-1]}-${names[em-1]} ${y}`,
    start: `${y}-${String(sm).padStart(2,'0')}-01`,
    end: new Date(y, em, 0).toISOString().split('T')[0],
  }
}

export default function Archive() {
  const [loading,setLoading]=useState(false)
  const [errorMsg,setErrorMsg]=useState("")
  const [p]=useState(getBimonthly())

  const getToken = async () => {
    const {data}=await supabase.auth.getSession()
    return data?.session?.access_token
  }

  const doArchive = async () => {
    if(!confirm(`Arsipkan periode ${p.label}?`)) return
    setLoading(true)
    setErrorMsg("")
    try{
      const token = await getToken()
      if(!token) throw new Error("Sesi login habis, silakan logout & login lagi")

      // FIX: Kalau API_URL kosong, coba pakai relative /api
      const baseUrl = API_URL ? API_URL.replace(/\/$/, "") : ""
      const endpoint = `${baseUrl}/api/archives/run`
      
      console.log("Arsip fetch ke:", endpoint)
      
      const res = await fetch(endpoint,{
        method:"POST",
        headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},
        body:JSON.stringify({start:p.start,end:p.end,label:p.label})
      })

      // Jika response bukan OK, baca error detailnya
      if(!res.ok){
        const text = await res.text()
        let detail = text
        try { 
          const j = JSON.parse(text)
          detail = j.detail || j.error || j.message || text
        } catch {}
        throw new Error(`Server ${res.status}: ${detail}`)
      }

      // Cek apakah response adalah JSON error yang terbungkus blob
      const contentType = res.headers.get("content-type") || ""
      if(contentType.includes("application/json")){
        const j = await res.json()
        if(j.error || j.detail) throw new Error(j.detail || j.error)
      }

      const blob = await res.blob()
      if(blob.size < 100) {
        const txt = await blob.text()
        throw new Error(`File terlalu kecil / error: ${txt}`)
      }

      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href=url
      a.download=`arsip_${p.label.replace(/ /g,'_')}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      alert(`Berhasil arsip ${p.label}`)
    }catch(e){ 
      console.error("Arsip error:", e)
      setErrorMsg(e.message)
      alert(`Gagal arsip: ${e.message}\n\nCek Console F12 untuk detail`)
    }
    setLoading(false)
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold">📦 Arsip 2 Bulanan</h1>
      <p className="text-slate-500 my-2">Periode: <b className="text-slate-900">{p.label}</b> ({p.start} s/d {p.end})</p>
      <p className="text-xs text-slate-400 mb-4">Otomatis arsip tiap akhir Feb, Apr, Jun, Agu, Okt, Des</p>
      
      {!API_URL && (
        <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
          ⚠️ VITE_API_URL belum di-set di Vercel! Saat ini pakai relative URL. Pastikan backend ada di /api
        </div>
      )}

      {errorMsg && (
        <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded text-sm text-rose-700 font-mono whitespace-pre-wrap">
          Error: {errorMsg}
        </div>
      )}

      <button onClick={doArchive} disabled={loading} className="bg-slate-900 text-white px-6 py-3 rounded-md font-semibold disabled:opacity-50">
        {loading?"Memproses...":`Arsipkan & Download Excel ${p.label}`}
      </button>

      <div className="mt-6 text-xs text-slate-400">
        <p>API: {API_URL ? `${API_URL}/api/archives/run` : "/api/archives/run (relative)"}</p>
        <p>Buka F12 - Console untuk lihat detail fetch</p>
      </div>
    </div>
  )
}
