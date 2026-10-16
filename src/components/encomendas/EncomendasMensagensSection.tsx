'use client';

import { useEffect, useState, useMemo } from 'react';
import { FileText } from 'lucide-react';
import { formatMt } from '@/lib/pricing-catalog';
import { statusMeta } from '@/lib/quotation-status-labels';
import { groupIntoBatches, type BatchItem } from '@/lib/quotation-batch';
import { useBatchNumeros, displayNumero } from '@/lib/use-batch-numeros';
import { QuotationMessagesThread } from '@/components/quotations/QuotationMessagesThread';
import { Spinner } from '@/components/ui/spinner';

type Quotation = BatchItem & {
  categoria_label: string;
  produto: string;
};

export function EncomendasMensagensSection({
  initialQuotationId,
  onMessageSent,
}: {
  initialQuotationId?: string | null;
  onMessageSent?: () => void;
}) {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(initialQuotationId ?? null);

  useEffect(() => {
    fetch('/api/cotacoes')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setQuotations(data.quotations);
          setSelectedId((prev) => prev ?? (data.quotations[0]?.id ?? null));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const batches = useMemo(() => groupIntoBatches(quotations), [quotations]);
  const numeros = useBatchNumeros();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-4 lg:gap-6 items-start">
      <div className="space-y-3">
        {loading && (
          <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 text-sm text-gray-500 dark:text-zinc-400">
            <Spinner /> A carregar...
          </div>
        )}
        {!loading && quotations.length === 0 && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 text-sm text-gray-500 dark:text-zinc-400">
            Ainda não tem encomendas — não há sobre o que falar com a equipa.
          </div>
        )}
        {batches.map((batch) => {
          const meta = statusMeta(batch.status, batch.sobConsulta);
          const anchor = batch.primaryItem;
          const isSelected = batch.items.some((i) => i.id === selectedId);
          return (
            <button
              key={batch.batchId}
              type="button"
              onClick={() => setSelectedId(anchor.id)}
              className={`w-full text-left flex items-start gap-3 p-4 rounded-lg border transition-all ${
                isSelected
                  ? 'border-red-400 bg-red-50/50 dark:bg-red-950/10 dark:border-red-900/50'
                  : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-red-300 dark:hover:border-red-500'
              }`}
            >
              <div className="w-9 h-9 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                <FileText className="w-4 h-4 text-red-600 dark:text-red-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-base text-black dark:text-white truncate">Encomenda: Nº {displayNumero(numeros, batch.batchId)}</p>
                <p className="text-sm text-gray-500 dark:text-zinc-400 mt-0.5">
                  {batch.sobConsulta ? 'Sob Consulta' : `${formatMt(batch.totalMt)} MT`}
                </p>
                <span className={`inline-block mt-2 px-2 py-0.5 rounded-md text-[11px] font-bold border ${meta.color}`}>
                  {meta.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg min-h-[500px] p-4">
        {selectedId ? (
          <div className="mx-auto max-w-xl">
            <QuotationMessagesThread quotationId={selectedId} viewerRole="client" onSent={onMessageSent} />
          </div>
        ) : (
          !loading && (
            <div className="flex items-center justify-center min-h-[460px] text-sm text-gray-400 dark:text-zinc-500">
              Seleccione uma encomenda para conversar com a equipa.
            </div>
          )
        )}
      </div>
    </div>
  );
}
