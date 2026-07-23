'use client';

import { useEffect, useState } from 'react';
import { FileText, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase-client';
import { PanelHeader } from '@/components/panel/PanelHeader';
import { panelBtnSecondary } from '@/lib/panel-ui';
import { formatMt } from '@/lib/pricing-catalog';

type Quotation = {
  id: string;
  categoria_label: string;
  produto: string;
  quantidade: number;
  total_mt: number;
  sob_consulta: boolean;
  status: string;
  data_limite_entrega: string;
  created_at: string;
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: 'Aguarda contacto', color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-900/30' },
  payment_selected: { label: 'Aguarda pagamento', color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/30' },
  approved: { label: 'Aprovada — em produção', color: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/30 dark:text-teal-400 dark:border-teal-900/30' },
  rejected: { label: 'Não aprovada', color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:text-rose-400 dark:border-rose-900/30' },
  done: { label: 'Concluída', color: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-900/30' },
  cancelled: { label: 'Cancelada', color: 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700' },
};

export default function EncomendasPage() {
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/cotacoes')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setQuotations(data.quotations);
          if (data.quotations.length > 0) setSelectedId(data.quotations[0].id);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  return (
    <div className="panel-shell font-panel min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
      <PanelHeader
        title="As Suas Encomendas"
        description="Painel VisualDesign — acompanhamento de pedidos e aprovação de layouts"
        actions={
          <button type="button" onClick={handleSignOut} className={panelBtnSecondary}>
            <LogOut className="h-4 w-4" />
            Sair
          </button>
        }
      />

      <div className="w-full p-4 lg:p-6 flex-grow grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 lg:gap-6 min-h-0">
        <div className="space-y-3 lg:overflow-y-auto lg:max-h-[calc(100vh-160px)]">
          {loading && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 text-sm text-gray-500 dark:text-zinc-400">
              A carregar...
            </div>
          )}

          {!loading && quotations.length === 0 && (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg p-5 text-sm text-gray-500 dark:text-zinc-400">
              Ainda não tem encomendas submetidas.
            </div>
          )}

          {quotations.map((q) => {
            const statusInfo = STATUS_LABELS[q.status] || { label: q.status, color: 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700' };
            const isSelected = selectedId === q.id;
            return (
              <button
                key={q.id}
                type="button"
                onClick={() => setSelectedId(q.id)}
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
                  <p className="font-bold text-sm text-gray-900 dark:text-white truncate">{q.categoria_label} — {q.produto}</p>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">Qtd: {q.quantidade} · {q.sob_consulta ? 'Sob Consulta' : `${formatMt(q.total_mt)} MT`}</p>
                  <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden min-h-[500px] lg:min-h-[calc(100vh-160px)]">
          {selectedId ? (
            <iframe
              key={selectedId}
              src={`/cotacao/${selectedId}?embed=1`}
              className="w-full h-full min-h-[500px] lg:min-h-[calc(100vh-160px)] border-0"
              title="Documento da encomenda"
            />
          ) : (
            !loading && (
              <div className="flex items-center justify-center h-full min-h-[500px] text-sm text-gray-400 dark:text-zinc-500">
                Seleccione uma encomenda para ver o documento.
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
