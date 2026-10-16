'use client';

import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { NotchSection } from '@/components/home/NotchSection';
import { AlertCircle, CheckCircle2, Smartphone, Landmark, Paperclip, Clock } from 'lucide-react';
import { MPESA_NUMBER, BANK_NAME, BANK_ACCOUNT, BANK_NIB } from '@/lib/quotation-payment-info';
import { formatMt } from '@/lib/pricing-catalog';
import { Spinner } from '@/components/ui/spinner';
import { groupIntoBatches, type BatchItem, type QuotationBatch } from '@/lib/quotation-batch';
import { useBatchNumeros, displayNumero } from '@/lib/use-batch-numeros';
import { isComprovativoRejeitado, type ComprovativoFase } from '@/lib/quotation-comprovativo';
import { encomendaPaymentSplit } from '@/lib/encomenda-checkout';

type Quotation = BatchItem & {
  categoria_label: string;
  produto: string;
  quantidade: number;
};

type Mode = 'advance' | 'remainder';

type PendingEntry = {
  batch: QuotationBatch<Quotation>;
  mode: Mode;
  valor: number;
};

function CotacaoPagamentoContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id as string;
  // Modo embutido — usado dentro de /encomendas (iframe): esconde o
  // cabeçalho do site e a navegação.
  const embed = searchParams.get('embed') === '1';

  const [quotations, setQuotations] = useState<Quotation[] | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [metodo, setMetodo] = useState<'mpesa' | 'transferencia' | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const numeros = useBatchNumeros();

  const fetchQuotations = async () => {
    try {
      const res = await fetch('/api/cotacoes');
      const data = await res.json();
      setQuotations(data.success ? data.quotations : []);
    } catch {
      setQuotations([]);
    }
  };

  useEffect(() => {
    fetchQuotations();
  }, []);

  const pendentes = useMemo<PendingEntry[]>(() => {
    if (!quotations) return [];
    const batches = groupIntoBatches(quotations);
    const entries: PendingEntry[] = [];
    for (const batch of batches) {
      if (batch.sobConsulta) continue; // sem valor fixo — nada para pagar ainda
      // Com IVA acrescido — os mesmos valores do documento da cotação/factura
      // e do checkout (antes eram 70%/30% do total sem IVA).
      const split = encomendaPaymentSplit(batch.totalMt);
      if (batch.status === 'pending' || batch.status === 'payment_selected') {
        entries.push({ batch, mode: 'advance', valor: split.adiantamentoMt });
      } else if (batch.status === 'delivered') {
        entries.push({ batch, mode: 'remainder', valor: split.remanescenteMt });
      }
    }
    return entries;
  }, [quotations]);

  // Selecciona por omissão a encomenda a partir da qual se chegou aqui
  // (o `id` do URL), senão a primeira da lista.
  useEffect(() => {
    if (selectedBatchId || pendentes.length === 0) return;
    const fromUrl = pendentes.find((p) => p.batch.items.some((i) => i.id === id));
    setSelectedBatchId((fromUrl ?? pendentes[0]).batch.batchId);
  }, [pendentes, id, selectedBatchId]);

  const selected = pendentes.find((p) => p.batch.batchId === selectedBatchId) ?? null;
  // Ligado ao estado real da encomenda (não a um estado local que se perdia
  // ao sair da página) — enquanto o método já foi escolhido mas a equipa
  // ainda não avançou o estado, mostra sempre o passo de anexar comprovativo,
  // independentemente de quanto tempo o cliente demore a voltar.
  const awaitingProof = selected?.batch.status === 'payment_selected';

  const handleConfirm = async () => {
    if (!metodo || !selected) return;
    setConfirming(true);
    setErrorMessage('');
    try {
      const anchorId = selected.batch.primaryItem.id;
      const endpoint = selected.mode === 'remainder' ? 'pagamento-remanescente' : 'pagamento';
      const res = await fetch(`/api/cotacoes/${anchorId}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metodoPagamento: metodo }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Não foi possível confirmar o método de pagamento.');
      }
      await fetchQuotations();
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao comunicar com o servidor.');
    } finally {
      setConfirming(false);
    }
  };

  const content = (
    <>
      {quotations === null ? (
        <div className="flex items-center justify-center min-h-[60vh] py-12">
          <Spinner className="w-8 h-8" />
        </div>
      ) : pendentes.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-8 text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-amber-500 mx-auto" />
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">Nada para pagar neste momento</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Não tem encomendas com pagamento pendente agora. Consulte o estado actual no seu painel.
          </p>
          <Link
            href="/encomendas"
            target={embed ? '_top' : undefined}
            className="inline-block mt-2 bg-red-600 hover:bg-red-700 text-white font-bold px-6 py-2.5 rounded-md text-sm transition-colors"
          >
            Ir para as Minhas Encomendas
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4 lg:gap-6 items-start w-full">
          {/* Coluna esquerda — lista de encomendas com pagamento pendente */}
          <div className="space-y-2">
            {pendentes.map((p) => {
              const isSelected = p.batch.batchId === selectedBatchId;
              const numero = displayNumero(numeros, p.batch.batchId);
              return (
                <button
                  key={p.batch.batchId}
                  type="button"
                  onClick={() => {
                    setSelectedBatchId(p.batch.batchId);
                    setMetodo(null);
                    setErrorMessage('');
                  }}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    isSelected
                      ? 'border-red-400 bg-red-50/50 dark:bg-red-950/10 dark:border-red-900/50'
                      : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-red-300'
                  }`}
                >
                  <p className="text-xs font-bold text-black dark:text-white">Nº {numero}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                    {p.mode === 'remainder' ? 'Remanescente (30%)' : 'Adiantamento (70%)'}
                  </p>
                  <p className="text-lg font-bold text-zinc-900 dark:text-white mt-1">{formatMt(p.valor)} MT</p>
                  {p.batch.status === 'payment_selected' && (
                    <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-bold text-blue-700 dark:text-blue-400">
                      <Clock className="w-3 h-3" /> Aguarda confirmação
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Coluna direita — itens da encomenda seleccionada + acção de pagamento */}
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 w-full">
            {!selected ? (
              <p className="text-sm text-zinc-400">Seleccione uma encomenda à esquerda.</p>
            ) : (
              <FaturaResumo selected={selected}>
                {awaitingProof ? (
                  <ComprovativoInline
                    quotationId={selected.batch.primaryItem.id}
                    fase={selected.mode === 'remainder' ? 'remanescente' : 'adiantamento'}
                  />
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2 justify-end">
                      <button
                        type="button"
                        onClick={() => setMetodo('mpesa')}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-md border text-sm font-bold transition-colors ${
                          metodo === 'mpesa'
                            ? 'border-red-600 bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400'
                            : 'border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-red-300'
                        }`}
                      >
                        <Smartphone className="w-4 h-4" /> M-Pesa
                      </button>
                      <button
                        type="button"
                        onClick={() => setMetodo('transferencia')}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-md border text-sm font-bold transition-colors ${
                          metodo === 'transferencia'
                            ? 'border-red-600 bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400'
                            : 'border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-red-300'
                        }`}
                      >
                        <Landmark className="w-4 h-4" /> Transferência
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={!metodo || confirming}
                        className="inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold px-5 py-2 rounded-md text-sm transition-colors"
                      >
                        {confirming ? <Spinner className="w-4 h-4" /> : 'Confirmar'}
                      </button>
                    </div>

                    {errorMessage && (
                      <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-lg p-3 flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-500 mt-0.5 shrink-0" />
                        <p className="text-sm text-red-800 dark:text-red-300">{errorMessage}</p>
                      </div>
                    )}

                    {metodo === 'mpesa' && (
                      <div className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 text-sm text-zinc-700 dark:text-zinc-300">
                        Envie o valor para <span className="font-bold">{MPESA_NUMBER}</span>.
                      </div>
                    )}
                    {metodo === 'transferencia' && (
                      <div className="bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800 rounded-lg p-4 text-sm text-zinc-700 dark:text-zinc-300 space-y-0.5">
                        <p>{BANK_NAME}</p>
                        <p>Conta BCI: <span className="font-bold">{BANK_ACCOUNT}</span></p>
                        <p>NIB: <span className="font-bold">{BANK_NIB}</span></p>
                      </div>
                    )}
                  </div>
                )}
              </FaturaResumo>
            )}
          </div>
        </div>
      )}
    </>
  );

  if (embed) {
    return (
      <div className="min-h-screen bg-white">
        <div className="w-full px-4 py-4">{content}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-200 dark:bg-black">
      <NotchSection shape="start" bg="bg-gradient-to-br from-black via-zinc-900 to-zinc-950" first>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-red-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="container mx-auto max-w-7xl px-6 pt-[170px] pb-[70px] relative z-10 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">Método de Pagamento</h1>
          <p className="text-base text-zinc-300 max-w-2xl mx-auto leading-relaxed mb-4">
            Escolha a encomenda e o método para fazer o pagamento.
          </p>
          <nav className="text-xs text-zinc-400">
            <Link href="/" className="hover:text-white transition-colors">Início</Link>
            <span className="mx-2">/</span>
            <Link href="/precos" className="hover:text-white transition-colors">Preços</Link>
            <span className="mx-2">/</span>
            <span className="text-zinc-300">Pagamento</span>
          </nav>
        </div>
        <div className="absolute bottom-0 left-0 right-0">
          <div className="h-[2px] bg-gradient-to-r from-transparent via-zinc-500 to-transparent" />
          <div className="h-[1px] bg-gradient-to-r from-transparent via-red-600 to-transparent" />
        </div>
      </NotchSection>

      <NotchSection shape="mid" bg="bg-zinc-200 dark:bg-black" className="py-12">
        <div className="max-w-5xl mx-auto px-4">{content}</div>
      </NotchSection>
    </div>
  );
}

/** Itens da encomenda (formato de factura) + resumo com IVA, seguido da acção de pagamento passada como children. */
function FaturaResumo({ selected, children }: { selected: PendingEntry; children: React.ReactNode }) {
  const { batch, valor, mode } = selected;
  const split = encomendaPaymentSplit(batch.totalMt);

  return (
    <div className="space-y-5">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-300 dark:border-zinc-700 text-left text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              <th className="pb-2 font-bold w-10">Nº</th>
              <th className="pb-2 font-bold">Descrição</th>
              <th className="pb-2 font-bold text-right">Qtd.</th>
              <th className="pb-2 font-bold text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {batch.items.map((item, idx) => (
              <tr key={item.id} className="border-b border-zinc-100 dark:border-zinc-800">
                <td className="py-3 text-zinc-500 dark:text-zinc-400">{idx + 1}</td>
                <td className="py-3">
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200">{item.categoria_label}</span>
                  <br />
                  <span className="text-zinc-500 dark:text-zinc-400">{item.produto}</span>
                </td>
                <td className="py-3 text-right text-zinc-700 dark:text-zinc-300">{item.quantidade}</td>
                <td className="py-3 text-right font-bold text-zinc-900 dark:text-white">
                  {item.sob_consulta ? 'Sob Consulta' : `${formatMt(item.total_mt)} MT`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col items-end gap-1 text-sm border-t border-zinc-200 dark:border-zinc-800 pt-4">
        <div className="flex justify-between w-full max-w-xs text-zinc-500 dark:text-zinc-400">
          <span>Subtotal</span>
          <span>{formatMt(split.subtotalMt)} MT</span>
        </div>
        <div className="flex justify-between w-full max-w-xs text-zinc-500 dark:text-zinc-400">
          <span>IVA (16%, acrescido)</span>
          <span>{formatMt(split.ivaMt)} MT</span>
        </div>
        <div className="flex justify-between w-full max-w-xs text-zinc-500 dark:text-zinc-400">
          <span>Valor total da factura</span>
          <span>{formatMt(split.totalComIvaMt)} MT</span>
        </div>
        <div className="flex justify-between w-full max-w-xs font-bold text-zinc-900 dark:text-white text-base pt-1 border-t border-zinc-200 dark:border-zinc-800">
          <span>{mode === 'remainder' ? 'Remanescente (30%)' : 'Adiantamento (70%)'}</span>
          <span>{formatMt(valor)} MT</span>
        </div>
      </div>

      {children}
    </div>
  );
}

/**
 * Anexar comprovativo — embutido na página (sem popup), para não se perder ao
 * sair/voltar. A `fase` marca o anexo para a Contabilidade › Encomendas saber
 * se é o comprovativo do adiantamento ou do remanescente.
 */
function ComprovativoInline({ quotationId, fase }: { quotationId: string; fase: ComprovativoFase }) {
  const [checking, setChecking] = useState(true);
  const [alreadySent, setAlreadySent] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setChecking(true);
    fetch(`/api/cotacoes/${quotationId}/anexos`)
      .then((r) => r.json())
      .then((data) => {
        // Só conta um comprovativo do cliente para ESTA fase e ainda não
        // rejeitado pela equipa — antes qualquer anexo bastava, o que
        // bloqueava o remanescente (o anexo do adiantamento já lá estava) e
        // um reenvio depois de uma rejeição. Anexos sem marca (encomendas
        // antigas) contam como o do adiantamento.
        const anexos: { uploaded_by_role: string; file_name: string; comprovativo_fase: ComprovativoFase | null }[] =
          data.success && Array.isArray(data.anexos) ? data.anexos : [];
        const validos = anexos.filter((a) => a.uploaded_by_role === 'client' && !isComprovativoRejeitado(a.file_name));
        setAlreadySent(
          validos.some((a) => a.comprovativo_fase === fase) ||
            (fase === 'adiantamento' && validos.some((a) => !a.comprovativo_fase)),
        );
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, [quotationId]);

  const handleSend = async () => {
    if (!file) return;
    setSending(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fase', fase);
      const res = await fetch(`/api/cotacoes/${quotationId}/anexos`, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Não foi possível enviar o comprovativo.');
      setSent(true);
    } catch (err: any) {
      setError(err.message || 'Não foi possível enviar o comprovativo.');
    } finally {
      setSending(false);
    }
  };

  if (checking) {
    return (
      <div className="flex justify-center py-6">
        <Spinner className="w-6 h-6" />
      </div>
    );
  }

  if (alreadySent || sent) {
    return (
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 text-center space-y-2">
        <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto" />
        <p className="font-bold text-zinc-900 dark:text-white">Comprovativo enviado</p>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          A nossa equipa vai confirmar o recebimento e actualizar o estado da sua encomenda.
        </p>
      </div>
    );
  }

  if (collapsed) {
    return (
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-2.5 rounded-md text-sm transition-colors"
        >
          <Paperclip className="w-4 h-4" />
          Anexar comprovativo
        </button>
      </div>
    );
  }

  return (
    <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 space-y-3">
      <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
        <Clock className="w-4 h-4" />
        <p className="font-bold text-sm">Método registado — falta anexar o comprovativo</p>
      </div>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Envie uma foto ou PDF do comprovativo do pagamento (M-Pesa ou transferência). A nossa equipa confirma o
        recebimento e actualiza o estado da sua encomenda.
      </p>

      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => setFile(e.target.files?.[0] || null)}
        className="hidden"
        disabled={sending}
      />
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={sending}
        className="w-full inline-flex items-center gap-2 justify-start border border-zinc-200 dark:border-zinc-800 rounded-md px-3 py-2.5 text-sm text-zinc-700 dark:text-zinc-300 hover:border-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/10 dark:hover:text-red-400 transition-colors truncate"
      >
        <Paperclip className="w-4 h-4 shrink-0" />
        <span className="truncate">{file ? file.name : 'Escolher ficheiro'}</span>
      </button>

      {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="flex-1 border border-zinc-200 dark:border-zinc-800 rounded-md px-4 py-2 text-sm font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
        >
          Mais tarde
        </button>
        <button
          type="button"
          onClick={handleSend}
          disabled={!file || sending}
          className="flex-1 inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold px-4 py-2 rounded-md text-sm transition-colors"
        >
          {sending ? <Spinner className="w-4 h-4" /> : 'Enviar'}
        </button>
      </div>
    </div>
  );
}

export default function CotacaoPagamentoPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black">
          <Spinner className="w-10 h-10" />
        </div>
      }
    >
      <CotacaoPagamentoContent />
    </Suspense>
  );
}
