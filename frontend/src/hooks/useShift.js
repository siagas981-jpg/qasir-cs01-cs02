import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";

export function getCurrentShift() {
  const hour = new Date().getHours();
  if (hour >= 1 && hour < 9) return 1;
  if (hour >= 9 && hour < 17) return 2;
  return 3;
}

export function getShiftLabel(sift) {
  if (sift === 1) return "SIFT 1 (01-09)";
  if (sift === 2) return "SIFT 2 (09-17)";
  return "SIFT 3 (17-01)";
}

export function calculateTarikTunai(nominal, balances){
  let laci1 = balances['LACI_1'] || 0;
  let laci2 = balances['LACI_2'] || 0;
  if (laci1 >= nominal) {
    return { success: true, autoTalang: false, mutations: [{ from: 'LACI_1', amount: nominal }] };
  }
  const totalCash = laci1 + laci2;
  if (totalCash < nominal) {
    return { success: false, message: `Uang tidak cukup. Butuh Rp ${nominal.toLocaleString()}, sisa cuma Rp ${totalCash.toLocaleString()}` };
  }
  const kurang = nominal - laci1;
  return {
    success: true,
    autoTalang: true,
    kurang: kurang,
    mutations: [
      { from: 'LACI_1', amount: laci1 },
      { from: 'LACI_2', amount: kurang, note: 'Auto Talang' }
    ]
  };
}

export function useShift(outletId) {
  const [loading, setLoading] = useState(true);
  const [needsInput, setNeedsInput] = useState(false);
  const [currentShift, setCurrentShift] = useState(getCurrentShift());

  const checkShift = useCallback(async () => {
    if (!outletId) { setLoading(false); return; }
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      const sift = getCurrentShift();
      setCurrentShift(sift);
      const { data, error } = await supabase.from('daily_cash_balances').select('id').eq('outlet_id', outletId).eq('date', today).eq('shift', sift).limit(1);
      if (error) throw error;
      setNeedsInput(!data || data.length === 0);
    } catch (e) {
      console.error("checkShift error", e);
      setNeedsInput(false);
    } finally { setLoading(false); }
  }, [outletId]);

  useEffect(() => { checkShift(); }, [checkShift]);

  const startShift = async (openingBalance) => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      const sift = getCurrentShift();

      // FIX: openingBalance bisa object {LACI_1, LACI_2, BNI, BRI, MANDIRI} atau null
      let totalOpening = 0;
      let balancesToUpdate = {};

      if (openingBalance && typeof openingBalance === 'object') {
        // Hitung total untuk kolom numeric
        totalOpening = Object.values(openingBalance).reduce((sum, v) => sum + (Number(v) || 0), 0);
        balancesToUpdate = openingBalance;
      } else {
        totalOpening = Number(openingBalance) || 0;
      }

      // 1. Insert daily_cash_balances dengan NUMERIC (bukan object!)
      const { error } = await supabase.from('daily_cash_balances').insert({
        outlet_id: outletId,
        date: today,
        shift: sift,
        opening_balance: totalOpening, // FIX: kirim angka, bukan object
        balance: totalOpening,
        drawer: 'LACI_1'
      });
      if (error) throw error;

      // 2. Update saldo laci asli di tabel laci
      if (Object.keys(balancesToUpdate).length > 0) {
        for (const [key, value] of Object.entries(balancesToUpdate)) {
          const nominal = Number(value) || 0;
          if (nominal === 0) continue;

          // Mapping BNI -> LACI_5_BNI, BRI -> LACI_5_BRI, MANDIRI -> LACI_5_MANDIRI
          let kodeCari = key;
          if (key === 'BNI') kodeCari = 'LACI_5_BNI';
          if (key === 'BRI') kodeCari = 'LACI_5_BRI';
          if (key === 'MANDIRI') kodeCari = 'LACI_5_MANDIRI';
          if (key === 'BCA') kodeCari = 'LACI_5_BNI'; // fallback kalau masih ada BCA

          // Update saldo laci
          const { data: existing } = await supabase.from('laci').select('id, saldo').eq('outlet_id', outletId).eq('kode', kodeCari).limit(1).single();
          if (existing) {
            await supabase.from('laci').update({ saldo: nominal }).eq('id', existing.id);
          } else if (key === 'LACI_1' || key === 'LACI_2') {
             const { data: ex2 } = await supabase.from('laci').select('id').eq('outlet_id', outletId).eq('kode', key).limit(1).single();
             if (ex2) await supabase.from('laci').update({ saldo: nominal }).eq('id', ex2.id);
          }
        }
      }

      setNeedsInput(false);
      return { success: true };
    } catch (e) {
      console.error(e);
      alert("Gagal mulai shift: " + e.message);
      return { success: false, message: e.message };
    } finally {
      setLoading(false);
    }
  };

  return { loading, needsInput, currentShift, startShift, refresh: checkShift };
}

export default useShift;
