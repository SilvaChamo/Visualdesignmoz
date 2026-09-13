'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { FileText, Trash2, Loader2, XCircle, Plus, X } from 'lucide-react';
import { formatMt } from '@/lib/pricing-catalog';
import { statusMeta } from '@/lib/quotation-status-labels';
import { groupIntoBatches, type BatchItem } from '@/lib/quotation-batch';
import { useBatchNumeros, displayNumero } from '@/lib/use-batch-numeros';
import { EncomendaDetalhe } from '@/components/quotations/EncomendaDetalhe';
import { Spinner } from '@/components/ui/spinner';
import { panelBtnPrimary } from '@/lib/panel-ui';

type Quotation = BatchItem & {
  categoria_label: string;
  produto: string;
  quantidade: number;
};

export function EncomendasListSection() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deletingBatchId, setDeletingBatchId] = useState<string | null>(null);
  const [cancellingBatchId, setCancellingBatchId] = useState<string | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);

  const fetchQuotations = useCallback(async () => {
    try {
      const res = await fetch('/api/cotacoes');
      const data = await res.json();
      if (data.success) {
        setQuotations(data.quotations);
        setSelectedId((prev) => prev ?? (data.quotations[0]?.id ?? null));
      }
    } catch {
      /* silencioso */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuotations();
  }, [fetchQuotations]);

  // O formulário de "Nova Encomenda" corre num iframe (reaproveita /cotacao
  // tal como já acontece na aba "Cotação"/"Facturas") — ao submeter, o
  // próprio iframe não pode navegar para si mesmo, por isso avisa esta janela
  // por postMessage para voltar à lista e mostrar a encomenda recém-criada.
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== 'visualdesign:cotacao-submitted') return;
      setCreatingNew(false);
      fetchQuotations();
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [fetchQuotations]);

  // Cada encomenda é um lote (batch_id) — pode ter vários serviços de
  // categorias diferentes, tal como foi submetida. Uma lista só, uma vez
  // cada encomenda — nunca repetida por categoria (isso confundia quando a
  // mesma encomenda tinha serviços mistos).
  const batches = useMemo(() => groupIntoBatches(quotations), [quotations]);
  const numeros = useBatchNumeros();

  const selectedBatch = batches.find((b) => b.items.some((i) => i.id === selectedId));

  const handleDeleteFromCard = async (e: React.MouseEvent, anchorId: string) => {
    e.stopPropagation();
    if (!window.confirm('Eliminar esta encomenda? Esta ação não pode ser desfeita.')) return;
    const batch = batches.find((b) => b.items.some((i) => i.id === anchorId));
    setDeletingBatchId(batch?.batchId ?? anchorId);
    try {
      const res = await fetch(`/api/cotacoes/${anchorId}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok && data.success) {
        const removedIds = new Set(batch?.items.map((i) => i.id) ?? [anchorId]);
        setQuotations((prev) => prev.filter((q) => !removedIds.has(q.id)));
        setSelectedId((prev) => (prev && removedIds.has(prev) ? null : prev));
      } else {
        window.alert(data.error || 'Não foi possível eliminar a encomenda.');
      }
    } catch {
      window.alert('Não foi possível eliminar a encomenda.');
    } finally {
      setDeletingBatchId(null);
    }
  };

  const handleCancelFromCard = async (e: React.MouseEvent, anchorId: string, batchId: string) => {
    e.stopPropagation();
    if (!window.confirm('Tem a certeza que quer cancelar esta encomenda?')) return;
    const motivo = window.prompt('Motivo do cancelamento (opcional):', '') || '';
    setCancellingBatchId(batchId);
    try {
      const res = await fetch(`/api/cotacoes/${anchorId}/cancelar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo }),
      });
      const data = await res.json();
      if (res.ok && data.success) await fetchQuotations();
    } catch {
      /* silencioso — o botão dentro do painel de detalhe dá o erro completo */
    } finally {
      setCancellingBatchId(null);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-4 lg:gap-6 min-h-0 h-full">
      <div className="space-y-3 lg:overflow-y-auto">
        <button type="button" onClick={() => setCreatingNew(true)} className={`${panelBtnPrimary} w-full justify-center`}>
          <Plus className="w-4 h-4" /> Nova Encomenda
        </button>

        {loading && (
          <div className="flex items-center gap-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 text-base text-gray-500 dark:text-zinc-400">
            <Spinner /> A carregar...
          </div>
        )}

        {!loading && quotations.length === 0 && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 text-base text-gray-500 dark:text-zinc-400">
            Ainda não tem encomendas submetidas.
          </div>
        )}

        {batches.map((batch) => {
          const meta = statusMeta(batch.status, batch.sobConsulta);
          const isSelected = batch.items.some((i) => i.id === selectedId);
          const anchor = batch.primaryItem;
          const resumo =
            batch.items.length === 1
              ? `${anchor.categoria_label} — ${anchor.produto}`
              : `${batch.items.length} serviços`;
          return (
            <div
              key={batch.batchId}
              className={`w-full rounded-lg border transition-all ${
                isSelected
                  ? 'border-red-400 bg-red-50/50 dark:bg-red-950/10 dark:border-red-900/50'
                  : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-gray-100 hover:border-red-300 dark:hover:bg-zinc-800 dark:hover:border-red-500'
              }`}
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => setSelectedId(anchor.id)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedId(anchor.id) } }}
                className="w-full text-left flex items-start gap-3 p-4 cursor-pointer"
              >
                <div className="w-9 h-9 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-red-600 dark:text-red-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-bold text-base text-black dark:text-white truncate">Encomenda Nº {displayNumero(numeros, batch.batchId)}</p>
                  <p className="text-sm text-gray-500 dark:text-zinc-400 mt-0.5 truncate">{resumo}</p>
                  <p className="text-sm text-gray-500 dark:text-zinc-400 mt-0.5">
                    {batch.sobConsulta ? 'Sob Consulta' : `${formatMt(batch.totalMt)} MT`}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={`inline-block px-2 py-0.5 rounded-md text-[11px] font-bold border ${meta.color}`}>
                      {meta.label}
                    </span>
                    {(batch.status === 'pending' || batch.status === 'payment_selected') && (
                      <button
                        type="button"
                        onClick={(e) => handleCancelFromCard(e, anchor.id, batch.batchId)}
                        disabled={cancellingBatchId === batch.batchId}
                        className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-0.5 text-[11px] font-bold text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:text-red-400 dark:hover:bg-red-950/20 transition-colors disabled:opacity-50"
                      >
                        {cancellingBatchId === batch.batchId ? <Spinner className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        Cancelar encomenda
                      </button>
                    )}
                  </div>
                </div>
                {(batch.status === 'done' || batch.status === 'cancelled' || batch.status === 'rejected') && (
                  <button
                    type="button"
                    onClick={(e) => handleDeleteFromCard(e, anchor.id)}
                    disabled={deletingBatchId === batch.batchId}
                    className="shrink-0 text-gray-300 hover:text-red-600 dark:text-zinc-600 dark:hover:text-red-500 transition-colors p-1"
                    title="Eliminar encomenda"
                  >
                    {deletingBatchId === batch.batchId ? <Spinner className="w-4 h-4" /> : <Trash2 className="w-4 h-4" />}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden min-h-[500px]">
        {creatingNew ? (
          <div className="flex flex-col h-full min-h-[500px]">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 dark:border-zinc-800 shrink-0">
              <p className="text-sm font-bold text-gray-900 dark:text-white">Nova Encomenda</p>
              <button
                type="button"
                onClick={() => setCreatingNew(false)}
                className="text-gray-400 hover:text-gray-700 dark:hover:text-zinc-200"
                title="Cancelar e voltar à lista"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <iframe src="/cotacao?panel=1&embed=1" className="w-full flex-1 border-0" title="Nova Encomenda" />
          </div>
        ) : selectedBatch ? (
          <EncomendaDetalhe
            quotationId={selectedBatch.primaryItem.id}
            onChanged={fetchQuotations}
          />
        ) : (
          !loading && (
            <div className="flex items-center justify-center h-full min-h-[500px] text-sm text-gray-400 dark:text-zinc-500">
              Seleccione uma encomenda para ver os detalhes.
            </div>
          )
        )}
      </div>
    </div>
  );
}
