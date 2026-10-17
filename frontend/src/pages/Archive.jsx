import { useState } from "react"
import { supabase } from "@/lib/supabase/client"

function getBimonthly() {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth() + 1
  const sm = m % 2 === 1 ? m : m-1
  const em = sm+1
  const names = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"]
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
    if(!confirm(`Arsipkan periode ${p.label}?`)) return
    setLoading(true)
    try{
      const { data, error } = await supabase
        .from("transactions")
        .select("*")
        .gte("created_at", p.start)
        .lte("created_at", p.end)
        .order("created_at", { ascending: true })

      if(error) throw error
      if(!data || data.length === 0) throw new Error(`Tidak ada data di ${p.label}`)

      // BIKIN FORMAT RAPI UNTUK EXCEL INDONESIA (pakai ; biar langsung kepisah di Excel Indonesia)
      const headers = ["No", "Tanggal", "Jam", "ID Transaksi", "Total", "Bayar", "Kembalian", "Outlet ID"]
      
      let totalOmzet = 0
      
      const rows = data.map((r, i) => {
        const d = new Date(r.created_at)
        const tgl = d.toLocaleDateString('id-ID')
        const jam = d.toLocaleTimeString('id-ID')
        totalOmzet += Number(r.total || 0)
        return [
          i+1,
          tgl,
          jam,
          r.id,
          r.total,
          r.paid,
          r.change,
          r.outlet_id
        ]
      })

      // Pakai ; untuk Excel Indonesia biar langsung rapi kolomnya!
      const csvContent = [
        `LAPORAN ARSIP ${p.label}`,
        `Periode: ${p.start} s/d ${p.end}`,
        `Total Transaksi: ${data.length}`,
        `Total Omzet: ${totalOmzet}`,
        "",
        headers.join(";"),
        ...rows.map(r => r.join(";"))
      ].join("\n")

      const blob = new Blob(["\uFEFF" + csvContent], {type:"text/csv;charset=utf-8;"}) // \uFEFF biar support karakter Indonesia
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href=url
      a.download=`ARSIP_RAPI_${p.label.replace(/ /g,'_')}.csv`
      document.body.appendChild(a); a.click(); a.remove()
      URL.revokeObjectURL(url)

      alert(`Berhasil! ${data.length} transaksi, Omzet Rp ${totalOmzet.toLocaleString('id-ID')} ter-download RAPI!`)

    }catch(e){ alert(`Gagal: ${e.message}`); console.error(e) }
    setLoading(false)
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold">📦 Arsip 2 Bulanan - Versi RAPI</h1>
      <p className="text-slate-500 my-2">Periode: <b>{p.label}</b> ({p.start} s/d {p.end})</p>
      <button onClick={doArchive} disabled={loading} className="bg-emerald-600 text-white px-6 py-3 rounded-md font-semibold">
        {loading?"Memproses...":`Download Laporan RAPI ${p.label}`}
      </button>
      <p className="text-xs text-slate-400 mt-4">File CSV pakai ; biar langsung rapi di Excel Indonesia</p>
    </div>
  )
}
