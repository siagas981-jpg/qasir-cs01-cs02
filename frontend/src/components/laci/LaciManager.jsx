import { useEffect, useState, useCallback } from "react"
import { supabase } from "@/lib/supabase/client"

export default function LaciManager({ outletId }) {
  const [laci, setLaci] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [showTransfer, setShowTransfer] = useState(false)
  const [showDeposit, setShowDeposit] = useState(false)
  const [selectedLaci, setSelectedLaci] = useState(null)
  const [depositJumlah, setDepositJumlah] = useState("")
  const [dailyDeposits, setDailyDeposits] = useState([])
  const [newNama, setNewNama] = useState("")
  const [newJenis, setNewJenis] = useState("cash")
  const [transfer, setTransfer] = useState({ dari: "", ke: "", jumlah: "" })

  // === LOGIKA BISNIS DATE 01:00 WITA ===
  const getBusinessDate = () => {
    const now = new Date();
    const witaStr = now.toLocaleString("en-US", { timeZone: "Asia/Makassar" });
    const wita = new Date(witaStr);
    if (wita.getHours() < 1) {
      wita.setDate(wita.getDate() - 1);
    }
    return wita.toISOString().split('T')[0];
  }

  const getCurrentShift = () => {
    const now = new Date();
    const witaStr = now.toLocaleString("en-US", { timeZone: "Asia/Makassar" });
    const wita = new Date(witaStr);
    const hour = wita.getHours();
    if (hour >= 1 && hour < 9) return "MALAM"; // Haekal
    if (hour >= 9 && hour < 17) return "PAGI"; // Fitry
    return "SORE"; // Eqy
  }

  const fetchLaci = useCallback(async () => {
    if (!outletId) return
    setLoading(true)
    const { data } = await supabase.from("laci").select("*").eq("outlet_id", outletId).order("kode", { ascending: true })
    setLaci(data || [])

    // Fetch setoran hari bisnis ini
    const businessDate = getBusinessDate();
    const { data: deposits } = await supabase.from("laci_daily_deposit").select("*").eq("outlet_id", outletId).eq("business_date", businessDate)
    setDailyDeposits(deposits || [])
    setLoading(false)
  }, [outletId])

  useEffect(() => { fetchLaci() }, [fetchLaci])

  const canInputDeposit = (laciKode) => {
    const shift = getCurrentShift();
    // ATURAN KERAS: Hanya shift MALAM (Haekal) yang boleh
    if (shift!== "MALAM") return { allowed: false, reason: `Terkunci. Hanya Shift Malam (Haekal 01:00-09:00) yang boleh input. Shift kamu: ${shift}. Fitry shift 2 tidak bisa input.` };
    // Cek sudah setor belum hari ini
    const sudah = dailyDeposits.find(d => d.laci_kode === laciKode);
    if (sudah) return { allowed: false, reason: `Sudah setor hari ini Rp ${Number(sudah.jumlah).toLocaleString("id-ID")} jam ${new Date(sudah.created_at).toLocaleString("id-ID")}. Reset jam 01:00 besok.` };
    return { allowed: true, reason: "" };
  }

  const handleOpenDeposit = (item) => {
    const check = canInputDeposit(item.kode);
    if (!check.allowed) {
      alert(check.reason);
      return;
    }
    setSelectedLaci(item);
    setDepositJumlah("");
    setShowDeposit(true);
  }

  const handleDeposit = async () => {
    const jml = Number(depositJumlah)
    if (!selectedLaci || jml <= 0) return alert("Isi jumlah dengan benar")

    const businessDate = getBusinessDate();
    const shift = getCurrentShift();

    // 1. Simpan ke tabel harian (1x sehari)
    const { error: depError } = await supabase.from("laci_daily_deposit").insert({
      outlet_id: outletId,
      laci_kode: selectedLaci.kode,
      business_date: businessDate,
      jumlah: jml,
      shift: shift,
      tanggal_input: new Date().toISOString()
    })
    if (depError) return alert("Gagal: " + depError.message + " (Mungkin sudah input hari ini)");

    // 2. Update saldo laci
    const { error: laciError } = await supabase.from("laci").update({ saldo: Number(selectedLaci.saldo) + jml }).eq("id", selectedLaci.id)
    if (laciError) return alert(laciError.message)

    setShowDeposit(false)
    fetchLaci()
    alert(`Berhasil! Saldo ${selectedLaci.nama} ditambah Rp ${jml.toLocaleString("id-ID")}. Terkunci sampai jam 01:00 besok.`)
  }

  const handleAddLaci = async () => {
    if (!newNama ||!outletId) return
    const { error } = await supabase.from("laci").insert({ outlet_id: outletId, nama: newNama, kode: `LACI_${Date.now()}`, jenis: newJenis, saldo: 0 })
    if (!error) { setNewNama(""); setShowAdd(false); fetchLaci() } else alert(error.message)
  }

  const handleTransfer = async () => {
    const { dari, ke, jumlah } = transfer
    const jml = Number(jumlah)
    if (!dari ||!ke || jml <= 0) return alert("Lengkapi data transfer")
    if (dari === ke) return alert("Asal dan tujuan tidak boleh sama")
    const laciDari = laci.find(l => l.id === dari)
    const laciKe = laci.find(l => l.id === ke)
    if (Number(laciDari.saldo) < jml) return alert("Saldo tidak cukup")
    const { error: e1 } = await supabase.from("laci").update({ saldo: Number(laciDari.saldo) - jml }).eq("id", dari)
    const { error: e2 } = await supabase.from("laci").update({ saldo: Number(laciKe.saldo) + jml }).eq("id", ke)
    if (e1 || e2) return alert((e1 || e2).message)
    await supabase.from("laci_mutasi").insert({ outlet_id: outletId, dari_laci_id: dari, ke_laci_id: ke, jumlah: jml, tipe: "transfer_antar_laci", keterangan: `Transfer ${laciDari.nama} -> ${laciKe.nama}` })
    setShowTransfer(false); setTransfer({ dari: "", ke: "", jumlah: "" }); fetchLaci()
  }

  if (!outletId) return <div className="p-4 text-sm opacity-60">Pilih outlet dulu...</div>
  if (loading) return <div className="p-4 text-sm">Memuat laci...</div>

  const laciInduk = laci.filter(l =>!l.parent_id)
  const laci5 = laci.find(l => l.kode === 'LACI_5')
  const anakLaci5 = laci5? laci.filter(l => l.parent_id === laci5.id) : []
  const displayList = laciInduk.length > 0? laciInduk : laci.filter(l => ['LACI_1', 'LACI_2', 'LACI_5'].includes(l.kode))
  const currentShift = getCurrentShift()
  const businessDate = getBusinessDate()

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 bg-yellow-50 border border-yellow-200 p-3 rounded-xl">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-sm">Manajemen Laci - Shift: {currentShift} | Hari Bisnis: {businessDate}</h3>
          <div className="text-[10px] bg-black text-white px-2 py-1 rounded-full">{currentShift === 'MALAM'? 'Haekal (01-09)' : currentShift === 'PAGI'? 'Fitry (09-17)' : 'Eqy (17-01)'} </div>
        </div>
        <div className="text-[11px] text-yellow-800">
          {currentShift === 'MALAM'? '✅ Kamu bisa input saldo 1x hari ini (sampai jam 09:00)' : '🔒 Input saldo HANYA bisa dilakukan Shift Malam (Haekal) jam 01:00-09:00. Fitry/Shift 2 tidak bisa input.'}
        </div>
      </div>

      <div className="flex justify-between items-center">
        <h3 className="font-bold text-base">Laci ({laci.length})</h3>
        <div className="flex gap-2">
          <button onClick={() => setShowTransfer(true)} className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold">Transfer Laci 1 ↔ 2</button>
          <button onClick={() => setShowAdd(true)} className="px-3 py-1.5 bg-black text-white rounded-lg text-xs font-bold">+ Tambah</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {displayList.map(item => {
          const check = canInputDeposit(item.kode)
          const sudah = dailyDeposits.find(d => d.laci_kode === item.kode)
          return (
            <div key={item.id} onClick={() => handleOpenDeposit(item)} className={`border rounded-xl p-3 bg-white shadow-sm transition-all ${check.allowed? 'cursor-pointer hover:border-green-500 hover:shadow-md active:scale-[0.99]' : 'cursor-not-allowed opacity-80 bg-slate-50'}`}>
              <div className="flex justify-between">
                <div className="text-[10px] tracking-widest opacity-60">{item.kode} • {item.jenis?.toUpperCase()}</div>
                <div className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${check.allowed? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{check.allowed? 'BISA INPUT' : 'TERKUNCI'}</div>
              </div>
              <div className="font-bold text-sm mt-1">{item.nama}</div>
              <div className="text-xl font-black mt-2">Rp {Number(item.saldo).toLocaleString("id-ID")}</div>
              <div className="mt-2 text-[11px] h-8">
                {sudah? <span className="text-green-600 font-bold">✅ Sudah setor Rp {Number(sudah.jumlah).toLocaleString("id-ID")} - Reset 01:00</span> : check.allowed? <span className="text-blue-600 font-bold">👆 Klik untuk input manual 1x hari ini</span> : <span className="text-red-500">{check.reason.slice(0, 90)}...</span>}
              </div>
              {item.kode === 'LACI_5' && (
                <div className="mt-3 pt-3 border-t space-y-2">
                  {anakLaci5.map(anak => (
                    <div key={anak.id} className="flex justify-between bg-slate-50 p-2 rounded-lg"><span className="text-xs font-bold">{anak.nama}</span><span className="text-xs">Rp {Number(anak.saldo).toLocaleString("id-ID")}</span></div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* MODAL INPUT SALDO HARIAN */}
      {showDeposit && selectedLaci && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-4 w-full max-w-sm">
            <h4 className="font-bold mb-1">Input Saldo Manual - {selectedLaci.nama}</h4>
            <p className="text-[11px] opacity-60 mb-3">Hari Bisnis: {businessDate} | Shift: {currentShift} (Haekal) | 1x sehari, lock sampai 01:00 besok</p>
            <label className="text-xs font-bold">Jumlah Setoran</label>
            <input type="number" autoFocus value={depositJumlah} onChange={e => setDepositJumlah(e.target.value)} placeholder="500000" className="w-full border p-3 rounded-lg text-sm mb-1 font-bold" />
            <p className="text-[10px] text-red-500 mb-4">⚠️ Tidak bisa dikurangi manual. Jika mau tarik, harus ajukan ke Owner.</p>
            <div className="flex gap-2">
              <button onClick={() => setShowDeposit(false)} className="flex-1 py-2.5 border rounded-lg text-sm">Batal</button>
              <button onClick={handleDeposit} className="flex-1 py-2.5 bg-green-600 text-white rounded-lg text-sm font-bold">Simpan & Kunci</button>
            </div>
          </div>
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-4 w-full max-w-sm">
            <h4 className="font-bold mb-3">Tambah Laci Baru</h4>
            <input value={newNama} onChange={e => setNewNama(e.target.value)} placeholder="Nama Laci" className="w-full border p-2 rounded-lg text-sm mb-2" />
            <select value={newJenis} onChange={e => setNewJenis(e.target.value)} className="w-full border p-2 rounded-lg text-sm mb-4">
              <option value="cash">Tunai</option><option value="brankas">Brankas</option><option value="bank">Bank</option><option value="ewallet">E-Wallet</option>
            </select>
            <div className="flex gap-2"><button onClick={() => setShowAdd(false)} className="flex-1 py-2 border rounded-lg text-sm">Batal</button><button onClick={handleAddLaci} className="flex-1 py-2 bg-black text-white rounded-lg text-sm font-bold">Simpan</button></div>
          </div>
        </div>
      )}

      {showTransfer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-4 w-full max-w-sm">
            <h4 className="font-bold mb-3">Transfer Antar Laci</h4>
            <label className="text-xs font-bold">Dari</label>
            <select value={transfer.dari} onChange={e => setTransfer({...transfer, dari: e.target.value })} className="w-full border p-2 rounded-lg text-sm mb-2"><option value="">Pilih Asal</option>{laci.map(l => <option key={l.id} value={l.id}>{l.nama} (Rp {Number(l.saldo).toLocaleString("id-ID")})</option>)}</select>
            <label className="text-xs font-bold">Ke</label>
            <select value={transfer.ke} onChange={e => setTransfer({...transfer, ke: e.target.value })} className="w-full border p-2 rounded-lg text-sm mb-2"><option value="">Pilih Tujuan</option>{laci.map(l => <option key={l.id} value={l.id}>{l.nama}</option>)}</select>
            <label className="text-xs font-bold">Jumlah</label>
            <input type="number" value={transfer.jumlah} onChange={e => setTransfer({...transfer, jumlah: e.target.value })} placeholder="50000" className="w-full border p-2 rounded-lg text-sm mb-4" />
            <div className="flex gap-2"><button onClick={() => setShowTransfer(false)} className="flex-1 py-2 border rounded-lg text-sm">Batal</button><button onClick={handleTransfer} className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold">Transfer</button></div>
          </div>
        </div>
      )}
    </div>
  )
}
