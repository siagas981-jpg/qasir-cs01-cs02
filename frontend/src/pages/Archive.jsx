import { useState } from "react"
import { supabase } from "@/lib/supabase/client"

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

  const doArchive = async () => {
    if(!confirm(`Arsipkan periode ${p.label}? File akan di-download ke HP/Laptop kamu`)) return
    setLoading(true)
    try{
      // Coba beberapa nama tabel yang umum
      const tablesToTry = ["transactions", "sales", "orders", "transaksi", "penjualan"]
      let data = null
      let usedTable = ""

      for (const t of tablesToTry) {
        const { data: d, error } = await supabase.from(t).select("*").gte("created_at", p.start).lte("created_at", p.end).limit(5000)
        if (!error && d) { data = d; usedTable = t; break; }
      }

      if(!data) throw new Error("Tabel transaksi tidak ditemukan. Cek nama tabel di Supabase: transactions / sales / orders")
      if(data.length === 0) throw new Error(`Tidak ada data di periode ${p.label} (${p.start} s/d ${p.end}) di tabel ${usedTable}`)

      // Bikin CSV yang bisa dibuka Excel
      const headers = Object.keys(data[0])
      const csv = [
        headers.join(","),
        ...data.map(r => headers.map(h => {
          let v = r[h]; if(v==null) return ""; v=String(v).replace(/"/g,'""'); 
          return (v.includes(",")||v.includes("\n"))?`"${v}"`:v
        }).join(","))
      ].join("\n")

      const blob = new Blob([csv], {type:"text/csv;charset=utf-8;"})
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href=url; a.download=`arsip_${usedTable}_${p.label.replace(/ /g,'_')}.csv`
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)

      alert(`Berhasil! ${data.length} data dari tabel ${usedTable} periode ${p.label} ter-download`)

    }catch(e){ alert(`Gagal: ${e.message}`); console.error(e) }
    setLoading(false)
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold">📦 Arsip 2 Bulanan</h1>
      <p className="text-slate-500 my-2">Periode: <b className="text-slate-900">{p.label}</b> ({p.start} s/d {p.end})</p>
      <p className="text-xs text-slate-400 mb-6">Langsung dari Supabase: fqmhxedhluaekglmlgnt.supabase.co</p>
      <button onClick={doArchive} disabled={loading} className="bg-slate-900 text-white px-6 py-3 rounded-md font-semibold disabled:opacity-50">
        {loading?"Memproses...":`Arsipkan & Download Excel ${p.label}`}
      </button>
    </div>
  )
}
