import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase/client";
import { useAuth } from "@/context/AuthContext";

// === FIX: SESUAI KOLOM ASLI: kode, nama, jenis, saldo ===
async function fetchAllLaci(outletId) {
  if (!outletId) return [];
  const { data, error } = await supabase
    .from("laci")
    .select("*")
    .eq("outlet_id", outletId)
    .order("kode", { ascending: true });

  if (error) throw error;
  return data || [];
}

export default function SaldoShiftCard() {
  const { activeOutletId, profile } = useAuth();
  const qc = useQueryClient();
  const isOwner = profile?.role === "owner" || profile?.role === "OWNER" || profile?.is_owner === true;
  
  const [editingId, setEditingId] = useState(null);
  const [newBalance, setNewBalance] = useState(0);
  const [openTransfer, setOpenTransfer] = useState(false);
  const [transfer, setTransfer] = useState({ from: "", to: "", amount: 0 });

  const { data: lacis = [], isLoading } = useQuery({
    queryKey: ["laci-kasir", activeOutletId],
    queryFn: () => fetchAllLaci(activeOutletId),
    enabled: !!activeOutletId,
  });

  // === REALTIME - TAMBAH GOPAY DI OWNER, AUTO MUNCUL DI KARYAWAN ===
  useEffect(() => {
    if (!activeOutletId) return;
    const ch = supabase.channel(`laci-kasir-${activeOutletId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "laci", filter: `outlet_id=eq.${activeOutletId}` }, () => {
        qc.invalidateQueries({ queryKey: ["laci-kasir", activeOutletId] });
        qc.invalidateQueries({ queryKey: ["laci-all", activeOutletId] });
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeOutletId, qc]);

  const handleOwnerEdit = async (laci) => {
    const { error } = await supabase.from("laci").update({ saldo: newBalance }).eq("id", laci.id);
    if (error) return alert(error.message);
    setEditingId(null);
    qc.invalidateQueries({ queryKey: ["laci-kasir", activeOutletId] });
  };

  const handleTransfer = async () => {
    const from = lacis.find(l=>l.id===transfer.from);
    const to = lacis.find(l=>l.id===transfer.to);
    if(!from || !to || transfer.amount <= 0) return alert("Lengkapi data");
    if(from.id === to.id) return alert("Laci sama");

    await supabase.from("laci").update({ saldo: (from.saldo||0) - transfer.amount }).eq("id", from.id);
    await supabase.from("laci").update({ saldo: (to.saldo||0) + transfer.amount }).eq("id", to.id);
    setOpenTransfer(false);
    qc.invalidateQueries({ queryKey: ["laci-kasir", activeOutletId] });
  };

  if (isLoading) return <p className="p-4">Memuat laci...</p>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-bold">Laci ({lacis.length}) {isOwner && <span className="text-[10px] bg-amber-500 text-white px-2 py-0.5 rounded">OWNER FULL ACCESS</span>}</h2>
        <div className="flex gap-2">
          <button onClick={()=>setOpenTransfer(true)} className="bg-blue-600 text-white px-3 py-1 rounded-lg text-sm">Transfer Laci 1 ↔ 2</button>
          {isOwner && <button className="bg-black text-white px-3 py-1 rounded-lg text-sm">+ Tambah</button>}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {lacis.map((laci) => (
          <div key={laci.id} className="border rounded-xl p-4 bg-white relative">
            <p className="text-[10px] uppercase text-slate-500">{laci.kode} • {laci.jenis}</p>
            <p className="font-bold">{laci.nama}</p>
            
            {editingId === laci.id && isOwner ? (
              <div className="mt-2 flex gap-2">
                <input type="number" value={newBalance} onChange={e=>setNewBalance(Number(e.target.value))} className="border rounded px-2 py-1 w-full" />
                <button onClick={()=>handleOwnerEdit(laci)} className="bg-amber-500 text-white px-3 rounded text-xs">Save</button>
                <button onClick={()=>setEditingId(null)} className="bg-slate-200 px-3 rounded text-xs">Batal</button>
              </div>
            ) : (
              <>
                <p className="text-xl font-extrabold mt-1">Rp {Number(laci.saldo || 0).toLocaleString("id-ID")}</p>
                {/* === BEDANYA OWNER vs KARYAWAN DISINI OWY === */}
                <div className="flex gap-2 mt-2">
                  {isOwner ? (
                    <button onClick={()=>{setEditingId(laci.id); setNewBalance(laci.saldo||0);}} className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">✏️ Owner Edit Kapanpun</button>
                  ) : (
                    <>
                      <span className="text-[11px] text-slate-400">Hanya bisa transfer</span>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {openTransfer && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-4 w-[90%] max-w-sm space-y-3">
            <h3 className="font-bold">Transfer Laci - Bisa Karyawan & Owner</h3>
            <select className="border w-full rounded p-2 text-sm" value={transfer.from} onChange={e=>setTransfer({...transfer, from: e.target.value})}>
              <option value="">Dari Laci</option>
              {lacis.map(l=><option key={l.id} value={l.id}>{l.nama} - Rp {Number(l.saldo||0).toLocaleString()}</option>)}
            </select>
            <select className="border w-full rounded p-2 text-sm" value={transfer.to} onChange={e=>setTransfer({...transfer, to: e.target.value})}>
              <option value="">Ke Laci</option>
              {lacis.map(l=><option key={l.id} value={l.id}>{l.nama}</option>)}
            </select>
            <input type="number" placeholder="Nominal" className="border w-full rounded p-2" value={transfer.amount} onChange={e=>setTransfer({...transfer, amount: Number(e.target.value)})} />
            <div className="flex gap-2">
              <button onClick={()=>setOpenTransfer(false)} className="flex-1 bg-slate-200 rounded py-2 text-sm">Batal</button>
              <button onClick={handleTransfer} className="flex-1 bg-blue-600 text-white rounded py-2 text-sm">Transfer</button>
            </div>
          </div>
        </div>
      )}

      {lacis.length === 0 && <p className="text-center text-sm text-slate-400 mt-6">Belum ada laci. Owner tambah di Pembukuan → Laci</p>}
    </div>
  );
}
