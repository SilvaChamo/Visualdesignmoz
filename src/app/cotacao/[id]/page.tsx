'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { formatMt } from '@/lib/pricing-catalog';
import { NotchSection } from '@/components/home/NotchSection';
import { Loader2, AlertCircle, Printer, ArrowRight } from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { useBatchNumeros, displayNumero } from '@/lib/use-batch-numeros';
import {
  DocumentCard,
  DocumentCompanyHeader,
  DocumentElectronicSeal,
  DocumentEmbedFrame,
} from '@/components/documents/VisualDesignDocument';

type QuotationRow = {
  id: string;
  batch_id: string;
  empresa: string;
  nif: string | null;
  endereco: string | null;
  telefone_institucional: string | null;
  email_institucional: string | null;
  website: string | null;
  responsavel: string;
  cargo: string | null;
  telefone: string;
  email: string;
  categoria_label: string;
  produto: string;
  preco_unitario_mt: number;
  quantidade: number;
  data_limite_entrega: string;
  total_mt: number;
  sob_consulta: boolean;
  notas: string | null;
  status: string;
  created_at: string;
};

const MPESA_NUMBER = '+258 85 73 96 739';

// Mesma percentagem usada na pré-visualização do pedido de cotação
// (/cotacao, antes de submeter) — o documento final tem de mostrar o mesmo
// IVA acrescido, senão o valor aqui não bate certo com o que foi prometido
// ao cliente nesse passo.
const IVA_PERCENT = 16;

type PaymentRow = { phase: string; metodo: string | null; valor_mt: number; confirmed_at: string };

const PHASE_LABEL: Record<string, string> = { advance: 'Adiantamento (70%)', remainder: 'Remanescente (30%)' };
const METODO_LABEL: Record<string, string> = { mpesa: 'M-Pesa', transferencia: 'Transferência' };

function CotacaoDocumentContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id as string;
  // Modo embutido — usado dentro de /encomendas e do painel admin (iframe ou
  // popup): esconde o cabeçalho do site e a navegação, mostra só a barra de
  // acções e o documento.
  const embed = searchParams.get('embed') === '1';
  // "Continuar para Pagamento" só faz sentido para o cliente pagar a sua
  // própria encomenda — no painel admin não deve aparecer (o admin só quer
  // ver/descarregar o documento).
  const showPaymentCta = searchParams.get('payment') === '1';
  // Depois do adiantamento confirmado, o mesmo documento passa a chamar-se
  // Factura em vez de Cotação — mesmo layout, só muda o rótulo.
  const isFactura = searchParams.get('tipo') === 'factura';
  const documentLabel = isFactura ? 'Factura' : 'Cotação';
  // Há duas facturas por encomenda — uma emitida no adiantamento (70%), outra
  // no remanescente (30%, quando a encomenda fica totalmente paga). ?fase=
  // escolhe qual mostrar; por omissão é a do adiantamento.
  const facturaPhase: 'advance' | 'remainder' = searchParams.get('fase') === 'remanescente' ? 'remainder' : 'advance';

  const [items, setItems] = useState<QuotationRow[] | null>(null);
  const [advanceInvoiceNumber, setAdvanceInvoiceNumber] = useState<string | null>(null);
  const [remainderInvoiceNumber, setRemainderInvoiceNumber] = useState<string | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const numeros = useBatchNumeros();

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const res = await fetch(`/api/cotacoes/${id}`);
        const data = await res.json();
        if (!res.ok || !data.success) {
          setError(data.error || 'Não foi possível encontrar esta cotação.');
          setLoading(false);
          return;
        }
        setItems(data.items as QuotationRow[]);
        setAdvanceInvoiceNumber(data.invoiceNumber ?? null);
        setRemainderInvoiceNumber(data.remainderInvoiceNumber ?? null);
        setPayments((data.payments as PaymentRow[]) ?? []);
      } catch {
        setError('Não foi possível encontrar esta cotação.');
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black">
        <Spinner className="w-10 h-10" />
      </div>
    );
  }

  if (error || !items || items.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black px-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-8 text-center space-y-4 max-w-md">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto" />
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{error || 'Cotação não encontrada.'}</p>
        </div>
      </div>
    );
  }

  const quotation = items[0];
  const totalMt = items.reduce((sum, i) => sum + (i.sob_consulta ? 0 : i.total_mt), 0);
  const allSobConsulta = items.every((i) => i.sob_consulta);
  const someSobConsulta = items.some((i) => i.sob_consulta);

  const dataEmissao = new Date(quotation.created_at).toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const dataLimite = new Date(quotation.data_limite_entrega).toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
  const ivaMt = totalMt * (IVA_PERCENT / 100);
  const totalComIvaMt = totalMt + ivaMt;
  const adiantamento = Math.round(totalComIvaMt * 0.7 * 100) / 100;
  const remanescenteValor = Math.round((totalComIvaMt - adiantamento) * 100) / 100;
  const numeroCotacao = displayNumero(numeros, quotation.batch_id);
  const facturaInvoiceNumber = facturaPhase === 'remainder' ? remainderInvoiceNumber : advanceInvoiceNumber;
  const valorDestaFactura = facturaPhase === 'remainder' ? remanescenteValor : adiantamento;
  const phasePayment = payments.find((p) => p.phase === facturaPhase) ?? null;

  const documentCard = (
        <DocumentCard embed={embed}>

          {/* Cabeçalho */}
          <DocumentCompanyHeader />

          <div className="flex flex-col sm:flex-row items-start justify-between gap-4 mb-8">
            <div className="text-xs text-zinc-600 leading-relaxed">
              <p className="font-bold text-zinc-800">Empresa: {quotation.empresa}</p>
              {quotation.nif && <p>NUIT: {quotation.nif}</p>}
              {quotation.endereco && <p>Província: {quotation.endereco}</p>}
              {quotation.telefone_institucional && <p>Tele: {quotation.telefone_institucional}</p>}
              {quotation.email_institucional && <p>Email: {quotation.email_institucional}</p>}
              {quotation.website && <p>Website: {quotation.website}</p>}
              {!isFactura && quotation.responsavel !== quotation.empresa && (
                <>
                  <div className="border-t border-zinc-200 my-2 w-full" />
                  <p>Responsável: {quotation.responsavel}{quotation.cargo ? ` — ${quotation.cargo}` : ''}</p>
                  <p>Contacto: {quotation.telefone}</p>
                  <p>Email: {quotation.email}</p>
                </>
              )}
            </div>
            <div className="sm:text-right shrink-0">
              <h1 className="text-xl font-bold text-black">
                {documentLabel} Nº {isFactura ? (facturaInvoiceNumber ?? 'a emitir') : numeroCotacao}
              </h1>
              {isFactura && (
                <p className="text-xs font-bold text-red-600 mt-1">
                  {facturaPhase === 'remainder' ? 'Remanescente — Pago na Totalidade' : 'Adiantamento (70%)'}
                </p>
              )}
              <p className="text-xs text-zinc-500 mt-1">Data de emissão: {dataEmissao}</p>
            </div>
          </div>

          {/* Linhas de serviço */}
          <table className="w-full text-sm mb-8">
            <thead>
              <tr className="border-b border-zinc-300 text-left text-xs uppercase tracking-wide text-zinc-500">
                <th className="pb-2 font-bold">Descrição</th>
                <th className="pb-2 font-bold text-right">Quantidade</th>
                <th className="pb-2 font-bold text-right">Preço Unitário</th>
                <th className="pb-2 font-bold text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-zinc-100">
                  <td className="py-3">
                    <span className="font-semibold text-zinc-800">{item.categoria_label}</span>
                    <br />
                    <span className="text-zinc-500">{item.produto}</span>
                  </td>
                  <td className="py-3 text-right">{item.quantidade}</td>
                  <td className="py-3 text-right">{item.sob_consulta ? 'Sob Consulta' : `${formatMt(item.preco_unitario_mt)} MT`}</td>
                  <td className="py-3 text-right font-bold">{item.sob_consulta ? 'Sob Consulta' : `${formatMt(item.total_mt)} MT`}</td>
                </tr>
              ))}
            </tbody>
            {!allSobConsulta && (
              <tfoot>
                <tr>
                  <td colSpan={3} className="pt-4 text-right text-zinc-600">Subtotal</td>
                  <td className="pt-4 text-right text-zinc-600">{formatMt(totalMt)} MT</td>
                </tr>
                <tr>
                  <td colSpan={3} className="pt-1 text-right text-zinc-600">IVA ({IVA_PERCENT}%, acrescido)</td>
                  <td className="pt-1 text-right text-zinc-600">{formatMt(ivaMt)} MT</td>
                </tr>
                <tr>
                  <td colSpan={3} className="pt-2 text-right font-bold text-zinc-900 border-t border-zinc-200">Total da encomenda</td>
                  <td className="pt-2 text-right font-bold text-zinc-900 border-t border-zinc-200">{formatMt(totalComIvaMt)} MT</td>
                </tr>
                {isFactura && (
                  <tr>
                    <td colSpan={3} className="pt-2 text-right font-bold text-red-600">
                      Valor desta factura ({facturaPhase === 'remainder' ? 'Remanescente 30%' : 'Adiantamento 70%'})
                    </td>
                    <td className="pt-2 text-right font-bold text-red-600">{formatMt(valorDestaFactura)} MT</td>
                  </tr>
                )}
              </tfoot>
            )}
          </table>

          {items.some((i) => i.notas) && (
            <div className="bg-zinc-50 border border-zinc-200 rounded-md p-4 mb-4 text-sm">
              <p className="text-zinc-700"><span className="font-bold">Notas:</span> {items.find((i) => i.notas)?.notas}</p>
            </div>
          )}

          {/* Prazo — só faz sentido antes de a encomenda estar concluída; numa
              factura já paga não há "prazo a cumprir" para mostrar. */}
          {!isFactura && (
            <div className="bg-zinc-50 border border-zinc-200 rounded-md p-4 mb-4 text-sm">
              <p className="text-zinc-700"><span className="font-bold">Data-limite de entrega pretendida:</span> {dataLimite}</p>
              <p className="text-xs text-zinc-500 mt-1">Prazo mínimo de execução: 7 dias úteis a partir da aprovação da cotação.</p>
            </div>
          )}

          {/* Pagamento — na Cotação são condições (ainda por cumprir); na
              Factura confirma-se o que já foi efectivamente pago. */}
          {isFactura ? (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 text-sm">
              <p className="font-bold text-zinc-800 mb-2">
                Pagamento confirmado — {PHASE_LABEL[facturaPhase]}
              </p>
              {phasePayment ? (
                <p className="text-zinc-700">
                  {formatMt(phasePayment.valor_mt)} MT
                  {phasePayment.metodo && ` — ${METODO_LABEL[phasePayment.metodo] ?? phasePayment.metodo}`}
                  {' — confirmado em '}{new Date(phasePayment.confirmed_at).toLocaleDateString('pt-PT')}
                </p>
              ) : (
                <p className="text-zinc-500 text-xs">Ainda não confirmado.</p>
              )}
              {facturaPhase === 'remainder' && (
                <p className="text-xs font-bold text-green-700 mt-2">Encomenda paga na totalidade.</p>
              )}
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 text-sm">
              {allSobConsulta ? (
                <p className="text-zinc-800">
                  <span className="font-bold">Condições de pagamento:</span> serviço Sob Consulta — entraremos em contacto para confirmar o valor e as condições de pagamento.
                </p>
              ) : (
                <>
                  <p className="text-zinc-800">
                    <span className="font-bold">Condições de pagamento:</span> 70% de adiantamento na aprovação da cotação
                    ({formatMt(adiantamento)} MT), restante na entrega.
                  </p>
                  <p className="text-xs text-zinc-600 mt-1">Adiantamento via M-Pesa: {MPESA_NUMBER}</p>
                  {someSobConsulta && (
                    <p className="text-xs text-zinc-600 mt-1">Os itens Sob Consulta acima não entram neste valor — o preço é confirmado à parte.</p>
                  )}
                </>
              )}
            </div>
          )}

          {!isFactura && (
            <p className="text-[11px] text-zinc-400 mt-8 text-center">
              Cotação válida por 30 dias a partir da data de emissão.
            </p>
          )}

          <DocumentElectronicSeal />
        </DocumentCard>
  );

  // Embutido dentro de /encomendas e do painel admin (iframe ou popup) — sem
  // o cabeçalho do site nem a navegação, só a barra de acções e o documento.
  if (embed) {
    return (
      <DocumentEmbedFrame
        actions={showPaymentCta && (
          <Link
            href={`/cotacao/${quotation.id}/pagamento?embed=1&payment=1`}
            className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-2.5 rounded-md text-sm transition-colors"
          >
            <span>Continuar para Pagamento</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        )}
      >
        {documentCard}
      </DocumentEmbedFrame>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-200 dark:bg-black">
      <NotchSection shape="start" bg="bg-gradient-to-br from-black via-zinc-900 to-zinc-950" first className="no-print">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-red-600/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="container mx-auto max-w-7xl px-6 pt-[170px] pb-[70px] relative z-10 text-center">
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2">A Sua Cotação</h1>
          <p className="text-base text-zinc-300 max-w-2xl mx-auto leading-relaxed mb-4">
            Reveja os dados abaixo, descarregue em PDF, e siga para o pagamento quando estiver pronto.
          </p>
          <nav className="text-xs text-zinc-400">
            <Link href="/" className="hover:text-white transition-colors">Início</Link>
            <span className="mx-2">/</span>
            <Link href="/precos" className="hover:text-white transition-colors">Preços</Link>
            <span className="mx-2">/</span>
            <span className="text-zinc-300">{documentLabel} Nº {numeroCotacao}</span>
          </nav>
        </div>
        <div className="absolute bottom-0 left-0 right-0">
          <div className="h-[2px] bg-gradient-to-r from-transparent via-zinc-500 to-transparent" />
          <div className="h-[1px] bg-gradient-to-r from-transparent via-red-600 to-transparent" />
        </div>
      </NotchSection>

      <div className="no-print -mt-[16px] relative z-20 bg-zinc-200 dark:bg-black pt-12 pb-2">
        <div className="max-w-3xl mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm font-bold text-black dark:text-white">{documentLabel} Nº {numeroCotacao}</p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold px-5 py-2.5 rounded-md text-sm hover:opacity-90 transition-opacity"
              >
                <Printer className="w-4 h-4" />
                <span>Descarregar PDF</span>
              </button>
              <Link
                href={`/cotacao/${quotation.id}/pagamento`}
                className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-2.5 rounded-md text-sm transition-colors"
              >
                <span>Continuar para Pagamento</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      <NotchSection shape="mid" bg="bg-zinc-200 dark:bg-black" className="notch-print-safe pb-12">
        <div className="max-w-3xl mx-auto px-4">
          {documentCard}
        </div>
      </NotchSection>
    </div>
  );
}

export default function CotacaoDocumentPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black">
          <Spinner className="w-10 h-10" />
        </div>
      }
    >
      <CotacaoDocumentContent />
    </Suspense>
  );
}
