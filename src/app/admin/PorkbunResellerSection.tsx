'use client';

import DomainSearch from '@/components/DomainSearch';

export function PorkbunResellerSection() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <DomainSearch
        isAdmin={true}
        searchContainerClassName="bg-slate-50 rounded-xl border border-slate-100 p-4"
      />
    </div>
  );
}
