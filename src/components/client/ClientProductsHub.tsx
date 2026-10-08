'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Globe,
  Server,
  Mail,
  ShoppingCart,
  Calendar,
  AlertCircle,
  FileText,
  ArrowRight,
  CheckCircle,
  CheckCircle2,
  X,
  Network,
  Inbox,
  Receipt,
  RefreshCw,
} from 'lucide-react';
import type { UserProductsSummary } from '@/lib/user-products';
import { Spinner } from '@/components/ui/spinner';
import { PendingOrdersSection } from '@/components/client/PendingOrdersSection';
import { attachEmailDomain } from '@/components/client/ClientAddDomainModal';

export type ClientNavigate = (section: string, opts?: { domain?: string }) => void;

type Props = {
  onNavigate?: ClientNavigate;
  displayName?: string | null;
  sessionUser?: string | null;
  /** Um domínio foi associado ao plano de email — o painel volta a ler os domínios (Contas de e-mail). */
  onProductsChanged?: () => void;
};

// Só a contagem interessa aqui — a lista/estado detalhado de cada encomenda
// vive no painel próprio da VisualDesign (/encomendas), não neste painel de
// hospedagem, para não misturar as duas marcas.
type Quotation = {
  id: string;
};

/**
 * Dashboard do painel Cliente — busca os produtos (/api/my-products) e mostra
 * o mesmo dashboard do painel Profissional (ResellerDashboard), adaptado a
 * quem não tem site: domínios e planos de email em vez de sites WordPress.
 */
export function ClientProductsHub({ onNavigate, displayName, sessionUser, onProductsChanged }: Props) {
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [products, setProducts] = useState<UserProductsSummary | null>(null);
  const [quotations, setQuotations] = useState<Quotation[]>([]);
  const [showApprovalBanner, setShowApprovalBanner] = useState(false);
  // null = ainda não sabemos (primeira leitura) — não deve disparar o aviso,
  // só uma leitura seguinte com MAIS produtos activos do que a anterior.
  const previousActiveCountRef = useRef<number | null>(null);

  const loadProducts = () => {
    fetch('/api/my-products', { credentials: 'include' })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        const nextProducts: UserProductsSummary | null = data.products ?? null;
        setProducts(nextProducts);
        setLoadFailed(false);

        // A equipa aprovou um pagamento pendente entretanto (M-Pesa/Transferência)
        // — o polling abaixo já corria para outros fins, só falta avisar o
        // cliente em vez de ele descobrir sozinho ao recarregar a página.
        const activeCount =
          (nextProducts?.domains?.length ?? 0) +
          (nextProducts?.hosting?.length ?? 0) +
          (nextProducts?.emailPlans?.length ?? 0);
        if (previousActiveCountRef.current !== null && activeCount > previousActiveCountRef.current) {
          setShowApprovalBanner(true);
        }
        previousActiveCountRef.current = activeCount;
      })
      .catch(() => setLoadFailed(true))
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
  // a equipa (ou o webhook do Stripe/saldo) confirmar um item, o dashboard
  // passa a mostrá-lo sem o cliente ter de recarregar a página.
  const pendingCount = products?.pendingSessions?.length ?? 0;
  useEffect(() => {
    if (pendingCount === 0) return;
    const interval = setInterval(loadProducts, 6000);
    return () => clearInterval(interval);
  }, [pendingCount]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner className="w-8 h-8" />
      </div>
    );
  }

  return (
    <ClientDashboardView
      products={products}
      loadFailed={loadFailed}
      quotationsCount={quotations.length}
      showApprovalBanner={showApprovalBanner}
      onDismissApprovalBanner={() => setShowApprovalBanner(false)}
      onReload={loadProducts}
      onDomainAttached={() => {
        loadProducts();
        onProductsChanged?.();
      }}
      onNavigate={onNavigate}
      displayName={displayName}
      sessionUser={sessionUser}
    />
  );
}

const RENEW_BUTTON_DAYS = 60;

const getDaysUntil = (date: string): number => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
};

const formatDate = (date: string): string => {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString('pt-PT');
};

const getDomainExtension = (domain: string): string => {
  const parts = domain.split('.');
  return parts.length >= 2 ? '.' + parts.slice(-1)[0] : '';
};

type RowState = 'active' | 'awaiting_payment' | 'provisioning' | 'registering' | 'transferring' | 'inactive';

const STATE_BADGE: Record<RowState, { label: string; className: string }> = {
  active: { label: 'ACTIVO', className: 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400' },
  awaiting_payment: { label: 'PAGAMENTO PENDENTE', className: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400' },
  provisioning: { label: 'A PROVISIONAR', className: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400' },
  registering: { label: 'EM REGISTO', className: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400' },
  transferring: { label: 'EM TRANSFERÊNCIA', className: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400' },
  inactive: { label: 'INACTIVO', className: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400' },
};

type ServiceRow = {
  key: string;
  kind: 'domain' | 'hosting' | 'email';
  /** Domínio (ou nome do plano, se ainda não houver domínio). */
  title: string;
  /** Tem domínio a sério (para mostrar a extensão / gerir). */
  isDomainName: boolean;
  subtitle: string;
  expirationDate?: string | null;
  state: RowState;
  renewHref?: string;
};

function domainRowState(status?: string | null): RowState {
  if (status === 'transferring') return 'transferring';
  if (status === 'pending') return 'registering';
  if (status === 'expired' || status === 'cancelled' || status === 'suspended') return 'inactive';
  return 'active';
}

function serviceRowState(status?: string | null): RowState {
  if (status === 'pending') return 'provisioning';
  if (status === 'expired' || status === 'cancelled' || status === 'suspended') return 'inactive';
  return 'active';
}

const KIND_ICON = { domain: Globe, hosting: Server, email: Mail } as const;

type ViewProps = {
  products: UserProductsSummary | null;
  loadFailed?: boolean;
  quotationsCount?: number;
  showApprovalBanner?: boolean;
  onDismissApprovalBanner?: () => void;
  onReload?: () => void;
  onDomainAttached?: () => void;
  onNavigate?: ClientNavigate;
  displayName?: string | null;
  sessionUser?: string | null;
};

/** Parte visual do dashboard (separada da leitura para poder ser pré-visualizada com dados fictícios). */
export function ClientDashboardView({
  products,
  loadFailed = false,
  quotationsCount = 0,
  showApprovalBanner = false,
  onDismissApprovalBanner,
  onReload,
  onDomainAttached,
  onNavigate,
  displayName,
  sessionUser,
}: ViewProps) {
  const domains = products?.domains ?? [];
  const hosting = products?.hosting ?? [];
  const emailPlans = products?.emailPlans ?? [];
  const pendingSessions = products?.pendingSessions ?? [];

  const rows = useMemo<ServiceRow[]>(() => {
    const out: ServiceRow[] = [];
    for (const session of pendingSessions) {
      session.items.forEach((item, idx) => {
        if (item.type !== 'domain' && item.type !== 'hosting' && item.type !== 'email') return;
        const title = item.type === 'hosting' ? item.hostingDomain || item.name : item.name;
        out.push({
          key: `pending-${session.id}-${idx}`,
          kind: item.type,
          title,
          isDomainName: item.type !== 'email' && title.includes('.'),
          subtitle: item.type === 'domain' ? 'Domínio' : item.type === 'hosting' ? 'Hospedagem' : 'Plano de e-mail',
          state: 'awaiting_payment',
        });
      });
    }
    for (const d of domains) {
      out.push({
        key: `domain-${d.id ?? d.name}`,
        kind: 'domain',
        title: d.name,
        isDomainName: true,
        subtitle: 'Domínio',
        expirationDate: d.expirationDate,
        state: domainRowState(d.status),
        renewHref: d.id ? `/renovacao/iniciar/domain/${d.id}` : undefined,
      });
    }
    for (const plan of emailPlans) {
      out.push({
        key: `email-${plan.id ?? plan.domain}`,
        kind: 'email',
        title: plan.domain || plan.plan || 'Plano de e-mail',
        isDomainName: Boolean(plan.domain),
        subtitle: plan.domain ? plan.plan || 'Plano de e-mail' : `${plan.plan || 'Plano de e-mail'} · sem domínio associado`,
        expirationDate: plan.expirationDate,
        state: serviceRowState(plan.status),
        renewHref: plan.id ? `/renovacao/iniciar/hosting/${plan.id}` : undefined,
      });
    }
    for (const h of hosting) {
      out.push({
        key: `hosting-${h.id ?? h.domain}`,
        kind: 'hosting',
        title: h.domain,
        isDomainName: Boolean(h.domain),
        subtitle: `Hospedagem · ${h.plan || 'Standard'}`,
        expirationDate: h.expirationDate,
        state: serviceRowState(h.status),
        renewHref: h.id ? `/renovacao/iniciar/hosting/${h.id}` : undefined,
      });
    }
    return out;
  }, [pendingSessions, domains, emailPlans, hosting]);

  const activeCount = rows.filter((r) => r.state !== 'awaiting_payment').length;
  const hasAnything = rows.length > 0;

  const nextRenewal = useMemo(() => {
    let earliest: { date: string; days: number } | null = null;
    for (const row of rows) {
      if (!row.expirationDate || row.state === 'awaiting_payment') continue;
      const days = getDaysUntil(row.expirationDate);
      if (days <= 0) continue;
      if (!earliest || days < earliest.days) earliest = { date: row.expirationDate, days };
    }
    return earliest;
  }, [rows]);

  const accountState = activeCount > 0
    ? { label: 'Activo', hint: 'Cliente', icon: CheckCircle, tone: 'green' as const }
    : pendingSessions.length > 0
      ? { label: 'Pendente', hint: 'A aguardar pagamento', icon: AlertCircle, tone: 'amber' as const }
      : { label: 'Sem produtos', hint: 'Ainda não comprou serviços', icon: AlertCircle, tone: 'gray' as const };

  const plansWithoutDomain = emailPlans.filter((p) => !p.domain);
  const activeEmailPlans = emailPlans.filter((p) => serviceRowState(p.status) === 'active').length;

  const profileLabel = displayName || (sessionUser ? sessionUser.split('@')[0] : 'Cliente');
  const profileInitials = profileLabel.substring(0, 2).toUpperCase();

  const navigate = (section: string, domain?: string) => onNavigate?.(section, domain ? { domain } : undefined);

  const quickLinks = activeCount > 0
    ? [
        { label: 'Contas de e-mail', id: 'emails-new', icon: <Inbox className="w-3.5 h-3.5" /> },
        { label: 'Webmail', id: 'webmail', icon: <Mail className="w-3.5 h-3.5" /> },
        { label: 'DNS Central', id: 'dns-central', icon: <Network className="w-3.5 h-3.5" /> },
        { label: 'As Minhas Compras', id: 'minhas-compras', icon: <ShoppingCart className="w-3.5 h-3.5" /> },
        { label: 'Facturas', id: 'facturas', icon: <Receipt className="w-3.5 h-3.5" /> },
      ]
    : [
        { label: 'As Minhas Compras', id: 'minhas-compras', icon: <ShoppingCart className="w-3.5 h-3.5" /> },
        { label: 'Facturas', id: 'facturas', icon: <Receipt className="w-3.5 h-3.5" /> },
      ];

  const toneClasses = {
    green: { box: 'bg-green-50 dark:bg-green-950/40', icon: 'text-green-600 dark:text-green-400' },
    amber: { box: 'bg-amber-50 dark:bg-amber-950/40', icon: 'text-amber-600 dark:text-amber-400' },
    gray: { box: 'bg-gray-100 dark:bg-zinc-800', icon: 'text-gray-500 dark:text-zinc-400' },
  }[accountState.tone];
  const AccountIcon = accountState.icon;

  return (
    <div className="flex flex-col gap-5 lg:flex-row">
      <div className="min-w-0 flex-1 space-y-5">
        {loadFailed && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            <span>Não foi possível carregar os seus produtos.</span>
            <button
              type="button"
              onClick={onReload}
              className="inline-flex items-center gap-1.5 text-xs font-bold hover:underline"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Tentar novamente
            </button>
          </div>
        )}

        {showApprovalBanner && (
          <div className="flex items-start gap-3 rounded border border-green-200 bg-green-50 p-4 dark:border-green-900/50 dark:bg-green-950/30">
            <CheckCircle2 className="w-5 h-5 text-green-700 flex-shrink-0 mt-0.5 dark:text-green-400" />
            <p className="text-sm text-green-800 flex-1 dark:text-green-300">
              O seu pagamento foi aprovado — o(s) seu(s) produto(s) já estão disponíveis.
            </p>
            <button
              type="button"
              onClick={onDismissApprovalBanner}
              className="text-green-700 hover:text-green-900 flex-shrink-0 dark:text-green-400"
              aria-label="Fechar aviso"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {!hasAnything && (
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm space-y-6">
            <div className="flex items-start gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-4">
              <div className="w-9 h-9 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900/50 flex items-center justify-center text-red-600 dark:text-red-400 shrink-0">
                <ShoppingCart className="w-4.5 h-4.5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Ainda não tem produtos activos na sua conta
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Escolha uma das opções abaixo para adquirir o seu domínio, hospedagem ou e-mail profissional:
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <a
                href="/servicos/dominios"
                className="group flex flex-col justify-between p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 hover:border-red-500/50 hover:bg-white dark:hover:bg-zinc-900 transition-all shadow-sm"
              >
                <div>
                  <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-950/40 border border-purple-100 dark:border-purple-900/50 flex items-center justify-center text-purple-600 dark:text-purple-400 mb-3">
                    <Globe className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                    Registar Domínio
                  </h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    Pesquise e registe o seu domínio (.co.mz, .com, .org) para a sua marca.
                  </p>
                </div>
                <div className="mt-4 flex items-center gap-1.5 text-xs font-bold text-red-600 dark:text-red-400">
                  <span>Registar agora</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </a>

              <a
                href="/precos/hospedagem"
                className="group flex flex-col justify-between p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 hover:border-red-500/50 hover:bg-white dark:hover:bg-zinc-900 transition-all shadow-sm"
              >
                <div>
                  <div className="w-10 h-10 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900/50 flex items-center justify-center text-red-600 dark:text-red-400 mb-3">
                    <Server className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                    Hospedagem Web
                  </h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    Alojamento rápido e seguro com suporte a sites WordPress e e-mail.
                  </p>
                </div>
                <div className="mt-4 flex items-center gap-1.5 text-xs font-bold text-red-600 dark:text-red-400">
                  <span>Ver planos</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </a>

              <a
                href="/precos/email"
                className="group flex flex-col justify-between p-5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 hover:border-red-500/50 hover:bg-white dark:hover:bg-zinc-900 transition-all shadow-sm"
              >
                <div>
                  <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-3">
                    <Mail className="w-5 h-5" />
                  </div>
                  <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-100 group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors">
                    E-mail Profissional
                  </h4>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                    Contas de e-mail corporativo personalizadas com o seu próprio domínio.
                  </p>
                </div>
                <div className="mt-4 flex items-center gap-1.5 text-xs font-bold text-red-600 dark:text-red-400">
                  <span>Ver planos</span>
                  <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                </div>
              </a>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <button
            type="button"
            onClick={() => (activeEmailPlans > 0 ? navigate('emails-new') : (window.location.href = '/precos/email'))}
            className="bg-white rounded border border-gray-200 shadow-sm p-5 flex items-start gap-4 text-left cursor-pointer hover:shadow-md hover:border-blue-200 transition-all dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-blue-900/50"
          >
            <div className="p-3 bg-blue-50 rounded-lg dark:bg-blue-950/40">
              <Mail className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-zinc-400">Planos de E-mail</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-zinc-100">{activeEmailPlans}</p>
              <p className="text-xs text-gray-400 mt-0.5 dark:text-zinc-500">
                {activeEmailPlans > 0 ? 'Ver contas de e-mail' : 'Ver planos de e-mail'}
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => (domains.length > 0 ? navigate('domain-manager') : (window.location.href = '/servicos/dominios?origem=painel'))}
            className="bg-white rounded border border-gray-200 shadow-sm p-5 flex items-start gap-4 text-left cursor-pointer hover:shadow-md hover:border-purple-200 transition-all dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-purple-900/50"
          >
            <div className="p-3 bg-purple-50 rounded-lg dark:bg-purple-950/40">
              <Globe className="w-6 h-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-zinc-400">Domínios</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-zinc-100">{domains.length}</p>
              <p className="text-xs text-gray-400 mt-0.5 dark:text-zinc-500">{domains.length > 0 ? 'Domínios registados' : 'Registar domínio'}</p>
            </div>
          </button>

          <div className="bg-white rounded border border-gray-200 shadow-sm p-5 flex items-start gap-4 dark:border-zinc-700 dark:bg-zinc-900">
            <div className={`p-3 rounded-lg ${toneClasses.box}`}>
              <AccountIcon className={`w-6 h-6 ${toneClasses.icon}`} />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-zinc-400">Estado da Conta</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-zinc-100">{accountState.label}</p>
              <p className="text-xs text-gray-400 mt-0.5 dark:text-zinc-500">{accountState.hint}</p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate('facturas')}
            className="bg-white rounded border border-gray-200 shadow-sm p-5 flex items-start gap-4 text-left cursor-pointer hover:shadow-md hover:border-red-200 transition-all dark:border-zinc-700 dark:bg-zinc-900 dark:hover:border-red-900/50"
          >
            <div className="p-3 bg-red-50 rounded-lg dark:bg-red-950/40">
              <FileText className="w-6 h-6 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-sm text-gray-500 dark:text-zinc-400">Próxima Renovação</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-zinc-100">
                {nextRenewal ? formatDate(nextRenewal.date) : 'N/A'}
              </p>
              <p className="text-xs text-gray-400 mt-0.5 dark:text-zinc-500">Ver facturas</p>
            </div>
          </button>
        </div>

        {plansWithoutDomain.length > 0 && (
          <EmailPlanDomainPrompt onAttached={onDomainAttached ?? onReload} />
        )}

        <PendingOrdersSection sessions={pendingSessions} onUploaded={() => onReload?.()} />

        {quotationsCount > 0 && (
          <a
            href="/encomendas"
            className="flex items-center justify-between gap-4 bg-white rounded border border-gray-200 shadow-sm p-4 hover:shadow-md hover:border-red-200 transition-all dark:border-zinc-700 dark:bg-zinc-900"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center flex-shrink-0 dark:bg-red-950/40">
                <FileText className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="min-w-0">
                <p className="font-bold text-gray-900 dark:text-zinc-100">Encomendas VisualDesign</p>
                <p className="text-xs text-gray-500 mt-0.5 dark:text-zinc-400">
                  Tem {quotationsCount} {quotationsCount === 1 ? 'encomenda' : 'encomendas'} de design gráfico — acompanhe no painel próprio.
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
          </a>
        )}

        <div className="space-y-3">
          {!hasAnything ? (
            <div className="bg-white rounded border border-gray-200 shadow-sm p-10 text-center dark:border-zinc-700 dark:bg-zinc-900">
              <Globe className="w-12 h-12 text-gray-300 mx-auto mb-4 dark:text-zinc-600" />
              <p className="text-gray-500 dark:text-zinc-400">Ainda não tem domínios nem planos de e-mail.</p>
              <p className="text-xs text-gray-400 mt-1 dark:text-zinc-500">
                Se acabou de comprar, a encomenda aparece aqui assim que for registada.
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <a
                  href="/servicos/dominios?origem=painel"
                  className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold uppercase tracking-wider rounded transition-colors"
                >
                  Registar domínio
                </a>
                <a
                  href="/precos/email"
                  className="px-5 py-2 bg-white border border-gray-800 hover:bg-gray-800 hover:text-white text-gray-800 text-xs font-bold uppercase tracking-wider rounded transition-colors dark:bg-transparent dark:border-zinc-500 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Planos de e-mail
                </a>
              </div>
            </div>
          ) : (
            rows.map((row) => {
              const Icon = KIND_ICON[row.kind];
              const badge = STATE_BADGE[row.state];
              const ok = row.state === 'active';
              const showRenew =
                ok && row.renewHref && row.expirationDate && getDaysUntil(row.expirationDate) <= RENEW_BUTTON_DAYS;
              const manage =
                row.state === 'awaiting_payment'
                  ? null
                  : row.kind === 'email'
                    ? { label: 'CAIXAS DE E-MAIL', go: () => navigate('emails-new') }
                    : row.isDomainName
                      ? { label: 'GERENCIAR', go: () => navigate('domain-detail', row.title) }
                      : null;

              return (
                <div
                  key={row.key}
                  className={`bg-white rounded border border-gray-200 shadow-sm p-4 flex flex-wrap items-center justify-between gap-3 hover:shadow-md transition-shadow dark:border-zinc-700 dark:bg-zinc-900 ${row.state === 'awaiting_payment' ? 'opacity-70' : ''}`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div
                      className={`w-12 h-12 shrink-0 rounded flex items-center justify-center border ${
                        ok
                          ? 'bg-green-50 border-green-100 dark:bg-green-950/30 dark:border-green-900/50'
                          : row.state === 'inactive'
                            ? 'bg-red-50 border-red-100 dark:bg-red-950/30 dark:border-red-900/50'
                            : 'bg-amber-50 border-amber-100 dark:bg-amber-950/30 dark:border-amber-900/50'
                      }`}
                    >
                      <Icon
                        className={`w-6 h-6 ${
                          ok
                            ? 'text-green-600 dark:text-green-400'
                            : row.state === 'inactive'
                              ? 'text-red-500 dark:text-red-400'
                              : 'text-amber-600 dark:text-amber-400'
                        }`}
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-gray-900 truncate dark:text-zinc-100">{row.title}</h3>
                        {row.isDomainName && (
                          <span className="text-xs text-gray-500 font-medium dark:text-zinc-400">
                            {getDomainExtension(row.title)}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                        <span className="text-xs text-gray-500 dark:text-zinc-400">{row.subtitle}</span>
                        {row.expirationDate && row.state !== 'awaiting_payment' ? (
                          <span className={`flex items-center gap-1 text-xs font-medium ${ok ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-zinc-400'}`}>
                            <Calendar className="w-3.5 h-3.5" />
                            Expiração: {formatDate(row.expirationDate)}
                          </span>
                        ) : null}
                        {row.state === 'awaiting_payment' ? (
                          <a href="#pedidos-pendentes" className="text-xs text-amber-700 underline dark:text-amber-400">
                            Ver detalhes de pagamento
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    {showRenew ? (
                      <a
                        href={row.renewHref}
                        className="px-5 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-bold uppercase tracking-wider rounded transition-colors"
                      >
                        RENOVAR
                      </a>
                    ) : null}
                    {manage ? (
                      <button
                        type="button"
                        onClick={manage.go}
                        className="px-5 py-2 bg-white border border-gray-800 hover:bg-gray-800 hover:text-white text-gray-800 text-xs font-bold uppercase tracking-wider rounded transition-colors dark:bg-transparent dark:border-zinc-500 dark:text-zinc-200 dark:hover:bg-zinc-800"
                      >
                        {manage.label}
                      </button>
                    ) : null}
                    <span className={`px-3 py-1 rounded text-xs font-bold ${badge.className}`}>{badge.label}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="w-full shrink-0 space-y-4 lg:w-64">
        <div className="bg-white rounded border border-gray-200 shadow-sm p-5 dark:border-zinc-700 dark:bg-zinc-900">
          <div className="flex flex-col items-center mb-4">
            <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mb-2">
              <span className="text-white text-xl font-bold">{profileInitials}</span>
            </div>
            <span
              className={`px-2 py-0.5 rounded text-xs font-bold ${
                activeCount > 0
                  ? 'bg-green-100 text-green-700 dark:bg-green-950/50 dark:text-green-400'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400'
              }`}
            >
              {activeCount > 0 ? 'Activo' : accountState.label}
            </span>
          </div>
          <div className="space-y-1.5 text-sm border-t border-gray-100 pt-4 text-center dark:border-zinc-800">
            <p className="font-bold text-gray-900 dark:text-zinc-100">{profileLabel}</p>
            {sessionUser ? <p className="text-gray-500 text-xs break-all dark:text-zinc-400">{sessionUser}</p> : null}
          </div>
        </div>

        <div className="bg-white rounded border border-gray-200 shadow-sm p-5 text-center dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-xs font-bold text-gray-500 uppercase mb-2 dark:text-zinc-400">Novos Serviços</p>
          <p className="text-xs text-gray-500 mb-3 dark:text-zinc-400">Registe outro domínio ou adicione e-mail profissional.</p>
          <a
            href="/servicos/dominios?origem=painel"
            className="block w-full bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase tracking-widest py-2 rounded transition-all"
          >
            Registar Domínio
          </a>
          <a
            href="/precos/email"
            className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-gray-700 hover:text-red-600 dark:text-zinc-300 dark:hover:text-red-400"
          >
            Planos de e-mail <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>

        <div className="bg-white rounded border border-gray-200 shadow-sm p-4 dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-3 dark:text-zinc-400">
            Acesso Rápido
          </p>
          <div className="space-y-1">
            {quickLinks.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 hover:text-red-600 rounded transition-colors text-left font-medium dark:text-zinc-300 dark:hover:bg-transparent dark:hover:text-red-400"
              >
                <span className="text-gray-400 dark:text-zinc-500">{item.icon}</span>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Plano de email comprado sem domínio — o cliente indica um que já tem, ou compra um connosco. */
function EmailPlanDomainPrompt({ onAttached }: { onAttached?: () => void }) {
  const [domainInput, setDomainInput] = useState('');
  const [attaching, setAttaching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAttach = async () => {
    if (!domainInput.trim()) return;
    setAttaching(true);
    setError(null);
    const result = await attachEmailDomain(domainInput);
    setAttaching(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDomainInput('');
    onAttached?.();
  };

  return (
    <div className="rounded border border-amber-200 bg-amber-50 p-4 space-y-3 dark:border-amber-900/50 dark:bg-amber-950/30">
      <p className="text-sm text-amber-900 dark:text-amber-200">
        O seu plano de email está activo mas ainda não tem domínio associado — indique um domínio que
        já tenha, ou compre um connosco, para o email começar a funcionar.
      </p>
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          value={domainInput}
          onChange={(e) => setDomainInput(e.target.value)}
          placeholder="meusite.co.mz"
          className="flex-1 min-w-[180px] text-sm border border-gray-300 rounded px-3 py-2 bg-white dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        />
        <button
          type="button"
          disabled={attaching || !domainInput.trim()}
          onClick={handleAttach}
          className="text-xs font-bold bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50"
        >
          {attaching ? 'A associar…' : 'Já tenho este domínio'}
        </button>
        {/* Pesquisa de domínios com a sessão desta conta; a compra fica ligada
            a este plano (checkout-fulfillment → attachDomainToEmailPlan) e no
            fim volta ao painel. */}
        <a
          href="/servicos/dominios?origem=painel"
          className="text-xs font-bold border border-gray-300 bg-white px-4 py-2 rounded hover:border-red-400 flex items-center gap-1 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
        >
          <ShoppingCart className="w-4 h-4" /> Comprar domínio connosco
        </a>
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
      <p className="text-xs text-amber-800/80 flex items-center gap-1 dark:text-amber-300/80">
        <AlertCircle className="w-3.5 h-3.5" />
        Os planos de e-mail não incluem Mail Marketing — só caixas de correio (Webmail).
      </p>
    </div>
  );
}
