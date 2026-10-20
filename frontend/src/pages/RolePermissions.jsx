// BARIS 1
import { useEffect, useState } from 'react'
// BARIS 2 - INI YANG BENER FINAL! JANGAN PAKAI supabaseClient LAGI!
import { supabase } from "@/lib/supabase"
// BARIS 3
// BARIS 4 - DAFTAR TOKO KAMU
const OUTLETS = [
// BARIS 5
  { id: '87aab4db-13a9-4fed-b00c-495bfdb46965', name: 'CS01 - Diskon ON' },
// BARIS 6
  { id: 'daf1d559-c067-49b7-9ae9-d3ff96893149', name: 'CS02 - Diskon OFF' },
// BARIS 7
]
// BARIS 8
// BARIS 9 - DAFTAR IZIN
const PERMISSIONS = [
// BARIS 10
  { key: 'cashier_checkout', label: 'Bisa Checkout' },
// BARIS 11
  { key: 'cashier_delete_item', label: 'Bisa Hapus Item' },
// BARIS 12
  { key: 'cashier_discount', label: 'Bisa Diskon' },
// BARIS 13
  { key: 'cashier_void', label: 'Bisa Void' },
// BARIS 14
  { key: 'pembukuan_bank', label: 'Pembukuan Bank' },
// BARIS 15
  { key: 'pembukuan_laci', label: 'Pembukuan Laci' },
// BARIS 16
  { key: 'pembukuan_saldo', label: 'Pembukuan Saldo' },
// BARIS 17
]
// BARIS 18
// BARIS 19
export default function RolePermissions() {
// BARIS 20
  const [outletId, setOutletId] = useState(OUTLETS[0].id)
// BARIS 21
  const [perms, setPerms] = useState({})
// BARIS 22
  const [loading, setLoading] = useState(false)
// BARIS 23
// BARIS 24
  useEffect(() => {
// BARIS 25
    const load = async () => {
// BARIS 26
      setLoading(true)
// BARIS 27
      const { data } = await supabase.from('role_permissions').select('permission_key, allowed').eq('role', 'cashier').eq('outlet_id', outletId)
// BARIS 28
      const map = {}
// BARIS 29
      data?.forEach(d => map[d.permission_key] = d.allowed)
// BARIS 30
      setPerms(map)
// BARIS 31
      setLoading(false)
// BARIS 32
    }
// BARIS 33
    load()
// BARIS 34
  }, [outletId])
// BARIS 35
// BARIS 36
  const toggle = async (key) => {
// BARIS 37
    const newVal = !perms[key]
// BARIS 38
    setPerms(p => ({ ...p, [key]: newVal }))
// BARIS 39
    await supabase.from('role_permissions').upsert({ role: 'cashier', outlet_id: outletId, permission_key: key, allowed: newVal }, { onConflict: 'role,permission_key,outlet_id' })
// BARIS 40
  }
// BARIS 41
// BARIS 42
  return (
// BARIS 43
    <div className="p-6">
// BARIS 44
      <h1 className="text-2xl font-bold mb-4">Setting Role Cashier Per Toko</h1>
// BARIS 45
      <select value={outletId} onChange={e => setOutletId(e.target.value)} className="border p-2 rounded w-full max-w-md mb-6">
// BARIS 46
        {OUTLETS.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
// BARIS 47
      </select>
// BARIS 48
      {loading ? <p>Loading...</p> : (
// BARIS 49
        <div className="space-y-2 max-w-md">
// BARIS 50
          {PERMISSIONS.map(p => (
// BARIS 51
            <label key={p.key} className="flex justify-between border p-3 rounded">
// BARIS 52
              <span>{p.label}</span>
// BARIS 53
              <input type="checkbox" checked={!!perms[p.key]} onChange={() => toggle(p.key)} className="w-5 h-5"/>
// BARIS 54
            </label>
// BARIS 55
          ))}
// BARIS 56
        </div>
// BARIS 57
      )}
// BARIS 58
    </div>
// BARIS 59
  )
// BARIS 60
}
