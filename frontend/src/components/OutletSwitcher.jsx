import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function OutletSwitcher() {
  const { outlets, activeOutlet, setActiveOutletId, isOwner } = useAuth();

  // Jika owner, tampilkan dropdown ganti CS 01 <> CS 02
  if (isOwner) {
    return (
      <select
        value={activeOutlet?.id || ''}
        onChange={(e) => setActiveOutletId(e.target.value)}
        className="border rounded px-2 py-1 text-sm font-medium bg-white"
      >
        {outlets.length === 0? (
          <option>Memuat outlet...</option>
        ) : (
          outlets.map(outlet => (
            <option key={outlet.id} value={outlet.id}>
              {outlet.name}
            </option>
          ))
        )}
      </select>
    );
  }

  // Jika bukan owner (karyawan)
  return (
    <span className="text-sm font-medium">
      {activeOutlet?.name || "Memuat outlet..."}
    </span>
  );
}