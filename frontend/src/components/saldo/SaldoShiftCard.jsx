import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";

async function fetchAllLaci(outletId) {
  if (!outletId) return [];
  const { data, error } = await supabase
    .from("laci")
    .select("*")
    .eq("outlet_id", outletId)
    // HAPUS FILTER is_active BIAR GAK JADI 0 - filter manual di bawah
    .order("code", { ascending: true });

  if (error) throw error;
  // Tampilkan semua kecuali yang is_active = false (NULL tetap tampil)
  return (data || []).filter(l => l.is_active !== false);
}

export default function SaldoShiftCard() {
  const { activeOutletId, profile } = useAuth();
  const qc = useQueryClient();
  const isOwner = profile?.role === "owner" || profile?.is_owner;
  const [editingId, setEditingId] = useState(null);
  const [newBalance, setNewBalance] = useState(0);

  const { data: lacis = [], isLoading } = useQuery({
    queryKey: ["laci-kasir", activeOutletId],
    queryFn: () => fetchAllLaci(activeOutletId),
    enabled: !!activeOutletId,
  });

  // === REALTIME - BIAR TAMBAH GOPAY AUTO MUNCUL DI KARYAWAN ===
  useEffect(() => {
    if (!activeOutletId) return;
    const ch = supabase.channel(`laci-kasir-${activeOutletId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "laci", filter: `outlet_id=eq.${activeOutletId}` }, () => {
        qc.invalidateQueries({ queryKey: ["laci-kasir", activeOutletId] });
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeOutletId, qc]);

  const handleOwnerEdit = async (laci) => {
    const { error } = await supabase.from("laci").update({ balance: newBalance }).eq("id", laci.id);
    if (error) return alert(error.message);
    setEditingId(null);
    qc.invalidateQueries({ queryKey: ["laci-kasir", activeOutletId] });
  };

  if (isLoading) return <p className="p-4">Memuat laci...</p>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-bold">Laci ({lacis.length}) {isOwner && <span className="text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded">OWNER FULL ACCESS</span>}</h2>
        <div className="flex gap-2">
          <button className="bg-blue-600 text-white px-3 py-1 rounded-lg text-sm">Transfer Laci 1 ↔ 2</button>
          {isOwner && <button className="bg-black text-white px-3 py-1 rounded-lg text-sm">+ Tambah</button>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {lacis.map((laci) => (
          <div key={laci.id} className="border rounded-xl p-4 bg-white relative">
            <p className="text-[10px] uppercase text-slate-500">{laci.code} • {laci.type}</p>
            <p className="font-bold">{laci.name}</p>
            
            {editingId === laci.id && isOwner ? (
              <div className="mt-2 flex gap-2">
                <input type="number" value={newBalance} onChange={e=>setNewBalance(Number(e.target.value))} className="border rounded px-2 py-1 w-full" />
                <button onClick={()=>handleOwnerEdit(laci)} className="bg-amber-500 text-white px-3 rounded text-xs">Save</button>
                <button onClick={()=>setEditingId(null)} className="bg-slate-200 px-3 rounded text-xs">Batal</button>
              </div>
            ) : (
              <>
                <p className="text-xl font-extrabold mt-1">Rp {Number(laci.balance || 0).toLocaleString("id-ID")}</p>
                <div className="flex gap-2 mt-2">
                  <button className="text-xs text-blue-600">👉 Klik untuk input manual 1x hari ini</button>
                  {/* OWNER BISA EDIT KAPANPUN */}
                  {isOwner && (
                    <button onClick={()=>{setEditingId(laci.id); setNewBalance(laci.balance||0);}} className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">✏️ Owner Edit</button>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {lacis.length === 0 && <p className="text-center text-sm text-slate-400 mt-6">Belum ada laci. Owner tambah di Pembukuan → Laci</p>}
    </div>
  );
}
