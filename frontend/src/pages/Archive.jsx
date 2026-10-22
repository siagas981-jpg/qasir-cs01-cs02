import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase/client"
import JSZip from "jszip"
import { saveAs } from "file-saver"

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
  const [loadingTotal,setLoadingTotal]=useState(false)
  const [p]=useState(getBimonthly())
  const [activeTab,setActiveTab]=useState("arsip")
  const [isOwner,setIsOwner]=useState(false)

  // CEK APAKAH OWNER - biar Admin Gudang / Toko gak bisa lihat
  useEffect(()=>{
    const checkOwner = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if(!user) return
      // Cek 2 cara: email kamu atau role di profiles
      if(user.email === "siagas981@gmail.com") { setIsOwner(true); return }
      const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single()
      if(data?.role === "OWNER") setIsOwner(true)
    }
    checkOwner()
  },[])

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

      const headers = ["No", "Tanggal", "Jam", "ID Transaksi", "Total", "Bayar", "Kembalian", "Outlet ID"]
      let totalOmzet = 0
      const rows = data.map((r, i) => {
        const d = new Date(r.created_at)
        const tgl = d.toLocaleDateString('id-ID')
        const jam = d.toLocaleTimeString('id-ID')
        totalOmzet += Number(r.total || 0)
        return [ i+1, tgl, jam, r.id, r.total, r.paid, r.change, r.outlet_id ]
      })

      const csvContent = [
        `LAPORAN ARSIP ${p.label}`,
        `Periode: ${p.start} s/d ${p.end}`,
        `Total Transaksi: ${data.length}`,
        `Total Omzet: ${totalOmzet}`,
        "",
        headers.join(";"),
        ...rows.map(r => r.join(";"))
      ].join("\n")

      const blob = new Blob(["\uFEFF" + csvContent], {type:"text/csv;charset=utf-8;"})
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

  // === FITUR BARU: BACKUP TOTAL TOKO ===
  const doBackupTotal = async () => {
    if(!confirm("Download BACKUP TOTAL TOKO? Ini akan backup SELURUH komponen kasir (Produk + Transaksi + Laci + Saldo BNI/BRI/DANA dll).")) return
    setLoadingTotal(true)
    try{
      const zip = new JSZip()
      const nowLabel = new Date().toISOString().split('T')[0]

      // Daftar semua komponen kasir kamu
      const tables = ["products", "transactions", "transaction_items", "baci_daily_deposit", "stock_movements", "outlets", "suppliers", "profiles"]
      
      let summary = `BACKUP TOTAL TOKO - ${nowLabel}\n`
      summary += `=====================================\n\n`

      for(const table of tables){
        try{
          const { data, error } = await supabase.from(table).select("*").limit(10000)
          if(error){ summary += `${table}: GAGAL (${error.message})\n`; continue }
          const count = data?.length || 0
          summary += `${table}: ${count} baris\n`
          if(count > 0){
            // Simpan jadi CSV dan JSON
            const headers = Object.keys(data[0])
            const csvRows = [headers.join(";"), ...data.map(r => headers.map(h => `"${String(r[h]??'').replace(/"/g,'""')}"`).join(";"))]
            zip.file(`${table}.csv`, "\uFEFF" + csvRows.join("\n"))
            zip.file(`${table}.json`, JSON.stringify(data, null, 2))
          }
        }catch(err){ summary += `${table}: ERROR\n` }
      }

      zip.file("00_RINGKASAN.txt", summary)
      const content = await zip.generateAsync({type:"blob"})
      saveAs(content, `BACKUP_TOTAL_TOKO_${nowLabel}.zip`)

      alert(`BACKUP TOTAL BERHASIL!\n\n${summary}\n\nSimpan ZIP ini di Google Drive yang aman ya owy!`)

    }catch(e){ alert(`Gagal Backup Total: ${e.message}`); console.error(e) }
    setLoadingTotal(false)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold">📦 Arsip & Cadangan</h1>
      
      {/* TAB SWITCHER */}
      <div className="flex gap-2 mt-4 border-b">
        <button onClick={()=>setActiveTab("arsip")} className={`px-4 py-2 font-semibold ${activeTab==="arsip" ? "border-b-2 border-emerald-600 text-emerald-600" : "text-slate-500"}`}>
          Arsip 2 Bulanan
        </button>
        {isOwner && (
          <button onClick={()=>setActiveTab("total")} className={`px-4 py-2 font-semibold ${activeTab==="total" ? "border-b-2 border-red-600 text-red-600" : "text-slate-500"}`}>
            🔒 BACKUP TOTAL TOKO (Owner)
          </button>
        )}
      </div>

      {activeTab === "arsip" && (
        <div className="mt-6">
          <p className="text-slate-500 my-2">Periode: <b>{p.label}</b> ({p.start} s/d {p.end})</p>
          <button onClick={doArchive} disabled={loading} className="bg-emerald-600 text-white px-6 py-3 rounded-md font-semibold">
            {loading?"Memproses...":`Download Laporan RAPI ${p.label}`}
          </button>
          <p className="text-xs text-slate-400 mt-4">File CSV pakai ; biar langsung rapi di Excel Indonesia</p>
        </div>
      )}

      {activeTab === "total" && isOwner && (
        <div className="mt-6 bg-red-50 border border-red-200 p-6 rounded-lg">
          <h2 className="text-xl font-bold text-red-700">🚨 BACKUP TOTAL TOKO</h2>
          <p className="text-sm text-slate-700 mt-2">Ini akan membackup <b>SELURUH komponen kasir</b> kamu:</p>
          <ul className="text-sm text-slate-700 list-disc ml-5 mt-2">
            <li>Semua Produk & Stok</li>
            <li>Semua Transaksi & Transaction Items</li>
            <li>Saldo Laci: Laci 1, Laci 2 Brankas, Laci 5, BNI, BRI, DANA, MANDIRI</li>
            <li>Stock Movements, Outlets, Suppliers, Profiles</li>
            <li>Termasuk saldo Rp 81.176.000 & Rp 77.707.554 yang ada di screenshot kamu</li>
          </ul>
          <p className="text-xs text-red-600 mt-3">Hanya OWNER yang bisa akses ini. Admin Gudang / Admin Toko / Cashier tidak bisa melihat tab ini.</p>
          <button onClick={doBackupTotal} disabled={loadingTotal} className="bg-red-600 text-white px-6 py-3 rounded-md font-semibold mt-4 w-full">
            {loadingTotal?"Membackup Semua...":"⬇️ DOWNLOAD BACKUP TOTAL TOKO (.ZIP)"}
          </button>
          <p className="text-xs text-slate-500 mt-2">File ZIP berisi 8 file CSV + 8 file JSON + Ringkasan</p>
        </div>
      )}

      {!isOwner && activeTab === "total" && (
        <p className="mt-6 text-red-500">Akses ditolak. Hanya OWNER.</p>
      )}
    </div>
  )
}
