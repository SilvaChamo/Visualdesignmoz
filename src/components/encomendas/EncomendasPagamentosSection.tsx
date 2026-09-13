'use client';

import { useEffect, useState, useMemo } from 'react';
import { Smartphone, Landmark, CheckCircle2, Wallet, FileText } from 'lucide-react';
import { formatMt } from '@/lib/pricing-catalog';
import { MPESA_NUMBER, BANK_NAME, BANK_ACCOUNT, BANK_NIB, metodoPagamentoLabel } from '@/lib/quotation-payment-info';
import { panelCard, panelBtnPrimary, panelBtnSecondary } from '@/lib/panel-ui';
import { Spinner } from '@/components/ui/spinner';
import { groupIntoBatches, type BatchItem } from '@/lib/quotation-batch';
import { useBatchNumeros, displayNumero } from '@/lib/use-batch-numeros';

const FACTURA_STATUSES = ['approved', 'delivered', 'done'];

function openFactura(quotationId: string) {
  const w = 900;
  const h = 1000;
  const left = window.screenX + Math.max(0, (window.outerWidth - w) / 2);
  const top = window.screenY + Math.max(0, (window.outerHeight - h) / 2);
  window.open(
    `/cotacao/${quotationId}?embed=1&tipo=factura`,
    `factura-${quotationId}`,
    `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`,
  );
}

type Quotation = BatchItem & {
  categoria_label: string;
  produto: string;
  metodo_pagamento?: string | null;
  remanescente_metodo_pagamento?: string | null;
};

function MetodoInstrucoes({ metodo }: { metodo: string }) {
  return metodo === 'mpesa' ? (
    <p className="flex items-center gap-1.5"><Smartphone className="w-3.5 h-3.5" /> Envie o valor para {MPESA_NUMBER}</p>
  ) : (
    <div className="flex items-start gap-1.5">
      <Landmark className="w-3.5 h-3.5 mt-0.5 shrink-0" />
      <div>
        <p>{BANK_NAME}</p>
        <p>Conta BCI: <span className="font-bold">{BANK_ACCOUNT}</span></p>
        <p>NIB: <span className="font-bold">{BANK_NIB}</span></p>
      </div>
    </div>
  );
}

export function EncomendasPagamentosSection() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/cotacoes')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setQuotations(data.quotations);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const batches = useMemo(
    () => groupIntoBatches(quotations).filter((b) => ['payment_selected', 'approved', 'delivered'].includes(b.status)),
    [quotations],
  );
  const numeros = useBatchNumeros();

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-gray-400 dark:text-zinc-500">
        <Spinner /> A carregar...
      </p>
    );
  }

  if (batches.length === 0) {
    return (
      <div className={`${panelCard} p-8 text-center text-sm text-gray-500 dark:text-zinc-400`}>
        <Wallet className="w-8 h-8 mx-auto mb-2 text-gray-300 dark:text-zinc-700" />
        Sem encomendas a aguardar pagamento neste momento.
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-2xl">
      {batches.map((batch) => {
        const anchor = batch.primaryItem;
        const isRemainder = batch.status === 'delivered';
        const metodoPagamento = batch.items.find((i) => i.metodo_pagamento)?.metodo_pagamento;
        const remanescenteMetodo = batch.items.find((i) => i.remanescente_metodo_pagamento)?.remanescente_metodo_pagamento;
        const remanescenteValor = Math.round(batch.totalMt * 0.3 * 100) / 100;
        const resumo =
          batch.items.length === 1
            ? `${anchor.categoria_label} — ${anchor.produto}`
            : `${batch.items.length} serviços`;
        const facturaDisponivel = FACTURA_STATUSES.includes(batch.status);
        return (
          <div key={batch.batchId} className={`${panelCard} p-4 flex items-start gap-4`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div>
                  <p className="font-bold text-black dark:text-white">Encomenda Nº {displayNumero(numeros, batch.batchId)}</p>
                  <p className="text-sm text-gray-500 dark:text-zinc-400">{resumo}</p>
                  <p className="text-sm text-gray-500 dark:text-zinc-400">
                    {batch.sobConsulta ? 'Sob Consulta' : `${formatMt(batch.totalMt)} MT`}
                  </p>
                </div>
                {batch.status === 'approved' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-700 dark:bg-teal-950/30 dark:text-teal-400">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Adiantamento confirmado — em produção
                  </span>
                )}
                {isRemainder && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Pronta para levantamento
                  </span>
                )}
              </div>

              {isRemainder ? (
                <div className="mt-2 text-sm text-gray-600 dark:text-zinc-400 space-y-1">
                  <p className="font-semibold text-gray-800 dark:text-zinc-200">Remanescente a pagar (30%): {formatMt(remanescenteValor)} MT</p>
                  {remanescenteMetodo ? (
                    <>
                      <p className="font-semibold text-gray-800 dark:text-zinc-200">Método escolhido: {metodoPagamentoLabel(remanescenteMetodo)}</p>
                      <MetodoInstrucoes metodo={remanescenteMetodo} />
                      <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
                        A equipa confirma o pagamento manualmente e entrega assim que o valor for recebido.
                      </p>
                    </>
                  ) : (
                    <a href={`/cotacao/${anchor.id}/pagamento`} className={`${panelBtnPrimary} mt-1`}>
                      Pagar remanescente para levantar
                    </a>
                  )}
                </div>
              ) : metodoPagamento ? (
                <div className="mt-2 text-sm text-gray-600 dark:text-zinc-400 space-y-1">
                  <p className="font-semibold text-gray-800 dark:text-zinc-200">Método escolhido: {metodoPagamentoLabel(metodoPagamento)}</p>
                  <MetodoInstrucoes metodo={metodoPagamento} />
                  {batch.status !== 'approved' && (
                    <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
                      A equipa confirma o pagamento manualmente assim que o depósito for recebido.
                    </p>
                  )}
                </div>
              ) : (
                <a href={`/cotacao/${anchor.id}/pagamento`} className={panelBtnPrimary}>
                  Escolher método de pagamento
                </a>
              )}
            </div>

            {facturaDisponivel && (
              <div className="shrink-0 flex flex-col items-center justify-center border-l border-gray-100 dark:border-zinc-800 pl-4">
                <button type="button" onClick={() => openFactura(anchor.id)} className={panelBtnSecondary}>
                  <FileText className="w-4 h-4" /> Ver Factura
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
