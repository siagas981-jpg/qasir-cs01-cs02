import { useEffect, useState } from 'react'
import { supabase } from "@/lib/supabaseClient"

const OUTLETS = [
  { id: '87aab4db-13a9-4fed-b00c-495bfdb46965', name: 'CS01 - Diskon ON' },
  { id: 'daf1d559-c067-49b7-9ae9-d3ff96893149', name: 'CS02 - Diskon OFF' },
]

const PERMISSIONS = [
  { key: 'cashier_checkout', label: 'Bisa Checkout' },
  { key: 'cashier_delete_item', label: 'Bisa Hapus Item' },
  { key: 'cashier_discount', label: 'Bisa Diskon' },
  { key: 'cashier_void', label: 'Bisa Void' },
  { key: 'pembukuan_bank', label: 'Pembukuan Bank' },
  { key: 'pembukuan_laci', label: 'Pembukuan Laci' },
  { key: 'pembukuan_saldo', label: 'Pembukuan Saldo' },
]

export default function RolePermissions() {
  const [outletId, setOutletId] = useState(OUTLETS[0].id)
  const [perms, setPerms] = useState({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data } = await supabase.from('role_permissions').select('permission_key, allowed').eq('role', 'cashier').eq('outlet_id', outletId)
      const map = {}
      data?.forEach(d => map[d.permission_key] = d.allowed)
      setPerms(map)
      setLoading(false)
    }
    load()
  }, [outletId])

  const toggle = async (key) => {
    const newVal = !perms[key]
    setPerms(p => ({ ...p, [key]: newVal }))
    await supabase.from('role_permissions').upsert({ role: 'cashier', outlet_id: outletId, permission_key: key, allowed: newVal }, { onConflict: 'role,permission_key,outlet_id' })
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Setting Role Cashier Per Toko</h1>
      <select value={outletId} onChange={e => setOutletId(e.target.value)} className="border p-2 rounded w-full max-w-md mb-6">
        {OUTLETS.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
      </select>
      {loading ? <p>Loading...</p> : (
        <div className="space-y-2 max-w-md">
          {PERMISSIONS.map(p => (
            <label key={p.key} className="flex justify-between border p-3 rounded">
              <span>{p.label}</span>
              <input type="checkbox" checked={!!perms[p.key]} onChange={() => toggle(p.key)} className="w-5 h-5"/>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
