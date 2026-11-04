'use client';

import { useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { formatMt, CUSTOM_CATEGORIA_ID } from '@/lib/pricing-catalog';
import { panelBtnPrimary, panelBtnSecondary } from '@/lib/panel-ui';
import { Spinner } from '@/components/ui/spinner';

type Quotation = {
  id: string;
  produto: string;
  categoria_id: string;
  categoria_label: string;
  preco_unitario_mt: number;
  quantidade: number;
  sob_consulta: boolean;
  notas: string | null;
  data_limite_entrega: string;
};

function minDate() {
  return new Date().toISOString().split('T')[0];
}

// Mesmo estilo dos campos da página pública de pedido de cotação
// (src/app/cotacao/page.tsx) — para o formulário de edição ficar igual ao
// que o cliente já conhece desse fluxo.
const inputClass =
  'w-full px-4 py-2.5 rounded-md bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-700 focus:border-red-600 focus:outline-none focus:ring-1 focus:ring-red-600 transition-all text-sm';
const labelClass = 'text-xs font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-1.5 block';

export function EncomendaEditForm({
  quotation,
  onCancel,
  onSaved,
}: {
  quotation: Quotation;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [notas, setNotas] = useState(quotation.notas || '');
  const [dataLimiteEntrega, setDataLimiteEntrega] = useState(quotation.data_limite_entrega);
  const [quantidade, setQuantidade] = useState(quotation.quantidade);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const previewTotal =
    !quotation.sob_consulta && quotation.categoria_id !== CUSTOM_CATEGORIA_ID
      ? quotation.preco_unitario_mt * quantidade
      : null;

  const handleSave = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`/api/cotacoes/${quotation.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notas, dataLimiteEntrega, quantidade }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Não foi possível guardar as alterações.');
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Falha ao comunicar com o servidor.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 text-sm text-red-800 dark:text-red-300">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <p>{error}</p>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 shadow-sm">
        <div className="flex-1 min-w-0 space-y-1">
          <p className="text-sm font-bold text-zinc-900 dark:text-white truncate">{quotation.categoria_label}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">{quotation.produto}</p>
        </div>
        <div className="w-20 shrink-0">
          <label className={labelClass}>Qtd.</label>
          <input
            type="number"
            min={1}
            step={1}
            className={inputClass}
            value={quantidade}
            onChange={(e) => setQuantidade(Math.max(1, Math.round(Number(e.target.value) || 1)))}
          />
        </div>
      </div>
      {previewTotal !== null && (
        <p className="text-xs text-gray-500 dark:text-zinc-400 -mt-2">Novo total: {formatMt(previewTotal)} MT</p>
      )}

      <div>
        <label className={labelClass}>Data-limite de entrega</label>
        <input
          type="date"
          min={minDate()}
          className={inputClass}
          value={dataLimiteEntrega}
          onChange={(e) => setDataLimiteEntrega(e.target.value)}
        />
      </div>

      <div>
        <label className={labelClass}>Notas</label>
        <textarea
          className={inputClass}
          rows={3}
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-2 pt-2">
        <button type="button" className={panelBtnPrimary} onClick={handleSave} disabled={saving}>
          {saving && <Spinner className="w-4 h-4" />}
          Guardar alterações
        </button>
        <button type="button" className={panelBtnSecondary} onClick={onCancel} disabled={saving}>
          Cancelar edição
        </button>
      </div>
    </div>
  );
}
