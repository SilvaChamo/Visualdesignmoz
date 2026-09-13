'use client';

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { statusMeta } from '@/lib/quotation-status-labels';

type HistoryEntry = {
  id: string;
  status: string;
  note: string | null;
  changed_by: 'client' | 'admin' | 'system';
  created_at: string;
};

const CHANGED_BY_LABEL: Record<HistoryEntry['changed_by'], string> = {
  client: 'Cliente',
  admin: 'Equipa',
  system: 'Sistema',
};

export function QuotationHistoryTimeline({ quotationId }: { quotationId: string }) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/cotacoes/${quotationId}/historico`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && data.success) setEntries(data.historico);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [quotationId]);

  if (loading) {
    return <p className="flex items-center gap-2 text-sm text-gray-400 dark:text-zinc-500"><Spinner /> A carregar histórico...</p>;
  }

  if (entries.length === 0) {
    return (
      <p className="text-sm text-gray-400 dark:text-zinc-500 flex items-center gap-1.5">
        <Clock className="w-4 h-4" />
        Ainda sem mudanças de estado registadas.
      </p>
    );
  }

  return (
    <ol className="space-y-3">
      {entries.map((entry) => {
        const meta = statusMeta(entry.status);
        return (
          <li key={entry.id} className="flex gap-3">
            <div className="flex flex-col items-center pt-1">
              <span className="w-2.5 h-2.5 rounded-full bg-red-600 shrink-0" />
              <span className="w-px flex-1 bg-gray-200 dark:bg-zinc-700 mt-1" />
            </div>
            <div className="pb-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${meta.color}`}>
                  {meta.label}
                </span>
                <span className="text-xs text-gray-400 dark:text-zinc-500">
                  Por: {CHANGED_BY_LABEL[entry.changed_by]} · {new Date(entry.created_at).toLocaleString('pt-PT')}
                </span>
              </div>
              {entry.note && (
                <p className="text-sm text-gray-600 dark:text-zinc-400 mt-1 italic">"{entry.note}"</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
