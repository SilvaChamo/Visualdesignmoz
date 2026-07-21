'use client';

import { useEffect, useState, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase-client';
import { formatMt } from '@/lib/pricing-catalog';
import { NotchSection } from '@/components/home/NotchSection';
import { Loader2, AlertCircle, Printer, ArrowRight } from 'lucide-react';

type QuotationRow = {
  id: string;
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

function CotacaoDocumentContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const id = params?.id as string;
  const autoPrint = searchParams.get('print') === '1';

  const [quotation, setQuotation] = useState<QuotationRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data, error: fetchError } = await supabase
        .from('quotation_requests')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError || !data) {
        setError('Não foi possível encontrar esta cotação.');
      } else {
        setQuotation(data as QuotationRow);
      }
      setLoading(false);
    })();
  }, [id]);

  useEffect(() => {
    if (autoPrint && quotation) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [autoPrint, quotation]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black">
        <Loader2 className="w-10 h-10 animate-spin text-red-600" />
      </div>
    );
  }

  if (error || !quotation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-black px-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-8 text-center space-y-4 max-w-md">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto" />
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{error || 'Cotação não encontrada.'}</p>
        </div>
      </div>
    );
  }

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
  const adiantamento = Math.round(quotation.total_mt * 0.7 * 100) / 100;
  const numeroCotacao = quotation.id.split('-')[0].toUpperCase();

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
            <span className="text-zinc-300">Cotação Nº {numeroCotacao}</span>
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
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Cotação Nº {numeroCotacao}</p>
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
        <div id="quote-print-area" className="bg-white dark:bg-white text-zinc-900 rounded-lg shadow-sm border border-zinc-200 p-8 sm:p-12">

          {/* Cabeçalho */}
          <div className="flex flex-col sm:flex-row items-start justify-between gap-6 border-b border-zinc-200 pb-6 mb-6">
            <div className="h-12 w-44 relative shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/Logo - horizontal.jpg" alt="VisualDESIGN" className="h-full w-full object-contain object-left" />
            </div>
            <div className="text-xs text-zinc-500 text-left sm:text-right leading-relaxed">
              <p className="font-bold text-zinc-800">VisualDESIGN Services, Lda.</p>
              <p>Maputo, Moçambique</p>
              <p>+258 82 52 88 318 · +258 84 123 4567</p>
              <p>info@visualdesignmoz.com</p>
              <p>visualdesignmoz.com</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start justify-between gap-4 mb-8">
            <div>
              <h1 className="text-xl font-bold text-zinc-900">Cotação Nº {numeroCotacao}</h1>
              <p className="text-xs text-zinc-500 mt-1">Data de emissão: {dataEmissao}</p>
            </div>
            <div className="text-xs text-zinc-600 sm:text-right leading-relaxed">
              <p className="font-bold text-zinc-800">{quotation.empresa}</p>
              {quotation.nif && <p>NIF: {quotation.nif}</p>}
              {quotation.endereco && <p>{quotation.endereco}</p>}
              {(quotation.telefone_institucional || quotation.email_institucional) && (
                <p>{quotation.telefone_institucional}{quotation.telefone_institucional && quotation.email_institucional ? ' · ' : ''}{quotation.email_institucional}</p>
              )}
              {quotation.website && <p>{quotation.website}</p>}
              {quotation.responsavel !== quotation.empresa && (
                <>
                  <p className="mt-1">{quotation.responsavel}{quotation.cargo ? ` — ${quotation.cargo}` : ''}</p>
                  <p>{quotation.telefone}</p>
                  <p>{quotation.email}</p>
                </>
              )}
            </div>
          </div>

          {/* Linha do serviço */}
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
              <tr className="border-b border-zinc-100">
                <td className="py-3">
                  <span className="font-semibold text-zinc-800">{quotation.categoria_label}</span>
                  <br />
                  <span className="text-zinc-500">{quotation.produto}</span>
                </td>
                <td className="py-3 text-right">{quotation.quantidade}</td>
                <td className="py-3 text-right">{quotation.sob_consulta ? 'Sob Consulta' : `${formatMt(quotation.preco_unitario_mt)} MT`}</td>
                <td className="py-3 text-right font-bold">{quotation.sob_consulta ? 'Sob Consulta' : `${formatMt(quotation.total_mt)} MT`}</td>
              </tr>
            </tbody>
            {!quotation.sob_consulta && (
              <tfoot>
                <tr>
                  <td colSpan={3} className="pt-4 text-right font-bold text-zinc-900">Total</td>
                  <td className="pt-4 text-right font-bold text-zinc-900">{formatMt(quotation.total_mt)} MT</td>
                </tr>
              </tfoot>
            )}
          </table>

          {quotation.notas && (
            <div className="bg-zinc-50 border border-zinc-200 rounded-md p-4 mb-4 text-sm">
              <p className="text-zinc-700"><span className="font-bold">Notas:</span> {quotation.notas}</p>
            </div>
          )}

          {/* Prazo */}
          <div className="bg-zinc-50 border border-zinc-200 rounded-md p-4 mb-4 text-sm">
            <p className="text-zinc-700"><span className="font-bold">Data-limite de entrega pretendida:</span> {dataLimite}</p>
            <p className="text-xs text-zinc-500 mt-1">Prazo mínimo de execução: 7 dias úteis a partir da aprovação da cotação.</p>
          </div>

          {/* Pagamento */}
          <div className="bg-red-50 border border-red-200 rounded-md p-4 text-sm">
            {quotation.sob_consulta ? (
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
              </>
            )}
          </div>

          <p className="text-[11px] text-zinc-400 mt-8 text-center">
            Cotação válida por 30 dias a partir da data de emissão. Os valores incluem IVA.
          </p>
        </div>
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
          <Loader2 className="w-10 h-10 animate-spin text-red-600" />
        </div>
      }
    >
      <CotacaoDocumentContent />
    </Suspense>
  );
}
