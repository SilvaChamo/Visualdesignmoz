'use client';

import React from 'react';
import { Globe } from 'lucide-react';
import DomainSearch from '@/components/DomainSearch';

export function PorkbunResellerSection() {
  return (
    <div className="p-6 bg-white rounded-xl shadow-sm border border-slate-200">
      <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
        <div className="p-2 bg-pink-100 rounded-lg">
          <Globe className="w-6 h-6 text-pink-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-slate-800">Registo de domínios</h2>
          <p className="text-sm text-slate-500">Pesquise disponibilidade e registe domínios com preço em tempo real (conta de registo ligada ao servidor).</p>
        </div>
      </div>

      <DomainSearch 
        isAdmin={true} 
        searchContainerClassName="bg-slate-50 p-6 rounded-xl border border-slate-100" 
      />
    </div>
  );
}
