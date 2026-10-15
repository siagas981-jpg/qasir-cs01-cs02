import { useEffect, useState } from "react"
import { supabase } from "../../lib/supabase/client.js"

export default function SaldoTabContent({ outletId }) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data: awal } = await supabase
       .from("saldo_awal")
       .select("*")
       .eq("outlet_id", outletId)
       .order("tanggal", { ascending: false })
       .limit(20)

      setData(awal || [])
      setLoading(false)
    }
    if (outletId) load()
  }, [outletId])

  if (loading) return <div className="p-4 text-sm text-gray-500">Memuat data saldo...</div>

  return (
    <div className="space-y-3 p-2">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-lg">Saldo Per Shift</h3>
        <span className="text-xs px-2 py-1 bg-gray-100 rounded">Auto-reset 01:05 WITA</span>
      </div>
      <div className="overflow-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="p-2.5 text-left">Tanggal</th>
              <th className="p-2.5 text-center">Shift</th>
              <th className="p-2.5 text-right">Saldo Awal</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.id} className="border-t">
                <td className="p-2.5">{row.tanggal}</td>
                <td className="p-2.5 text-center">
                  <span className="px-2 py-0.5 rounded bg-slate-900 text-white text-xs">{row.shift}</span>
                </td>
                <td className="p-2.5 text-right font-semibold">Rp {Number(row.jumlah || 0).toLocaleString("id-ID")}</td>
              </tr>
            ))}
            {data.length === 0 && (
              <tr><td colSpan={3} className="p-6 text-center text-gray-400">Belum ada data saldo.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
