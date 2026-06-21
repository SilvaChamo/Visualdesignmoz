'use client';

import React, { useEffect, useState } from 'react';
import { Loader2, Plus, RefreshCw, Server } from 'lucide-react';
import { panelBtnPrimary, panelBtnSecondary } from '@/lib/panel-ui';
import type { DirectAdminWebsite } from '@/lib/directadmin-api';

export function PorkbunMyDomainsSection({
  sites = [],
  onAddHostingDomain,
}: {
  sites?: DirectAdminWebsite[];
  onAddHostingDomain?: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      await fetch('/api/registrar/account/domains', { credentials: 'include' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {onAddHostingDomain && (
          <button type="button" onClick={onAddHostingDomain} className={panelBtnPrimary}>
            <Plus className="h-4 w-4" />
            Adicionar domínio
          </button>
        )}
        <button type="button" onClick={() => void load()} disabled={loading} className={panelBtnSecondary}>
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {sites.length === 0 ? (
        <div className="rounded border border-gray-200 bg-white py-10 text-center text-gray-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-500">
          Nenhum domínio de hospedagem encontrado.
        </div>
      ) : (
        <div className="overflow-x-auto rounded border border-gray-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-bold uppercase text-gray-500 dark:bg-zinc-800 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-2">Domínio</th>
                <th className="px-4 py-2">Estado</th>
                <th className="px-4 py-2">Pacote</th>
                <th className="px-4 py-2">Owner</th>
              </tr>
            </thead>
            <tbody>
              {sites.map((s) => (
                <tr
                  key={s.domain}
                  className="border-t border-gray-100 hover:bg-gray-50/80 dark:border-zinc-800 dark:hover:bg-zinc-800/50"
                >
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-2 text-[15px] font-semibold text-gray-900 dark:text-zinc-100">
                      <Server className="h-4 w-4 shrink-0 text-gray-400" />
                      {s.domain}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-gray-600 dark:text-zinc-400">{s.state || s.status || 'Active'}</td>
                  <td className="px-4 py-2 text-gray-600 dark:text-zinc-400">{s.package || '—'}</td>
                  <td className="px-4 py-2 text-gray-600 dark:text-zinc-400">{s.owner || 'admin'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {loading && sites.length === 0 && (
        <div className="flex items-center justify-center gap-2 py-8 text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" /> A carregar…
        </div>
      )}
    </div>
  );
}
