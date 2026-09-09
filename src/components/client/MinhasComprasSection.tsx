'use client';

import { useEffect, useState } from 'react';
import { ShoppingBag, FileDown, CheckCircle2, Clock, XCircle, AlertCircle } from 'lucide-react';
import { metodoPagamentoLabel } from '@/lib/quotation-payment-info';

type CompraItem = {
  name?: string;
  type?: string;
  price?: number;
  status?: string;
};

type Compra = {
  id: string;
  items: CompraItem[];
  total_mt: number;
  metodo_pagamento: string;
  status: 'pending' | 'paid' | 'failed' | 'expired' | string;
  comprovativo_url: string | null;
  rejection_reason: string | null;
  created_at: string;
};

const STATUS_META: Record<string, { label: string; icon: typeof Clock; className: string }> = {
  pending: { label: 'Pendente de confirmação', icon: Clock, className: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400' },
  paid: { label: 'Confirmado', icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' },
  failed: { label: 'Rejeitado', icon: XCircle, className: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400' },
  expired: { label: 'Expirado', icon: AlertCircle, className: 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-400' },
};

function formatMt(value: number) {
  return `${Math.round(value).toLocaleString('pt-PT')} MT`;
}

export function MinhasComprasSection() {
  const [compras, setCompras] = useState<Compra[]>([]);
  const [loading, setLoading] = useState(true);
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
      .catch(() => { if (!cancelled) setError('Não foi possível carregar as suas compras.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return <div className="p-6 text-sm text-slate-500 dark:text-zinc-400">A carregar as suas compras…</div>;
  }

  if (error) {
    return <div className="p-6 text-sm text-red-600 dark:text-red-400">{error}</div>;
  }

  if (compras.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-slate-400 space-y-3 py-16">
        <ShoppingBag className="w-12 h-12 opacity-20" />
        <p className="font-medium text-slate-700 dark:text-zinc-300">Ainda não fez nenhuma compra</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {compras.map((compra) => {
        const meta = STATUS_META[compra.status] || STATUS_META.pending;
        const StatusIcon = meta.icon;
        return (
          <div key={compra.id} className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
              <div>
                <p className="text-xs text-slate-400 dark:text-zinc-500">
                  {new Date(compra.created_at).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
                <p className="text-xs text-slate-400 dark:text-zinc-500">{metodoPagamentoLabel(compra.metodo_pagamento)}</p>
              </div>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${meta.className}`}>
                <StatusIcon className="w-3.5 h-3.5" />
                {meta.label}
              </span>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-zinc-800/60 border-t border-b border-slate-100 dark:border-zinc-800/60 py-1 mb-3">
              {compra.items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center py-1.5 text-sm">
                  <span className="text-slate-700 dark:text-zinc-300">{item.name || '—'}</span>
                  <span className="text-slate-500 dark:text-zinc-400">{item.price != null ? formatMt(item.price) : ''}</span>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-bold text-slate-800 dark:text-zinc-100">Total: {formatMt(compra.total_mt)}</span>
              <div className="flex flex-wrap items-center gap-3">
                {compra.status === 'paid' ? (
                  <a
                    href={`/recibo/${compra.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    Recibo
                  </a>
                ) : null}
                {compra.comprovativo_url ? (
                  <a
                    href={compra.comprovativo_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-red-600 dark:text-red-400 hover:underline"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    Ver comprovativo
                  </a>
                ) : null}
              </div>
            </div>

            {compra.status === 'failed' && compra.rejection_reason ? (
              <p className="mt-2 text-xs text-red-600 dark:text-red-400">Motivo: {compra.rejection_reason}</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
