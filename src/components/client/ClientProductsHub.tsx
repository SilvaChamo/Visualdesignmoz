'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Globe,
  Server,
  Mail,
  RefreshCw,
  ShoppingCart,
  ExternalLink,
  Calendar,
  AlertCircle,
  FileText,
  ArrowRight,
  CheckCircle2,
  X,
} from 'lucide-react';
import type { ClientProductTier, UserProductsSummary } from '@/lib/user-products';
import { useCart } from '@/contexts/CartContext';
import { Spinner } from '@/components/ui/spinner';
import { PendingOrdersSection } from '@/components/client/PendingOrdersSection';

type Props = {
  onNavigate?: (section: string) => void;
};

// Só a contagem interessa aqui — a lista/estado detalhado de cada encomenda
// vive no painel próprio da VisualDesign (/encomendas), não neste painel de
// hospedagem, para não misturar as duas marcas.
type Quotation = {
  id: string;
};

export function ClientProductsHub({ onNavigate }: Props) {
  const { setIsCartOpen } = useCart();
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<UserProductsSummary | null>(null);
  const [tier, setTier] = useState<ClientProductTier>('none');
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [emailDomainInput, setEmailDomainInput] = useState('');
  const [attachingDomain, setAttachingDomain] = useState(false);
  const [attachError, setAttachError] = useState<string | null>(null);
  const [showApprovalBanner, setShowApprovalBanner] = useState(false);
  // null = ainda não sabemos (primeira leitura) — não deve disparar o aviso,
  // só uma leitura seguinte com MAIS produtos activos do que a anterior.
  const previousActiveCountRef = useRef<number | null>(null);

  const loadProducts = () => {
    fetch('/api/my-products', { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        const nextProducts = data.products ?? null;
        setProducts(nextProducts);
        setTier(nextProducts?.tier ?? 'none');

        // A equipa aprovou um pagamento pendente entretanto (M-Pesa/Transferência)
        // — o polling abaixo já corria para outros fins, só falta avisar o
        // cliente em vez de ele descobrir sozinho ao recarregar a página.
        const activeCount = (nextProducts?.domains?.length ?? 0) + (nextProducts?.hosting?.length ?? 0);
        if (previousActiveCountRef.current !== null && activeCount > previousActiveCountRef.current) {
          setShowApprovalBanner(true);
        }
        previousActiveCountRef.current = activeCount;
      })
      .catch(() => setProducts(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProducts();

    fetch('/api/cotacoes')
      .then((r) => r.json())
      .then((data) => { if (data.success) setQuotations(data.quotations); })
      .catch(() => {});
  }, []);

  // Enquanto houver encomendas pendentes, sonda de vez em quando — assim que
  // a equipa (ou o webhook do Stripe/saldo) confirmar um item, a secção
  // correspondente liga-se sozinha sem o cliente ter de recarregar a página.
  const pendingCount = products?.pendingSessions?.length ?? 0;
  useEffect(() => {
    if (pendingCount === 0) return;
    const interval = setInterval(loadProducts, 6000);
    return () => clearInterval(interval);
  }, [pendingCount]);

  const handleAttachEmailDomain = async () => {
    const domain = emailDomainInput.trim().toLowerCase();
    if (!domain) return;
    setAttachingDomain(true);
    setAttachError(null);
    try {
      const res = await fetch('/api/client/attach-email-domain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setAttachError(data.error || 'Não foi possível associar o domínio.');
        return;
      }
      setEmailDomainInput('');
      loadProducts();
    } catch {
      setAttachError('Erro de rede — tente novamente.');
    } finally {
      setAttachingDomain(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  const hasEmailPlan = (products?.emailPlans?.length ?? 0) > 0;
  const pendingSessions = products?.pendingSessions ?? [];

  if (!products || (tier === 'none' && !hasEmailPlan && pendingSessions.length === 0)) {
    return (
      <div className="p-6 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-900">
        Ainda não encontrámos produtos na sua conta. Se acabou de comprar, aguarde alguns minutos
        ou contacte o suporte.
        <button
          type="button"
          onClick={() => (window.location.href = '/guest')}
          className="block mt-3 font-bold text-red-600 hover:underline"
        >
          Voltar à área de compras →
        </button>
      </div>
    );
  }

  const showDomainPanel = tier === 'domain' || tier === 'both';
  const showHostingPanel = tier === 'hosting' || tier === 'both';

  const pendingDomainRows = pendingSessions.flatMap((s) =>
    s.items
      .filter((i) => i.type === 'domain')
      .map((i) => ({ sessionId: s.id, name: i.name })),
  );
  const pendingHostingRows = pendingSessions.flatMap((s) =>
    s.items
      .filter((i) => i.type === 'hosting')
      .map((i) => ({ sessionId: s.id, domain: i.hostingDomain || i.name, plan: i.name })),
  );

  return (
    <div className="space-y-6 p-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Os meus produtos</h1>
        <p className="text-sm text-gray-500 mt-1">
          {tier === 'domain' && 'Gestão de domínios, renovações e novas compras.'}
          {tier === 'hosting' && 'Acesso à hospedagem e opção de comprar domínio.'}
          {tier === 'both' && 'Domínios, hospedagem, renovações e compras adicionais.'}
        </p>
      </div>

      {quotations.length > 0 && (
        <a
          href="/encomendas"
          className="flex items-center justify-between gap-4 bg-white border border-gray-200 rounded-xl p-5 hover:border-red-300 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-red-50 border border-red-200 rounded-lg flex items-center justify-center flex-shrink-0">
              <FileText className="w-5 h-5 text-red-600" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-gray-900">Encomendas VisualDesign</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Tem {quotations.length} {quotations.length === 1 ? 'encomenda' : 'encomendas'} de design gráfico — acompanhe no painel próprio.
              </p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
        </a>
      )}

      {showApprovalBanner && (
        <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-xl p-4">
          <CheckCircle2 className="w-5 h-5 text-green-700 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-green-800 flex-1">
            O seu pagamento foi aprovado — o(s) seu(s) produto(s) já estão disponíveis.
          </p>
          <button
            type="button"
            onClick={() => setShowApprovalBanner(false)}
            className="text-green-700 hover:text-green-900 flex-shrink-0"
            aria-label="Fechar aviso"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <PendingOrdersSection sessions={pendingSessions} onUploaded={loadProducts} />

      {showDomainPanel && (
        <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-gray-900">Domínios</h2>
          </div>
          <div className="p-5 space-y-3">
            {products.domains.length === 0 && pendingDomainRows.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhum domínio registado ainda.</p>
            ) : (
              <>
              {pendingDomainRows.map((row) => (
                <div
                  key={`pending-${row.sessionId}-${row.name}`}
                  className="flex flex-wrap items-center justify-between gap-3 p-4 bg-gray-50 rounded-lg border border-gray-100 opacity-60"
                >
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-gray-900">{row.name}</p>
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                        Pagamento pendente
                      </span>
                    </div>
                    <p className="text-xs text-amber-700 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5" />
                      A aguardar confirmação do pagamento.
                    </p>
                  </div>
                  <a href="#pedidos-pendentes" className="text-xs font-bold text-blue-600 hover:underline">
                    Ver detalhes de pagamento ↑
                  </a>
                </div>
              ))}
              {products.domains.map((d) => (
                <div
                  key={d.id ?? d.name}
                  className="flex flex-wrap items-center justify-between gap-3 p-4 bg-gray-50 rounded-lg border border-gray-100"
                >
                  <div>
                    <p className="font-bold text-gray-900">{d.name}</p>
                    {d.expirationDate && (
                      <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                        <Calendar className="w-3.5 h-3.5" />
                        Expira: {new Date(d.expirationDate).toLocaleDateString('pt-PT')}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {d.id ? (
                      <a
                        href={`/renovacao/iniciar/domain/${d.id}`}
                        className="text-xs font-bold bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
                      >
                        Renovar
                      </a>
                    ) : null}
                    <a
                      href={`https://${d.name}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-bold border border-gray-300 px-4 py-2 rounded-lg hover:border-blue-400 flex items-center gap-1"
                    >
                      Ver site <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              ))}
              </>
            )}
            <button
              type="button"
              onClick={() => (window.location.href = '/precos#dominios')}
              className="text-sm font-bold text-red-600 hover:underline flex items-center gap-1"
            >
              <ShoppingCart className="w-4 h-4" /> Comprar outro domínio
            </button>
          </div>
        </section>
      )}

      {showHostingPanel && (
        <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <Server className="w-5 h-5 text-red-600" />
            <h2 className="font-bold text-gray-900">Hospedagem</h2>
          </div>
          <div className="p-5 space-y-3">
            {products.hosting.length === 0 && pendingHostingRows.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhum pacote de hospedagem activo.</p>
            ) : (
              [
                ...pendingHostingRows.map((row) => ({
                  key: `pending-${row.sessionId}-${row.domain}`,
                  id: undefined as string | undefined,
                  domain: row.domain,
                  plan: row.plan,
                  expirationDate: undefined as string | undefined,
                  state: 'awaiting_payment' as const,
                })),
                ...products.hosting.map((h) => ({
                  key: h.id ?? h.domain,
                  id: h.id,
                  domain: h.domain,
                  plan: h.plan,
                  expirationDate: h.expirationDate ?? undefined,
                  state: h.status === 'pending' ? ('provisioning' as const) : ('active' as const),
                })),
              ].map((row) => {
                const disabled = row.state !== 'active';
                return (
                <div
                  key={row.key}
                  className={`flex flex-wrap items-center justify-between gap-3 p-4 bg-gray-50 rounded-lg border border-gray-100 ${row.state === 'awaiting_payment' ? 'opacity-60' : ''}`}
                >
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-gray-900">{row.domain}</p>
                      {row.state === 'provisioning' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                          A provisionar
                        </span>
                      )}
                      {row.state === 'awaiting_payment' && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                          Pagamento pendente
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Plano: {row.plan || 'Standard'}
                      {row.expirationDate &&
                        ` · Renova: ${new Date(row.expirationDate).toLocaleDateString('pt-PT')}`}
                    </p>
                    {row.state === 'provisioning' && (
                      <p className="text-xs text-amber-700 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Estamos a preparar a sua conta de hospedagem — pode demorar alguns minutos.
                      </p>
                    )}
                    {row.state === 'awaiting_payment' && (
                      <p className="text-xs text-amber-700 mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        <a href="#pedidos-pendentes" className="underline">A aguardar confirmação do pagamento ↑</a>
                      </p>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onNavigate?.('webmail')}
                      disabled={disabled}
                      className="text-xs font-bold border border-gray-300 px-4 py-2 rounded-lg hover:border-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Webmail
                    </button>
                    {row.state === 'active' && row.id ? (
                      <a
                        href={`/renovacao/iniciar/hosting/${row.id}`}
                        className="text-xs font-bold bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
                      >
                        Renovar
                      </a>
                    ) : null}
                  </div>
                </div>
                );
              })
            )}
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                type="button"
                onClick={() => (window.location.href = '/precos#dominios')}
                className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
              >
                <ShoppingCart className="w-4 h-4" /> Comprar domínio no painel
              </button>
            </div>
          </div>
        </section>
      )}

      {hasEmailPlan && (
        <section className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <Mail className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-gray-900">Email</h2>
          </div>
          <div className="p-5 space-y-3">
            {products.emailPlans.map((plan) => {
              if (!plan.domain) {
                return (
                  <div key={plan.id} className="p-4 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
                    <p className="text-sm text-amber-900">
                      O seu plano de email está activo mas ainda não tem domínio associado — indique
                      um domínio que já tenha, ou compre um connosco, para o email começar a funcionar.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <input
                        type="text"
                        value={emailDomainInput}
                        onChange={(e) => setEmailDomainInput(e.target.value)}
                        placeholder="meusite.co.mz"
                        className="flex-1 min-w-[180px] text-sm border border-gray-300 rounded-lg px-3 py-2"
                      />
                      <button
                        type="button"
                        disabled={attachingDomain || !emailDomainInput.trim()}
                        onClick={handleAttachEmailDomain}
                        className="text-xs font-bold bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
                      >
                        {attachingDomain ? 'A associar…' : 'Já tenho este domínio'}
                      </button>
                      <button
                        type="button"
                        onClick={() => (window.location.href = '/precos#dominios')}
                        className="text-xs font-bold border border-gray-300 px-4 py-2 rounded-lg hover:border-red-400 flex items-center gap-1"
                      >
                        <ShoppingCart className="w-4 h-4" /> Comprar domínio connosco
                      </button>
                    </div>
                    {attachError && <p className="text-xs text-red-600">{attachError}</p>}
                  </div>
                );
              }

              return (
                <div
                  key={plan.id ?? plan.domain}
                  className="flex flex-wrap items-center justify-between gap-3 p-4 bg-gray-50 rounded-lg border border-gray-100"
                >
                  <div>
                    <p className="font-bold text-gray-900">{plan.domain}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Email Básico
                      {plan.expirationDate &&
                        ` · Renova: ${new Date(plan.expirationDate).toLocaleDateString('pt-PT')}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onNavigate?.('webmail')}
                      className="text-xs font-bold border border-gray-300 px-4 py-2 rounded-lg hover:border-blue-400"
                    >
                      Webmail
                    </button>
                    {plan.id ? (
                      <a
                        href={`/renovacao/iniciar/hosting/${plan.id}`}
                        className="text-xs font-bold bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700"
                      >
                        Renovar
                      </a>
                    ) : null}
                  </div>
                </div>
              );
            })}
            <p className="text-xs text-gray-400 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5" />
              O plano Email Básico não inclui Mail Marketing — só caixas de correio (Webmail).
            </p>
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={() => setIsCartOpen(true)}
        className="inline-flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-lg text-sm font-bold hover:bg-red-600"
      >
        <ShoppingCart className="w-4 h-4" /> Nova compra
      </button>
    </div>
  );
}
