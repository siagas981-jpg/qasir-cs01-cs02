import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase/client.js"

export default function LaciManager() {
  const [laci, setLaci] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [newNama, setNewNama] = useState("")
  const [newJenis, setNewJenis] = useState("cash")
  const [transfer, setTransfer] = useState({ dari: "", ke: "", jumlah: 0 })

  const fetchLaci = async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    let outletId = null
    if (user) {
      const { data: p } = await supabase.from("profiles").select("outlet_id").eq("id", user.id).maybeSingle()
      outletId = p?.outlet_id
    }
    let q = supabase.from("laci").select("*").order("kode", { ascending: true })
    if (outletId) q = q.eq("outlet_id", outletId)
    const { data } = await q
    setLaci(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchLaci() }, [])

  const handleAddLaci = async () => {
    if (!newNama) return
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from("profiles").select("outlet_id").eq("id", user.id).maybeSingle()

    const { error } = await supabase.from("laci").insert({
      outlet_id: profile.outlet_id,
      nama: newNama,
      kode: `LACI_${Date.now()}`,
      jenis: newJenis,
      saldo: 0
    })
    if (!error) {
      setNewNama("")
      setShowAdd(false)
      fetchLaci()
    }
  }

  const handleTransfer = async () => {
    const { dari, ke, jumlah } = transfer
    if (!dari ||!ke || jumlah <= 0) return alert("Lengkapi data transfer")

    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase.from("profiles").select("outlet_id").eq("id", user.id).maybeSingle()

    // 1. Kurangi saldo dari
    const laciDari = laci.find(l => l.id === dari)
    const laciKe = laci.find(l => l.id === ke)

    await supabase.from("laci").update({ saldo: laciDari.saldo - Number(jumlah) }).eq("id", dari)
    await supabase.from("laci").update({ saldo: laciKe.saldo + Number(jumlah) }).eq("id", ke)

    // 2. Catat mutasi
    await supabase.from("laci_mutasi").insert({
      outlet_id: profile.outlet_id,
      dari_laci_id: dari,
      ke_laci_id: ke,
      jumlah: Number(jumlah),
      tipe: "transfer_antar_laci",
      keterangan: `Transfer ${laciDari.nama} -> ${laciKe.nama}`
    })

    setShowTransfer(false)
    setTransfer({ dari: "", ke: "", jumlah: 0 })
    fetchLaci()
    alert("Transfer Berhasil!")
  }

  const laci5 = laci.find(l => l.kode === 'LACI_5')
  const anakLaci5 = laci.filter(l => l.parent_id === laci5?.id)
  const laciInduk = laci.filter(l =>!l.parent_id)

  if (loading) return <div className="p-4 text-sm">Memuat laci...</div>

  return (
    <div className="space-y-4 p-2">
      {/* HEADER */}
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-lg">Manajemen Laci</h3>
        <div className="flex gap-2">
          <button onClick={() => setShowTransfer(true)} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold">Transfer Laci 1 ↔ 2</button>
          <button onClick={() => setShowAdd(true)} className="px-3 py-1.5 bg-black text-white rounded-lg text-xs font-bold">+ Tambah Laci</button>
        </div>
      </div>

      {/* GRID LACI */}
      <div className="grid grid-cols-2 gap-3">
        {laciInduk.map(item => (
          <div key={item.id} className="border rounded-xl p-3 bg-white">
            <div className="text-[10px] tracking-widest opacity-60">{item.kode} • {item.jenis.toUpperCase()}</div>
            <div className="font-bold text-sm mt-1">{item.nama}</div>
            <div className="text-xl font-black mt-2">Rp {Number(item.saldo).toLocaleString("id-ID")}</div>

            {/* Jika ini Laci 5, tampilkan isinya */}
            {item.kode === 'LACI_5' && (
              <div className="mt-3 pt-3 border-t space-y-2">
                {anakLaci5.length === 0 && <div className="text-[11px] opacity-50">Belum ada rekening. Jalankan SQL Laci 5</div>}
                {anakLaci5.map(anak => (
                  <div key={anak.id} className="flex justify-between bg-slate-50 p-2 rounded-lg">
                    <span className="text-xs font-bold">{anak.nama}</span>
                    <span className="text-xs">Rp {Number(anak.saldo).toLocaleString("id-ID")}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* POPUP TAMBAH LACI */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-4 w-full max-w-sm">
            <h4 className="font-bold mb-3">Tambah Laci Baru</h4>
            <input value={newNama} onChange={e => setNewNama(e.target.value)} placeholder="Nama Laci, ex: Laci 6 - Shopee" className="w-full border p-2 rounded-lg text-sm mb-2" />
            <select value={newJenis} onChange={e => setNewJenis(e.target.value)} className="w-full border p-2 rounded-lg text-sm mb-4">
              <option value="cash">Tunai / Cash</option>
              <option value="brankas">Brankas</option>
              <option value="bank">Bank</option>
              <option value="ewallet">E-Wallet</option>
            </select>
            <div className="flex gap-2">
              <button onClick={() => setShowAdd(false)} className="flex-1 py-2 border rounded-lg text-sm">Batal</button>
              <button onClick={handleAddLaci} className="flex-1 py-2 bg-black text-white rounded-lg text-sm font-bold">Simpan</button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP TRANSFER */}
      {showTransfer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-4 w-full max-w-sm">
            <h4 className="font-bold mb-3">Transfer Antar Laci</h4>
            <label className="text-xs">Dari Laci</label>
            <select value={transfer.dari} onChange={e => setTransfer({...transfer, dari: e.target.value})} className="w-full border p-2 rounded-lg text-sm mb-2">
              <option value="">Pilih Asal</option>
              {laci.map(l => <option key={l.id} value={l.id}>{l.nama} (Rp {Number(l.saldo).toLocaleString("id-ID")})</option>)}
            </select>
            <label className="text-xs">Ke Laci</label>
            <select value={transfer.ke} onChange={e => setTransfer({...transfer, ke: e.target.value})} className="w-full border p-2 rounded-lg text-sm mb-2">
              <option value="">Pilih Tujuan</option>
              {laci.map(l => <option key={l.id} value={l.id}>{l.nama}</option>)}
            </select>
            <label className="text-xs">Jumlah</label>
            <input type="number" value={transfer.jumlah} onChange={e => setTransfer({...transfer, jumlah: e.target.value})} placeholder="50000" className="w-full border p-2 rounded-lg text-sm mb-4" />
            <div className="flex gap-2">
              <button onClick={() => setShowTransfer(false)} className="flex-1 py-2 border rounded-lg text-sm">Batal</button>
              <button onClick={handleTransfer} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold">Transfer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
