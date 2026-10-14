import { useState } from 'react';
import { getCurrentShift, getShiftLabel } from '@/hooks/useShift';

export default function ShiftStartModal({ isOpen, onSubmit, outletBanks }) {
  const currentShift = getCurrentShift();
  const [form, setForm] = useState({ LACI_1: '', LACI_2: '', BCA: '', BRI: '', DANA: '' });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 z-[9999] flex items-center justify-center p-4">
      <div className="bg-white rounded-xl p-6 w-full max-w-md">
        <h2 className="font-bold text-lg">Mulai {getShiftLabel(currentShift)}</h2>
        <p className="text-sm text-gray-500 mb-4">
          {currentShift === 1? 'Wajib input saldo awal hari ini (01-09)' : 'Melanjutkan saldo dari sift sebelumnya'}
        </p>

        {currentShift === 1? (
          <div className="space-y-3">
            <label className="block">Laci 1 - Jualan
              <input type="number" className="w-full border p-2 rounded" value={form.LACI_1} onChange={e=>setForm({...form, LACI_1:e.target.value})} placeholder="Rp 0" />
            </label>
            <label className="block">Laci 2 - Cadangan/Titipan
              <input type="number" className="w-full border p-2 rounded" value={form.LACI_2} onChange={e=>setForm({...form, LACI_2:e.target.value})} placeholder="Rp 0" />
            </label>
            <label className="block">BCA
              <input type="number" className="w-full border p-2 rounded" value={form.BCA} onChange={e=>setForm({...form, BCA:e.target.value})} />
            </label>
            <label className="block">BRI
              <input type="number" className="w-full border p-2 rounded" value={form.BRI} onChange={e=>setForm({...form, BRI:e.target.value})} />
            </label>
            <label className="block">DANA
              <input type="number" className="w-full border p-2 rounded" value={form.DANA} onChange={e=>setForm({...form, DANA:e.target.value})} />
            </label>
            <button onClick={()=>onSubmit(form)} className="w-full bg-black text-white py-3 rounded-lg mt-4">Simpan & Mulai Jualan</button>
          </div>
        ) : (
          <div className="text-center py-6">
            <p>Saldo otomatis dari Sift {currentShift-1}</p>
            <button onClick={()=>onSubmit(null)} className="w-full bg-black text-white py-3 rounded-lg mt-4">Mulai Sift {currentShift}</button>
          </div>
        )}
      </div>
    </div>
  );
}
