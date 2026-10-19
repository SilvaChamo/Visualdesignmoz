'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRightLeft, Loader2, CheckCircle2, XCircle, Clock, HelpCircle, Server, Lock, Timer, ArrowRight, ChevronRight } from 'lucide-react';
import { panelBtnPrimary, panelBtnSecondary, panelField } from '@/lib/panel-ui';
import { Spinner } from '@/components/ui/spinner';
import { useCart } from '@/contexts/CartContext';
import { useCurrency } from '@/contexts/CurrencyContext';
import { readListCache, writeListCache } from '@/lib/panel-list-cache';

const TRANSFER_CACHE_KEY = 'vd_domain_transfer_requests_v1';

type TransferOrder = {
  orderId: string;
  costMt: number;
  paidMt: number;
  metodoPagamento: string;
  status: 'pending' | 'paid' | 'failed';
};

type TransferRequest = {
  id: string;
  domain_name: string;
  status: 'pending' | 'submitted' | 'waiting' | 'locked' | 'completed' | 'rejected' | 'failed';
  error_message?: string | null;
  created_at: string;
  order?: TransferOrder | null;
};

const METODO_LABEL: Record<string, string> = { mpesa: 'M-Pesa', emola: 'e-Mola', transferencia: 'Transferência', stripe: 'Cartão' };

/** Label e estilo do badge na coluna "Status" de Pedidos Abertos */
const ORDER_STATUS_META: Record<TransferOrder['status'], { label: string; className: string; dotColor: string }> = {
  pending: { label: 'A aguardar pagamento', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', dotColor: 'bg-amber-500' },
  paid:    { label: 'Processando',           className: 'bg-teal-100  text-teal-700  dark:bg-teal-900/40  dark:text-teal-300',  dotColor: 'bg-teal-500'  },
  failed:  { label: 'Pagamento rejeitado',   className: 'bg-red-100   text-red-700   dark:bg-red-900/40   dark:text-red-300',   dotColor: 'bg-red-500'   },
};

/** "Processando" (order.status) só descreve o pagamento — quando a
 * transferência em si já foi confirmada concluída pela Dynadot
 * (r.status === 'completed'), este badge sobrepõe-se para não ficar preso em
 * "Processando" para sempre depois de já estar mesmo terminado. */
const CONCLUDED_ORDER_META = {
  label: 'Concluído',
  className: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  dotColor: 'bg-green-500',
};

/**
 * A ICANN dá ao registador anterior até 5-7 dias para responder a um pedido
 * de transferência (ver TRANSFER_STEPS abaixo) — se não fizer nada, conta
 * como aprovação silenciosa. Usamos 7 dias (o pior caso) para a barra de
 * progresso e a data prevista não prometerem mais rápido do que a realidade.
 */
const ESTIMATED_TRANSFER_DAYS = 7;

function getTransferProgress(createdAt: string) {
  const start = new Date(createdAt).getTime();
  const totalMs = ESTIMATED_TRANSFER_DAYS * 24 * 60 * 60 * 1000;
  const elapsedMs = Date.now() - start;
  const percent = Math.min(100, Math.max(5, Math.round((elapsedMs / totalMs) * 100)));
  const eta = new Date(start + totalMs);
  return { percent, eta };
}

const STATUS_META: Record<
  TransferRequest['status'],
  { label: string; subtitle?: string; icon: typeof Clock; className: string; pulse?: boolean }
> = {
  pending: { label: 'A processar pagamento', icon: Clock, className: 'text-gray-500' },
  submitted: {
    label: 'Transferência em curso, aguarde até finalizar!',
    subtitle: 'Processo a decorrer — pode demorar alguns dias. Vai receber um aviso assim que terminar.',
    icon: Clock,
    className: 'text-amber-600',
    pulse: true,
  },
  waiting: {
    label: 'Transferência em curso, aguarde até finalizar!',
    subtitle: 'Processo a decorrer — pode demorar alguns dias. Vai receber um aviso assim que terminar.',
    icon: Clock,
    className: 'text-amber-600',
    pulse: true,
  },
  locked: {
    label: 'Bloqueada — precisa da sua acção',
    subtitle: 'O domínio está "bloqueado" (locked) no registador antigo, o que impede a transferência de avançar. Entre na conta desse registador (ou peça ao suporte dele) e desactive o bloqueio de transferência ("unlock"). Assim que desbloquear, o processo continua sozinho.',
    icon: Lock,
    className: 'text-orange-600',
  },
  completed: { label: 'Transferência concluída', icon: CheckCircle2, className: 'text-green-600' },
  rejected: { label: 'Rejeitada pelo registador anterior', icon: XCircle, className: 'text-red-600' },
  failed: { label: 'Falhou ao submeter — contacte o suporte', icon: XCircle, className: 'text-red-600' },
};

const TRANSFER_STEPS = [
  'Pede-se a transferência com o código de autorização (EPP) do registador actual.',
  'O registador anterior recebe o pedido e tem de aprovar — ou passar 5 a 7 dias sem responder, o que conta como aprovação silenciosa.',
  'Assim que aprovado, o domínio passa a ser gerido por nós e fica logo activo na sua conta.',
];

type DnsSnapshot = { domain: string; nameservers: string[]; mailExchangers: string[] } | null;

function DnsSnapshotCard({ domain }: { domain: string }) {
  const [snapshot, setSnapshot] = useState<DnsSnapshot>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/domain-transfer/dns-snapshot?domain=${encodeURIComponent(domain)}`, { credentials: 'include' })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.success) setSnapshot(data);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [domain]);

  return (
    <div className="rounded border border-gray-200 p-3 dark:border-zinc-800">
      <p className="mb-2 truncate font-mono text-xs font-bold text-gray-900 dark:text-zinc-100">{domain}</p>
      {loading ? (
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <Loader2 className="h-3 w-3 animate-spin" /> A consultar DNS...
        </div>
      ) : !snapshot || (snapshot.nameservers.length === 0 && snapshot.mailExchangers.length === 0) ? (
        <p className="text-xs text-gray-400 dark:text-zinc-500">Sem resposta de DNS neste momento.</p>
      ) : (
        <div className="space-y-1.5 text-[11px] text-gray-600 dark:text-zinc-400">
          {snapshot.nameservers.length > 0 && (
            <div>
              <p className="font-bold uppercase tracking-tight text-gray-500 dark:text-zinc-500">Nameservers</p>
              {snapshot.nameservers.map((ns) => (
                <p key={ns} className="truncate font-mono">{ns}</p>
              ))}
            </div>
          )}
          {snapshot.mailExchangers.length > 0 && (
            <div>
              <p className="font-bold uppercase tracking-tight text-gray-500 dark:text-zinc-500">Email (MX)</p>
              {snapshot.mailExchangers.map((mx) => (
                <p key={mx} className="truncate font-mono">{mx}</p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Componente: Contador regressivo em tempo real ─────────────────────────
function calcCountdown(etaMs: number) {
  const diff = Math.max(0, etaMs - Date.now());
  const days    = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours   = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  return { days, hours, minutes, seconds, done: diff === 0 };
}

function useCountdown(etaMs: number) {
  const [time, setTime] = useState(() => calcCountdown(etaMs));

  useEffect(() => {
    // Actualizar imediatamente ao montar (evita mostrar valor stale)
    setTime(calcCountdown(etaMs));
    const id = setInterval(() => setTime(calcCountdown(etaMs)), 1000);
    return () => clearInterval(id);
  }, [etaMs]);

  return time;
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="tabular-nums text-2xl font-black leading-none tracking-tight text-gray-900 dark:text-zinc-100">
        {String(value).padStart(2, '0')}
      </span>
      <span className="mt-0.5 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-zinc-500">
        {label}
      </span>
    </div>
  );
}

function TransferCountdownCard({ request }: { request: { domain_name: string; created_at: string } }) {
  const start  = new Date(request.created_at).getTime();
  const etaMs  = start + ESTIMATED_TRANSFER_DAYS * 24 * 60 * 60 * 1000;
  const eta    = new Date(etaMs);
  const { days, hours, minutes, seconds, done } = useCountdown(etaMs);
  const elapsedMs  = Date.now() - start;
  const totalMs    = ESTIMATED_TRANSFER_DAYS * 24 * 60 * 60 * 1000;
  const percent    = Math.min(100, Math.max(4, Math.round((elapsedMs / totalMs) * 100)));

  return (
    <div className="flex flex-col rounded border border-gray-200 bg-gray-50/60 p-4 dark:border-zinc-800 dark:bg-zinc-800/40">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="font-mono text-sm font-bold text-teal-600 dark:text-teal-400 truncate">
          {request.domain_name}
        </span>
        <span className="shrink-0 rounded border border-teal-400 px-2 py-0.5 font-mono text-xs font-bold text-teal-600 dark:border-teal-600 dark:text-teal-400">
          Em curso
        </span>
      </div>

      <p className="text-xs text-gray-600 dark:text-zinc-300 font-medium mb-3">
        Iniciado, deve ser concluído até{' '}
        <span className="font-bold text-gray-800 dark:text-zinc-100">
          {eta.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
        </span>
      </p>

      {/* Contador de Tempo Restante — este cartão só aparece para pedidos
          ainda não confirmados como concluídos (ver filtro pendingRequests
          mais abaixo); a contagem é só uma ESTIMATIVA nossa (7 dias), não o
          estado real da Dynadot — por isso, mesmo que a estimativa chegue a
          zero, não podemos afirmar "concluída" sem confirmação real: quem
          confirma isso é a verificação automática à Dynadot (a cada ~30 min),
          que só então tira este pedido desta lista. */}
      <div className="my-1 py-2.5 px-3 bg-white dark:bg-zinc-900 rounded border border-gray-200/80 dark:border-zinc-700/80 shadow-xs">
        <div className="text-[10px] uppercase font-bold text-gray-400 mb-1.5 tracking-wider text-center">Tempo Restante de Transferência</div>
        {done ? (
          <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
            <Clock className="h-4 w-4" /> A demorar mais do que o previsto — ainda em curso
          </div>
        ) : (
          <div className="flex items-center justify-center gap-2">
            <CountdownUnit value={days} label="dias" />
            <span className="pb-3 text-base font-black text-gray-300 dark:text-zinc-600">:</span>
            <CountdownUnit value={hours} label="horas" />
            <span className="pb-3 text-base font-black text-gray-300 dark:text-zinc-600">:</span>
            <CountdownUnit value={minutes} label="min" />
            <span className="pb-3 text-base font-black text-gray-300 dark:text-zinc-600">:</span>
            <CountdownUnit value={seconds} label="seg" />
          </div>
        )}
      </div>

      {/* Barra de Progresso */}
      <div className="mt-3 w-full">
        <div className="relative h-2 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-zinc-700">
          <div
            className="h-full rounded-full bg-gradient-to-r from-teal-400 to-teal-500 transition-all duration-1000"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export function DomainTransferSection() {

  const { addItem, setIsCartOpen } = useCart();
  const { formatPrice } = useCurrency();

  const [domain, setDomain] = useState('');
  const [authCode, setAuthCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgOk, setMsgOk] = useState(false);
  const [transferPriceMt, setTransferPriceMt] = useState<number | null>(null);
  const [validatedDomain, setValidatedDomain] = useState('');
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());

  const [requests, setRequests] = useState<TransferRequest[]>(() => readListCache<TransferRequest[]>(TRANSFER_CACHE_KEY) ?? []);
  const [loadingRequests, setLoadingRequests] = useState(() => readListCache<TransferRequest[]>(TRANSFER_CACHE_KEY) === null);
  // Data de início real do pedido, tal como a Dynadot a regista
  // (order_created_date) — por domínio, porque é isso que a Dynadot usa para
  // calcular o prazo dela, e não a data em que a nossa própria tabela criou
  // a linha do pedido.
  const [liveCreatedAt, setLiveCreatedAt] = useState<Record<string, string>>({});

  const loadRequests = async () => {
    try {
      const res = await fetch('/api/domain-transfer', { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setRequests(data.pedidos || []);
        writeListCache(TRANSFER_CACHE_KEY, data.pedidos || []);
      }
    } catch {
      /* lista fica vazia */
    } finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    void loadRequests();
  }, []);

  useEffect(() => {
    const pending = requests.filter((r) => r.status === 'submitted' || r.status === 'waiting' || r.status === 'locked');
    if (pending.length === 0) return;

    const refreshLive = () => {
      Promise.all(
        pending.map((r) =>
          fetch(`/api/domain-transfer/status?domain=${encodeURIComponent(r.domain_name)}`, { credentials: 'include' })
            .then((res) => res.json())
            .then((data) => ({ domain: r.domain_name, data }))
            .catch(() => null),
        ),
      ).then((results) => {
        setLiveCreatedAt((prev) => {
          const next = { ...prev };
          for (const entry of results) {
            if (entry?.data?.success && entry.data.createdAt) next[entry.domain] = entry.data.createdAt;
          }
          return next;
        });
        void loadRequests();
      });
    };

    // Corre logo ao detectar pedidos pendentes — não espera 30s para mostrar
    // a data certa — e depois repete periodicamente.
    refreshLive();
    const interval = setInterval(refreshLive, 30_000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requests.map((r) => r.status).join(',')]);

  const handleValidate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain.trim() || !authCode.trim()) return;
    setLoading(true);
    setMsg('');
    setTransferPriceMt(null);
    try {
      const clean = domain.trim().toLowerCase();
      const res = await fetch('/api/domain-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: clean, tld: '' }),
      });
      const data = await res.json();

      if (data.error) {
        setMsgOk(false);
        setMsg(data.error);
        return;
      }
      if (data.available) {
        setMsgOk(false);
        setMsg('Este domínio está livre — ninguém o possui, por isso não há nada para transferir. Registe-o directamente em vez de transferir.');
        return;
      }
      if (data.alreadyOurs) {
        setMsgOk(false);
        setMsg('Este domínio já está registado connosco — não é preciso transferir.');
        return;
      }

      const pricesRes = await fetch('/api/domain-tld-prices');
      const pricesData = await pricesRes.json();
      const tld = (pricesData.prices || []).find((t: { value: string }) => clean.endsWith(t.value));
      if (!tld) {
        setMsgOk(false);
        setMsg('Não reconhecemos esta extensão de domínio.');
        return;
      }

      const priceMt = Math.round(tld.transfer * 65 * 1.5 * 1.075);
      setTransferPriceMt(priceMt);
      setValidatedDomain(clean);
      setMsgOk(true);
      setMsg(`Domínio ${clean} confirmado como registado noutro lado — pronto para pedir a transferência.`);
    } catch (e: unknown) {
      setMsgOk(false);
      setMsg(e instanceof Error ? e.message : 'Erro ao validar domínio.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = () => {
    if (!validatedDomain || transferPriceMt === null) return;
    addItem({
      id: validatedDomain,
      type: 'domain',
      name: validatedDomain,
      price: transferPriceMt,
      period: 1,
      authCode: authCode.trim(),
    });
    setIsCartOpen(true);
    setDomain('');
    setAuthCode('');
    setTransferPriceMt(null);
    setValidatedDomain('');
    setMsg('');
  };

  const orderedRequests = requests.filter((r) => r.order);

  // Checkbox helpers
  const allSelected = orderedRequests.length > 0 && orderedRequests.every((r) => selectedRows.has(r.id));
  const toggleAll = () => {
    if (allSelected) setSelectedRows(new Set());
    else setSelectedRows(new Set(orderedRequests.map((r) => r.id)));
  };
  const toggleRow = (id: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const pendingRequests = requests.filter((r) => r.status === 'submitted' || r.status === 'waiting' || r.status === 'locked');

  return (
    <div className="w-full gap-5 lg:flex lg:items-start">
      {/* ── Coluna principal ─────────────────────────────────────── */}
      <div className="min-w-0 flex-1 space-y-5">

        {/* Card principal em 2 colunas: Formulário à esquerda, Processo de transferência à direita */}
        <div className="w-full rounded border border-gray-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            
            {/* Coluna Esquerda: Texto + Formulário de transferência */}
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded border border-gray-200 dark:border-zinc-700">
                  <ArrowRightLeft className="h-5 w-5 text-gray-600 dark:text-zinc-400" />
                </div>
                <div className="space-y-1 text-sm text-gray-600 dark:text-zinc-400">
                  <p className="font-semibold text-gray-800 dark:text-zinc-200">Transferência de Domínio</p>
                  <p className="text-xs">Introduza o domínio e o código de autorização (EPP) do registador actual. O domínio permanece activo durante a transferência.</p>
                </div>
              </div>

              <form onSubmit={handleValidate} className="space-y-4 pt-1">
                <div className="grid w-full grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="min-w-0">
                    <label className="mb-1 block text-xs font-bold uppercase text-gray-500 dark:text-zinc-500">Domínio</label>
                    <input
                      value={domain}
                      onChange={(e) => { setDomain(e.target.value); setTransferPriceMt(null); }}
                      placeholder="exemplo.com"
                      className={`${panelField} w-full font-mono`}
                      required
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="mb-1 block text-xs font-bold uppercase text-gray-500 dark:text-zinc-500">
                      Código EPP
                    </label>
                    <input
                      value={authCode}
                      onChange={(e) => { setAuthCode(e.target.value); setTransferPriceMt(null); }}
                      placeholder="Código do registador"
                      className={`${panelField} w-full font-mono`}
                      required
                    />
                  </div>
                </div>

                {msg && (
                  <div
                    className={`rounded border px-4 py-3 text-sm ${
                      msgOk
                        ? 'border-gray-200 bg-gray-50 text-gray-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                        : 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400'
                    }`}
                  >
                    {msg}
                    {msgOk && transferPriceMt !== null && (
                      <p className="mt-1 font-bold">Preço da transferência: {formatPrice(transferPriceMt)}</p>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  {transferPriceMt !== null ? (
                    <button type="button" onClick={handleAddToCart} className={panelBtnPrimary}>
                      <ArrowRightLeft className="h-4 w-4" /> Adicionar ao carrinho — {formatPrice(transferPriceMt)}
                    </button>
                  ) : (
                    <button type="submit" disabled={loading || !domain.trim() || !authCode.trim()} className={panelBtnPrimary}>
                      {loading ? <Spinner className="h-4 w-4" /> : <ArrowRightLeft className="h-4 w-4" />}
                      Validar domínio
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => { setDomain(''); setAuthCode(''); setMsg(''); setTransferPriceMt(null); }}
                    className={panelBtnSecondary}
                  >
                    Limpar
                  </button>
                </div>
              </form>
            </div>

            {/* Coluna Direita: Processo de Transferência & Contador Regressivo */}
            <div className="border-t pt-5 lg:border-t-0 lg:border-l lg:pl-6 lg:pt-0 border-gray-200 dark:border-zinc-700">
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-zinc-400 mb-3 flex items-center gap-1.5">
                <Timer className="h-4 w-4 text-teal-600 dark:text-teal-400" /> Processo de Transferência
              </h4>

              {pendingRequests.length > 0 ? (
                <div className="space-y-3">
                  {pendingRequests.map((req) => (
                    <TransferCountdownCard
                      key={req.id}
                      request={{
                        ...req,
                        created_at: liveCreatedAt[req.domain_name] || req.created_at,
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center rounded border border-dashed border-gray-200 p-6 text-center dark:border-zinc-800 bg-gray-50/40 dark:bg-zinc-800/20">
                  <Clock className="h-8 w-8 text-gray-300 dark:text-zinc-600 mb-2" />
                  <p className="text-xs font-medium text-gray-600 dark:text-zinc-400">
                    Nenhuma transferência em curso no momento.
                  </p>
                  <p className="text-[11px] text-gray-400 dark:text-zinc-500 mt-1">
                    Insira o domínio e código EPP ao lado para iniciar um novo pedido.
                  </p>
                </div>
              )}
            </div>

          </div>

          {/* Banner de Garantia / Confiança do Site (Respeita Tema Claro e Escuro) */}
          <div className="mt-6 -mx-5 -mb-5 bg-gray-50 dark:bg-zinc-800/80 border-t border-gray-200 dark:border-zinc-700 p-3.5 text-gray-700 dark:text-zinc-300 rounded-b">
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-medium">
              <span>Agente de registro credenciado pela <strong className="text-gray-900 dark:text-white font-bold">ICANN</strong></span>
              <span className="text-gray-300 dark:text-zinc-600 font-light hidden sm:inline">|</span>
              <span>Confiado por <strong className="text-gray-900 dark:text-white font-bold">10M+</strong> Clientes</span>
              <span className="text-gray-300 dark:text-zinc-600 font-light hidden sm:inline">|</span>
              <span>Mais de <strong className="text-gray-900 dark:text-white font-bold">8M+</strong> Domínios</span>
              <span className="text-gray-300 dark:text-zinc-600 font-light hidden sm:inline">|</span>
              <span><strong className="text-gray-900 dark:text-white font-bold">Grátis</strong> Privacidade WHOIS</span>
              <span className="text-gray-300 dark:text-zinc-600 font-light hidden sm:inline">|</span>
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-gray-900 dark:text-white">Excellent</span>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <span key={i} className="flex h-3.5 w-3.5 items-center justify-center bg-teal-600 text-[9px] text-white font-black rounded-xs">
                      ★
                    </span>
                  ))}
                </div>
                <span className="font-bold text-gray-900 dark:text-white flex items-center gap-0.5 ml-1">
                  <span className="text-teal-600 dark:text-teal-400">★</span> Trustpilot
                </span>
              </div>
            </div>
          </div>
        </div>

      {orderedRequests.length > 0 && (
          <div className="w-full overflow-hidden rounded border border-gray-200 bg-white dark:border-zinc-700 dark:bg-zinc-900">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3.5 dark:border-zinc-700">
              <h3 className="text-sm font-bold text-gray-800 dark:text-zinc-100">Pedidos Abertos</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50 text-xs font-bold uppercase tracking-wide text-gray-500 dark:border-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-400">
                    <th className="w-10 px-4 py-3 text-left">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        className="h-3.5 w-3.5 cursor-pointer accent-teal-600"
                        aria-label="Seleccionar todos"
                      />
                    </th>
                    <th className="px-4 py-3 text-left">Itens</th>
                    <th className="whitespace-nowrap px-4 py-3 text-left">ID do Pedido</th>
                    <th className="whitespace-nowrap px-4 py-3 text-left">Data de Envio</th>
                    <th className="whitespace-nowrap px-4 py-3 text-left">Custo</th>
                    <th className="whitespace-nowrap px-4 py-3 text-left">Pago</th>
                    <th className="whitespace-nowrap px-4 py-3 text-left">
                      Status{' '}
                      <span
                        title="Estado do pagamento do pedido de transferência"
                        className="inline-flex h-3.5 w-3.5 cursor-help items-center justify-center rounded-full border border-gray-300 text-[9px] text-gray-400 align-middle"
                      >
                        ?
                      </span>
                    </th>
                    <th className="whitespace-nowrap px-4 py-3 text-left">Tipo de Pagamento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                  {orderedRequests.map((r) => {
                    const order = r.order as TransferOrder;
                    const meta = r.status === 'completed' ? CONCLUDED_ORDER_META : ORDER_STATUS_META[order.status];
                    return (
                      <tr
                        key={r.id}
                        className={`transition-colors ${selectedRows.has(r.id) ? 'bg-teal-50/60 dark:bg-teal-950/20' : 'hover:bg-gray-50/70 dark:hover:bg-zinc-800/40'}`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedRows.has(r.id)}
                            onChange={() => toggleRow(r.id)}
                            className="h-3.5 w-3.5 cursor-pointer accent-teal-600"
                            aria-label={`Seleccionar ${r.domain_name}`}
                          />
                        </td>
                        <td className="px-4 py-3 font-mono font-medium text-teal-600 dark:text-teal-400">
                          {r.domain_name}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-500 dark:text-zinc-400">{order.orderId}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-500 dark:text-zinc-400">
                          {new Date(r.created_at).toLocaleDateString('pt-PT')}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-semibold text-gray-900 dark:text-white">{formatPrice(order.costMt)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-500 dark:text-zinc-400">{formatPrice(order.paidMt)}</td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${meta.className}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${meta.dotColor}`} />
                            {meta.label}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-gray-500 dark:text-zinc-400">
                          {METODO_LABEL[order.metodoPagamento] || order.metodoPagamento}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Secção Informativa: Antes de transferir seu domínio (Tema Claro e Escuro do Site) ── */}
        <div className="w-full rounded border border-gray-200 bg-white p-6 lg:p-8 text-gray-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 my-2">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            {/* Coluna Esquerda: Ilustração, Título, Descrição & Botão */}
            <div className="lg:col-span-5 space-y-4">
              {/* Ilustração das esferas sobrepostas */}
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 rounded-full bg-gradient-to-tr from-black via-red-700 to-red-500 shadow-md shadow-red-500/20" />
                <div className="flex h-6 w-6 items-center justify-center">
                  <ArrowRight className="h-4 w-4 text-gray-400 dark:text-zinc-400" />
                </div>
                <div className="h-14 w-14 rounded-full border-2 border-red-600 bg-transparent" />
              </div>

              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-zinc-100 tracking-tight leading-snug">
                Antes de transferir seu domínio
              </h3>

              <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed font-normal">
                Antes de iniciar sua <span className="underline font-semibold text-gray-900 dark:text-zinc-200">transferência de domínio</span>, reserve um momento rápido para garantir que tudo esteja pronto. Um início tranquilo significa que sua transferência será concluída mais rapidamente.
              </p>

              <div className="pt-2">
                <Link
                  href="/ajuda/dominios/transferir"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${panelBtnPrimary} text-sm font-semibold inline-flex items-center gap-2`}
                >
                  Veja nosso guia de como transferir um domínio
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </div>
            </div>

            {/* Coluna Direita: Lista de requisitos e dicas */}
            <div className="lg:col-span-7 space-y-6">
              
              {/* Item 1 */}
              <div className="flex items-start gap-3.5">
                <CheckCircle2 className="h-5 w-5 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-base font-semibold text-gray-900 dark:text-zinc-100 mb-1">Sem mudanças recentes</h4>
                  <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed">
                    Seu domínio não pode ter sido registrado, transferido ou atualizado nos últimos 60 dias. Recomendamos iniciar sua transferência pelo menos 2 semanas antes do vencimento.
                  </p>
                </div>
              </div>

              {/* Item 2 */}
              <div className="flex items-start gap-3.5">
                <CheckCircle2 className="h-5 w-5 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-base font-semibold text-gray-900 dark:text-zinc-100 mb-1">Email Whois atualizado</h4>
                  <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed">
                    Certifique-se de que seu endereço de e-mail Whois está correto. É para lá que o link de aprovação da transferência será enviado.
                  </p>
                </div>
              </div>

              {/* Item 3 */}
              <div className="flex items-start gap-3.5">
                <CheckCircle2 className="h-5 w-5 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-base font-semibold text-gray-900 dark:text-zinc-100 mb-1">Renovação de 1 ano incluída</h4>
                  <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed">
                    Quando a transferência for concluída, você estenderá automaticamente seu registro por 1 ano (algumas exceções de TLD se aplicam).
                  </p>
                </div>
              </div>

              {/* Item 4 */}
              <div className="flex items-start gap-3.5">
                <CheckCircle2 className="h-5 w-5 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-base font-semibold text-gray-900 dark:text-zinc-100 mb-1">Dica rápida para transferência</h4>
                  <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed">
                    Se seu domínio expirou recentemente, talvez ainda seja possível transferi-lo após renová-lo no seu agente de registros atual.
                  </p>
                </div>
              </div>

            </div>

          </div>
        </div>

      </div>

      <div className="mt-5 w-full shrink-0 space-y-5 lg:mt-0 lg:w-[242px]">
        <div className="rounded border border-gray-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase text-gray-500 dark:text-zinc-500">
            <HelpCircle className="h-3.5 w-3.5" /> Como funciona
          </div>
          <ol className="space-y-2 text-[11px] text-gray-600 dark:text-zinc-400">
            {TRANSFER_STEPS.map((step, i) => (
              <li key={step} className="flex gap-1.5">
                <span className="shrink-0 font-bold text-gray-400 dark:text-zinc-600">{i + 1}.</span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        {pendingRequests.length > 0 && (
          <div className="rounded border border-gray-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-900">
            <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase text-gray-500 dark:text-zinc-500">
              <Server className="h-3.5 w-3.5" /> DNS actual (ainda no registador antigo)
            </div>
            <div className="space-y-2">
              {pendingRequests.map((r) => (
                <DnsSnapshotCard key={r.id} domain={r.domain_name} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
