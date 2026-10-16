'use client';

import { useEffect, useState } from 'react';
import { formatMt } from '@/lib/pricing-catalog';
import { panelSectionCard } from '@/lib/panel-ui';
import { checkoutItemSummary, type CheckoutItemLike } from '@/lib/checkout-item-labels';
import { openDocumentWindow } from '@/components/documents/VisualDesignDocument';
import { Spinner } from '@/components/ui/spinner';

type Compra = {
  id: string;
  items: CheckoutItemLike[];
  total_mt: number;
  metodo_pagamento: string;
  status: 'pending' | 'paid' | 'failed' | 'expired' | string;
  created_at: string;
  /** Algum serviço desta compra já passou da data sem ser renovado (ver a rota). */
  renovacao_url: string | null;
};

// Mesmas cores/rótulos da Contabilidade (ContabilidadeTable → ITEM_STATUS_META).
const STATUS_META: Record<string, { label: string; className: string }> = {
  pending: { label: 'Pendente', className: 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400' },
  paid: { label: 'Confirmado', className: 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400' },
  failed: { label: 'Rejeitado', className: 'bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400' },
  expired: { label: 'Expirado', className: 'bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-zinc-400' },
};
const RENOVACAO_META = { label: 'Exige renovação', className: 'bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400' };

// Rótulos curtos da Contabilidade (ContabilidadeTable → METODO_LABEL).
const METODO_LABEL: Record<string, string> = { mpesa: 'M-Pesa', emola: 'e-Mola', transferencia: 'Transferência', stripe: 'Cartão' };

const TH = 'px-4 py-2 align-middle whitespace-nowrap';
const TD = 'whitespace-nowrap px-4 py-2.5';
const LINK = 'text-xs font-medium text-red-600 hover:underline dark:text-red-400';

export function MinhasComprasSection() {
  const [compras, setCompras] = useState<Compra[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    fetch('/api/client/minhas-compras')
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.success) setCompras(data.compras);
        else setError(data.error || 'Não foi possível carregar as suas compras.');
      })
      .catch(() => { if (!cancelled) setError('Não foi possível carregar as suas compras.'); });
    return () => { cancelled = true; };
  }, []);

  if (error) {
    return <div className={`${panelSectionCard} p-8 text-center text-sm text-red-600 dark:text-red-400`}>{error}</div>;
  }

  if (!compras) {
    return <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-400 dark:text-zinc-500"><Spinner /> A carregar as suas compras...</div>;
  }

  if (compras.length === 0) {
    return <div className={`${panelSectionCard} p-8 text-center text-sm text-gray-500 dark:text-zinc-400`}>Ainda não fez nenhuma compra.</div>;
  }

  return (
    <div className={`${panelSectionCard} overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-xs font-bold uppercase tracking-wide text-gray-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
              <th className={`${TH} text-left`}>Descrição</th>
              <th className={`${TH} text-left`}>Preço</th>
              <th className={`${TH} text-left`}>Método</th>
              {/* Espaço livre — empurra Data/Estado/Recibo para a direita. */}
              <th aria-hidden className="w-full" />
              <th className={`${TH} text-right`}>Data</th>
              <th className={`${TH} text-right`}>Estado</th>
              <th className={`${TH} text-right`}>Recibo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
            {compras.map((compra) => {
              const meta = compra.renovacao_url ? RENOVACAO_META : STATUS_META[compra.status] || STATUS_META.pending;
              const [primeiro, ...outros] = compra.items;
              const descricao = primeiro ? checkoutItemSummary(primeiro) : '—';
              const outrosNomes = outros.map((i) => i.name).filter(Boolean).join(', ');
              return (
                <tr key={compra.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/30">
                  <td className={`${TD} font-medium text-gray-900 dark:text-white`}>
                    <div className="max-w-[20rem] truncate" title={outrosNomes ? `${descricao} (+ ${outrosNomes})` : descricao}>
                      {descricao}
                      {outrosNomes && <span className="text-gray-400 dark:text-zinc-500"> (+ {outrosNomes})</span>}
                    </div>
                  </td>
                  <td className={`${TD} font-bold tabular-nums text-gray-900 dark:text-white`}>
                    {formatMt(Number(compra.total_mt) || 0)} MT
                  </td>
                  <td className={`${TD} text-gray-500 dark:text-zinc-400`}>
                    {METODO_LABEL[compra.metodo_pagamento] || compra.metodo_pagamento || '—'}
                  </td>
                  <td aria-hidden />
                  <td className={`${TD} text-right text-gray-500 dark:text-zinc-400`}>
                    {new Date(compra.created_at).toLocaleDateString('pt-PT')}
                  </td>
                  <td className={`${TD} text-right`}>
                    <div className="inline-flex items-center gap-2">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${meta.className}`}>{meta.label}</span>
                      {compra.renovacao_url && (
                        <a href={compra.renovacao_url} className={LINK}>Renovar</a>
                      )}
                    </div>
                  </td>
                  <td className={`${TD} text-right`}>
                    {compra.status === 'paid' ? (
                      <button
                        type="button"
                        onClick={() => openDocumentWindow(`/recibo/${compra.id}?embed=1`, `recibo-${compra.id}`)}
                        className={LINK}
                      >
                        Ver recibo
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400 dark:text-zinc-500">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
