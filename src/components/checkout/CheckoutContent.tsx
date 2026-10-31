'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useCart } from '@/contexts/CartContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { supabase } from '@/lib/supabase-client';
import { useAuth } from '@/components/auth/AuthProvider';
import { useRouter, useSearchParams } from 'next/navigation';
import { PUBLIC_PANEL_ENTRY } from '@/lib/panel-origin';
import { marcarViaSite, pedirAbrirCompra, preCarregarDadosVhost } from '@/lib/vhost-cache';
import { destinoDepoisDoPagamento } from '@/lib/voltar-ao-painel';
import Link from 'next/link';
import { RenewalCheckout } from '@/app/checkout/RenewalCheckout';
import {
  ENCOMENDA_EDIT_PATH,
  EncomendaFaturadoPara,
  EncomendaLoginNecessario,
  EncomendaResumoCard,
  EncomendaVazia,
  dadosFacturaResponsavel,
  podeFacturarResponsavel,
  type FacturarEm,
} from '@/app/checkout/EncomendaCheckoutParts';
import {
  ENCOMENDA_CHECKOUT_PATH,
  clearEncomendaDraft,
  descartarEncomendaRegistada,
  encomendaComprovativoPath,
  encomendaDraftSignature,
  encomendaDadosEmFalta,
  encomendaRegistadaValida,
  priceEncomendaItems,
  resolveEncomendaLandingPath,
  setEncomendaRegistada,
  type MetodoEncomenda,
} from '@/lib/encomenda-checkout';
import { useEncomendaDraft } from '@/lib/use-encomenda-draft';
import { MPESA_NUMBER, BANK_NAME, BANK_ACCOUNT, BANK_NIB, SUPORTE_TELEFONES } from '@/lib/quotation-payment-info';
import { formatMt } from '@/lib/pricing-catalog';
import { DOMAIN_TLD_PRICES, domainRegistrationPriceMt } from '@/lib/domain-tld-prices';
import { getHostingPlan, getHostingCyclePrice, type HostingBillingCycle } from '@/lib/hosting-plans';
import {
  EMAIL_CYCLE_LABELS,
  EMAIL_CYCLE_MONTHS,
  emailCycleForMonths,
  getEmailCyclePrice,
  getEmailPlan,
  type EmailBillingCycle,
} from '@/lib/email-plans';
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
import { referenciaPedido } from '@/lib/checkout-referencia';
import { nomeContaValido, NOME_CONTA_ERRO } from '@/lib/conta-hospedagem';
import { mensagemEmailInvalido } from '@/lib/email-valido';
import { profileAuthOrFilter } from '@/lib/profile-db';
import { acrescentarIva, IVA_TAXA } from '@/lib/iva';
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
  Briefcase,
  ShieldCheck,
  Zap,
  ArrowLeft,
  Info,
  Building2,
  Wallet,
  CheckCircle2,
  Paperclip,
  Trash2,
  User,
  Phone,
  MapPin,
  Map as MapaIcone,
  KeyRound,
  Wand2
} from 'lucide-react';
import { Spinner } from '@/components/ui/spinner';

type MetodoPagamento = 'stripe' | 'mpesa' | 'transferencia' | 'saldo';

// Campos do checkout: sem etiquetas, a dica fica dentro do campo e o ícone (a cores) numa caixa à esquerda, como nos outros
// formulários do site.
const campoCls =
  'h-10 w-full min-w-0 flex-1 bg-transparent px-3 text-sm text-slate-800 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 outline-none disabled:cursor-default disabled:bg-slate-50 dark:disabled:bg-zinc-900 disabled:text-slate-600';
const campoVazioCls = campoCls.replace('text-slate-800 dark:text-zinc-100', 'text-slate-400 dark:text-zinc-500');
const caixaCampoCls =
  'flex items-stretch overflow-hidden rounded border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-950 transition-colors focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-500/20';
const corIcone = (Icone: unknown) =>
  (new Map<unknown, string>([
    [User, 'text-violet-600'],
    [Phone, 'text-green-600'],
    [Building2, 'text-blue-500'],
    [Mail, 'text-sky-500'],
    [Briefcase, 'text-indigo-500'],
    [KeyRound, 'text-amber-500'],
    [MapPin, 'text-red-500'],
    [Landmark, 'text-red-500'],
    [MapaIcone, 'text-teal-500'],
  ]).get(Icone) || 'text-slate-400');
function IconeCaixa({ icone: Icone }: { icone: React.ComponentType<{ className?: string }> }) {
  return (
    <span className="flex w-10 shrink-0 items-center justify-center border-r border-zinc-300 bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900">
      <Icone className={`h-4 w-4 ${corIcone(Icone)}`} />
    </span>
  );
}
/** NUIT de moçambicano: 9 dígitos (obrigatório para a factura; Silva, 31/10/2026). */
const nuitValido = (v: string) => /^\d{9}$/.test(v.replace(/\s/g, ''));
/** O primeiro campo com problema e o que há a corrigir nele (Silva, 31/10/2026: a mensagem só aparece por uma falha concreta num campo). */
function erroDosDados(f: { telefone: string; endereco: string; estado: string; nuit: string }): { campo: string; mensagem: string } | null {
  if (!f.telefone.trim()) return { campo: 'Telefone', mensagem: 'Indique o telefone.' };
  if (!f.endereco.trim()) return { campo: 'Morada', mensagem: 'Indique a morada.' };
  if (!f.estado) return { campo: 'Província', mensagem: 'Escolha a província.' };
  if (!nuitValido(f.nuit)) return { campo: 'NUIT da empresa', mensagem: f.nuit.trim() ? 'O NUIT da empresa deve ter 9 dígitos.' : 'Indique o NUIT da empresa (9 dígitos).' };
  return null;
}
function LinhaDado({ icone: Icone, valor }: { icone: React.ComponentType<{ className?: string }>; valor: string }) {
  return (
    <p className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-zinc-300 break-all">
      <Icone className={`h-4 w-4 shrink-0 ${corIcone(Icone)}`} />
      {valor ? valor : <span className="text-rose-600">Em falta</span>}
    </p>
  );
}
function CampoIcone({ icone, children, erro }: { icone: React.ComponentType<{ className?: string }>; children: React.ReactNode; erro?: boolean }) {
  return (
    <div className={`relative ${caixaCampoCls}${erro ? ' !border-red-500 ring-2 ring-red-500/20' : ''}`}>
      <IconeCaixa icone={icone} />
      {children}
    </div>
  );
}

/** Telefone com o indicativo escolhido; se a pessoa já escreveu o indicativo (+258… ou 00258…), fica como escreveu. */
function telefoneCompleto(escrito: string, prefixo: string): string {
  const t = escrito.trim();
  if (!t) return t;
  if (/^(\+|00)/.test(t)) return t;
  const digitos = t.replace(/\D/g, '');
  const prefixoDigitos = prefixo.replace(/\D/g, '');
  if (digitos.startsWith(prefixoDigitos) && digitos.length >= prefixoDigitos.length + 8) return `+${digitos}`;
  return `${prefixo} ${digitos}`;
}

const METODO_META: Record<MetodoPagamento, { label: string; icon: typeof Smartphone }> = {
  transferencia: { label: 'Transferência Bancária', icon: Landmark },
  mpesa: { label: 'M-Pesa', icon: Smartphone },
  stripe: { label: 'Cartão', icon: CreditCard },
  saldo: { label: 'Saldo da Conta', icon: Wallet },
};

/** Painel de destino depois de uma compra — segue o papel que a compra deu
 * (promoteBuyerAfterPurchase): com site /profissional, só domínio/email /cliente. */
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

/** `painel`: o checkout das encomendas aberto dentro do painel VisualHost (Gestão › Encomendas › Finalizar), sem sair do sítio (Silva, 23/10/2026).
 *  `voltar` leva à página das encomendas (depois de submeter/cancelar); `editar` volta à nova encomenda para mudar os serviços. */
export type CheckoutPainel = { voltar: () => void; editar: () => void };

export function CheckoutContent({ painel }: { painel?: CheckoutPainel } = {}) {
  const { items, total, clearCart, updateItemPeriod, removeItem, updateItemContaUtilizador, ready: carrinhoLido } = useCart();
  const router = useRouter();
  const { user: authUser, loading: authLoading } = useAuth();
  const isAuthenticated = authLoading ? null : !!authUser;
  const searchParams = useSearchParams();
  const renewalId = searchParams.get('renewalId');
  const { currency, formatPrice } = useCurrency();

  // Encomenda VisualDesign vinda de /cotacao ("Pagar factura") — o mesmo
  // checkout, mas o que se paga é a encomenda guardada no rascunho local (ver
  // src/lib/encomenda-checkout.ts), não o carrinho de domínios/hospedagem.
  const isEncomenda = Boolean(painel) || searchParams.get('encomenda') === '1';
  // Sempre actualizado (o rascunho só é apagado depois do comprovativo ou de
  // um cancelamento) — voltar atrás no browser nunca perde a encomenda.
  const encomendaDraft = useEncomendaDraft();
  const [encomendaDraftLoaded, setEncomendaDraftLoaded] = useState(false);
  useEffect(() => {
    setEncomendaDraftLoaded(true);
  }, []);
  const encomendaPricing = useMemo(
    () => (encomendaDraft ? priceEncomendaItems(encomendaDraft.itens) : null),
    [encomendaDraft],
  );
  // Só Sob Consulta: não há adiantamento — o checkout só confirma o pedido.
  const encomendaTemValor = (encomendaPricing?.adiantamentoMt ?? 0) > 0;
  // Em nome de quem sai a factura — por omissão a empresa.
  const [facturarEm, setFacturarEm] = useState<FacturarEm>('empresa');
  // Encomenda já gravada, à espera do comprovativo. Vem do URL (passo
  // próprio no histórico do browser): "voltar" regressa ao resumo para rever
  // ou editar, "avançar"/o balão do carrinho regressa aqui.
  // No painel não há URL de checkout: o passo do comprovativo guarda-se em estado
  const [pendentePainel, setPendentePainel] = useState<{ id: string; metodo: string } | null>(null);
  const pendingQuotationIdParam = painel ? pendentePainel?.id ?? null : searchParams.get('pendingQuotationId');
  const pendingMetodoParam = painel ? pendentePainel?.metodo ?? null : searchParams.get('metodo');
  /** Passos do checkout das encomendas: no site mudam o endereço; no painel mudam o estado */
  const irEncomenda = (path: string) => {
    if (!painel) return router.push(path);
    const m = path.match(/pendingQuotationId=([^&]+)&metodo=(\w+)/);
    setPendentePainel(m ? { id: decodeURIComponent(m[1]), metodo: m[2] } : null);
  };
  const encomendaPending =
    isEncomenda && pendingQuotationIdParam && (pendingMetodoParam === 'mpesa' || pendingMetodoParam === 'transferencia')
      ? {
          quotationId: pendingQuotationIdParam,
          metodoPagamento: pendingMetodoParam as MetodoEncomenda,
          valorMt: encomendaDraft?.registada?.quotationId === pendingQuotationIdParam ? encomendaDraft.registada.valorMt : undefined,
        }
      : null;
  // A encomenda gravada ainda corresponde ao que está no rascunho (não foi
  // editada depois) — o resumo mostra o atalho para o comprovativo.
  const encomendaRegistada = encomendaRegistadaValida(encomendaDraft);
  // Dados em falta da entidade: o painel deixa ir direito aos serviços, mas aqui não se paga nem se submete sem os completar
  const dadosEmFalta = isEncomenda && encomendaDraft ? encomendaDadosEmFalta(encomendaDraft) : [];
  // "Editar dados"/"Cancelar encomenda" em curso (ver editarEncomenda mais
  // abaixo). Tem de ficar aqui, antes dos returns antecipados ("A validar
  // sessão", renovações) — senão o número de hooks muda entre renders.
  const [encomendaAccao, setEncomendaAccao] = useState<'editar' | 'cancelar' | null>(null);
  // Ao voltar ao resumo, o método e a factura escolhidos ficam como estavam.
  const registadaPreenchidaRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (!encomendaRegistada || registadaPreenchidaRef.current === encomendaRegistada.quotationId) return;
    registadaPreenchidaRef.current = encomendaRegistada.quotationId;
    setMetodoPagamento(encomendaRegistada.metodo);
    setFacturarEm(encomendaRegistada.facturarEm);
  }, [encomendaRegistada]);

  // Hospedagem sem domínio associado não deve chegar a esta página — manda
  // sempre primeiro para /checkout/dominio (rede de segurança para quem
  // chega aqui directamente, ex. voltar atrás no browser).
  useEffect(() => {
    if (renewalId || isEncomenda) return;
    const entry = checkoutEntryPath(items);
    if (entry !== '/checkout') router.replace(entry);
  }, [items, renewalId, isEncomenda, router]);

  // Renovação sem sessão: vai ao login e volta (num efeito, nunca durante o desenho)
  useEffect(() => {
    if (renewalId && isAuthenticated === false) router.push(`/login?redirect=${encodeURIComponent(`/checkout?renewalId=${renewalId}`)}`);
  }, [renewalId, isAuthenticated, router]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  // Quem ainda não tem conta continua a ver o formulário completo enquanto se cria a conta e se segue para o passo seguinte
  // (a página não muda de aspecto a meio do processamento).
  const [comoVisitante, setComoVisitante] = useState(false);
  // Quem tem conta vê os seus dados escritos; «Editar» abre os campos.
  const [editando, setEditando] = useState(false);
  // Campo que falhou ao pagar/guardar: fica a vermelho até estar certo (a validade lê-se ao vivo, por isso sai sozinho).
  const [campoComErro, setCampoComErro] = useState<string | null>(null);
  const campoEmErro = (campo: string) => campoComErro === campo && erroDosDados(accountForm)?.campo === campo;
  const avisarCampo = (e: { campo: string; mensagem: string }) => {
    setCampoComErro(e.campo);
    setErrorMessage(e.mensagem);
    setStatus('error');
    setTimeout(() => (document.querySelector(`[aria-label="${e.campo}"]`) as HTMLElement | null)?.focus(), 80);
  };
  const [savingDados, setSavingDados] = useState(false);
  const copiaAntesDeEditar = React.useRef<{ form: Record<string, string>; prefixo: string } | null>(null);
  useEffect(() => {
    if (!isSubmitting) setComoVisitante(false);
  }, [isSubmitting]);
  const [metodoPagamento, setMetodoPagamento] = useState<MetodoPagamento>('transferencia');

  // Pedido de M-Pesa/Transferência já criado, à espera do comprovativo —
  // enquanto isto não for null, o checkout mostra o passo de upload em vez
  // do carrinho (mesmo já vazio) ou do formulário de pagamento.
  const [manualSession, setManualSession] = useState<{ id: string; metodoPagamento: 'mpesa' | 'transferencia'; totalMt?: number; comprovativoEnviado?: boolean; motivo?: string | null } | null>(null);
  // Pedido M-Pesa recém-criado que ainda tem de passar pelo passo do número (ver MpesaTesteStep).
  const [mpesaPassoId, setMpesaPassoId] = useState<string | null>(null);
  const [mpesaAvisoTeste, setMpesaAvisoTeste] = useState(false);
  const [mpesaPassoValor, setMpesaPassoValor] = useState<number | undefined>(undefined);
  const restoredPendingIdRef = React.useRef<string | null>(null);
  // Pedido de quem ainda não tem conta (M-Pesa/Transferência): a chave com que este navegador lê o pedido e envia o comprovativo.
  const CHAVE_PEDIDO_SEM_CONTA = 'vd_pedido_sem_conta';
  const [tokenPedido, setTokenPedido] = useState<string | null>(null);
  const lerPedidoSemConta = (): { id: string; token: string } | null => {
    try {
      const v = JSON.parse(sessionStorage.getItem(CHAVE_PEDIDO_SEM_CONTA) || 'null');
      return v && v.id && v.token ? v : null;
    } catch {
      return null;
    }
  };

  // Recupera este passo depois de um recarregamento a meio (ex: refresh
  // acidental) — sem isto a página cairia no ecrã genérico de "carrinho
  // vazio" (o carrinho já foi limpo ao criar o pedido pendente).
  useEffect(() => {
    const pendingId = searchParams.get('pendingId');
    if (!pendingId || isAuthenticated === null || restoredPendingIdRef.current === pendingId) return;
    const semConta = isAuthenticated === false ? lerPedidoSemConta() : null;
    if (isAuthenticated === false && semConta?.id !== pendingId) return;
    restoredPendingIdRef.current = pendingId;
    if (semConta) setTokenPedido(semConta.token);
    fetch(`/api/checkout/session-status?session_id=${encodeURIComponent(pendingId)}${semConta ? `&token=${encodeURIComponent(semConta.token)}` : ''}`)
      .then((r) => r.json())
      .then((data) => {
        const s = data?.session;
        if (data.success && s?.status === 'pending' && (s.metodo_pagamento === 'mpesa' || s.metodo_pagamento === 'transferencia')) {
          setManualSession({
            id: s.id,
            metodoPagamento: s.metodo_pagamento,
            totalMt: Number(s.total_mt) || undefined,
            comprovativoEnviado: Boolean(s.comprovativo_url),
            motivo: s.rejection_reason ?? null,
          });
        } else {
          router.replace('/checkout');
        }
      })
      .catch(() => router.replace('/checkout'));
  }, [searchParams, isAuthenticated, router]);

  // Voltar atrás (botão do navegador) do passo do comprovativo para o checkout: mostra o carrinho outra vez, em vez de ficar preso
  // no passo. Só reage a uma mudança do endereço (de «com pedido» para «sem pedido»), nunca ao criar o pedido.
  const pedidoAnterior = React.useRef<string | null>(null);
  useEffect(() => {
    const atual = searchParams.get('pendingId');
    if (pedidoAnterior.current && !atual) {
      setManualSession(null);
      setMpesaPassoId(null);
      restoredPendingIdRef.current = null;
    }
    pedidoAnterior.current = atual;
  }, [searchParams]);

  // Pagamento por cartão concluído (o serviço de pagamento devolve aqui): só agora o carrinho esvazia e segue-se para o painel.
  useEffect(() => {
    // só depois de o carrinho guardado ser lido (senão a leitura repunha os itens por cima)
    if (searchParams.get('pago') !== '1' || !carrinhoLido) return;
    clearCart();
    limparFormulario();
    router.replace(PUBLIC_PANEL_ENTRY);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, carrinhoLido]);

  // M-Pesa/Transferência/Saldo não processam USD — se o cliente troca a
  // moeda no topo do site enquanto está no checkout, o método tem de
  // acompanhar para nunca ficar um valor em USD "por pagar" com M-Pesa.
  useEffect(() => {
    // Encomendas pagam-se sempre em MT por M-Pesa/Transferência (é o que a
    // Contabilidade › Encomendas confirma) — nem Cartão nem Saldo.
    if (isEncomenda) {
      if (metodoPagamento === 'stripe' || metodoPagamento === 'saldo') setMetodoPagamento('transferencia');
      return;
    }
    if (currency === 'USD' && metodoPagamento !== 'stripe') setMetodoPagamento('stripe');
  }, [currency, metodoPagamento, isEncomenda]);

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
    emailEmpresa: '',
    cargo: '',
    nuit: '',
    cidade: '',
    estado: '',
    pais: 'Mozambique'
  });
  const [telefonePrefixo, setTelefonePrefixo] = useState('+258');
  // O que a pessoa escreveu no formulário guarda-se (nunca a palavra-passe) para voltar atrás e encontrá-lo como o deixou;
  const CHAVE_FORMULARIO = 'vd_checkout_form';
  const [rascunhoLido, setRascunhoLido] = useState(false);
  useEffect(() => {
    try {
      const guardado = sessionStorage.getItem(CHAVE_FORMULARIO);
      if (guardado) {
        const { prefixo, ...campos } = JSON.parse(guardado) as Record<string, string>;
        setAccountForm((f) => ({ ...f, ...campos, password: '' }));
        if (prefixo) setTelefonePrefixo(prefixo);
      }
    } catch {
      /* sem armazenamento: o formulário começa vazio */
    }
    setRascunhoLido(true);
  }, []);
  useEffect(() => {
    if (!rascunhoLido) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _senha, ...semSenha } = accountForm;
      sessionStorage.setItem(CHAVE_FORMULARIO, JSON.stringify({ ...semSenha, prefixo: telefonePrefixo }));
    } catch {
      /* sem armazenamento */
    }
  }, [accountForm, telefonePrefixo, rascunhoLido]);
  const limparFormulario = () => {
    try {
      sessionStorage.removeItem(CHAVE_FORMULARIO);
    } catch {
      /* sem armazenamento */
    }
  };
  const [showPassword, setShowPassword] = useState(false);

  // Morada/telefone do perfil (WHOIS) — para o card "Faturado Para" de quem já
  // tem conta; não vem no user_metadata, só na tabela profiles.
  const [profileExtra, setProfileExtra] = useState<{ telefone?: string | null; morada?: string | null; cidade?: string | null; nuit?: string | null } | null>(null);
  useEffect(() => {
    if (!authUser) return;
    supabase
      .from('profiles')
      .select('telefone, morada, cidade, nuit')
      .or(profileAuthOrFilter(authUser.id))
      .maybeSingle()
      .then(async ({ data }: { data: { telefone?: string | null; morada?: string | null; cidade?: string | null; nuit?: string | null } | null }) => {
        // o que a tabela de perfis não tem, vem dos restantes dados pessoais da conta (telefone e endereço)
        let extra = data;
        if (!data?.telefone || !data?.morada) {
          try {
            const r = await fetch('/api/encomendas/perfil');
            const pf = r.ok ? await r.json() : null;
            if (pf) extra = { telefone: data?.telefone || pf.telefone || null, morada: data?.morada || pf.endereco || null, cidade: data?.cidade || null, nuit: data?.nuit || null };
          } catch {
            /* fica o que a tabela de perfis tem */
          }
        }
        setProfileExtra(extra);
      })
      .catch(() => undefined);
  }, [authUser]);

  // Os dados que o sistema já tem desta conta (perfil + dados do registo): nada se volta a pedir ao que já existe.
  const metaConta = (authUser?.user_metadata || {}) as Record<string, unknown>;
  const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const dadosConta = {
    telefone: texto(profileExtra?.telefone) || texto(metaConta.telefone),
    morada: texto(profileExtra?.morada) || texto(metaConta.endereco),
    cidade: texto(profileExtra?.cidade) || texto(metaConta.cidade),
    nuit: texto(profileExtra?.nuit),
    provincia: texto(metaConta.provincia),
  };

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

  // O formulário abre com os dados da conta (nome, e-mail, telefone, morada, província) em vez de campos vazios; o que a pessoa
  // já escreveu (rascunho) não é substituído.
  useEffect(() => {
    if (!authUser || !rascunhoLido) return;
    const fonte = buyingAs
      ? { nome: buyingAs.billing?.nome || '', email: buyingAs.email || '', telefone: buyingAs.billing?.telefone || '', morada: buyingAs.billing?.morada || '', provincia: '' }
      : { nome: texto(metaConta.nome) || texto(metaConta.full_name), email: authUser.email || '', telefone: dadosConta.telefone, morada: dadosConta.morada, provincia: dadosConta.provincia };
    const prefixo = ['+258', '+244', '+351', '+55'].find((x) => fonte.telefone.replace(/\s/g, '').startsWith(x));
    const numero = prefixo ? fonte.telefone.replace(/\s/g, '').slice(prefixo.length) : fonte.telefone.replace(/^\+\d+\s*/, '');
    const [primeiro, ...resto] = fonte.nome.split(/\s+/).filter(Boolean);
    setAccountForm((f) => ({
      ...f,
      name: f.name || primeiro || '',
      sobrenome: f.sobrenome || resto.join(' '),
      email: f.email || fonte.email,
      telefone: f.telefone || numero,
      endereco: f.endereco || fonte.morada,
      emailEmpresa: f.emailEmpresa || (buyingAs ? '' : texto(metaConta.email_empresa)),
      cargo: f.cargo || (buyingAs ? '' : texto(metaConta.cargo)),
      nuit: f.nuit || (buyingAs ? '' : dadosConta.nuit),
      estado: f.estado || (MOZAMBIQUE_PROVINCIAS.includes(fonte.provincia) ? fonte.provincia : ''),
    }));
    if (prefixo && !accountForm.telefone) setTelefonePrefixo(prefixo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser, rascunhoLido, profileExtra, buyingAs]);

  // Grava telefone, morada, cidade e província da conta (a cidade segue igual à província quando não há outra).
  const gravarPerfil = async (v: { telefone: string; morada: string; cidade: string; provincia: string; emailEmpresa?: string; cargo?: string; nuit?: string }) => {
    if (!authUser) return;
    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .or(profileAuthOrFilter(authUser.id))
      .maybeSingle();
    const payload = {
      user_id: authUser.id,
      telefone: v.telefone || null,
      morada: v.morada || null,
      cidade: v.cidade || dadosConta.cidade || v.provincia || null,
      nuit: v.nuit ? v.nuit.replace(/\s/g, '') : null,
      updated_at: new Date().toISOString(),
    };
    const { error } = existing?.id
      ? await supabase.from('profiles').update(payload).eq('id', existing.id)
      : await supabase.from('profiles').insert(payload);
    if (error) throw error;
    // a província não tem coluna no perfil: guarda-se nos dados da conta (onde o registo já a põe)
    const novoEmailEmpresa = (v.emailEmpresa ?? texto(metaConta.email_empresa)).trim();
    const novoCargo = (v.cargo ?? texto(metaConta.cargo)).trim();
    if (v.provincia !== dadosConta.provincia || novoEmailEmpresa !== texto(metaConta.email_empresa) || novoCargo !== texto(metaConta.cargo)) {
      await supabase.auth.updateUser({ data: { provincia: v.provincia, email_empresa: novoEmailEmpresa, cargo: novoCargo } });
    }
    setProfileExtra({ telefone: payload.telefone, morada: payload.morada, cidade: payload.cidade, nuit: payload.nuit });
  };
  // Quem tem conta pode mudar a palavra-passe ao editar os dados (campo opcional: vazio = não muda).
  const mudarSenha = async () => {
    const nova = accountForm.password;
    if (!nova) return;
    if (nova.length < 6 || nova.length > 20) throw new Error('A palavra-passe deve ter entre 6 e 20 caracteres.');
    const { error } = await supabase.auth.updateUser({ password: nova });
    if (error) throw new Error(error.message);
    setAccountForm((f) => ({ ...f, password: '' }));
    setShowPassword(false);
  };

  // Cada hospedagem tem a sua conta no servidor (o seu domínio e o seu nome de utilizador), mesmo para quem já tem outra conta.
  // O campo começa vazio: quem compra escolhe o nome; vê já se está livre.
  const [contaLivre, setContaLivre] = useState<Record<string, { livre: boolean; msg: string } | 'a-verificar'>>({});
  const nomesContaChave = items.filter((i) => i.type === 'hosting').map((i) => `${i.id}:${i.contaUtilizador || ''}`).join('|');
  useEffect(() => {
    if (isAuthenticated !== true) return;
    let activo = true;
    const timer = setTimeout(() => {
      for (const item of items) {
        const nome = (item.contaUtilizador || '').trim();
        if (item.type !== 'hosting' || !nome) continue;
        if (!nomeContaValido(nome)) {
          setContaLivre((c) => ({ ...c, [item.id]: { livre: false, msg: NOME_CONTA_ERRO } }));
          continue;
        }
        setContaLivre((c) => ({ ...c, [item.id]: 'a-verificar' }));
        fetch(`/api/checkout/utilizador-disponivel?u=${encodeURIComponent(nome)}`)
          .then((r) => r.json())
          .then((d) => {
            if (activo) setContaLivre((c) => ({ ...c, [item.id]: { livre: Boolean(d?.valido && d?.livre), msg: d?.error || '' } }));
          })
          .catch(() => {
            if (activo) setContaLivre((c) => ({ ...c, [item.id]: { livre: true, msg: '' } }));
          });
      }
    }, 500);
    return () => {
      activo = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nomesContaChave, isAuthenticated]);
  const contaHospedagemInvalida = items.some(
    (i) => i.type === 'hosting' && (!nomeContaValido((i.contaUtilizador || '').trim()) || (typeof contaLivre[i.id] === 'object' && !(contaLivre[i.id] as { livre: boolean }).livre)),
  );

  // Flow State
  const [status, setStatus] = useState<'idle' | 'registering' | 'redirecting' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  // O aviso de erro fica no topo da página: ao aparecer, a página sobe até ele (quem clicou em «Pagar» lá em baixo via «nada acontecer»).
  const caixaErroRef = React.useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (status === 'error' && errorMessage) caixaErroRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [status, errorMessage]);

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return; // Evita duplo-clique / duplo pagamento
    if (dadosEmFalta.length > 0) {
      setErrorMessage(`Complete os dados em falta para continuar: ${dadosEmFalta.join(', ')}.`);
      setStatus('error');
      return;
    }
    // Encomendas: a conta cria-se no formulário /cotacao — aqui só se paga.
    if (isEncomenda && isAuthenticated === false) {
      setErrorMessage('Inicie sessão na conta criada no pedido para pagar a encomenda.');
      setStatus('error');
      return;
    }
    const faltamDados = !isEncomenda && isAuthenticated === true && !buyingAs && (!accountForm.telefone.trim() || !accountForm.endereco.trim() || !accountForm.estado || !nuitValido(accountForm.nuit));
    if (!isEncomenda && (contaHospedagemInvalida || faltamDados)) {
      // quem tem conta vê os dados em texto: abre os campos para corrigir o que falta
      if (isAuthenticated === true && !comoVisitante && !editando) {
        copiaAntesDeEditar.current = { form: { ...accountForm }, prefixo: telefonePrefixo };
        setEditando(true);
      }
      const erro = contaHospedagemInvalida ? null : erroDosDados(accountForm);
      if (erro) avisarCampo(erro);
      else {
        setErrorMessage('Confira o nome da empresa (utilizador): tem de ser válido e estar livre.');
        setStatus('error');
      }
      return;
    }
    if (isAuthenticated === false && !isEncomenda) setComoVisitante(true);
    // Quem compra uma hospedagem (o administrador, por exemplo) abre depois o painel da conta comprada, e não o seu principal:
    // o painel lê esta marca e, assim que a conta existir no servidor, passa para ela (sem deixar de ser administrador).
    if (!isEncomenda) pedirAbrirCompra(items.filter((i) => i.type === 'hosting').map((i) => i.contaUtilizador || '').filter(Boolean));
    setIsSubmitting(true);
    setErrorMessage('');

    if (isAuthenticated === true && !buyingAs && !isEncomenda) {
      const erroDados = erroDosDados(accountForm);
      if (erroDados) {
        avisarCampo(erroDados);
        setIsSubmitting(false);
        return;
      }
      const erroEmailEmpresa = accountForm.emailEmpresa.trim() ? mensagemEmailInvalido(accountForm.emailEmpresa, 'O e-mail da empresa') : null;
      if (erroEmailEmpresa) {
        setErrorMessage(erroEmailEmpresa);
        setStatus('error');
        setIsSubmitting(false);
        return;
      }
      try {
        await gravarPerfil({
          telefone: telefoneCompleto(accountForm.telefone, telefonePrefixo),
          morada: accountForm.endereco.trim(),
          cidade: accountForm.estado,
          provincia: accountForm.estado,
          emailEmpresa: accountForm.emailEmpresa,
          cargo: accountForm.cargo,
          nuit: accountForm.nuit,
        });
        await mudarSenha();
      } catch (err: unknown) {
        setErrorMessage(err instanceof Error ? err.message : 'Não foi possível guardar os dados da conta.');
        setStatus('error');
        setIsSubmitting(false);
        return;
      }
    }

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
      const erroEmail = mensagemEmailInvalido(accountForm.email, 'O e-mail da pessoa responsável');
      const erroEmailEmpresa = accountForm.emailEmpresa.trim() ? mensagemEmailInvalido(accountForm.emailEmpresa, 'O e-mail da empresa') : null;
      if (erroEmail || erroEmailEmpresa) {
        setErrorMessage(erroEmail || erroEmailEmpresa || '');
        setStatus('error');
        setIsSubmitting(false);
        return;
      }
      const erroDadosVisitante = erroDosDados(accountForm);
      if (erroDadosVisitante) {
        avisarCampo(erroDadosVisitante);
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
      // M-Pesa/Transferência de quem ainda não tem conta: agora não se cria nada (nem login, nem conta no servidor, nem
      // hospedagem). O pedido guarda os dados digitados e tudo nasce quando a equipa confirma o comprovativo.
      if (isAuthenticated === false && !isEncomenda && (metodoPagamento === 'mpesa' || metodoPagamento === 'transferencia')) {
        const anterior = lerPedidoSemConta();
        const res = await fetch('/api/checkout/pedido-sem-conta', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items,
            metodoPagamento,
            senha: accountForm.password,
            anterior,
            dados: {
              nome: accountForm.name,
              apelido: accountForm.sobrenome,
              email: accountForm.email,
              telefone: telefoneCompleto(accountForm.telefone, telefonePrefixo),
              morada: accountForm.endereco,
              provincia: accountForm.estado,
              emailEmpresa: accountForm.emailEmpresa,
              cargo: accountForm.cargo,
              nuit: accountForm.nuit.replace(/\s/g, ''),
              empresa: items.find((i) => i.type === 'hosting')?.contaUtilizador || accountForm.empresa,
            },
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) throw new Error(data.error || 'Não foi possível registar o pedido de pagamento.');
        try {
          sessionStorage.setItem(CHAVE_PEDIDO_SEM_CONTA, JSON.stringify({ id: data.session.id, token: data.token }));
        } catch {
          /* sem armazenamento: o passo seguinte continua nesta página */
        }
        setTokenPedido(data.token);
        const metodo = metodoPagamento === 'mpesa' ? 'mpesa' : 'transferencia';
        setManualSession({ id: data.session.id, metodoPagamento: metodo, totalMt: Number(data.session.total_mt) || undefined });
        if (metodo === 'mpesa') {
          setMpesaPassoValor(Number(data.session.total_mt) || undefined);
          setMpesaPassoId(data.session.id);
        }
        restoredPendingIdRef.current = data.session.id;
        router.push(`/checkout?pendingId=${data.session.id}`);
        setStatus('idle');
        setIsSubmitting(false);
        return;
      }

      if (isAuthenticated === false) {
        setStatus('registering');
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: accountForm.email,
            password: accountForm.password,
            nome: `${accountForm.name} ${accountForm.sobrenome}`.trim(),
            telefone: telefoneCompleto(accountForm.telefone, telefonePrefixo),
            empresa: items.find((i) => i.type === 'hosting')?.contaUtilizador || accountForm.empresa,
            endereco: accountForm.endereco.trim(),
            cidade: accountForm.estado,
            provincia: accountForm.estado,
            emailEmpresa: accountForm.emailEmpresa,
            cargo: accountForm.cargo,
            nuit: accountForm.nuit.replace(/\s/g, ''),
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
               throw new Error(`Já existe uma conta com o e-mail ${accountForm.email.trim().toLowerCase()} (e-mail da pessoa responsável). Escreva a palavra-passe dessa conta ou use «Entrar».`);
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

      if (isEncomenda) {
        if (!encomendaDraft) {
          throw new Error('Não encontrámos a encomenda a pagar — volte a escolher os serviços.');
        }
        // A encomenda só é gravada agora, já com o método escolhido (fica
        // logo "Pagamento em confirmação"), e o comprovativo é pedido a seguir
        // no mesmo passo de upload das compras de domínio/hospedagem — mas vai
        // para os anexos da encomenda, que a Contabilidade › Encomendas lê.
        const metodoEncomenda: MetodoEncomenda = metodoPagamento === 'mpesa' ? 'mpesa' : 'transferencia';
        const facturaResponsavel = facturarEm === 'responsavel' && podeFacturarResponsavel(encomendaDraft);
        const facturarEscolhido: FacturarEm = facturaResponsavel ? 'responsavel' : 'empresa';

        // Voltou atrás sem mudar nada — a encomenda já está gravada, segue
        // para o comprovativo dela em vez de gravar outra.
        if (
          encomendaTemValor &&
          encomendaRegistada &&
          encomendaRegistada.metodo === metodoEncomenda &&
          encomendaRegistada.facturarEm === facturarEscolhido
        ) {
          irEncomenda(encomendaComprovativoPath(encomendaRegistada));
          setIsSubmitting(false);
          return;
        }

        setStatus('redirecting');
        // Mudou o método ou em nome de quem sai a factura — a encomenda
        // gravada antes (ainda sem comprovativo) sai, para não ficar duplicada.
        if (encomendaDraft.registada) {
          const descartada = await descartarEncomendaRegistada(encomendaDraft.registada.quotationId);
          if (!descartada.ok) throw new Error(descartada.error);
          setEncomendaRegistada(null);
        }

        const { savedAt: _savedAt, tipoCliente: _tipoCliente, contaDados: _contaDados, registada: _registada, ...dadosEncomenda } = encomendaDraft;
        const res = await fetch('/api/cotacoes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...dadosEncomenda,
            ...(facturaResponsavel ? dadosFacturaResponsavel(encomendaDraft) : {}),
            metodoPagamento: encomendaTemValor ? metodoEncomenda : undefined,
          }),
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Não foi possível submeter a encomenda.');
        }

        if (!data.metodoPagamento) {
          // Só Sob Consulta — nada a pagar ainda: o pedido fica feito, segue
          // directo para o painel.
          clearEncomendaDraft();
          if (painel) painel.voltar(); else router.push(await resolveEncomendaLandingPath());
          return;
        }
        // O rascunho fica (marcado como gravado) até o comprovativo seguir —
        // é o que deixa voltar atrás, e o que o balão do carrinho mostra.
        const registada = {
          quotationId: data.id as string,
          metodo: metodoEncomenda,
          facturarEm: facturarEscolhido,
          valorMt: encomendaPricing?.adiantamentoMt ?? 0,
          assinatura: encomendaDraftSignature(encomendaDraft),
        };
        setEncomendaRegistada(registada);
        irEncomenda(encomendaComprovativoPath(registada));
        setStatus('idle');
        setIsSubmitting(false);
        return;
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
        limparFormulario();
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
      // O carrinho só esvazia quando a compra se conclui (comprovativo enviado): até lá, voltar atrás ao checkout mostra-o intacto.
      const manualMetodo = metodoPagamento === 'mpesa' ? 'mpesa' : 'transferencia';
      setManualSession({ id: data.session.id, metodoPagamento: manualMetodo, totalMt: Number(data.session.total_mt) || undefined });
      if (manualMetodo === 'mpesa') {
        setMpesaPassoValor(Number(data.session.total_mt) || undefined);
        setMpesaPassoId(data.session.id);
      }
      restoredPendingIdRef.current = data.session.id;
      router.push(`/checkout?pendingId=${data.session.id}`);
      setStatus('idle');
      setIsSubmitting(false);
      return;
    } catch (err: any) {
      setErrorMessage(err.message || 'Falha ao comunicar com o servidor de registo.');
      setStatus('error');
      setIsSubmitting(false);
    }
  };

  // O nome da empresa de uma hospedagem é o nome de utilizador da sua conta no servidor: pede-se nos dados da empresa.
  const campoNomeEmpresa = (item: (typeof items)[number]) => {
    const estado = contaLivre[item.id];
    const nome = (item.contaUtilizador || '').trim();
    let nota: React.ReactNode = null;
    if (nome && !nomeContaValido(nome)) nota = <span className="mt-1 block text-[11px] text-rose-600">{NOME_CONTA_ERRO}</span>;
    else if (estado && estado !== 'a-verificar' && !estado.livre) nota = <span className="mt-1 block text-[11px] text-rose-600">{estado.msg || 'Este nome de utilizador já existe.'}</span>;
    return (
      <div key={item.id}>
        <CampoIcone icone={Building2}>
          <input
            type="text"
            value={item.contaUtilizador || ''}
            maxLength={20}
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Nome da empresa (utilizador)"
            placeholder={itensHospedagem.length > 1 && item.hostingDomain ? item.hostingDomain + ' — Nome da empresa (utilizador) *' : 'Nome da empresa (utilizador) *'}
            onChange={(e) => updateItemContaUtilizador(item.id, e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''))}
            className={campoCls}
          />
        </CampoIcone>
        {nota}
      </div>
    );
  };
  const itensHospedagem = items.filter((i) => i.type === 'hosting');

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
  // Depois de "Fazer login" volta ao mesmo checkout — no caso da encomenda,
  // o rascunho continua guardado e é retomado.
  const checkoutReturnPath = isEncomenda ? '/checkout?encomenda=1' : '/checkout';
  // O IVA (16 %) acrescenta-se ao preço dos itens do carrinho (Silva, 28/10/2026); `total` é o subtotal sem IVA.
  const ivaCarrinho = acrescentarIva(total);
  const payTotalLabel = isEncomenda ? `${formatMt(encomendaPricing?.adiantamentoMt ?? 0)} MT` : formatPrice(ivaCarrinho.totalMt);

  // Editar ou cancelar a meio do pagamento: a encomenda já gravada (sem
  // comprovativo) sai da base de dados; ao editar, os dados continuam no
  // rascunho e voltam ao formulário; ao cancelar, o rascunho também sai.
  const editarEncomenda = async () => {
    setEncomendaAccao('editar');
    const quotationId = encomendaPending?.quotationId ?? encomendaDraft?.registada?.quotationId;
    if (quotationId) {
      const descartada = await descartarEncomendaRegistada(quotationId);
      if (!descartada.ok) {
        window.alert(descartada.error);
        setEncomendaAccao(null);
        return;
      }
      setEncomendaRegistada(null);
    }
    if (painel) painel.editar(); else router.push(`${ENCOMENDA_EDIT_PATH}&passo=dados`);
  };
  const cancelarEncomenda = async () => {
    if (!window.confirm('Cancelar esta encomenda? Os dados preenchidos e o pedido são apagados.')) return;
    setEncomendaAccao('cancelar');
    const quotationId = encomendaPending?.quotationId ?? encomendaDraft?.registada?.quotationId;
    if (quotationId) {
      const descartada = await descartarEncomendaRegistada(quotationId);
      if (!descartada.ok) {
        window.alert(descartada.error);
        // 409: já tem comprovativo/está com a equipa — segue no painel, não aqui.
        if (descartada.status === 409) {
          clearEncomendaDraft();
          if (painel) painel.voltar(); else router.push(await resolveEncomendaLandingPath());
          return;
        }
        setEncomendaAccao(null);
        return;
      }
    }
    clearEncomendaDraft();
    if (painel) painel.voltar(); else router.push('/precos');
  };

  return (
    <div className={painel ? 'vh-checkout-painel' : 'min-h-screen bg-slate-50 dark:bg-zinc-950 pt-32 pb-16 transition-colors duration-200'}>
      <div className={painel ? '' : 'max-w-7xl mx-auto px-[40px] mt-4'}>

        {isEncomenda && encomendaPending ? (
          <ManualPaymentUploadStep
            uploadUrl={`/api/cotacoes/${encomendaPending.quotationId}/anexos`}
            uploadFields={{ fase: 'adiantamento' }}
            metodoPagamento={encomendaPending.metodoPagamento}
            valorMt={encomendaPending.valorMt}
            successMessage="A nossa equipa confirma o pagamento e dá início à produção — acompanhe a encomenda no seu painel."
            // Pago — a encomenda sai do balão do carrinho.
            onSent={clearEncomendaDraft}
            secondaryActions={
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 dark:border-zinc-800 pt-4">
                <button
                  type="button"
                  onClick={() => irEncomenda(ENCOMENDA_CHECKOUT_PATH)}
                  disabled={encomendaAccao !== null}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-100 disabled:opacity-50"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Voltar ao resumo
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={editarEncomenda}
                    disabled={encomendaAccao !== null}
                    className="border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-300 font-bold text-xs px-3 py-2 rounded-md hover:border-slate-300 disabled:opacity-50"
                  >
                    {encomendaAccao === 'editar' ? 'A abrir...' : 'Editar dados'}
                  </button>
                  <button
                    type="button"
                    onClick={cancelarEncomenda}
                    disabled={encomendaAccao !== null}
                    className="text-xs font-bold text-rose-600 hover:underline px-2 py-2 disabled:opacity-50"
                  >
                    {encomendaAccao === 'cancelar' ? 'A cancelar...' : 'Cancelar encomenda'}
                  </button>
                </div>
              </div>
            }
            onContinue={async () => {
              // Sem domínio/hospedagem/produtos VisualWeb → painel das encomendas.
              if (painel) painel.voltar(); else router.push(await resolveEncomendaLandingPath());
            }}
          />
        ) : isEncomenda && !encomendaDraftLoaded ? (
          <div className="flex items-center justify-center py-24">
            <Spinner className="w-10 h-10" />
          </div>
        ) : isEncomenda && !encomendaDraft ? (
          <EncomendaVazia />
        ) : manualSession && mpesaPassoId === manualSession.id ? (
          <MpesaTesteStep
            sessionId={manualSession.id}
            token={tokenPedido}
            valorMt={mpesaPassoValor}
            onDone={(testado) => { setMpesaAvisoTeste(testado); setMpesaPassoId(null); }}
          />
        ) : manualSession ? (
          <ManualPaymentUploadStep
            uploadUrl={`/api/checkout/${manualSession.id}/comprovativo`}
            metodoPagamento={manualSession.metodoPagamento}
            valorMt={manualSession.totalMt}
            referencia={referenciaPedido(manualSession.id)}
            jaEnviado={manualSession.comprovativoEnviado}
            motivoNovoComprovativo={manualSession.motivo}
            avisoTeste={mpesaAvisoTeste}
            uploadFields={tokenPedido ? { token: tokenPedido } : undefined}
            successMessage={tokenPedido ? 'A nossa equipa vai confirmar o pagamento. Entretanto já pode entrar no painel; as configurações do seu plano abrem assim que o pagamento for confirmado.' : undefined}
            onSent={() => {
              clearCart();
              limparFormulario();
              try {
                sessionStorage.removeItem(CHAVE_PEDIDO_SEM_CONTA);
              } catch {
                /* sem armazenamento */
              }
            }}
            onContinue={async () => {
              const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();
              if (refreshedSession) {
                // como o login do site: esquece a leitura de quem entrou antes neste navegador (ex.: o admin) e lê já a da conta nova,
                // para o painel abrir com os dados do pacote comprado e não mostrar primeiro os de outra conta
                pedirAbrirCompra();
                await preCarregarDadosVhost();
                marcarViaSite();
              }
              router.push(refreshedSession ? redirectPathForSession(refreshedSession) : `/login?redirect=${encodeURIComponent(PUBLIC_PANEL_ENTRY)}`);
            }}
          />
        ) : !isEncomenda && (!carrinhoLido || searchParams.get('pago') === '1') ? (
          <div className="flex items-center justify-center py-24">
            <Spinner className="w-10 h-10" />
          </div>
        ) : !isEncomenda && items.length === 0 ? (
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

              {/* Encomendas: quem factura e em nome de quem. Nas compras de domínio e hospedagem os dados são os do formulário abaixo. */}
              {isAuthenticated === true && isEncomenda && encomendaDraft && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-6 shadow-sm">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-red-600 dark:text-red-400 flex items-center gap-1.5 mb-3">
                      <Building2 className="w-3.5 h-3.5" /> Facturado Por
                    </p>
                    <p className="font-bold text-slate-800 dark:text-zinc-100 text-sm">VisualDESIGN Services, Lda.</p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2 leading-relaxed">
                      Av. Karl Marx, 177, Maputo — Moçambique
                    </p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">info@visualdesignmoz.com</p>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 mt-2">NUIT: 400597243</p>
                  </div>
                  <EncomendaFaturadoPara draft={encomendaDraft} facturarEm={facturarEm} onFacturarEmChange={setFacturarEm} />
                </div>
              )}

              {/* Quem tem conta vê os dados que escreveu (ou os da conta) como texto; «Editar» abre os campos. */}
              {isAuthenticated === true && !comoVisitante && !editando && !isEncomenda && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-6 shadow-sm">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-red-600 dark:text-red-400 flex items-center gap-1.5 mb-4">
                      <User className="w-3.5 h-3.5" /> Dados da Pessoa Responsável
                    </p>
                    <div className="space-y-2.5">
                      <LinhaDado icone={User} valor={[accountForm.name, accountForm.sobrenome].filter(Boolean).join(' ')} />
                      {accountForm.cargo ? <LinhaDado icone={Briefcase} valor={accountForm.cargo} /> : null}
                      <LinhaDado icone={Mail} valor={authUser?.email || accountForm.email} />
                      <LinhaDado icone={Phone} valor={accountForm.telefone ? `${telefonePrefixo} ${accountForm.telefone}` : ''} />
                    </div>
                  </div>
                  <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-red-600 dark:text-red-400 flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5" /> Dados da Empresa
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          copiaAntesDeEditar.current = { form: { ...accountForm }, prefixo: telefonePrefixo };
                          setEditando(true);
                        }}
                        className="text-[10px] font-bold text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                      >
                        Editar
                      </button>
                    </div>
                    <div className="space-y-2.5">
                      {itensHospedagem.map((i) => (
                        <LinhaDado key={i.id} icone={Building2} valor={i.contaUtilizador || ''} />
                      ))}
                      {accountForm.emailEmpresa ? <LinhaDado icone={Mail} valor={accountForm.emailEmpresa} /> : null}
                      <LinhaDado icone={CreditCard} valor={accountForm.nuit ? 'NUIT ' + accountForm.nuit : ''} />
                      <LinhaDado icone={MapPin} valor={accountForm.endereco} />
                      <LinhaDado icone={MapaIcone} valor={accountForm.estado} />
                    </div>
                  </div>
                </div>
              )}

              {/* PROCESSING STEPS */}
              {/* ERROR STATE */}
              {status === 'error' && errorMessage && (
                <div ref={caixaErroRef} className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/50 rounded-lg p-5 flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-bold text-red-800 dark:text-red-300 text-sm font-panel">Falha na Transação</h4>
                    <p className="text-xs text-red-700 dark:text-red-400 mt-1 leading-normal">{errorMessage}</p>
                    {(errorMessage.toLowerCase().includes('login') || errorMessage.toLowerCase().includes('já existe')) && (
                      <Link href={`/login?redirect=${encodeURIComponent(checkoutReturnPath)}`} className="mt-4 bg-red-600 text-white font-bold text-xs px-4 py-2 rounded-lg hover:bg-red-700 transition-colors inline-block">
                        Fazer Login
                      </Link>
                    )}
                  </div>
                </div>
              )}

              {/* PAY FORM */}
              {(
                <div className="space-y-5">

                  {isEncomenda && encomendaRegistada && (
                    <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900/50 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-blue-800 dark:text-blue-300">Esta encomenda já está registada — falta anexar o comprovativo</p>
                        <p className="text-xs text-blue-700 dark:text-blue-400 mt-0.5">
                          Pode rever os dados, mudar o método ou cancelar. Se mudar alguma coisa, o pedido é actualizado ao clicar em "Pagar".
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => irEncomenda(encomendaComprovativoPath(encomendaRegistada))}
                        className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2.5 rounded-md transition-colors"
                      >
                        Anexar comprovativo
                      </button>
                    </div>
                  )}

                  {isAuthenticated === false && isEncomenda && (
                    <EncomendaLoginNecessario loginHref={`/login?redirect=${encodeURIComponent(checkoutReturnPath)}`} />
                  )}

                  {isAuthenticated !== null && !isEncomenda && (isAuthenticated !== true || comoVisitante || editando) && (
                    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-6 shadow-sm">
                      {(isAuthenticated !== true || comoVisitante) && (
                        <div className="mb-6 pb-4 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center">
                          <p className="text-sm text-slate-600 dark:text-zinc-400">
                            Já tem uma conta? <Link href={`/login?redirect=${encodeURIComponent(checkoutReturnPath)}`} className="text-blue-600 font-bold hover:underline">Inicie sessão</Link> para concluir o processo de pagamento.
                          </p>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-8">
                        {/* Dados da pessoa responsável */}
                        <div className="space-y-3">
                          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-zinc-300 pb-3 border-b border-slate-100 dark:border-zinc-800">
                            Dados da Pessoa Responsável
                          </h3>
                          <div className="grid grid-cols-2 gap-3">
                          <CampoIcone icone={User}>
                            <input type="text" aria-label="Nome" placeholder="Nome *" value={accountForm.name} onChange={e => setAccountForm(p => ({ ...p, name: e.target.value }))} className={campoCls} />
                          </CampoIcone>
                          <CampoIcone icone={User}>
                            <input type="text" aria-label="Apelido" placeholder="Apelido" value={accountForm.sobrenome} onChange={e => setAccountForm(p => ({ ...p, sobrenome: e.target.value }))} className={campoCls} />
                          </CampoIcone>
                          </div>
                          <CampoIcone icone={Briefcase}>
                            <input type="text" aria-label="Cargo" placeholder="Cargo" value={accountForm.cargo} onChange={e => setAccountForm(p => ({ ...p, cargo: e.target.value }))} className={campoCls} />
                          </CampoIcone>
                          <CampoIcone icone={Mail}>
                            <input type="email" aria-label="E-mail" placeholder="E-mail *" disabled={isAuthenticated === true && !comoVisitante} value={isAuthenticated === true && !comoVisitante && authUser?.email ? authUser.email : accountForm.email} onChange={e => setAccountForm(p => ({ ...p, email: e.target.value }))} className={campoCls} />
                          </CampoIcone>
                          <div className={`${caixaCampoCls}${campoEmErro('Telefone') ? ' !border-red-500 ring-2 ring-red-500/20' : ''}`}>
                            <IconeCaixa icone={Phone} />
                            <div className="relative flex items-center border-r border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950">
                              <select aria-label="Indicativo" value={telefonePrefixo} onChange={(e) => setTelefonePrefixo(e.target.value)} className="pl-3 pr-8 h-10 bg-transparent text-sm text-slate-700 dark:text-zinc-300 outline-none cursor-pointer appearance-none">
                                <option value="+258">🇲🇿 +258</option>
                                <option value="+244">🇦🇴 +244</option>
                                <option value="+351">🇵🇹 +351</option>
                                <option value="+55">🇧🇷 +55</option>
                              </select>
                              <svg className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                            </div>
                            <input type="tel" aria-label="Telefone" placeholder="Telefone *" value={accountForm.telefone} onChange={e => setAccountForm(p => ({ ...p, telefone: e.target.value }))} className={campoCls} />
                          </div>
                          {(isAuthenticated !== true || comoVisitante || editando) && (
                          <CampoIcone icone={KeyRound}>
                            <input type={showPassword ? 'text' : 'password'} aria-label="Palavra-passe" placeholder={isAuthenticated === true && !comoVisitante ? 'Nova palavra-passe (opcional)' : 'Palavra-passe (6 a 20 caracteres) *'} maxLength={20} autoComplete="new-password" value={accountForm.password} onChange={e => setAccountForm(p => ({ ...p, password: e.target.value }))} className={campoCls} />
                            <div className="flex items-center gap-2 pr-3 text-slate-400">
                              <button type="button" title="Gerar senha segura" aria-label="Gerar senha segura" onClick={() => { setAccountForm(p => ({ ...p, password: Math.random().toString(36).slice(-6) + Math.random().toString(36).slice(-2).toUpperCase() + '@' })); setShowPassword(true); }} className="hover:text-blue-600 dark:hover:text-blue-400">
                                <Wand2 className="w-4 h-4" />
                              </button>
                              <button type="button" aria-label="Mostrar palavra-passe" onClick={() => setShowPassword(!showPassword)} className="hover:text-slate-600 dark:hover:text-zinc-300">
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            </div>
                          </CampoIcone>
                          )}
                        </div>

                        {/* Dados da empresa */}
                        <div className="space-y-3">
                          <h3 className="text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-zinc-300 pb-3 border-b border-slate-100 dark:border-zinc-800">
                            Dados da Empresa
                          </h3>
                          {itensHospedagem.length > 0 ? (
                            itensHospedagem.map(campoNomeEmpresa)
                          ) : (
                            <CampoIcone icone={Building2}>
                              <input type="text" aria-label="Empresa" placeholder="Empresa" value={accountForm.empresa} onChange={e => setAccountForm(p => ({ ...p, empresa: e.target.value }))} className={campoCls} />
                            </CampoIcone>
                          )}
                          <CampoIcone icone={Mail}>
                            <input type="email" aria-label="E-mail da empresa" placeholder="E-mail da empresa" value={accountForm.emailEmpresa} onChange={e => setAccountForm(p => ({ ...p, emailEmpresa: e.target.value }))} className={campoCls} />
                          </CampoIcone>
                          <CampoIcone icone={CreditCard} erro={campoEmErro('NUIT da empresa')}>
                            <input type="text" inputMode="numeric" maxLength={9} aria-label="NUIT da empresa" placeholder="NUIT da empresa *" value={accountForm.nuit} onChange={e => setAccountForm(p => ({ ...p, nuit: e.target.value.replace(/\D/g, '').slice(0, 9) }))} className={nuitValido(accountForm.nuit) || !accountForm.nuit ? (accountForm.nuit ? campoCls : campoVazioCls) : campoCls} />
                          </CampoIcone>
                          <CampoIcone icone={MapPin} erro={campoEmErro('Morada') || campoEmErro('Província')}>
                            <input type="text" aria-label="Morada" placeholder="Morada *" value={accountForm.endereco} onChange={e => setAccountForm(p => ({ ...p, endereco: e.target.value }))} className={campoCls} />
                            <select aria-label="Província" value={accountForm.estado} onChange={e => setAccountForm(p => ({ ...p, estado: e.target.value }))} className={`${accountForm.estado ? campoCls : campoVazioCls} !w-44 !flex-none border-l border-zinc-300 dark:border-zinc-700`}>
                              <option value="">Província *</option>
                              {MOZAMBIQUE_PROVINCIAS.map((p) => (
                                <option key={p} value={p}>{p}</option>
                              ))}
                            </select>
                          </CampoIcone>
                      {isAuthenticated === true && !comoVisitante && editando && (
                        <div className="flex items-center justify-start gap-2 h-10">
                          <button
                            type="button"
                            disabled={savingDados}
                            onClick={async () => {
                              const erroGuardar = erroDosDados(accountForm);
                              if (erroGuardar) {
                                avisarCampo(erroGuardar);
                                return;
                              }
                              const erroEmailEmpresa = accountForm.emailEmpresa.trim() ? mensagemEmailInvalido(accountForm.emailEmpresa, 'O e-mail da empresa') : null;
                              if (erroEmailEmpresa) {
                                setErrorMessage(erroEmailEmpresa);
                                setStatus('error');
                                return;
                              }
                              setSavingDados(true);
                              try {
                                if (!buyingAs) {
                                  await gravarPerfil({
                                    telefone: telefoneCompleto(accountForm.telefone, telefonePrefixo),
                                    morada: accountForm.endereco.trim(),
                                    cidade: accountForm.estado,
                                    provincia: accountForm.estado,
                                    emailEmpresa: accountForm.emailEmpresa,
                                    cargo: accountForm.cargo,
                                  });
                                  await mudarSenha();
                                }
                                setErrorMessage('');
                                setStatus('idle');
                                setEditando(false);
                              } catch (err: unknown) {
                                setErrorMessage(err instanceof Error ? err.message : 'Não foi possível guardar os dados da conta.');
                                setStatus('error');
                              } finally {
                                setSavingDados(false);
                              }
                            }}
                            className="bg-red-600 text-white text-xs font-bold px-4 py-2 rounded hover:bg-red-700 disabled:opacity-50"
                          >
                            {savingDados ? 'A guardar...' : 'Guardar'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (copiaAntesDeEditar.current) {
                                setAccountForm((f) => ({ ...f, ...copiaAntesDeEditar.current!.form, password: '' }));
                                setTelefonePrefixo(copiaAntesDeEditar.current.prefixo);
                              }
                              setEditando(false);
                            }}
                            className="border border-slate-300 dark:border-zinc-700 text-slate-600 dark:text-zinc-300 text-xs font-bold px-4 py-2 rounded hover:bg-slate-50 dark:hover:bg-zinc-800"
                          >
                            Cancelar
                          </button>
                        </div>
                      )}
                        </div>
                      </div>
                    </div>
                  )}

                  {isEncomenda && encomendaDraft && encomendaPricing ? (
                    <EncomendaResumoCard draft={encomendaDraft} pricing={encomendaPricing} />
                  ) : (
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
                              {(item.type === 'hosting' || item.type === 'email') && item.hostingDomain && (
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
                            ) : item.type === 'email' && getEmailPlan(item.id) ? (
                              <label className="flex items-center gap-2">
                                <span className="text-xs text-slate-400">Ciclo:</span>
                                <select
                                  value={item.period}
                                  onChange={(e) => {
                                    const months = Number(e.target.value);
                                    const plan = getEmailPlan(item.id);
                                    const cycle = emailCycleForMonths(months);
                                    const newPrice = plan && cycle ? getEmailCyclePrice(plan, cycle) : item.price;
                                    updateItemPeriod(item.id, months, newPrice);
                                  }}
                                  className="rounded border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 px-2.5 py-1.5 text-xs font-bold text-slate-600 dark:text-zinc-300"
                                >
                                  {(Object.keys(EMAIL_CYCLE_MONTHS) as EmailBillingCycle[]).map((cycle) => (
                                    <option key={cycle} value={EMAIL_CYCLE_MONTHS[cycle]}>{EMAIL_CYCLE_LABELS[cycle]}</option>
                                  ))}
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
                      <div className="flex justify-between items-center text-sm text-slate-500 dark:text-zinc-400">
                        <span>Subtotal</span>
                        <div className="flex items-center justify-end gap-2">
                          <span>{formatPrice(ivaCarrinho.subtotalMt)}</span>
                          <span className="w-6 h-6 flex-shrink-0" aria-hidden="true" />
                        </div>
                      </div>
                      <div className="flex justify-between items-center text-sm text-slate-500 dark:text-zinc-400">
                        <span>{`IVA (${Math.round(IVA_TAXA * 100)}%)`}</span>
                        <div className="flex items-center justify-end gap-2">
                          <span>{formatPrice(ivaCarrinho.ivaMt)}</span>
                          <span className="w-6 h-6 flex-shrink-0" aria-hidden="true" />
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-black text-slate-800 dark:text-zinc-100 text-sm uppercase">Total</span>
                        <div className="flex items-center justify-end gap-2">
                          <span className="font-black text-xl text-red-600 dark:text-red-400">{formatPrice(ivaCarrinho.totalMt)}</span>
                          <span className="w-6 h-6 flex-shrink-0" aria-hidden="true" />
                        </div>
                      </div>
                    </div>
                  </div>
                  )}

                  <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-6 space-y-5 shadow-sm">
                    <div>
                      <h2 className="text-xl font-bold text-slate-800 dark:text-zinc-50 font-panel">
                        {isEncomenda && !encomendaTemValor ? 'Submeter' : 'Finalizar Pagamento'}
                      </h2>
                      <p className="text-xs text-slate-400 dark:text-zinc-550 mt-1">
                        {isEncomenda && !encomendaTemValor
                          ? 'Não há valor a pagar agora — submeta o pedido e a equipa entra em contacto.'
                          : 'Escolha o método de pagamento ao lado e conclua a compra.'}
                      </p>
                    </div>

                    {isEncomenda && !encomendaTemValor ? (
                      <div className="p-4 rounded-lg bg-slate-50 dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="p-3 rounded-md bg-slate-100 dark:bg-zinc-800 flex-shrink-0">
                            <Info className="w-6 h-6 text-slate-500 dark:text-zinc-400" />
                          </div>
                          <h4 className="font-bold text-sm text-slate-800 dark:text-zinc-200">Encomenda Sob Consulta</h4>
                        </div>
                        {/* a descrição ocupa a largura toda do quadro, por baixo do ícone e do título */}
                        <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                          Ao clicar em "Submeter", a encomenda fica registada no seu painel. Depois de a equipa confirmar o valor, paga o adiantamento a partir de lá.
                        </p>
                      </div>
                    ) : metodoPagamento === 'saldo' ? (
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
                            Pagamento seguro por cartão
                          </h4>
                          <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1 leading-relaxed">
                            Ao clicar em "Pagar", será encaminhado para a página segura de pagamento para introduzir os dados do cartão. Este site nunca vê nem guarda o número do seu cartão.
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
                            {isEncomenda
                              ? 'Ao clicar em "Pagar", a encomenda fica registada e vai receber o número M-Pesa para pagar o adiantamento — depois anexa o comprovativo e a nossa equipa confirma e dá início à produção.'
                              : 'Ao clicar em "Pagar", o pedido fica registado e vai receber o número M-Pesa para concluir — depois anexa o comprovativo e a nossa equipa confirma a activação.'}
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
                            {isEncomenda
                              ? 'Ao clicar em "Pagar", a encomenda fica registada e vai receber os dados de transferência para pagar o adiantamento — depois anexa o comprovativo e a nossa equipa confirma e dá início à produção.'
                              : 'Ao clicar em "Pagar", o pedido fica registado e vai receber os dados de transferência para concluir — depois anexa o comprovativo e a nossa equipa confirma a activação.'}
                          </p>
                        </div>
                      </div>
                    )}

                    {dadosEmFalta.length > 0 && (
                      <div className="p-4 rounded-lg bg-rose-50 dark:bg-rose-900/10 border border-rose-200 dark:border-rose-800/60 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs text-rose-700 dark:text-rose-300 leading-relaxed">
                          <span className="font-bold">Faltam dados para finalizar a encomenda: </span>
                          {dadosEmFalta.join(', ')}.
                        </p>
                        <button
                          type="button"
                          onClick={() => window.dispatchEvent(new Event('visualdesign:editar-dados-encomenda'))}
                          className="bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white font-bold text-xs px-4 py-2 rounded-md"
                        >
                          Completar dados
                        </button>
                      </div>
                    )}

                    <div className="mt-2 flex flex-wrap justify-start gap-3">
                      <button
                        type="button"
                        onClick={handlePay}
                        disabled={
                          isSubmitting ||
                          dadosEmFalta.length > 0 ||
                          (isEncomenda && isAuthenticated === false) ||
                          (metodoPagamento === 'saldo' && (saldoDisponivel ?? 0) < ivaCarrinho.totalMt)
                        }
                        className={`flex-1 sm:flex-none disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-md flex items-center justify-center gap-2 transition-all cursor-pointer ${
                          isEncomenda && !encomendaTemValor
                            ? 'bg-black hover:bg-red-600'
                            : metodoPagamento === 'mpesa'
                              ? 'bg-red-600 hover:bg-red-700'
                              : metodoPagamento === 'saldo'
                                ? 'bg-teal-600 hover:bg-teal-700'
                                : 'bg-indigo-600 hover:bg-indigo-700'
                        }`}
                      >
                        <Lock className="w-5 h-5 animate-pulse" />{' '}
                        {isSubmitting
                          ? metodoPagamento === 'mpesa' || metodoPagamento === 'transferencia'
                            ? 'A registar o pedido...'
                            : 'A processar...'
                          : isEncomenda && !encomendaTemValor
                            ? 'Submeter'
                            : `Pagar ${payTotalLabel}`}
                      </button>
                      {isSubmitting && (
                        <p role="status" className="w-full text-xs text-slate-500 dark:text-zinc-400">
                          {metodoPagamento === 'mpesa' || metodoPagamento === 'transferencia'
                            ? 'A guardar os seus dados e a preparar os dados de pagamento. Aguarde alguns segundos.'
                            : 'A processar o pagamento. Aguarde alguns segundos.'}
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => (isEncomenda ? cancelarEncomenda() : window.history.back())}
                        disabled={isSubmitting || encomendaAccao !== null}
                        className="flex-1 sm:flex-none bg-transparent border border-slate-200 hover:border-slate-300 dark:border-zinc-800 dark:hover:border-zinc-700 text-slate-600 dark:text-zinc-400 font-bold py-3 px-6 rounded-md transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
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
                  <span className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-zinc-300">
                    {isEncomenda ? 'A Pagar Agora' : 'Valor Total'}
                  </span>
                  <p className="text-2xl font-black text-slate-900 dark:text-zinc-50 mt-0.5">
                    {isEncomenda && !encomendaTemValor ? 'Sob Consulta' : payTotalLabel}
                  </p>
                  {isEncomenda && encomendaTemValor && encomendaPricing && (
                    <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-0.5">
                      Adiantamento de 70% da factura de {formatMt(encomendaPricing.totalComIvaMt)} MT
                    </p>
                  )}
                </div>

                {!(isEncomenda && !encomendaTemValor) && (
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
                      // Encomendas: só os métodos que a Contabilidade › Encomendas confirma.
                      .filter(([value]) => !isEncomenda || value === 'mpesa' || value === 'transferencia')
                      // Em USD só o Cartão processa o pagamento — M-Pesa/Transferência
                      // são sempre MZN (redes moçambicanas), e o Saldo é um crédito
                      // interno também em MZN.
                      .filter(([value]) => isEncomenda || currency === 'MZN' || value === 'stripe')
                      .map(([value, meta]) => (
                        <option key={value} value={value}>{meta.label}</option>
                      ))}
                  </select>
                  {currency === 'USD' && !isEncomenda && (
                    <p className="text-[11px] text-slate-400 dark:text-zinc-500 mt-1.5">
                      Em USD só é possível pagar por Cartão — M-Pesa e Transferência são sempre em MZN.
                    </p>
                  )}
                </div>
                )}

                <div className="text-sm space-y-1.5 pt-2 border-t border-dashed border-slate-200 dark:border-zinc-800">
                  {metodoPagamento === 'saldo' && (
                    <div className="space-y-1">
                      <p className="text-slate-700 dark:text-zinc-300">
                        Saldo disponível: <span className="font-mono font-bold">{formatMt(saldoDisponivel ?? 0)} MT</span>
                      </p>
                      {(saldoDisponivel ?? 0) < ivaCarrinho.totalMt && (
                        <p className="text-xs text-rose-600 dark:text-rose-400">
                          Saldo insuficiente para esta compra — carregue mais saldo no seu painel de revendedor.
                        </p>
                      )}
                    </div>
                  )}
                  {metodoPagamento === 'mpesa' && !(isEncomenda && !encomendaTemValor) && (
                    <div className="space-y-2">
                      <p className="text-slate-700 dark:text-zinc-300">Número M-Pesa: <span className="font-mono font-bold">{MPESA_NUMBER}</span></p>
                      <button
                        type="button"
                        onClick={handlePay}
                        disabled={isSubmitting || dadosEmFalta.length > 0 || (isEncomenda && isAuthenticated === false) || (status !== 'idle' && status !== 'error')}
                        className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold py-3 rounded-md transition-colors cursor-pointer"
                      >
                        <Smartphone className="w-4 h-4" />
                        Pagar com
                        <span className="italic font-black tracking-tight">m-pesa</span>
                      </button>
                      <p className="text-[11px] text-center text-slate-400 dark:text-zinc-500">O pedido fica registado e depois envia o valor e o comprovativo.</p>
                    </div>
                  )}
                  {metodoPagamento === 'transferencia' && !(isEncomenda && !encomendaTemValor) && (
                    <>
                      <p className="text-slate-700 dark:text-zinc-300">Titular: <span className="font-medium">{BANK_NAME}</span></p>
                      <p className="text-slate-700 dark:text-zinc-300">Nº Conta: <span className="font-mono font-bold">{BANK_ACCOUNT}</span></p>
                      <p className="text-slate-700 dark:text-zinc-300">NIB: <span className="font-mono font-bold">{BANK_NIB}</span></p>
                    </>
                  )}
                  {metodoPagamento === 'stripe' && (
                    <p className="text-slate-500 dark:text-zinc-400 text-xs leading-relaxed">
                      Clique em "Pagar {payTotalLabel}" à esquerda para continuar para a página segura de pagamento.
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-center gap-2 pt-1">
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-500 dark:text-zinc-400 bg-slate-100 dark:bg-zinc-800 px-2 py-1 rounded">
                    <ShieldCheck className="w-3.5 h-3.5 text-green-600" /> SSL Seguro
                  </span>
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg overflow-hidden shadow-sm">
                <p className="px-5 pt-4 pb-1 text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-zinc-300 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" /> Acções Rápidas
                </p>
                <button type="button" onClick={() => (painel ? painel.voltar() : router.push(isEncomenda ? destinoDepoisDoPagamento('/encomendas') : PUBLIC_PANEL_ENTRY))} className="w-full flex items-center gap-2.5 px-5 py-3 text-sm text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-800 hover:text-red-600 dark:hover:text-red-400 cursor-pointer border-t border-slate-100 dark:border-zinc-800">
                  <ArrowLeft className="w-4 h-4 text-slate-400" /> Retornar ao Painel
                </button>
              </div>

              <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-5 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-zinc-300 flex items-center gap-1.5 mb-2">
                  <Info className="w-3.5 h-3.5" /> Informações Importantes
                </p>
                {isEncomenda ? (
                  <>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                      A produção começa depois de confirmado o adiantamento de 70% — a nossa equipa verifica o comprovativo do M-Pesa ou da Transferência.
                    </p>
                    <div className="border-t border-dashed border-slate-200 dark:border-zinc-800 my-3" />
                    <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                      Os restantes 30% pagam-se na entrega, a partir do painel das encomendas.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                      Pagamentos por M-Pesa ou Transferência são, por enquanto, confirmados manualmente pela nossa equipa — o serviço é activado assim que o comprovativo for verificado.
                    </p>
                    <div className="border-t border-dashed border-slate-200 dark:border-zinc-800 my-3" />
                    <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                      Pagamentos por cartão são confirmados e activados automaticamente.
                    </p>
                  </>
                )}
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
 * Passo do número M-Pesa, entre «Pagar Agora» e o comprovativo. Enquanto o M-Pesa está em sandbox o pedido
 * segue o protocolo (o cliente dá o número e confirma no telemóvel) mas NÃO é cobrado: no fim o cliente é
 * avisado, no ecrã do comprovativo, de que o valor não foi deduzido. Fora do sandbox
 * (produção) o passo salta-se sozinho e o checkout vai direito ao comprovativo.
 */
function MpesaTesteStep({ sessionId, token, valorMt, onDone }: { sessionId: string; token?: string | null; valorMt?: number; onDone: (testado: boolean) => void }) {
  const [fase, setFase] = useState<'a-verificar' | 'numero' | 'a-pagar'>('a-verificar');
  const [numero, setNumero] = useState('');
  const [error, setError] = useState('');
  const [falhas, setFalhas] = useState(0);

  useEffect(() => {
    let cancelado = false;
    fetch('/api/checkout/mpesa-teste')
      .then((r) => r.json())
      .then((d) => {
        if (cancelado) return;
        if (d?.sandbox) setFase('numero');
        else onDone(false);
      })
      .catch(() => { if (!cancelado) onDone(false); });
    return () => { cancelado = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pagar = async () => {
    const digitos = numero.replace(/\D/g, '');
    const msisdn = digitos.length === 9 ? `258${digitos}` : digitos;
    if (!/^258\d{9}$/.test(msisdn)) {
      setError('Indique um número M-Pesa válido (ex.: 84 000 0000).');
      return;
    }
    setError('');
    setFase('a-pagar');
    // O pedido vai para o telemóvel; esta chamada só termina quando a pessoa confirma (ou recusa). Só depois de confirmar
    // aparece o campo do comprovativo.
    let aprovado = false;
    let aviso = 'Não foi possível confirmar o pagamento no M-Pesa. O PIN escreve-se no telemóvel, não aqui: confirme que o pedido chegou ao número indicado e tente outra vez.';
    try {
      const res = await fetch('/api/checkout/mpesa-teste', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, msisdn, ...(token ? { token } : {}) }),
      });
      const d = await res.json().catch(() => ({}));
      aprovado = Boolean(d?.aprovado);
      if (!aprovado && d?.erro) aviso = String(d.erro);
    } catch {
      /* fica o aviso */
    }
    if (aprovado) {
      onDone(true);
      return;
    }
    setFalhas((n) => n + 1);
    setError(aviso);
    setFase('numero');
  };

  return (
    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-lg p-8 max-w-lg mx-auto space-y-5 shadow-sm">
      {fase === 'a-verificar' && (
        <div className="flex justify-center py-6"><Spinner className="w-8 h-8" /></div>
      )}

      {fase === 'numero' && (
        <>
          <div className="text-center space-y-1">
            <h2 className="text-lg font-bold text-slate-800 dark:text-zinc-100 font-panel">Pagar com M-Pesa</h2>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              Indique o número M-Pesa que vai fazer o pagamento.
            </p>
          </div>
          {valorMt ? (
            <p className="text-sm text-slate-700 dark:text-zinc-300 text-center">
              Valor a pagar: <span className="font-mono font-bold">{formatMt(valorMt)} MT</span>
            </p>
          ) : null}
          <input
            type="tel"
            inputMode="numeric"
            placeholder="84 000 0000"
            value={numero}
            onChange={(e) => setNumero(e.target.value)}
            className="w-full border border-slate-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 rounded-md px-4 py-3 text-sm text-slate-800 dark:text-zinc-100"
          />
          {error && <p className="text-xs text-rose-600 dark:text-rose-400">{error}</p>}
          <button
            type="button"
            onClick={pagar}
            className="w-full inline-flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-md transition-colors"
          >
            <Smartphone className="w-4 h-4" /> Pagar com M-Pesa
          </button>
          {falhas >= 2 && (
            <button
              type="button"
              onClick={() => onDone(true)}
              className="w-full text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-100 underline"
            >
              Já paguei por outra via — continuar para o comprovativo
            </button>
          )}
        </>
      )}

      {fase === 'a-pagar' && (
        <div className="text-center space-y-3 py-4">
          <Spinner className="w-8 h-8 mx-auto" />
          <p className="text-sm text-slate-600 dark:text-zinc-300">
            Enviámos o pedido de pagamento para o número indicado. Abra o pedido do M-Pesa no telemóvel e escreva lá o seu PIN (não é aqui no site). Pode demorar até 1 minuto.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Passo de anexar o comprovativo, embutido no próprio checkout (sem popup) —
 * mesmo padrão de `ComprovativoInline` em `cotacao/[id]/pagamento/page.tsx`.
 * Só depois de o envio ter sucesso é que aparece o botão para entrar no
 * painel — nunca antes (confirmado com o utilizador). Serve as compras do
 * carrinho (comprovativo do checkout_sessions) e as encomendas VisualDesign
 * (anexo da encomenda, marcado com a fase) — muda só o `uploadUrl`.
 */
function ManualPaymentUploadStep({
  uploadUrl,
  uploadFields,
  metodoPagamento,
  valorMt,
  referencia,
  jaEnviado = false,
  motivoNovoComprovativo,
  avisoTeste,
  successMessage = 'Aguarde a aprovação da nossa equipa para aceder à gestão do(s) seu(s) produto(s).',
  textoContinuar = 'Aceder ao Painel',
  onSent,
  secondaryActions,
  onContinue,
}: {
  uploadUrl: string;
  uploadFields?: Record<string, string>;
  metodoPagamento: 'mpesa' | 'transferencia';
  valorMt?: number;
  /** Referência do pedido, a escrever na transferência/M-Pesa para a equipa reconhecer o pagamento. */
  referencia?: string;
  /** O comprovativo já foi enviado (o cliente voltou a abrir o pedido): mostra só o estado. */
  jaEnviado?: boolean;
  /** A equipa pediu outro comprovativo: o motivo. */
  motivoNovoComprovativo?: string | null;
  /** M-Pesa de teste já percorrido: avisa que nada foi deduzido. */
  avisoTeste?: boolean;
  successMessage?: string;
  /** texto do botão depois do envio (quem comprou sem conta ainda não tem painel) */
  textoContinuar?: string;
  /** Depois de o comprovativo seguir com sucesso. */
  onSent?: () => void;
  /** Por baixo do envio, enquanto ainda não foi enviado (ex.: editar/cancelar a encomenda). */
  secondaryActions?: React.ReactNode;
  onContinue: () => Promise<void> | void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(jaEnviado);
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
      for (const [key, value] of Object.entries(uploadFields ?? {})) formData.append(key, value);
      const res = await fetch(uploadUrl, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Não foi possível enviar o comprovativo.');
      setSent(true);
      onSent?.();
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
          <p className="text-sm text-slate-500 dark:text-zinc-400">{successMessage}</p>
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
            {enteringPanel ? 'A entrar...' : textoContinuar}
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
            {valorMt ? (
              <p className="pb-1">Valor a pagar: <span className="font-mono font-bold">{formatMt(valorMt)} MT</span></p>
            ) : null}
            {referencia ? (
              <p className="pb-1">Referência (indique-a no pagamento): <span className="font-mono font-bold">{referencia}</span></p>
            ) : null}
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

          {motivoNovoComprovativo && (
            <div className="bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-lg p-4 text-sm text-rose-800 dark:text-rose-300">
              A equipa pediu outro comprovativo: {motivoNovoComprovativo}
            </div>
          )}

          {avisoTeste && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-lg p-4 text-sm text-slate-700 dark:text-zinc-300 space-y-1">
              <p>Estamos em ambiente de teste: o valor não foi deduzido da sua conta M-Pesa. Para concluir, faça o pagamento e anexe o comprovativo.</p>
              <p>Em caso de dúvida, contacte o suporte: <span className="font-mono font-bold">{SUPORTE_TELEFONES}</span></p>
            </div>
          )}

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

          {secondaryActions}
        </>
      )}
    </div>
  );
}
