'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PUBLIC_PANEL_ENTRY } from '@/lib/panel-origin';
import {
  CheckCircle2,
  XCircle,
  Upload,
  CreditCard,
  Smartphone,
  Landmark,
  Lock,
  ShieldCheck,
  BadgeCheck,
  Printer,
  FileDown,
  ArrowLeft,
  Info,
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';
import { useCurrency } from '@/contexts/CurrencyContext';
import { useAuth } from '@/components/auth/AuthProvider';
import { MPESA_NUMBER, EMOLA_NUMBER, BANK_NAME, BANK_ACCOUNT, BANK_NIB } from '@/lib/quotation-payment-info';

type MetodoPagamento = 'mpesa' | 'emola' | 'transferencia' | 'stripe';

type Pedido = {
  id: string;
  service_name: string;
  renewal_type: 'domain' | 'hosting';
  valor_mt: number;
  metodo_pagamento: MetodoPagamento;
  status: 'pending' | 'confirmed' | 'rejected';
  comprovativo_url: string | null;
  rejection_reason: string | null;
  created_at: string;
  invoice_number: string | null;
  invoice_date: string | null;
  expiration_date: string | null;
};

function formatDate(iso: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('pt-MZ');
}

const METODO_META: Record<MetodoPagamento, { label: string; icon: typeof Smartphone }> = {
  mpesa: { label: 'M-Pesa', icon: Smartphone },
  emola: { label: 'e-Mola', icon: Smartphone },
  transferencia: { label: 'Transferência Bancária', icon: Landmark },
  stripe: { label: 'Cartão (Stripe)', icon: CreditCard },
};

const POLL_INTERVAL_MS = 1500;
const MAX_ATTEMPTS = 20;

export function RenewalCheckout({ renewalId }: { renewalId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const justPaid = searchParams.get('success') === '1';
  const { user: authUser } = useAuth();
  const { formatPrice } = useCurrency();

  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [payingStripe, setPayingStripe] = useState(false);
  const [changingMetodo, setChangingMetodo] = useState(false);
  const [actionError, setActionError] = useState('');

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/renewals/pagamento/${renewalId}`);
      const data = await res.json();
      if (!res.ok || !data.success) {
        setNotFound(true);
        setLoadError(data.error || '');
        return;
      }
      setPedido(data.pedido);
    } catch {
      setNotFound(true);
    }
  }, [renewalId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!justPaid) return;
    let attempts = 0;
    let cancelled = false;
    const poll = async () => {
      attempts += 1;
      const res = await fetch(`/api/renewals/pagamento/${renewalId}`);
      const data = await res.json();
      if (cancelled) return;
      if (data.success) setPedido(data.pedido);
      if (data.success && data.pedido.status !== 'pending') return;
      if (attempts < MAX_ATTEMPTS) setTimeout(poll, POLL_INTERVAL_MS);
    };
    poll();
    return () => { cancelled = true; };
  }, [justPaid, renewalId]);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setActionError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/renewals/pagamento/${renewalId}/comprovativo`, { method: 'POST', body: form });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Não foi possível enviar o comprovativo.');
      setPedido(data.pedido);
    } catch (err: any) {
      setActionError(err.message || 'Falha ao enviar o comprovativo.');
    } finally {
      setUploading(false);
    }
  };

  const handlePayStripe = async () => {
    setPayingStripe(true);
    setActionError('');
    try {
      const res = await fetch(`/api/renewals/pagamento/${renewalId}/stripe-session`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || 'Não foi possível iniciar o pagamento.');
      window.location.href = data.url;
    } catch (err: any) {
      setActionError(err.message || 'Falha ao comunicar com o servidor.');
      setPayingStripe(false);
    }
  };

  const handleChangeMetodo = async (novoMetodo: MetodoPagamento) => {
    if (!pedido || novoMetodo === pedido.metodo_pagamento) return;
    setChangingMetodo(true);
    setActionError('');
    try {
      const res = await fetch(`/api/renewals/pagamento/${renewalId}/metodo`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metodo_pagamento: novoMetodo }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Não foi possível trocar o método de pagamento.');
      setPedido(data.pedido);
    } catch (err: any) {
      setActionError(err.message || 'Falha ao trocar o método de pagamento.');
    } finally {
      setChangingMetodo(false);
    }
  };

  if (notFound) {
    return (
      <div className="max-w-lg mx-auto bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-10 text-center">
        <XCircle className="w-14 h-14 text-rose-500 mx-auto mb-4" />
        <h1 className="text-xl font-bold text-slate-800 dark:text-zinc-100">Pedido não encontrado</h1>
        <p className="text-sm text-slate-500 dark:text-zinc-400 mt-2">
          {loadError || 'Verifica se tens sessão iniciada com a conta certa.'}
        </p>
      </div>
    );
  }

  if (!pedido) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="w-10 h-10" />
      </div>
    );
  }

  const tipoLabel = pedido.renewal_type === 'domain' ? 'Domínio' : 'Hospedagem';
  const clientName = authUser?.user_metadata?.full_name || authUser?.email?.split('@')[0] || 'Cliente';
  const referencia = pedido.id.slice(0, 8).toUpperCase();
  const metodoDisabled = pedido.status !== 'pending' || changingMetodo;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">

      {/* Coluna esquerda: dados do cliente + acção de pagamento */}
      <div className="lg:col-span-8 space-y-5">
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-6 shadow-sm">
          <div className="flex items-start justify-between gap-3 mb-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-zinc-500">
                Renovação de {tipoLabel}
              </p>
              <h1 className="text-lg font-bold text-slate-900 dark:text-white mt-1 truncate">{pedido.service_name}</h1>
            </div>
            <span
              className={`px-2.5 py-1 rounded-md text-xs font-bold shrink-0 ${
                pedido.status === 'confirmed'
                  ? 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400'
                  : pedido.status === 'rejected'
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400'
              }`}
            >
              {pedido.status === 'confirmed' ? 'Pago' : pedido.status === 'rejected' ? 'Rejeitado' : 'Em Aberto'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-dashed border-slate-200 dark:border-zinc-800 text-sm">
            <div>
              <span className="text-xs text-slate-400 dark:text-zinc-500 block mb-0.5">Cliente</span>
              <span className="font-bold text-slate-800 dark:text-zinc-100">{clientName}</span>
            </div>
            <div>
              <span className="text-xs text-slate-400 dark:text-zinc-500 block mb-0.5">Email</span>
              <span className="font-bold text-slate-800 dark:text-zinc-100 truncate block">{authUser?.email}</span>
            </div>
            {pedido.invoice_number && (
              <div>
                <span className="text-xs text-slate-400 dark:text-zinc-500 block mb-0.5">Nº da Factura</span>
                <span className="font-bold text-slate-800 dark:text-zinc-100 font-mono">{pedido.invoice_number}</span>
              </div>
            )}
            <div>
              <span className="text-xs text-slate-400 dark:text-zinc-500 block mb-0.5">Referência</span>
              <span className="font-bold text-slate-800 dark:text-zinc-100 font-mono">{referencia}</span>
            </div>
          </div>
        </div>

        {actionError && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">{actionError}</div>
        )}

        {pedido.status === 'pending' && pedido.metodo_pagamento === 'stripe' && (
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-6 shadow-sm text-center space-y-3">
            <p className="text-sm text-slate-600 dark:text-zinc-300">
              {justPaid ? 'A confirmar o pagamento com o Stripe...' : 'Paga com cartão de forma segura via Stripe.'}
            </p>
            {justPaid ? (
              <Spinner className="w-8 h-8 mx-auto" />
            ) : (
              <button
                type="button"
                onClick={handlePayStripe}
                disabled={payingStripe}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-bold py-3 px-6 rounded-md flex items-center justify-center gap-2 mx-auto transition-all"
              >
                {payingStripe ? <Spinner className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                {payingStripe ? 'A abrir pagamento seguro...' : `Pagar ${formatPrice(pedido.valor_mt)}`}
              </button>
            )}
          </div>
        )}

        {pedido.status === 'pending' && pedido.metodo_pagamento !== 'stripe' && (
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-6 shadow-sm space-y-4">
            <p className="text-sm text-slate-600 dark:text-zinc-300">
              Faça a transferência com os dados ao lado e depois anexe o comprovativo abaixo.
            </p>
            {pedido.comprovativo_url ? (
              <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-md p-3">
                <CheckCircle2 className="w-4 h-4 shrink-0" /> Comprovativo enviado — a aguardar confirmação da equipa.
              </div>
            ) : (
              <label className="flex items-center justify-center gap-2 w-full px-4 py-3 border-2 border-dashed border-slate-300 dark:border-zinc-700 rounded-md text-sm text-slate-600 dark:text-zinc-300 hover:border-red-400 hover:text-red-600 cursor-pointer transition-colors">
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
            )}
          </div>
        )}

        {pedido.status === 'confirmed' && (
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-6 shadow-sm text-center">
            <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-2" />
            <p className="text-sm text-slate-600 dark:text-zinc-300">Serviço já renovado por mais 1 ano.</p>
          </div>
        )}

        {pedido.status === 'rejected' && (
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-6 shadow-sm text-center">
            <XCircle className="w-10 h-10 text-rose-500 mx-auto mb-2" />
            <p className="text-sm text-slate-600 dark:text-zinc-300">
              {pedido.rejection_reason || 'Este pedido foi rejeitado pela equipa.'}
            </p>
          </div>
        )}
      </div>

      {/* Coluna direita: card de pagamento (tema claro), selector de método,
          badges de confiança, acções rápidas e informações importantes. */}
      <div className="lg:col-span-4">
        <div className="bg-white border border-slate-200 rounded-lg shadow-sm sticky top-28 overflow-hidden">
          <div className="p-6 space-y-4">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Valor Total</span>
              <p className="text-3xl font-black text-slate-900 mt-0.5">{formatPrice(pedido.valor_mt)}</p>
            </div>

            <div>
              <label className="text-[11px] font-bold uppercase tracking-wide text-slate-400 block mb-1.5">
                Método de Pagamento
              </label>
              <select
                value={pedido.metodo_pagamento}
                disabled={metodoDisabled}
                onChange={(e) => handleChangeMetodo(e.target.value as MetodoPagamento)}
                className="w-full px-3 py-2.5 border border-slate-200 rounded-md text-sm font-bold text-slate-800 bg-slate-50 outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {Object.entries(METODO_META).map(([value, meta]) => (
                  <option key={value} value={value}>{meta.label}</option>
                ))}
              </select>
            </div>

            <div className="text-sm space-y-1.5 pt-2 border-t border-dashed border-slate-200">
              {pedido.metodo_pagamento === 'mpesa' && (
                <p className="text-slate-700">Número M-Pesa: <span className="font-mono font-bold">{MPESA_NUMBER}</span></p>
              )}
              {pedido.metodo_pagamento === 'emola' && (
                <p className="text-slate-700">Número e-Mola: <span className="font-mono font-bold">{EMOLA_NUMBER}</span></p>
              )}
              {pedido.metodo_pagamento === 'transferencia' && (
                <>
                  <p className="text-slate-700">Titular: <span className="font-medium">{BANK_NAME}</span></p>
                  <p className="text-slate-700">Nº Conta: <span className="font-mono font-bold">{BANK_ACCOUNT}</span></p>
                  <p className="text-slate-700">NIB: <span className="font-mono font-bold">{BANK_NIB}</span></p>
                  <p className="text-slate-700">Nº de referência: <span className="font-mono font-bold">{referencia}</span></p>
                </>
              )}
              {pedido.metodo_pagamento === 'stripe' && (
                <p className="text-slate-500 text-xs leading-relaxed">
                  Clique em &quot;Pagar {formatPrice(pedido.valor_mt)}&quot; à esquerda para continuar para a página segura da Stripe.
                </p>
              )}
            </div>

            <div className="flex items-center justify-center gap-2 pt-1">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">
                <ShieldCheck className="w-3.5 h-3.5 text-green-600" /> SSL Seguro
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded">
                <BadgeCheck className="w-3.5 h-3.5 text-green-600" /> PCI Compliant
              </span>
            </div>
            <p className="text-[11px] text-slate-400 text-center">Pagamento seguro e processamento instantâneo.</p>
          </div>

          <div className="border-t border-slate-100">
            <p className="px-6 pt-4 pb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">Acções Rápidas</p>
            <button type="button" onClick={() => window.print()} className="w-full flex items-center gap-2.5 px-6 py-3 text-sm text-slate-700 hover:bg-slate-50 border-t border-slate-100">
              <Printer className="w-4 h-4 text-slate-400" /> Imprimir Factura
            </button>
            <button type="button" onClick={() => window.print()} className="w-full flex items-center gap-2.5 px-6 py-3 text-sm text-slate-700 hover:bg-slate-50 border-t border-slate-100">
              <FileDown className="w-4 h-4 text-slate-400" /> Download PDF
            </button>
            <button type="button" onClick={() => router.push(PUBLIC_PANEL_ENTRY)} className="w-full flex items-center gap-2.5 px-6 py-3 text-sm text-slate-700 hover:bg-slate-50 border-t border-slate-100">
              <ArrowLeft className="w-4 h-4 text-slate-400" /> Retornar ao Painel
            </button>
          </div>

          {pedido.expiration_date && (
            <div className="border-t border-slate-100 bg-slate-50 p-5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500 flex items-center gap-1.5 mb-2">
                <Info className="w-3.5 h-3.5" /> Informações Importantes
              </p>
              <p className="text-xs text-slate-500 leading-relaxed">
                A factura vence em <strong className="text-slate-700">{formatDate(pedido.expiration_date)}</strong>.
              </p>
              <p className="text-xs text-slate-500 leading-relaxed mt-1.5">
                Após o vencimento, poderão ser aplicadas taxas de atraso conforme os termos de serviço.
              </p>
              <p className="text-xs text-slate-500 leading-relaxed mt-1.5">
                Em caso de dúvidas, entre em contacto com o nosso suporte técnico.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
