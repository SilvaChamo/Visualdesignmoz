'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { XCircle, Pencil, CreditCard, AlertCircle, Loader2, CheckCircle2, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase-client';
import { Spinner } from '@/components/ui/spinner';
import { formatMt } from '@/lib/pricing-catalog';
import { statusMeta, computeBatchStatus } from '@/lib/quotation-status-labels';
import { panelTabBar, panelTabBtn, panelTabBtnActive, panelTabBtnInactive, panelBtnPrimary, panelBtnSecondary } from '@/lib/panel-ui';
import { QuotationHistoryTimeline } from '@/components/quotations/QuotationHistoryTimeline';
import { QuotationMessagesThread } from '@/components/quotations/QuotationMessagesThread';
import { EncomendaEditForm } from '@/components/quotations/EncomendaEditForm';

type QuotationRow = {
  id: string;
  batch_id: string;
  empresa: string;
  categoria_id: string;
  categoria_label: string;
  produto: string;
  preco_unitario_mt: number;
  quantidade: number;
  data_limite_entrega: string;
  total_mt: number;
  sob_consulta: boolean;
  status: string;
  notas: string | null;
  cancellation_reason: string | null;
  rejection_reason: string | null;
  created_at: string;
};

type Tab = 'detalhes' | 'historico' | 'mensagens' | 'cotacao' | 'facturas';

// Anexos e Layouts deixaram de ser abas — vivem dentro da conversa em
// "Mensagens" (QuotationMessagesThread mostra tudo inline).
const TABS: { id: Tab; label: string }[] = [
  { id: 'detalhes', label: 'Detalhes da Encomenda' },
  { id: 'historico', label: 'Histórico' },
  { id: 'mensagens', label: 'Mensagens' },
  { id: 'cotacao', label: 'Cotação' },
  { id: 'facturas', label: 'Facturas' },
];

// Altura dinâmica em vez de um valor fixo — um iframe normal não cresce com o
// conteúdo, por isso ou sobra espaço em branco (valor alto de mais para uma
// factura curta) ou corta o documento (valor baixo de mais). O documento
// embutido (/cotacao) mostra primeiro um spinner e só depois busca os dados —
// medir apenas uma vez no onLoad apanhava sempre o spinner (pequeno) e nunca
// mais actualizava. Um ResizeObserver no próprio documento (mesma origem)
// acompanha a altura real em contínuo, incluindo quando o conteúdo aparece
// depois, e ajusta o iframe exactamente ao que existe.
//
// Importante: mede `body.scrollHeight`, nunca `documentElement.scrollHeight`
// — este último nunca é menor do que o próprio iframe (é assim que os
// browsers o definem: inclui sempre a área visível), por isso nunca
// encolhia de volta para facturas curtas depois de crescer uma vez.
function AutoHeightIframe({ src, title }: { src: string; title: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState<number>(400);

  const handleLoad = useCallback(() => {
    try {
      const doc = ref.current?.contentWindow?.document;
      if (!doc) return;
      const update = () => setHeight(doc.body.scrollHeight);
      update();
      const observer = new ResizeObserver(update);
      observer.observe(doc.body);
    } catch {
      /* cross-origin — fica com a altura por omissão */
    }
  }, []);

  return (
    <iframe
      ref={ref}
      src={src}
      title={title}
      onLoad={handleLoad}
      className="w-full border-0"
      style={{ height }}
    />
  );
}

export function EncomendaDetalhe({
  quotationId,
  onChanged,
}: {
  quotationId: string;
  onChanged: () => void;
}) {
  const [items, setItems] = useState<QuotationRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('detalhes');
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [actionError, setActionError] = useState('');

  const fetchQuotation = useCallback(async () => {
    setLoading(true);
    const { data: row } = await supabase.from('quotation_requests').select('*').eq('id', quotationId).single();
    if (!row) {
      setItems(null);
      setLoading(false);
      return;
    }
    const { data: siblings } = await supabase
      .from('quotation_requests')
      .select('*')
      .eq('batch_id', row.batch_id)
      .order('created_at', { ascending: true });
    setItems((siblings && siblings.length > 0 ? siblings : [row]) as QuotationRow[]);
    setLoading(false);
  }, [quotationId]);

  useEffect(() => {
    setTab('detalhes');
    setEditingItemId(null);
    setActionError('');
    fetchQuotation();
  }, [quotationId, fetchQuotation]);

  const handleCancelar = async () => {
    if (!window.confirm('Tem a certeza que quer cancelar esta encomenda?')) return;
    const motivo = window.prompt('Motivo do cancelamento (opcional):', '') || '';
    setCancelling(true);
    setActionError('');
    try {
      const res = await fetch(`/api/cotacoes/${quotationId}/cancelar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Não foi possível cancelar a encomenda.');
      await fetchQuotation();
      onChanged();
    } catch (err: any) {
      setActionError(err.message || 'Falha ao comunicar com o servidor.');
    } finally {
      setCancelling(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Spinner className="w-6 h-6" />
      </div>
    );
  }

  if (!items || items.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] text-sm text-gray-400 dark:text-zinc-500">
        Não foi possível carregar esta encomenda.
      </div>
    );
  }

  const primary = items[0];
  const status = computeBatchStatus(items);
  const allSobConsulta = items.every((i) => i.sob_consulta);
  const meta = statusMeta(status, allSobConsulta);
  const rejectionReason = items.find((i) => i.rejection_reason)?.rejection_reason;
  const cancellationReason = items.find((i) => i.cancellation_reason)?.cancellation_reason;

  const canEditOrCancel = status === 'pending';
  const canCancelOnly = status === 'payment_selected';
  const canPay = status === 'pending' && !allSobConsulta;
  const canPayRemainder = status === 'delivered';

  const hasStatusStrip = canPayRemainder || Boolean(rejectionReason) || Boolean(cancellationReason) || Boolean(actionError);

  return (
    <div className="flex flex-col h-full">
      <div className={`${panelTabBar} px-4 pt-3`}>
        {/* os separadores assentam em baixo e a linha vermelha do ativo cobre a linha cinzenta da barra (Silva, 23/10/2026) */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap gap-5 -mb-px">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`${panelTabBtn} ${tab === t.id ? panelTabBtnActive : panelTabBtnInactive}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0 pb-2.5">
            {/* Quando há uma ação disponível (cancelar), mostra o botão aqui
                em vez do badge passivo — o badge só aparece quando não há
                nada para o cliente fazer agora. Pagar fica junto aos itens,
                não aqui (ver fim da lista na aba "Detalhes da Encomenda"). */}
            {canEditOrCancel || canCancelOnly ? (
              <button type="button" className={panelBtnSecondary} onClick={handleCancelar} disabled={cancelling}>
                {cancelling ? <Spinner className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                Cancelar
              </button>
            ) : (
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold border shrink-0 ${meta.color}`}>{meta.label}</span>
            )}
          </div>
        </div>
      </div>

      {hasStatusStrip && (
        <div className="px-4 py-3 border-b border-gray-100 dark:border-zinc-800 space-y-2">
          {canPayRemainder && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-900/50 text-xs text-indigo-800 dark:text-indigo-300">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <p>Todos os itens desta encomenda estão concluídos. Para a levantar, falta efectuar o pagamento do remanescente.</p>
            </div>
          )}

          {rejectionReason && (
            <p className="text-sm text-rose-600 dark:text-rose-400">Motivo da rejeição: {rejectionReason}</p>
          )}
          {cancellationReason && (
            <p className="text-sm text-gray-500 dark:text-zinc-400">Motivo do cancelamento: {cancellationReason}</p>
          )}

          {actionError && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 text-xs text-red-800 dark:text-red-300">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>{actionError}</p>
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {tab === 'detalhes' && (
          <div className="p-4 space-y-2">
            {items.map((item) => {
              const isEditing = editingItemId === item.id;
              return (
                <div key={item.id} className="rounded-lg border border-gray-200 dark:border-zinc-800 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-gray-900 dark:text-white truncate">{item.categoria_label}</p>
                      <p className="text-xs text-gray-500 dark:text-zinc-400 truncate">
                        {item.produto} · Qtd: {item.quantidade} · {item.sob_consulta ? 'Sob Consulta' : `${formatMt(item.total_mt)} MT`}
                      </p>
                    </div>
                    {item.status === 'rejected' && !isEditing && (
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${statusMeta(item.status).color}`}>{statusMeta(item.status).label}</span>
                        <button type="button" className={panelBtnSecondary} onClick={() => setEditingItemId(item.id)} title="Editar a encomenda e voltar a submetê-la">
                          <Pencil className="w-4 h-4" /> Editar
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (!window.confirm('Eliminar esta encomenda? Esta ação não pode ser desfeita.')) return;
                            const r = await fetch(`/api/cotacoes/${item.id}`, { method: 'DELETE' });
                            const j = await r.json().catch(() => ({}));
                            if (r.ok && j.success) onChanged();
                            else window.alert(j.error || 'Não foi possível eliminar a encomenda.');
                          }}
                          className="text-gray-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-500 transition-colors p-1"
                          title="Eliminar encomenda"
                          aria-label="Eliminar encomenda"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                    {item.status === 'pending' && !isEditing && (
                      <button
                        type="button"
                        className={`${panelBtnSecondary} shrink-0`}
                        onClick={() => setEditingItemId(item.id)}
                      >
                        <Pencil className="w-4 h-4" /> Editar
                      </button>
                    )}
                    {(item.status === 'delivered' || item.status === 'done') && (
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold border shrink-0 ${statusMeta(item.status).color}`}>
                        {statusMeta(item.status).label}
                      </span>
                    )}
                  </div>

                  {isEditing && (
                    <div className="mt-3">
                      <EncomendaEditForm
                        quotation={item}
                        onCancel={() => setEditingItemId(null)}
                        onSaved={async () => {
                          setEditingItemId(null);
                          await fetchQuotation();
                          onChanged();
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
            {(canPay || canPayRemainder) && (
              <div className="pt-2">
                {canPay && (
                  <a href={`/cotacao/${primary.id}/pagamento`} className={panelBtnPrimary}>
                    <CreditCard className="w-4 h-4" /> Continuar para Pagamento
                  </a>
                )}
                {canPayRemainder && (
                  <a href={`/cotacao/${primary.id}/pagamento`} className={panelBtnPrimary}>
                    <CreditCard className="w-4 h-4" /> Pagar Remanescente
                  </a>
                )}
              </div>
            )}
          </div>
        )}
        {tab === 'historico' && <div className="p-4"><QuotationHistoryTimeline quotationId={primary.id} /></div>}
        {tab === 'mensagens' && <div className="p-4 h-[520px] mx-auto max-w-xl"><QuotationMessagesThread quotationId={primary.id} viewerRole="client" /></div>}
        {tab === 'cotacao' && (
          <iframe
            key={primary.id}
            src={`/cotacao/${primary.id}?embed=1&payment=1`}
            className="w-full h-full min-h-[600px] border-0"
            title="Cotação"
          />
        )}
        {tab === 'facturas' && (
          <div className="p-4 space-y-4">
            <div>
              <p className="text-xs font-bold uppercase text-gray-400 dark:text-zinc-500 mb-2">Factura do adiantamento</p>
              {['approved', 'delivered', 'done'].includes(status) ? (
                <AutoHeightIframe
                  key={`${primary.id}-factura-adiantamento`}
                  src={`/cotacao/${primary.id}?embed=1&tipo=factura&fase=adiantamento`}
                  title="Factura do adiantamento"
                />
              ) : (
                <div className="rounded-lg border border-gray-200 dark:border-zinc-800 p-4 text-sm text-gray-500 dark:text-zinc-400">
                  Fica disponível aqui assim que a equipa confirmar o pagamento do adiantamento.
                </div>
              )}
            </div>
            {status === 'done' && (
              <div>
                <p className="text-xs font-bold uppercase text-gray-400 dark:text-zinc-500 mb-2">Factura do remanescente</p>
                <AutoHeightIframe
                  key={`${primary.id}-factura-remanescente`}
                  src={`/cotacao/${primary.id}?embed=1&tipo=factura&fase=remanescente`}
                  title="Factura do remanescente"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
