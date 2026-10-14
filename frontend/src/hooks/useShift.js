import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabase/client";

// Deteksi Sift otomatis dari jam HP/Laptop
export function getCurrentShift() {
  const hour = new Date().getHours();
  if (hour >= 1 && hour < 9) return 1; // Sift 1: 01-09
  if (hour >= 9 && hour < 17) return 2; // Sift 2: 09-17
  return 3; // Sift 3: 17-01
}

export function getShiftLabel(sift) {
  if (sift === 1) return "SIFT 1 (01-09)";
  if (sift === 2) return "SIFT 2 (09-17)";
  return "SIFT 3 (17-01)";
}

// Logic Auto Talang Laci 2 -> Laci 1
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
    if (!outletId) {
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      const sift = getCurrentShift();
      setCurrentShift(sift);

      const { data, error } = await supabase
       .from('daily_cash_balances')
       .select('id')
       .eq('outlet_id', outletId)
       .eq('date', today)
       .eq('shift', sift)
       .limit(1);

      if (error) throw error;
      // Kalau belum ada data hari ini untuk sift ini -> wajib isi saldo awal
      setNeedsInput(!data || data.length === 0);
    } catch (e) {
      console.error("checkShift error", e);
      setNeedsInput(false);
    } finally {
      setLoading(false);
    }
  }, [outletId]);

  useEffect(() => {
    checkShift();
  }, [checkShift]);

  const startShift = async (openingBalance) => {
    try {
      setLoading(true);
      const today = new Date().toISOString().split('T')[0];
      const sift = getCurrentShift();

      const { error } = await supabase
       .from('daily_cash_balances')
       .insert({
          outlet_id: outletId,
          date: today,
          shift: sift,
          opening_balance: openingBalance,
          balance: openingBalance,
          drawer: 'LACI_1'
        });

      if (error) throw error;
      setNeedsInput(false);
      return { success: true };
    } catch (e) {
      console.error(e);
      return { success: false, message: e.message };
    } finally {
      setLoading(false);
    }
  };

  return { loading, needsInput, currentShift, startShift, refresh: checkShift };
}

export default useShift;
