'use client';

import React, { useState } from 'react';
import { Clock, Upload, CheckCircle2, Smartphone, Landmark, CreditCard } from 'lucide-react';
import type { PendingCheckoutSession } from '@/lib/user-products';
import { MPESA_NUMBER, BANK_NAME, BANK_ACCOUNT, BANK_NIB, metodoPagamentoLabel } from '@/lib/quotation-payment-info';
import { formatMt } from '@/lib/pricing-catalog';
import { Spinner } from '@/components/ui/spinner';

type Props = {
  sessions: PendingCheckoutSession[];
  onUploaded: () => void;
};

const METODO_ICON: Record<string, typeof Smartphone> = {
  mpesa: Smartphone,
  transferencia: Landmark,
  stripe: CreditCard,
};

function itemLabel(item: PendingCheckoutSession['items'][number]): string {
  return item.type === 'hosting' ? item.hostingDomain || item.name : item.name;
}

function PendingOrderCard({ session, onUploaded }: { session: PendingCheckoutSession; onUploaded: () => void }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const Icon = METODO_ICON[session.metodoPagamento || ''] || Landmark;
  const isManual = session.metodoPagamento === 'mpesa' || session.metodoPagamento === 'transferencia';

  const handleUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/checkout/${session.id}/comprovativo`, { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Não foi possível enviar o comprovativo.');
      onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao enviar o comprovativo.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-4 bg-gray-50 rounded-lg border border-gray-100 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-amber-700" />
          <span className="font-bold text-gray-900 text-sm">{metodoPagamentoLabel(session.metodoPagamento)}</span>
        </div>
        <span className="font-bold text-gray-900 text-sm">{formatMt(session.totalMt)} MT</span>
      </div>

      <ul className="text-xs text-gray-600 list-disc list-inside space-y-0.5">
        {session.items.map((item, i) => (
          <li key={i}>{itemLabel(item)}</li>
        ))}
      </ul>

      {session.metodoPagamento === 'stripe' ? (
        <p className="text-xs text-gray-500">A confirmar automaticamente — normalmente leva alguns segundos.</p>
      ) : isManual ? (
        session.hasComprovativo ? (
          <div className="flex items-center gap-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-md p-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0" /> Comprovativo enviado — a aguardar confirmação da equipa.
          </div>
        ) : (
          <div className="space-y-2">
            <div className="bg-white border border-gray-200 rounded-lg p-3 text-xs text-gray-700 space-y-0.5">
              {session.metodoPagamento === 'mpesa' ? (
                <p>Envie o valor para <span className="font-bold">{MPESA_NUMBER}</span>.</p>
              ) : (
                <>
                  <p>{BANK_NAME}</p>
                  <p>Conta BCI: <span className="font-bold">{BANK_ACCOUNT}</span></p>
                  <p>NIB: <span className="font-bold">{BANK_NIB}</span></p>
                </>
              )}
            </div>
            <label className="flex items-center justify-center gap-2 w-full px-4 py-2.5 border-2 border-dashed border-gray-300 rounded-md text-xs font-bold text-gray-600 hover:border-red-400 hover:text-red-600 cursor-pointer transition-colors">
              {uploading ? <Spinner className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
              {uploading ? 'A enviar...' : 'Anexar comprovativo de pagamento'}
              <input
                type="file"
                accept="image/*,.pdf"
                className="hidden"
                disabled={uploading}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); }}
              />
            </label>
            {error && <p className="text-xs text-rose-600">{error}</p>}
          </div>
        )
      ) : null}
    </div>
  );
}

export function PendingOrdersSection({ sessions, onUploaded }: Props) {
  if (sessions.length === 0) return null;

  return (
    <section id="pedidos-pendentes" className="bg-white border border-amber-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-amber-100 bg-amber-50 flex items-center gap-2">
        <Clock className="w-5 h-5 text-amber-700" />
        <h2 className="font-bold text-gray-900">Pedidos Pendentes</h2>
      </div>
      <div className="p-5 space-y-3">
        {sessions.map((session) => (
          <PendingOrderCard key={session.id} session={session} onUploaded={onUploaded} />
        ))}
      </div>
    </section>
  );
}
