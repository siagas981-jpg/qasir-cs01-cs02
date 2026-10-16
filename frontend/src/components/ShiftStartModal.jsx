import { useState } from 'react';
import { getCurrentShift, getShiftLabel } from '@/hooks/useShift';

export default function ShiftStartModal({ open, isOpen, onSubmit, loading }) {
  const show = open || isOpen;
  const currentShift = getCurrentShift();
  // FIX: BNI sesuai punyamu, bukan BCA. DAN SESUAIKAN MANDIRI kalau kamu pakai MANDIRI
  const [form, setForm] = useState({
    LACI_1: '200000',
    LACI_2: '0',
    BNI: '0',
    BRI: '0',
    MANDIRI: '0'
  });

  if (!show) return null;

  const handleSubmit = () => {
    // FIX: Convert semua ke Number biar gak error numeric
    const payload = {
      LACI_1: Number(form.LACI_1) || 0,
      LACI_2: Number(form.LACI_2) || 0,
      BNI: Number(form.BNI) || 0,
      BRI: Number(form.BRI) || 0,
      MANDIRI: Number(form.MANDIRI) || 0,
    };
    console.log('SHIFT SUBMIT PAYLOAD', payload);
    onSubmit(payload);
  };

  return (
    <div className="fixed inset-0 bg-black/70 z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-md">
        <h2 className="font-bold text-lg">Mulai {getShiftLabel(currentShift)}</h2>
        <p className="text-sm text-gray-500 mb-4">
          {currentShift === 1? 'Wajib input saldo awal hari ini (01-09)' : 'Melanjutkan saldo dari sift sebelumnya'}
        </p>

        {currentShift === 1? (
          <div className="space-y-3">
            <label className="block text-sm">Laci 1 - Jualan
              <input type="number" className="w-full border p-2 rounded mt-1" value={form.LACI_1} onChange={e=>setForm({...form, LACI_1:e.target.value})} />
            </label>
            <label className="block text-sm">Laci 2 - Cadangan
              <input type="number" className="w-full border p-2 rounded mt-1" value={form.LACI_2} onChange={e=>setForm({...form, LACI_2:e.target.value})} />
            </label>
            <label className="block text-sm">BNI
              <input type="number" className="w-full border p-2 rounded mt-1" value={form.BNI} onChange={e=>setForm({...form, BNI:e.target.value})} />
            </label>
            <label className="block text-sm">BRI
              <input type="number" className="w-full border p-2 rounded mt-1" value={form.BRI} onChange={e=>setForm({...form, BRI:e.target.value})} />
            </label>
            <label className="block text-sm">MANDIRI
              <input type="number" className="w-full border p-2 rounded mt-1" value={form.MANDIRI} onChange={e=>setForm({...form, MANDIRI:e.target.value})} />
            </label>
            <button disabled={loading} onClick={handleSubmit} className="w-full bg-black text-white py-3 rounded-lg mt-4 disabled:opacity-50">
              {loading? 'Menyimpan...' : 'Simpan & Mulai Jualan'}
            </button>
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-sm">Saldo otomatis dari Sift {currentShift-1}</p>
            <button disabled={loading} onClick={()=>onSubmit(null)} className="w-full bg-black text-white py-3 rounded-lg mt-4">
              Mulai Sift {currentShift}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
