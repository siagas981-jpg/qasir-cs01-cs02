import { useEffect, useState, useCallback } from "react"
import { supabase } from "@/lib/supabase/client"

export default function LaciManager({ outletId }) {
  const [laci, setLaci] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [newNama, setNewNama] = useState("")
  const [newJenis, setNewJenis] = useState("cash")
  const [transfer, setTransfer] = useState({ dari: "", ke: "", jumlah: "" })

  const fetchLaci = useCallback(async () => {
    if (!outletId) {
      console.log("LaciManager: outletId masih kosong");
      return
    }
    setLoading(true)
    console.log("LaciManager FETCH untuk outletId:", outletId);
    const { data, error } = await supabase
    .from("laci")
    .select("*")
    .eq("outlet_id", outletId)
    .order("kode", { ascending: true })

    if (error) {
      console.error("LaciManager ERROR:", error);
    }
    console.log("LaciManager RESULT:", data);
    setLaci(data || [])
    setLoading(false)
  }, [outletId])

  useEffect(() => { fetchLaci() }, [fetchLaci])

  const handleAddLaci = async () => {
    if (!newNama ||!outletId) return
    const { error } = await supabase.from("laci").insert({
      outlet_id: outletId,
      nama: newNama,
      kode: `LACI_${Date.now()}`,
      jenis: newJenis,
      saldo: 0
    })
    if (!error) {
      setNewNama("")
      setShowAdd(false)
      fetchLaci()
    } else {
      alert(error.message)
    }
  }

  const handleTransfer = async () => {
    const { dari, ke, jumlah } = transfer
    const jml = Number(jumlah)
    if (!dari ||!ke || jml <= 0) return alert("Lengkapi data transfer")
    if (dari === ke) return alert("Asal dan tujuan tidak boleh sama")

    const laciDari = laci.find(l => l.id === dari)
    const laciKe = laci.find(l => l.id === ke)
    if (!laciDari ||!laciKe) return alert("Laci tidak ditemukan")
    if (Number(laciDari.saldo) < jml) return alert("Saldo tidak cukup")

    const { error: e1 } = await supabase.from("laci").update({ saldo: Number(laciDari.saldo) - jml }).eq("id", dari)
    const { error: e2 } = await supabase.from("laci").update({ saldo: Number(laciKe.saldo) + jml }).eq("id", ke)
    if (e1 || e2) return alert((e1||e2).message)

    await supabase.from("laci_mutasi").insert({
      outlet_id: outletId,
      dari_laci_id: dari,
      ke_laci_id: ke,
      jumlah: jml,
      tipe: "transfer_antar_laci",
      keterangan: `Transfer ${laciDari.nama} -> ${laciKe.nama}`
    })

    setShowTransfer(false)
    setTransfer({ dari: "", ke: "", jumlah: "" })
    fetchLaci()
  }

  if (!outletId) return <div className="p-4 text-sm opacity-60">Pilih outlet dulu... (outletId kosong)</div>
  if (loading) return <div className="p-4 text-sm">Memuat laci untuk {outletId}...</div>

  // FIX UTAMA: parent_id bisa null, undefined, atau "" - anggap induk jika falsy
  const laciInduk = laci.filter(l =>!l.parent_id)
  const laci5 = laci.find(l => l.kode === 'LACI_5')
  const anakLaci5 = laci5? laci.filter(l => l.parent_id === laci5.id) : []

  // Fallback: kalau filter induk gagal, tampilkan semua biar tidak kosong
  const displayList = laciInduk.length > 0? laciInduk : laci.filter(l => ['LACI_1','LACI_2','LACI_5'].includes(l.kode))

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-base">Manajemen Laci - {outletId.slice(0,8)}... ({laci.length} laci)</h3>
        <div className="flex gap-2">
          <button onClick={() => setShowTransfer(true)} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold">Transfer Laci 1 ↔ 2</button>
          <button onClick={() => setShowAdd(true)} className="px-3 py-1.5 bg-black text-white rounded-lg text-xs font-bold">+ Tambah Laci</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {displayList.map(item => (
          <div key={item.id} className="border rounded-xl p-3 bg-white shadow-sm">
            <div className="text-[10px] tracking-widest opacity-60">{item.kode} • {item.jenis?.toUpperCase()} • {item.outlet_id.slice(0,8)}</div>
            <div className="font-bold text-sm mt-1">{item.nama}</div>
            <div className="text-xl font-black mt-2">Rp {Number(item.saldo).toLocaleString("id-ID")}</div>
            {item.kode === 'LACI_5' && (
              <div className="mt-3 pt-3 border-t space-y-2">
                {anakLaci5.length === 0 && <div className="text-[11px] opacity-50">Belum ada rekening. Jalankan SQL insert anak Laci 5 (BRI, BNI, MANDIRI, DANA)</div>}
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
        {displayList.length === 0 && (
          <div className="col-span-2 p-6 text-center text-xs opacity-50 border rounded-xl">
            Belum ada laci untuk outlet {outletId}. Data total di DB: {laci.length}. Cek console log.
          </div>
        )}
      </div>

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

      {showTransfer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-4 w-full max-w-sm">
            <h4 className="font-bold mb-3">Transfer Antar Laci (Laci 1 ↔ 2)</h4>
            <label className="text-xs font-bold">Dari Laci</label>
            <select value={transfer.dari} onChange={e => setTransfer({...transfer, dari: e.target.value})} className="w-full border p-2 rounded-lg text-sm mb-2">
              <option value="">Pilih Asal</option>
              {laci.map(l => <option key={l.id} value={l.id}>{l.nama} (Rp {Number(l.saldo).toLocaleString("id-ID")})</option>)}
            </select>
            <label className="text-xs font-bold">Ke Laci</label>
            <select value={transfer.ke} onChange={e => setTransfer({...transfer, ke: e.target.value})} className="w-full border p-2 rounded-lg text-sm mb-2">
              <option value="">Pilih Tujuan</option>
              {laci.map(l => <option key={l.id} value={l.id}>{l.nama}</option>)}
            </select>
            <label className="text-xs font-bold">Jumlah</label>
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
