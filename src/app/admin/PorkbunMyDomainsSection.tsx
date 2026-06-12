'use client';

import React, { useEffect, useState } from 'react';
import { Globe, Loader2, RefreshCw } from 'lucide-react';
import { useAdminSectionChrome } from '@/components/admin/AdminSectionChrome';

type PorkbunDomainRow = {
  domain: string;
  status?: string;
  expireDate?: string;
  tld?: string;
};

export function PorkbunMyDomainsSection() {
  const [domains, setDomains] = useState<PorkbunDomainRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { setChrome } = useAdminSectionChrome();

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/registrar/account/domains', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Falha ao carregar');
      setDomains(Array.isArray(data.domains) ? data.domains : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar');
      setDomains([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    setChrome({
      toolbar: (
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      ),
    });
    return () => setChrome(null);
  }, [loading, setChrome]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <strong>DirectAdmin:</strong> os websites alojados no servidor estão em{' '}
        <strong>Hospedagem → Sites</strong>, não nesta página. Esta secção lista apenas domínios
        comprados via <strong>Spaceship</strong> (registador).
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-12 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin" /> A carregar…
        </div>
      ) : domains.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white py-12 text-center text-slate-500 shadow-sm">
          <Globe className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          Nenhum domínio encontrado na conta de registo.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs font-bold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Domínio</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">TLD</th>
                <th className="px-4 py-3">Expira</th>
              </tr>
            </thead>
            <tbody>
              {domains.map((d, i) => (
                <tr key={`${d.domain}-${i}`} className="border-t border-slate-100 hover:bg-slate-50/80">
                  <td className="px-4 py-3 font-semibold text-slate-900">{d.domain}</td>
                  <td className="px-4 py-3 text-slate-600">{d.status || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{d.tld || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{d.expireDate || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
