'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Printer, AlertCircle } from 'lucide-react';
import { formatMt } from '@/lib/pricing-catalog';
import { Spinner } from '@/components/ui/spinner';

type MonthRow = {
  month: string;
  receitaMt: number;
  custosProducaoMt: number;
  ivaPercent: number;
  ivaMt: number;
  lucroMt: number;
};

type FechoRow = {
  year: number;
  receita_mt: number;
  custos_producao_mt: number;
  iva_percent: number;
  iva_mt: number;
  lucro_mt: number;
  closed_at: string;
  closed_by: string | null;
};

const MES_LABEL = new Intl.DateTimeFormat('pt-PT', { month: 'long', timeZone: 'UTC' });

function mesLabel(month: string): string {
  const label = MES_LABEL.format(new Date(`${month}T00:00:00Z`));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export default function FechoAnualDocumentPage() {
  const params = useParams();
  const year = Number(params?.year);

  const [meses, setMeses] = useState<MonthRow[] | null>(null);
  const [fecho, setFecho] = useState<FechoRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch('/api/admin/contabilidade')
      .then((r) => r.json())
      .then((data) => {
        if (!data.success) {
          setError(data.error || 'Não foi possível carregar a contabilidade.');
          setLoading(false);
          return;
        }
        const fechoAno = (data.fechos as FechoRow[]).find((f) => f.year === year) ?? null;
        if (!fechoAno) {
          setError(`O ano de ${year} ainda não foi fechado.`);
          setLoading(false);
          return;
        }
        setFecho(fechoAno);
        setMeses((data.meses as MonthRow[]).filter((m) => Number(m.month.slice(0, 4)) === year).sort((a, b) => a.month.localeCompare(b.month)));
        setLoading(false);
      })
      .catch(() => {
        setError('Não foi possível carregar a contabilidade.');
        setLoading(false);
      });
  }, [year]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <Spinner className="w-10 h-10" />
      </div>
    );
  }

  if (error || !fecho || !meses) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4">
        <div className="bg-white border border-zinc-200 rounded-lg p-8 text-center space-y-4 max-w-md">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto" />
          <p className="text-sm text-zinc-600">{error || 'Fecho não encontrado.'}</p>
        </div>
      </div>
    );
  }

  const dataFecho = new Date(fecho.closed_at).toLocaleDateString('pt-PT', { day: '2-digit', month: 'long', year: 'numeric' });

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-3xl mx-auto px-4 py-4">
        <div className="flex justify-end gap-3 no-print mb-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 bg-zinc-900 text-white font-bold px-5 py-2.5 rounded-md text-sm hover:opacity-90 transition-opacity"
          >
            <Printer className="w-4 h-4" />
            <span>Descarregar PDF</span>
          </button>
        </div>

        <div className="bg-white text-zinc-900 shadow-sm border border-zinc-200 rounded-lg p-8 sm:p-12">
          {/* Cabeçalho */}
          <div className="flex flex-col sm:flex-row items-start justify-between gap-6 border-b border-zinc-200 pb-6 mb-6">
            <div className="h-12 w-44 relative shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/assets/Logo - horizontal.jpg" alt="VisualDESIGN" className="h-full w-full object-contain object-left" />
            </div>
            <div className="text-xs text-zinc-500 text-left sm:text-right leading-relaxed">
              <p className="font-bold text-zinc-800">VisualDESIGN Services, Lda.</p>
              <p>Av. Karl Marx, nº 177, Maputo, Moçambique</p>
              <p>NUIT: 400597243</p>
              <p>info@visualdesignmoz.com</p>
            </div>
          </div>

          <div className="flex items-start justify-between gap-4 mb-8">
            <div>
              <h1 className="text-xl font-bold text-black">Fecho de Exercício — {fecho.year}</h1>
              <p className="text-xs text-zinc-500 mt-1">Fechado em {dataFecho}{fecho.closed_by ? ` por ${fecho.closed_by}` : ''}</p>
            </div>
            <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700 shrink-0">
              Exercício encerrado
            </span>
          </div>

          {/* Balanço mensal do ano */}
          <table className="w-full text-sm mb-8">
            <thead>
              <tr className="border-b border-zinc-300 text-left text-xs uppercase tracking-wide text-zinc-500">
                <th className="pb-2 font-bold">Mês</th>
                <th className="pb-2 font-bold text-right">Receita</th>
                <th className="pb-2 font-bold text-right">Custo de produção</th>
                <th className="pb-2 font-bold text-right">IVA (16%)</th>
                <th className="pb-2 font-bold text-right">Lucro</th>
              </tr>
            </thead>
            <tbody>
              {meses.map((m) => (
                <tr key={m.month} className="border-b border-zinc-100">
                  <td className="py-2.5 text-zinc-700">{mesLabel(m.month)}</td>
                  <td className="py-2.5 text-right">{formatMt(m.receitaMt)} MT</td>
                  <td className="py-2.5 text-right">{formatMt(m.custosProducaoMt)} MT</td>
                  <td className="py-2.5 text-right">{formatMt(m.ivaMt)} MT</td>
                  <td className="py-2.5 text-right font-bold">{formatMt(m.lucroMt)} MT</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="pt-4 font-bold text-zinc-900">Total do ano</td>
                <td className="pt-4 text-right font-bold text-zinc-900">{formatMt(fecho.receita_mt)} MT</td>
                <td className="pt-4 text-right font-bold text-zinc-900">{formatMt(fecho.custos_producao_mt)} MT</td>
                <td className="pt-4 text-right font-bold text-zinc-900">{formatMt(fecho.iva_mt)} MT</td>
                <td className="pt-4 text-right font-bold text-red-600">{formatMt(fecho.lucro_mt)} MT</td>
              </tr>
            </tfoot>
          </table>

          <p className="text-[11px] text-zinc-400 text-center">
            Resumo interno de gestão — não substitui certificação fiscal (SAF-T/IRPC). Serve de base para avaliação por um contabilista.
          </p>

          <div className="mt-8 pt-4 border-t border-zinc-200 flex items-center justify-end gap-2">
            <div className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full border border-red-600 text-red-600">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="h-3 w-3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="text-right leading-tight">
              <p className="text-xs font-bold text-zinc-800">VisualDESIGN Services, Lda.</p>
              <p className="text-[11px] text-zinc-500">Documento gerado e validado electronicamente — dispensa assinatura manuscrita.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
