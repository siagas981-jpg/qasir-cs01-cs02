import React from 'react';
import { useAuth } from '../context/AuthContext';

export function OutletSwitcher() {
  const { outlets, activeOutlet, setActiveOutletId, isOwner } = useAuth();

  if (isOwner) {
    return (
      <select
        value={activeOutlet?.id || ''}
        onChange={(e) => setActiveOutletId(e.target.value)}
        className="border rounded px-2 py-1 text-sm font-medium bg-white"
      >
        {outlets.length === 0 ? (
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

  return (
    <span className="text-sm font-medium">
      {activeOutlet?.name || "Memuat outlet..."}
    </span>
  );
}

export default OutletSwitcher;