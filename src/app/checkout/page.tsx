'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useCart } from '@/contexts/CartContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { supabase } from '@/lib/supabase-client';
import { useAuth } from '@/components/auth/AuthProvider';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { RenewalCheckout } from './RenewalCheckout';
import { MPESA_NUMBER, BANK_NAME, BANK_ACCOUNT, BANK_NIB } from '@/lib/quotation-payment-info';
import { formatMt } from '@/lib/pricing-catalog';
import { DOMAIN_TLD_PRICES, domainRegistrationPriceMt } from '@/lib/domain-tld-prices';
import { getHostingPlan, getHostingCyclePrice, type HostingBillingCycle } from '@/lib/hosting-plans';
import { EMAIL_CATALOG } from '@/lib/package-catalog';
import { resolveUserRole, getRedirectPathForRole } from '@/lib/user-roles';

// Moçambique não usa "Estado" (terminologia brasileira) — usa província.
// Ordem geográfica norte → sul, como pedido.
const MOZAMBIQUE_PROVINCIAS = [
  'Cabo Delgado',
  'Niassa',
  'Nampula',
  'Zambézia',
  'Tete',
  'Manica',
  'Sofala',
  'Inhambane',
  'Gaza',
  'Maputo Província',
  'Cidade de Maputo',
];

const DOMAIN_REGISTRATION_YEARS = [1, 2, 3, 5, 10];
const HOSTING_CYCLE_MONTHS: Record<HostingBillingCycle, number> = { monthly: 1, semiannual: 6, annual: 12 };
const HOSTING_CYCLE_LABELS: Record<HostingBillingCycle, string> = { monthly: 'Mensal', semiannual: 'Semestral', annual: 'Anual' };
import { checkoutEntryPath } from '@/lib/checkout-flow';
import { profileAuthOrFilter } from '@/lib/profile-db';
import {
  CreditCard,
  Lock,
  Loader2,
  AlertCircle,
  ShoppingCart,
  Globe,
  Server,
  Mail,
  Shield,
  Eye,
  EyeOff,
  Smartphone,
  Landmark,
  ShieldCheck,
  BadgeCheck,
  Zap,
  Printer,
  FileDown,
  ArrowLeft,
  Info,
  Building2,
  UserCircle,
  Wallet,
  CheckCircle2,
  Paperclip,
  Trash2
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';

type MetodoPagamento = 'stripe' | 'mpesa' | 'transferencia' | 'saldo';

const METODO_META: Record<MetodoPagamento, { label: string; icon: typeof Smartphone }> = {
  transferencia: { label: 'Transferência Bancária', icon: Landmark },
  mpesa: { label: 'M-Pesa', icon: Smartphone },
  stripe: { label: 'Cartão (Stripe)', icon: CreditCard },
  saldo: { label: 'Saldo da Conta', icon: Wallet },
};

/** Painel de destino depois de uma compra — quem compra a si próprio vai para
 * /profissional (nunca /cliente, reservado a contas geridas pela VisualDesign). */
function redirectPathForSession(
  session: { user?: { email?: string | null; user_metadata?: Record<string, unknown> | null; app_metadata?: Record<string, unknown> | null } | null } | null,
): string {
  const role = resolveUserRole({
    email: session?.user?.email,
    userMetadata: session?.user?.user_metadata,
    appMetadata: session?.user?.app_metadata,
  });
  return getRedirectPathForRole(role);
}

function CheckoutContent() {
  const { items, total, clearCart, updateItemPeriod, removeItem } = useCart();
  const router = useRouter();
  const { user: authUser, loading: authLoading } = useAuth();
  const isAuthenticated = authLoading ? null : !!authUser;
  const searchParams = useSearchParams();
  const renewalId = searchParams.get('renewalId');
  const { currency, formatPrice } = useCurrency();

  // Hospedagem sem domínio associado não deve chegar a esta página — manda
  // sempre primeiro para /checkout/dominio (rede de segurança para quem
  // chega aqui directamente, ex. voltar atrás no browser).
  useEffect(() => {
    if (renewalId) return;
    const entry = checkoutEntryPath(items);
    if (entry !== '/checkout') router.replace(entry);
  }, [items, renewalId, router]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [metodoPagamento, setMetodoPagamento] = useState<MetodoPagamento>('transferencia');

  // Pedido de M-Pesa/Transferência já criado, à espera do comprovativo —
  // enquanto isto não for null, o checkout mostra o passo de upload em vez
  // do carrinho (mesmo já vazio) ou do formulário de pagamento.
  const [manualSession, setManualSession] = useState<{ id: string; metodoPagamento: 'mpesa' | 'transferencia' } | null>(null);
  const restoredPendingIdRef = React.useRef<string | null>(null);

  // Recupera este passo depois de um recarregamento a meio (ex: refresh
  // acidental) — sem isto a página cairia no ecrã genérico de "carrinho
  // vazio" (o carrinho já foi limpo ao criar o pedido pendente).
  useEffect(() => {
    const pendingId = searchParams.get('pendingId');
    if (!pendingId || isAuthenticated !== true || restoredPendingIdRef.current === pendingId) return;
    restoredPendingIdRef.current = pendingId;
    fetch(`/api/checkout/session-status?session_id=${encodeURIComponent(pendingId)}`)
      .then((r) => r.json())
      .then((data) => {
        const s = data?.session;
        if (data.success && s?.status === 'pending' && (s.metodo_pagamento === 'mpesa' || s.metodo_pagamento === 'transferencia')) {
          setManualSession({ id: s.id, metodoPagamento: s.metodo_pagamento });
        } else {
          router.replace('/checkout');
        }
      })
      .catch(() => router.replace('/checkout'));
  }, [searchParams, isAuthenticated, router]);

  // M-Pesa/Transferência/Saldo não processam USD — se o cliente troca a
  // moeda no topo do site enquanto está no checkout, o método tem de
  // acompanhar para nunca ficar um valor em USD "por pagar" com M-Pesa.
  useEffect(() => {
    if (currency === 'USD' && metodoPagamento !== 'stripe') setMetodoPagamento('stripe');
  }, [currency, metodoPagamento]);

  // Saldo do revendedor (reseller_credits) — null enquanto não se sabe, ou
  // se a conta nem é de revendedor (a rota devolve 403, ignorado em silêncio:
  // a opção "Saldo da Conta" simplesmente não aparece no select).
  const [saldoDisponivel, setSaldoDisponivel] = useState<number | null>(null);
  useEffect(() => {
    if (!isAuthenticated) return;
    fetch('/api/reseller/credito')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data?.success) setSaldoDisponivel(data.saldoMt); })
      .catch(() => {});
  }, [isAuthenticated]);

  // Account Form State (For unauthenticated users)
  const [accountForm, setAccountForm] = useState({
    name: '',
    sobrenome: '',
    email: '',
    telefone: '',
    password: '',
    empresa: '',
    endereco: '',
    endereco2: '',
    cidade: '',
    estado: '',
    codigoPostal: '',
    pais: 'Mozambique'
  });
  const [showPassword, setShowPassword] = useState(false);

  // Morada/telefone do perfil (WHOIS) — para o card "Faturado Para" de quem já
  // tem conta; não vem no user_metadata, só na tabela profiles.
  const [profileExtra, setProfileExtra] = useState<{ telefone?: string | null; morada?: string | null; cidade?: string | null } | null>(null);
  useEffect(() => {
    if (!authUser) return;
    supabase
      .from('profiles')
      .select('telefone, morada, cidade')
      .or(profileAuthOrFilter(authUser.id))
      .maybeSingle()
      .then(({ data }: { data: { telefone?: string | null; morada?: string | null; cidade?: string | null } | null }) => setProfileExtra(data));
  }, [authUser]);

  // "Entrar como" — se um admin estiver a impersonar um revendedor/cliente, a
  // compra corre como essa conta (servidor: /lib/checkout-actor.ts). Aqui só
  // trazemos o rótulo + os dados de faturação DESSA conta para o cartão não
  // mostrar os dados do admin.
  const [buyingAs, setBuyingAs] = useState<{
    label: string | null;
    email: string | null;
    billing: { nome: string | null; telefone: string | null; morada: string | null; cidade: string | null };
  } | null>(null);
  useEffect(() => {
    if (!authUser) return;
    fetch('/api/checkout/actor', { credentials: 'include' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setBuyingAs(d && d.impersonating ? d : null))
      .catch(() => setBuyingAs(null));
  }, [authUser]);

  // Editar telefone/morada/cidade sem sair do checkout — "Completar Dados"
  // já não manda para /cliente (dava problemas de navegação para contas que
  // não são 'client'); passa a editar aqui mesmo, os mesmos campos que a
  // Dynadot exige no registo WHOIS do domínio.
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileEditForm, setProfileEditForm] = useState({ email: '', telefone: '', morada: '', cidade: '' });
  const startEditingProfile = () => {
    setProfileEditForm({
      email: authUser?.email || '',
      telefone: profileExtra?.telefone || '',
      morada: profileExtra?.morada || '',
      cidade: profileExtra?.cidade || '',
    });
    setEditingProfile(true);
  };
  const saveProfileExtra = async () => {
    if (!authUser) return;
    setSavingProfile(true);
    try {
      const newEmail = profileEditForm.email.toLowerCase().trim();
      // #22: o email identifica a conta no Auth — trocar isto tem de actualizar
      // Auth e o perfil juntos (nunca só um), por isso passa por uma rota
      // própria com service role em vez do update directo usado abaixo.
      if (newEmail && newEmail !== (authUser.email || '').toLowerCase()) {
        const res = await fetch('/api/account/update-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newEmail }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Erro ao trocar email.');
        }
        // Actualiza a sessão local para reflectir o novo email sem sair do checkout.
        await supabase.auth.refreshSession();
      }

      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .or(profileAuthOrFilter(authUser.id))
        .maybeSingle();
      const payload = {
        user_id: authUser.id,
        telefone: profileEditForm.telefone || null,
        morada: profileEditForm.morada || null,
        cidade: profileEditForm.cidade || null,
        updated_at: new Date().toISOString(),
      };
      const { error } = existing?.id
        ? await supabase.from('profiles').update(payload).eq('id', existing.id)
        : await supabase.from('profiles').insert(payload);
      if (error) throw error;
      setProfileExtra({ telefone: payload.telefone, morada: payload.morada, cidade: payload.cidade });
      setEditingProfile(false);
      if (status === 'error') {
        setStatus('idle');
        setErrorMessage('');
      }
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Erro ao guardar dados.');
    } finally {
      setSavingProfile(false);
    }
  };

  // Flow State
  const [status, setStatus] = useState<'idle' | 'registering' | 'redirecting' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; // Evita duplo-clique / duplo pagamento
    setIsSubmitting(true);
    setErrorMessage('');

    if (isAuthenticated === false) {
      if (!accountForm.name.trim()) {
        setErrorMessage('Por favor, preencha o seu Nome Completo para criar a conta.');
        setStatus('error');
        setIsSubmitting(false);
        return;
      }
      if (!accountForm.email.trim()) {
        setErrorMessage('Por favor, introduza o seu Email para criar a conta.');
        setStatus('error');
        setIsSubmitting(false);
        return;
      }
      if (!accountForm.telefone.trim()) {
        setErrorMessage('Por favor, introduza o seu Telefone para criar a conta.');
        setStatus('error');
        setIsSubmitting(false);
        return;
      }
      if (accountForm.password.length < 6) {
        setErrorMessage('A Palavra-passe é demasiado curta. Deve ter no mínimo 6 caracteres.');
        setStatus('error');
        setIsSubmitting(false);
        return;
      }
    }

    try {
      if (isAuthenticated === false) {
        setStatus('registering');
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: accountForm.email,
            password: accountForm.password,
            nome: `${accountForm.name} ${accountForm.sobrenome}`.trim(),
            telefone: accountForm.telefone,
            empresa: accountForm.empresa,
            endereco: accountForm.endereco,
            cidade: accountForm.cidade,
            pais: accountForm.pais,
          })
        });
        const data = await res.json();

        if (!res.ok) {
          if (data.error?.includes('Já existe uma conta') || data.error?.includes('already')) {
             // signInWithPassword nunca lança excepção mesmo com credenciais
             // erradas — devolve sempre { error } no resultado. Um try/catch
             // à volta não deteta a falha; é preciso verificar o campo error.
             const { error: loginError } = await supabase.auth.signInWithPassword({
               email: accountForm.email,
               password: accountForm.password,
             });
             if (loginError) {
               throw new Error('Já existe uma conta com este email. Por favor, faça login para continuar.');
             }
          } else {
            throw new Error(data.error || 'Erro ao criar a sua conta.');
          }
        } else if (!data.sessionReady) {
          // Salvaguarda rara: a sessão normalmente já vem pronta na resposta
          // de /api/auth/register (autenticada no servidor). Só cai aqui se
          // esse passo falhar por algum motivo — tenta uma vez a partir do browser.
          const { error: loginError } = await supabase.auth.signInWithPassword({
            email: accountForm.email,
            password: accountForm.password,
          });
          if (loginError) {
            throw new Error('Não foi possível iniciar sessão com a conta criada. Tente submeter novamente.');
          }
        }

        // O registo (ou login em conta já existente) só deixou a sessão nos
        // cookies — sincroniza aqui o estado do cliente para o resto deste
        // fluxo (e para a página depois do router.replace mais abaixo) já
        // reconhecer isAuthenticated correctamente, em vez de depender de um
        // evento que pode não disparar a tempo (era isto que causava o falso
        // "faça login" mesmo com a conta e a sessão já certas).
        await supabase.auth.refreshSession();
      }

      if (metodoPagamento === 'saldo') {
        // Saldo do revendedor já é "dinheiro confirmado" — activa na hora.
        // Ainda assim entra pelo painel real (não por uma página de sucesso
        // à parte), mesmo mecanismo dos outros métodos — aqui já chega lá
        // com o produto já activo, não cinzento.
        const res = await fetch('/api/checkout/saldo-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Não foi possível pagar com o saldo.');
        }
        clearCart();
        const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();
        router.push(redirectPathForSession(refreshedSession));
        return;
      }

      if (metodoPagamento === 'stripe') {
        setStatus('redirecting');
        const res = await fetch('/api/checkout/create-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items }),
        });
        const data = await res.json();
        if (!res.ok || !data.success || !data.url) {
          throw new Error(data.error || 'Não foi possível iniciar o pagamento com Stripe.');
        }
        // Redirecciona para o Stripe Checkout hospedado — o webhook confirma o pagamento
        // e activa os produtos; esta página não marca nada como "pago" directamente.
        window.location.href = data.url;
        return;
      }

      // M-Pesa / Transferência — regista o pedido como pendente; a equipa
      // confirma manualmente depois de ver o comprovativo (ver
      // /api/admin/checkout-pagamentos). Fica aqui mesmo no checkout a pedir
      // o comprovativo — só entra no painel real depois de o enviar com
      // sucesso (ver ManualPaymentUploadStep abaixo).
      const res = await fetch('/api/checkout/manual-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, metodoPagamento }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Não foi possível registar o pedido de pagamento.');
      }
      clearCart();
      const manualMetodo = metodoPagamento === 'mpesa' ? 'mpesa' : 'transferencia';
      setManualSession({ id: data.session.id, metodoPagamento: manualMetodo });
      restoredPendingIdRef.current = data.session.id;
      router.replace(`/checkout?pendingId=${data.session.id}`);
      setStatus('idle');
      setIsSubmitting(false);
      return;
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao comunicar com o servidor de registo.');
      setStatus('error');
      setIsSubmitting(false);
    }
  };

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950">
        <div className="text-center space-y-4">
          <Spinner className="w-10 h-10 mx-auto" />
          <p className="text-sm font-semibold text-slate-500 dark:text-zinc-400">A validar sessão segura...</p>
        </div>
      </div>
    );
  }

  // Checkout de renovação (link "Pagar Agora" das notificações) — dados da
  // conta clicada carregados a partir do pedido, layout próprio (ver
  // RenewalCheckout.tsx). Não usa o carrinho de compras nem o fluxo de registo
  // abaixo, que servem só para compras novas.
  if (renewalId) {
    if (isAuthenticated === false) {
      router.push(`/auth/login?redirect=${encodeURIComponent(`/checkout?renewalId=${renewalId}`)}`);
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950">
          <Spinner className="w-10 h-10" />
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 pt-32 pb-16 transition-colors duration-200">
        <div className="max-w-7xl mx-auto px-[40px] mt-4">
          <RenewalCheckout renewalId={renewalId} />
        </div>
      </div>
    );
  }

  const typeLabel: Record<string, string> = { domain: 'Domínio', hosting: 'Alojamento', email: 'Email', ssl: 'SSL' };
  const typeIcon: Record<string, React.ReactNode> = {
    domain: <Globe className="w-4 h-4 text-teal-650 dark:text-teal-400" />,
    hosting: <Server className="w-4 h-4 text-red-600 dark:text-red-400" />,
    email: <Mail className="w-4 h-4 text-blue-650 dark:text-blue-400" />,
    ssl: <Shield className="w-4 h-4 text-green-650 dark:text-green-400" />,
  };

  const clientName = authUser?.user_metadata?.full_name || authUser?.user_metadata?.nome || authUser?.email?.split('@')[0];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 pt-32 pb-16 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-[40px] mt-4">

        {manualSession ? (
          <ManualPaymentUploadStep
            sessionId={manualSession.id}
            metodoPagamento={manualSession.metodoPagamento}
            onContinue={async () => {
              const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();
              router.push(redirectPathForSession(refreshedSession));
            }}
          />
        ) : items.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-12 text-center max-w-lg mx-auto space-y-6 shadow-sm">
            <ShoppingCart className="w-16 h-16 text-slate-300 dark:text-zinc-700 mx-auto" />
            <h2 className="text-xl font-bold text-slate-800 dark:text-zinc-100 font-panel">O seu carrinho está vazio</h2>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              Não existem produtos ou domínios prontos para finalização de compra.
            </p>
            <button
              onClick={() => router.push('/')}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-md transition-colors"
            >
              Pesquisar Domínio
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">

            {/* Left Column: Account data / form and loading steps */}
            <div className="lg:col-span-9 space-y-5">

              {/* Dados da conta — só quando já tem sessão iniciada; para quem não
                  tem conta, é o próprio formulário abaixo que cumpre este papel. */}
              {isAuthenticated === true && (status === 'idle' || status === 'error') && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-6 shadow-sm">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-red-600 dark:text-red-400 flex items-center gap-1.5 mb-3">
                      <Building2 className="w-3.5 h-3.5" /> Faturado Por
                    </p>
                    <p className="font-bold text-slate-800 dark:text-zinc-100 text-sm">VisualDESIGN Services, Lda.</p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2 leading-relaxed">
                      Av. Karl Marx, 177, Maputo — Moçambique
                    </p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">info@visualdesignmoz.com</p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2">NUIT: 400597243</p>
                  </div>

                  <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-red-600 dark:text-red-400 flex items-center gap-1.5">
                        <UserCircle className="w-3.5 h-3.5" /> Faturado Para
                      </p>
                      {!editingProfile && !buyingAs && (
                        <button type="button" onClick={startEditingProfile} className="text-[10px] font-bold text-slate-400 hover:text-red-600 dark:hover:text-red-400">
                          Editar
                        </button>
                      )}
                    </div>
                    {buyingAs ? (
                      <p className="mb-2 inline-flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-700 dark:bg-amber-950/40 dark:text-amber-400">
                        Em nome de: {buyingAs.label}
                      </p>
                    ) : null}
                    <p className="font-bold text-slate-800 dark:text-zinc-100 text-sm">{buyingAs?.billing?.nome || clientName}</p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 truncate">Email: {buyingAs?.email || authUser?.email}</p>

                    {editingProfile ? (
                      <div className="mt-3 space-y-2">
                        <input
                          type="email"
                          value={profileEditForm.email}
                          onChange={(e) => setProfileEditForm((f) => ({ ...f, email: e.target.value }))}
                          placeholder="Email"
                          className="w-full text-xs border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded px-2.5 py-1.5"
                        />
                        <input
                          value={profileEditForm.telefone}
                          onChange={(e) => setProfileEditForm((f) => ({ ...f, telefone: e.target.value }))}
                          placeholder="Telefone"
                          className="w-full text-xs border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded px-2.5 py-1.5"
                        />
                        <input
                          value={profileEditForm.morada}
                          onChange={(e) => setProfileEditForm((f) => ({ ...f, morada: e.target.value }))}
                          placeholder="Morada"
                          className="w-full text-xs border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded px-2.5 py-1.5"
                        />
                        <input
                          value={profileEditForm.cidade}
                          onChange={(e) => setProfileEditForm((f) => ({ ...f, cidade: e.target.value }))}
                          placeholder="Cidade"
                          className="w-full text-xs border border-slate-200 dark:border-zinc-800 dark:bg-zinc-950 rounded px-2.5 py-1.5"
                        />
                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            onClick={saveProfileExtra}
                            disabled={savingProfile}
                            className="bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded hover:bg-red-700 disabled:opacity-50"
                          >
                            {savingProfile ? 'A guardar...' : 'Guardar'}
                          </button>
                          <button type="button" onClick={() => setEditingProfile(false)} className="text-xs font-bold text-slate-400 px-2">
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2">
                          Endereço: {buyingAs
                            ? [buyingAs.billing?.morada, buyingAs.billing?.cidade].filter(Boolean).join(', ') || '—'
                            : [profileExtra?.morada, profileExtra?.cidade].filter(Boolean).join(', ') || '—'}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                          Contacto: {buyingAs
                            ? buyingAs.billing?.telefone || '—'
                            : profileExtra?.telefone || authUser?.user_metadata?.telefone || '—'}
                        </p>
                        {buyingAs ? (
                          <p className="mt-2 text-[10px] text-amber-600 dark:text-amber-500">
                            Estes são os dados da conta {buyingAs.label}. Se estiverem incompletos, complete o perfil dessa conta antes de comprar um domínio.
                          </p>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* PROCESSING STEPS */}
              {(status === 'registering' || status === 'redirecting') && (
                <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-10 text-center space-y-4 shadow-sm">
                  <Spinner className="w-12 h-12 mx-auto" />
                  <h3 className="text-lg font-bold text-slate-800 dark:text-zinc-100 font-panel">
                    {status === 'registering' ? 'A criar a sua conta...' : 'A abrir o pagamento seguro da Stripe...'}
                  </h3>
                </div>
              )}

              {/* ERROR STATE */}
              {status === 'error' && errorMessage && (
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-lg p-5 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-bold text-red-800 dark:text-red-300 text-sm font-panel">Falha na Transação</h4>
                    <p className="text-xs text-red-700 dark:text-red-400 mt-1 leading-normal">{errorMessage}</p>
                    {(errorMessage.toLowerCase().includes('login') || errorMessage.toLowerCase().includes('já existe')) && (
                      <Link href={`/auth/login?redirect=${encodeURIComponent('/checkout')}`} className="mt-4 bg-red-600 text-white font-bold text-xs px-4 py-2 rounded-lg hover:bg-red-700 transition-colors inline-block">
                        Fazer Login
                      </Link>
                    )}
                    {errorMessage.toLowerCase().includes('a minha conta') && (
                      <button
                        type="button"
                        onClick={startEditingProfile}
                        className="mt-4 bg-red-600 text-white font-bold text-xs px-4 py-2 rounded-lg hover:bg-red-700 transition-colors inline-block"
                      >
                        Completar Dados
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* PAY FORM */}
              {(status === 'idle' || status === 'error') && (
                <div className="space-y-5">

                  {isAuthenticated === false && (
                    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-6 shadow-sm">
                      <div className="mb-6 pb-4 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center">
                        <p className="text-sm text-slate-600 dark:text-zinc-400">
                          Já tem uma conta? <Link href={`/auth/login?redirect=${encodeURIComponent('/checkout')}`} className="text-blue-600 font-bold hover:underline">Inicie sessão</Link> para concluir o processo de pagamento.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-8">
                        {/* Dados da pessoa responsável */}
                        <div className="space-y-4">
                          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-zinc-500 pb-3 border-b border-slate-100 dark:border-zinc-800">
                            Dados da Pessoa Responsável
                          </h3>
                          <div>
                            <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 mb-1.5 block">Nome</label>
                            <input type="text" value={accountForm.name} onChange={e => setAccountForm(p => ({ ...p, name: e.target.value }))} className="w-full px-4 py-2 border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-slate-800 dark:text-zinc-100 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500" />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 mb-1.5 block">Sobrenome</label>
                            <input type="text" value={accountForm.sobrenome} onChange={e => setAccountForm(p => ({ ...p, sobrenome: e.target.value }))} className="w-full px-4 py-2 border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-slate-800 dark:text-zinc-100 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500" />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 mb-1.5 block">E-mail</label>
                            <input type="email" value={accountForm.email} onChange={e => setAccountForm(p => ({ ...p, email: e.target.value }))} className="w-full px-4 py-2 border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-slate-800 dark:text-zinc-100 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500" />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 mb-1.5 block">Telefone</label>
                            <div className="flex border border-slate-200 dark:border-zinc-800 rounded-md bg-slate-50 dark:bg-zinc-950 overflow-hidden focus-within:ring-1 focus-within:ring-blue-500">
                              <div className="relative flex items-center border-r border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-900">
                                <select className="pl-3 pr-8 py-2 bg-transparent text-sm text-slate-700 dark:text-zinc-300 outline-none cursor-pointer appearance-none w-full h-full">
                                  <option value="+258">🇲🇿 +258</option>
                                  <option value="+244">🇦🇴 +244</option>
                                  <option value="+351">🇵🇹 +351</option>
                                  <option value="+55">🇧🇷 +55</option>
                                </select>
                                <svg className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                              </div>
                              <input type="tel" value={accountForm.telefone} onChange={e => setAccountForm(p => ({ ...p, telefone: e.target.value }))} className="flex-1 min-w-0 px-3 py-2 bg-transparent text-slate-800 dark:text-zinc-100 text-sm outline-none" />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between items-end mb-1.5">
                              <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 block">Palavra-passe para a conta (mín. 6 caracteres)</label>
                              <button type="button" onClick={() => { setAccountForm(p => ({ ...p, password: Math.random().toString(36).slice(-6) + Math.random().toString(36).slice(-2).toUpperCase() + '@' })); setShowPassword(true); }} className="text-[10px] font-bold text-blue-600 dark:text-blue-400 hover:underline">Gerar senha segura</button>
                            </div>
                            <div className="relative">
                              <input type={showPassword ? 'text' : 'password'} value={accountForm.password} onChange={e => setAccountForm(p => ({ ...p, password: e.target.value }))} className="w-full px-4 py-2 border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-slate-800 dark:text-zinc-100 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500 pr-10" />
                              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300">
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Dados da empresa */}
                        <div className="space-y-4 md:pl-8 md:border-l border-slate-100 dark:border-zinc-800">
                          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-400 dark:text-zinc-500 pb-3 border-b border-slate-100 dark:border-zinc-800">
                            Dados da Empresa
                          </h3>
                          <div>
                            <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 mb-1.5 block">Empresa</label>
                            <input type="text" value={accountForm.empresa} onChange={e => setAccountForm(p => ({ ...p, empresa: e.target.value }))} className="w-full px-4 py-2 border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-slate-800 dark:text-zinc-100 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500" />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 mb-1.5 block">Endereço</label>
                            <input type="text" value={accountForm.endereco} onChange={e => setAccountForm(p => ({ ...p, endereco: e.target.value }))} className="w-full px-4 py-2 border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-slate-800 dark:text-zinc-100 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500" />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 mb-1.5 block">Endereço 2</label>
                            <input type="text" value={accountForm.endereco2} onChange={e => setAccountForm(p => ({ ...p, endereco2: e.target.value }))} className="w-full px-4 py-2 border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-slate-800 dark:text-zinc-100 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500" />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 mb-1.5 block">Cidade</label>
                              <input type="text" value={accountForm.cidade} onChange={e => setAccountForm(p => ({ ...p, cidade: e.target.value }))} className="w-full px-4 py-2 border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-slate-800 dark:text-zinc-100 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500" />
                            </div>
                            <div>
                              <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 mb-1.5 block">Código Postal</label>
                              <input type="text" value={accountForm.codigoPostal} onChange={e => setAccountForm(p => ({ ...p, codigoPostal: e.target.value }))} className="w-full px-4 py-2 border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-slate-800 dark:text-zinc-100 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500" />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 mb-1.5 block">Província</label>
                              <select value={accountForm.estado} onChange={e => setAccountForm(p => ({ ...p, estado: e.target.value }))} className="w-full px-4 py-2 border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-950 text-slate-800 dark:text-zinc-100 rounded-md text-sm outline-none focus:ring-1 focus:ring-blue-500">
                                <option value="">Escolher…</option>
                                {MOZAMBIQUE_PROVINCIAS.map((p) => (
                                  <option key={p} value={p}>{p}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="text-xs font-bold text-slate-600 dark:text-zinc-400 mb-1.5 block">País</label>
                              <input type="text" value="Moçambique" disabled readOnly className="w-full px-4 py-2 border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-900 text-slate-500 dark:text-zinc-400 rounded-md text-sm outline-none cursor-not-allowed" />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-6 shadow-sm">
                    <h3 className="text-[11px] font-bold uppercase tracking-wide text-red-600 dark:text-red-400 flex items-center gap-1.5 mb-4">
                      <ShoppingCart className="w-3.5 h-3.5" />
                      Resumo da Compra
                    </h3>

                    <div className="border-t border-slate-200 dark:border-zinc-800 divide-y divide-slate-100 dark:divide-zinc-800/40">
                      {items.map((item) => (
                        <div key={item.id} className="py-3 grid grid-cols-1 sm:grid-cols-[1.4fr_1.2fr_auto] gap-2 sm:gap-4 sm:items-center">
                          <div className="flex gap-2.5 items-start min-w-0">
                            <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-100 dark:border-zinc-850 flex items-center justify-center flex-shrink-0 mt-0.5">
                              {typeIcon[item.type] || <Globe className="w-4 h-4 text-slate-400" />}
                            </div>
                            <div className="min-w-0">
                              <span className="inline-block px-1.5 py-0.2 bg-slate-100 dark:bg-zinc-800 text-[8px] font-bold text-slate-500 dark:text-zinc-400 rounded uppercase tracking-wider mb-0.5">
                                {typeLabel[item.type] || item.type}
                              </span>
                              <h4 className="font-bold text-slate-800 dark:text-zinc-100 text-sm break-all leading-tight">{item.name}</h4>
                              {item.type === 'hosting' && item.hostingDomain && (
                                <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5 break-all">{item.hostingDomain}</p>
                              )}
                            </div>
                          </div>

                          <div className="pl-[42px] sm:pl-0 min-w-0 sm:flex sm:flex-col sm:items-center sm:justify-center sm:text-center">
                            {item.type === 'domain' ? (
                              <label className="flex items-center gap-2">
                                <span className="text-xs text-slate-400">Registar por:</span>
                                <select
                                  value={item.period}
                                  onChange={(e) => {
                                    const years = Number(e.target.value);
                                    const tld = DOMAIN_TLD_PRICES.find((t) => item.name.toLowerCase().endsWith(t.value));
                                    const newPrice = tld ? domainRegistrationPriceMt(tld, years) : item.price;
                                    updateItemPeriod(item.id, years, newPrice);
                                  }}
                                  className="rounded border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2.5 py-1.5 text-xs font-bold text-slate-600 dark:text-zinc-300"
                                >
                                  {DOMAIN_REGISTRATION_YEARS.map((y) => (
                                    <option key={y} value={y}>{y} {y === 1 ? 'ano' : 'anos'}</option>
                                  ))}
                                </select>
                              </label>
                            ) : item.type === 'hosting' ? (
                              <label className="flex items-center gap-2">
                                <span className="text-xs text-slate-400">Ciclo:</span>
                                <select
                                  value={item.period}
                                  onChange={(e) => {
                                    const months = Number(e.target.value);
                                    const cycle = (Object.keys(HOSTING_CYCLE_MONTHS) as HostingBillingCycle[]).find(
                                      (c) => HOSTING_CYCLE_MONTHS[c] === months,
                                    );
                                    const plan = getHostingPlan(item.id);
                                    const newPrice = plan && cycle ? getHostingCyclePrice(plan.basePrice, cycle) : item.price;
                                    updateItemPeriod(item.id, months, newPrice);
                                  }}
                                  className="rounded border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2.5 py-1.5 text-xs font-bold text-slate-600 dark:text-zinc-300"
                                >
                                  {(Object.keys(HOSTING_CYCLE_MONTHS) as HostingBillingCycle[]).map((cycle) => (
                                    <option key={cycle} value={HOSTING_CYCLE_MONTHS[cycle]}>{HOSTING_CYCLE_LABELS[cycle]}</option>
                                  ))}
                                </select>
                              </label>
                            ) : item.type === 'email' && EMAIL_CATALOG[item.id] ? (
                              <label className="flex items-center gap-2">
                                <span className="text-xs text-slate-400">Ciclo:</span>
                                <select
                                  value={item.period}
                                  onChange={(e) => {
                                    const months = Number(e.target.value);
                                    const plan = EMAIL_CATALOG[item.id];
                                    const newPrice = months === 12 ? plan.annual : plan.monthly;
                                    updateItemPeriod(item.id, months, newPrice);
                                  }}
                                  className="rounded border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2.5 py-1.5 text-xs font-bold text-slate-600 dark:text-zinc-300"
                                >
                                  <option value={1}>Mensal</option>
                                  <option value={12}>Anual</option>
                                </select>
                              </label>
                            ) : (
                              <span className="text-xs text-slate-400">Período: {item.period} {item.period === 1 ? 'mês' : 'meses'}</span>
                            )}
                          </div>

                          <div className="pl-[42px] sm:pl-0 flex items-center justify-end gap-2 flex-shrink-0">
                            <span className="font-bold text-base text-slate-800 dark:text-zinc-100">{formatPrice(item.price)}</span>
                            <button
                              type="button"
                              onClick={() => removeItem(item.id)}
                              title="Remover item da encomenda"
                              className="w-6 h-6 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="pt-3 mt-1 border-t border-dashed border-slate-300 dark:border-zinc-700 space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="font-black text-slate-800 dark:text-zinc-100 text-sm uppercase">Total</span>
                        <div className="flex items-center justify-end gap-2">
                          <span className="font-black text-xl text-red-600 dark:text-red-400">{formatPrice(total)}</span>
                          <span className="w-6 h-6 flex-shrink-0" aria-hidden="true" />
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-400 dark:text-zinc-500 text-right pr-8">
                        Preço final — já inclui IVA (16%): base {formatPrice(total / 1.16)} + IVA {formatPrice(total - total / 1.16)}
                      </p>
                    </div>
                  </div>

                  <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-6 space-y-5 shadow-sm">
                    <div>
                      <h2 className="text-xl font-bold text-slate-800 dark:text-zinc-50 font-panel">Finalizar Pagamento</h2>
                      <p className="text-xs text-slate-400 dark:text-zinc-550 mt-1">
                        Escolha o método de pagamento ao lado e conclua a compra.
                      </p>
                    </div>

                    {metodoPagamento === 'saldo' ? (
                      <div className="p-4 rounded-lg bg-teal-50 dark:bg-teal-900/10 border border-teal-100 dark:border-teal-800/60 flex items-start gap-3">
                        <div className="p-3 rounded-md bg-teal-100 dark:bg-teal-800/30 flex-shrink-0">
                          <Wallet className="w-6 h-6 text-teal-600 dark:text-teal-300" />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-teal-800 dark:text-teal-300">
                            Saldo da Conta
                          </h4>
                          <p className="text-xs text-teal-700 dark:text-teal-400 mt-1 leading-relaxed">
                            Ao clicar em "Pagar", o valor é descontado de imediato do seu saldo (Créditos) e os produtos são activados na hora — sem esperar confirmação.
                          </p>
                        </div>
                      </div>
                    ) : metodoPagamento === 'stripe' ? (
                      <div className="p-4 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800/60 flex items-start gap-3">
                        <div className="p-3 rounded-md bg-indigo-100 dark:bg-indigo-800/40 flex-shrink-0">
                          <CreditCard className="w-6 h-6 text-indigo-600 dark:text-indigo-300" />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-indigo-800 dark:text-indigo-300">
                            Pagamento seguro por cartão (Stripe)
                          </h4>
                          <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1 leading-relaxed">
                            Ao clicar em "Pagar", será encaminhado para a página segura da Stripe para introduzir os dados do cartão. Este site nunca vê nem guarda o número do seu cartão.
                          </p>
                        </div>
                      </div>
                    ) : metodoPagamento === 'mpesa' ? (
                      <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-800/60 flex items-start gap-3">
                        <div className="p-3 rounded-md bg-red-100 dark:bg-red-800/30 flex-shrink-0">
                          <Smartphone className="w-6 h-6 text-red-600 dark:text-red-300" />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-red-800 dark:text-red-300">
                            M-Pesa
                          </h4>
                          <p className="text-xs text-red-700 dark:text-red-400 mt-1 leading-relaxed">
                            Ao clicar em "Pagar", o pedido fica registado e vai receber o número M-Pesa para concluir — depois anexa o comprovativo e a nossa equipa confirma a activação.
                          </p>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-800/60 flex items-start gap-3">
                        <div className="p-3 rounded-md bg-amber-100 dark:bg-amber-800/30 flex-shrink-0">
                          <Landmark className="w-6 h-6 text-amber-600 dark:text-amber-300" />
                        </div>
                        <div>
                          <h4 className="font-bold text-sm text-amber-800 dark:text-amber-300">
                            Transferência Bancária
                          </h4>
                          <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 leading-relaxed">
                            Ao clicar em "Pagar", o pedido fica registado e vai receber os dados de transferência para concluir — depois anexa o comprovativo e a nossa equipa confirma a activação.
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="mt-2 flex justify-start gap-3">
                      <button
                        type="button"
                        onClick={handlePay}
                        disabled={isSubmitting || (metodoPagamento === 'saldo' && (saldoDisponivel ?? 0) < total)}
                        className={`disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-md flex items-center justify-center gap-2 transition-all cursor-pointer ${
                          metodoPagamento === 'mpesa'
                            ? 'bg-red-600 hover:bg-red-700'
                            : metodoPagamento === 'saldo'
                              ? 'bg-teal-600 hover:bg-teal-700'
                              : 'bg-indigo-600 hover:bg-indigo-700'
                        }`}
                      >
                        <Lock className="w-5 h-5 animate-pulse" /> {isSubmitting ? 'A processar...' : `Pagar ${formatPrice(total)}`}
                      </button>
                      <button
                        type="button"
                        onClick={() => window.history.back()}
                        disabled={isSubmitting}
                        className="bg-transparent border border-slate-200 hover:border-slate-300 dark:border-zinc-800 dark:hover:border-zinc-700 text-slate-600 dark:text-zinc-400 font-bold py-3 px-6 rounded-md transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Right Column: Payment method */}
            <div className="lg:col-span-3 space-y-5 sticky top-28">
              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-5 space-y-4 shadow-sm">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-zinc-300">Valor Total</span>
                  <p className="text-2xl font-black text-slate-900 dark:text-zinc-50 mt-0.5">{formatPrice(total)}</p>
                </div>

                <div>
                  <label htmlFor="checkout-metodo-pagamento" className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-zinc-300 block mb-1.5">
                    Método de Pagamento
                  </label>
                  <select
                    id="checkout-metodo-pagamento"
                    value={metodoPagamento}
                    disabled={status !== 'idle' && status !== 'error'}
                    onChange={(e) => setMetodoPagamento(e.target.value as MetodoPagamento)}
                    className="w-full px-3 py-2.5 border border-slate-200 dark:border-zinc-800 rounded-md text-sm font-bold text-slate-800 dark:text-zinc-100 bg-slate-50 dark:bg-zinc-950 outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {Object.entries(METODO_META)
                      .filter(([value]) => value !== 'saldo' || saldoDisponivel !== null)
                      // Em USD só o Cartão processa o pagamento — M-Pesa/Transferência
                      // são sempre MZN (redes moçambicanas), e o Saldo é um crédito
                      // interno também em MZN.
                      .filter(([value]) => currency === 'MZN' || value === 'stripe')
                      .map(([value, meta]) => (
                        <option key={value} value={value}>{meta.label}</option>
                      ))}
                  </select>
                  {currency === 'USD' && (
                    <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1.5">
                      Em USD só é possível pagar por Cartão — M-Pesa e Transferência são sempre em MZN.
                    </p>
                  )}
                </div>

                <div className="text-sm space-y-1.5 pt-2 border-t border-dashed border-slate-200 dark:border-zinc-800">
                  {metodoPagamento === 'saldo' && (
                    <div className="space-y-1">
                      <p className="text-slate-700 dark:text-zinc-300">
                        Saldo disponível: <span className="font-mono font-bold">{formatMt(saldoDisponivel ?? 0)} MT</span>
                      </p>
                      {(saldoDisponivel ?? 0) < total && (
                        <p className="text-xs text-rose-600 dark:text-rose-400">
                          Saldo insuficiente para esta compra — carregue mais saldo no seu painel de revendedor.
                        </p>
                      )}
                    </div>
                  )}
                  {metodoPagamento === 'mpesa' && (
                    <div className="space-y-2">
                      <p className="text-slate-700 dark:text-zinc-300">Número M-Pesa: <span className="font-mono font-bold">{MPESA_NUMBER}</span></p>
                      <button
                        type="button"
                        onClick={handlePay}
                        disabled={isSubmitting || (status !== 'idle' && status !== 'error')}
                        className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3 rounded-md transition-colors cursor-pointer"
                      >
                        <Smartphone className="w-4 h-4" />
                        Pagar Agora
                        <span className="italic font-black tracking-tight">m-pesa</span>
                      </button>
                      <p className="text-[11px] text-center text-slate-400 dark:text-zinc-500">Clique aqui para Pagar com M-Pesa</p>
                    </div>
                  )}
                  {metodoPagamento === 'transferencia' && (
                    <>
                      <p className="text-slate-700 dark:text-zinc-300">Titular: <span className="font-medium">{BANK_NAME}</span></p>
                      <p className="text-slate-700 dark:text-zinc-300">Nº Conta: <span className="font-mono font-bold">{BANK_ACCOUNT}</span></p>
                      <p className="text-slate-700 dark:text-zinc-300">NIB: <span className="font-mono font-bold">{BANK_NIB}</span></p>
                    </>
                  )}
                  {metodoPagamento === 'stripe' && (
                    <p className="text-slate-500 dark:text-zinc-400 text-xs leading-relaxed">
                      Clique em "Pagar {formatPrice(total)}" à esquerda para continuar para a página segura da Stripe.
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-center gap-2 pt-1">
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 px-2 py-1 rounded">
                    <ShieldCheck className="w-3.5 h-3.5 text-green-600" /> SSL Seguro
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 px-2 py-1 rounded">
                    <BadgeCheck className="w-3.5 h-3.5 text-green-600" /> PCI Compliant
                  </span>
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg overflow-hidden shadow-sm">
                <p className="px-5 pt-4 pb-1 text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-zinc-300 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" /> Ações Rápidas
                </p>
                <button type="button" onClick={() => window.print()} className="w-full flex items-center gap-2.5 px-5 py-3 text-sm text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 hover:text-red-600 dark:hover:text-red-400 cursor-pointer border-t border-slate-100 dark:border-zinc-800">
                  <Printer className="w-4 h-4 text-slate-400" /> Imprimir Fatura
                </button>
                <button type="button" onClick={() => window.print()} className="w-full flex items-center gap-2.5 px-5 py-3 text-sm text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 hover:text-red-600 dark:hover:text-red-400 cursor-pointer border-t border-slate-100 dark:border-zinc-800">
                  <FileDown className="w-4 h-4 text-slate-400" /> Download PDF
                </button>
                <button type="button" onClick={() => router.push('/cliente')} className="w-full flex items-center gap-2.5 px-5 py-3 text-sm text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 hover:text-red-600 dark:hover:text-red-400 cursor-pointer border-t border-slate-100 dark:border-zinc-800">
                  <ArrowLeft className="w-4 h-4 text-slate-400" /> Retornar ao Painel
                </button>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-zinc-300 flex items-center gap-1.5 mb-2">
                  <Info className="w-3.5 h-3.5" /> Informações Importantes
                </p>
                <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                  Pagamentos por M-Pesa ou Transferência são, por enquanto, confirmados manualmente pela nossa equipa — o serviço é activado assim que o comprovativo for verificado.
                </p>
                <div className="border-t border-dashed border-slate-200 dark:border-zinc-800 my-3" />
                <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                  Pagamentos por Cartão (Stripe) são confirmados e activados automaticamente.
                </p>
                <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed mt-1.5">
                  Em caso de dúvidas, entre em contacto com o nosso suporte técnico.
                </p>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Passo de anexar o comprovativo, embutido no próprio checkout (sem popup) —
 * mesmo padrão de `ComprovativoInline` em `cotacao/[id]/pagamento/page.tsx`.
 * Só depois de o envio ter sucesso é que aparece o botão para entrar no
 * painel — nunca antes (confirmado com o utilizador).
 */
function ManualPaymentUploadStep({
  sessionId,
  metodoPagamento,
  onContinue,
}: {
  sessionId: string;
  metodoPagamento: 'mpesa' | 'transferencia';
  onContinue: () => Promise<void> | void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [enteringPanel, setEnteringPanel] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleSend = async () => {
    if (!file) return;
    setSending(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/checkout/${sessionId}/comprovativo`, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Não foi possível enviar o comprovativo.');
      setSent(true);
    } catch (err: any) {
      setError(err.message || 'Não foi possível enviar o comprovativo.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-8 max-w-lg mx-auto space-y-5 shadow-sm">
      {sent ? (
        <div className="text-center space-y-3">
          <CheckCircle2 className="w-14 h-14 text-green-600 mx-auto" />
          <h2 className="text-lg font-bold text-slate-800 dark:text-zinc-100 font-panel">
            Comprovativo enviado com sucesso
          </h2>
          <p className="text-sm text-slate-500 dark:text-zinc-400">
            Aguarde a aprovação da nossa equipa para aceder à gestão do(s) seu(s) produto(s).
          </p>
          <button
            type="button"
            disabled={enteringPanel}
            onClick={async () => {
              setEnteringPanel(true);
              await onContinue();
            }}
            className="mt-2 inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white font-bold py-3 px-6 rounded-md transition-colors"
          >
            {enteringPanel ? <Spinner className="w-4 h-4" /> : null}
            {enteringPanel ? 'A entrar...' : 'Aceder ao Painel'}
          </button>
        </div>
      ) : (
        <>
          <div className="text-center space-y-1">
            <h2 className="text-lg font-bold text-slate-800 dark:text-zinc-100 font-panel">
              Falta anexar o comprovativo
            </h2>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              O seu pedido foi registado — envie o comprovativo do pagamento para a nossa equipa confirmar.
            </p>
          </div>

          <div className="bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-lg p-4 text-sm text-slate-700 dark:text-zinc-300 space-y-0.5">
            {metodoPagamento === 'mpesa' ? (
              <p>Envie o valor para <span className="font-mono font-bold">{MPESA_NUMBER}</span>.</p>
            ) : (
              <>
                <p>{BANK_NAME}</p>
                <p>Nº Conta: <span className="font-mono font-bold">{BANK_ACCOUNT}</span></p>
                <p>NIB: <span className="font-mono font-bold">{BANK_NIB}</span></p>
              </>
            )}
          </div>

          <input
            type="file"
            ref={fileInputRef}
            accept="image/*,.pdf"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="hidden"
            disabled={sending}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={sending}
            className="w-full inline-flex items-center gap-2 justify-start border border-dashed border-slate-300 dark:border-zinc-700 rounded-md px-4 py-3 text-sm text-slate-600 dark:text-zinc-400 hover:border-red-400 hover:text-red-600 dark:hover:text-red-400 transition-colors truncate"
          >
            <Paperclip className="w-4 h-4 shrink-0" />
            <span className="truncate">{file ? file.name : 'Escolher ficheiro (imagem ou PDF)'}</span>
          </button>

          {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}

          <button
            type="button"
            onClick={handleSend}
            disabled={!file || sending}
            className="w-full inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3 rounded-md transition-colors"
          >
            {sending ? <Spinner className="w-4 h-4" /> : null}
            {sending ? 'A enviar...' : 'Enviar comprovativo'}
          </button>
        </>
      )}
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-zinc-950">
        <Spinner className="w-10 h-10" />
      </div>
    }>
      <CheckoutContent />
    </Suspense>
  );
}
