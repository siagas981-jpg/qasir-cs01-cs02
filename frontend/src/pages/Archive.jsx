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
  const [p]=useState(getBimonthly())

  const getToken = async () => {
    const {data}=await supabase.auth.getSession()
    return data?.session?.access_token
  }

  const doArchive = async () => {
    if(!confirm(`Arsipkan periode ${p.label}?`)) return
    setLoading(true)
    try{
      const token = await getToken()
      const res = await fetch(`${API_URL}/api/archives/run`,{
        method:"POST",
        headers:{Authorization:`Bearer ${token}`,"Content-Type":"application/json"},
        body:JSON.stringify({start:p.start,end:p.end,label:p.label})
      })
      if(!res.ok){
        const j=await res.json().catch(()=>({error:"Gagal"}))
        throw new Error(j.detail || j.error)
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href=url
      a.download=`arsip_${p.label.replace(/ /g,'_')}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      alert(`Berhasil arsip ${p.label}`)
    }catch(e){ alert(e.message) }
    setLoading(false)
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold">📦 Arsip 2 Bulanan</h1>
      <p className="text-slate-500 my-2">Periode: <b className="text-slate-900">{p.label}</b> ({p.start} s/d {p.end})</p>
      <p className="text-xs text-slate-400 mb-6">Otomatis arsip tiap akhir Feb, Apr, Jun, Agu, Okt, Des</p>
      <button onClick={doArchive} disabled={loading} className="bg-slate-900 text-white px-6 py-3 rounded-md font-semibold">
        {loading?"Memproses...":`Arsipkan & Download Excel ${p.label}`}
      </button>
    </div>
  )
}
