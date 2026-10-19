'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  RefreshCw, Building2, Phone, Mail, Calendar, ChevronDown, History,
  Inbox, Clock, Factory, PackageCheck, XCircle, CheckCircle2, MessageCircle, Check, Ban, Pencil, AlertTriangle,
} from 'lucide-react'
import {
  panelBtnSecondary, panelField,
  panelTabBar, panelTabBtn, panelTabBtnActive, panelTabBtnInactive, panelSectionCard,
} from '@/lib/panel-ui'
import { formatMt, BRANDS } from '@/lib/pricing-catalog'
import { statusMeta, statusBucket, type StatusBucket } from '@/lib/quotation-status-labels'
import { groupIntoBatches, groupBatchesByBrand, filterBatchesByBucket, type BatchItem, type QuotationBatch } from '@/lib/quotation-batch'
import { useBatchNumeros, displayNumero } from '@/lib/use-batch-numeros'
import { QuotationHistoryTimeline } from '@/components/quotations/QuotationHistoryTimeline'
import { QuotationMessagesThread } from '@/components/quotations/QuotationMessagesThread'
import { QuotationAttachmentsPanel } from '@/components/quotations/QuotationAttachmentsPanel'
import { QuotationBatchExpenses } from '@/components/quotations/QuotationBatchExpenses'
import { useAdminSectionChrome } from '@/components/admin/AdminSectionChrome'
import { Spinner } from '@/components/ui/spinner'

interface QuotationRequest extends BatchItem {
  empresa: string
  nif: string | null
  responsavel: string
  cargo: string | null
  telefone: string
  email: string
  categoria_label: string
  produto: string
  // Marca permanente (nunca muda) — ao contrário de sob_consulta, que passa a
  // false assim que o valor é definido. Usado só para decidir se o lápis de
  // reeditar o valor continua disponível depois de precificado (ver Pencil,
  // acima) — a equipa só pode reeditar preços de itens que nasceram "Sob
  // Consulta", nunca o preço de um item de catálogo com valor fixo.
  sob_consulta_original: boolean
  preco_unitario_mt: number
  quantidade: number
  data_limite_entrega: string
  metodo_pagamento: string | null
  remanescente_metodo_pagamento: string | null
  notas: string | null
  rejection_reason: string | null
  delivered_at: string | null
}

// 'payment_selected' não é uma opção manual — é indistinguível de 'pending' do ponto de
// vista do admin (nada por fazer até o pagamento confirmar), por isso mostra-se/edita-se
// sempre como "Pendente" em vez de duplicar um estado redundante.
const STATUS_OPTIONS: { value: QuotationRequest['status']; label: string; badge: string }[] = [
  { value: 'pending', label: 'Pendente', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400' },
  { value: 'approved', label: 'Em Produção', badge: 'bg-teal-100 text-teal-700 dark:bg-teal-950/30 dark:text-teal-400' },
  { value: 'delivered', label: 'Concluída', badge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/30 dark:text-indigo-400' },
  { value: 'rejected', label: 'Rejeitada', badge: 'bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400' },
  { value: 'done', label: 'Entregue', badge: 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400' },
  { value: 'cancelled', label: 'Cancelada', badge: 'bg-gray-200 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400' },
]

// 'cancelled' fica de fora — só o cliente pode cancelar (ver botão no painel
// dele); a equipa só tem a opção de rejeitar quando a negociação não avança,
// ou marcar "Entregue" directamente neste mesmo dropdown, item a item.
const SELECTABLE_STATUS_OPTIONS = STATUS_OPTIONS.filter((s) => s.value !== 'cancelled')

const displayStatusValue = (status: QuotationRequest['status']) => (status === 'payment_selected' ? 'pending' : status)

const DELIVERED_BUCKET_DAYS = 7

function daysSinceDelivered(deliveredAt: string | null): number | null {
  if (!deliveredAt) return null
  return Math.floor((Date.now() - new Date(deliveredAt).getTime()) / 86_400_000)
}

/** Momento em que a encomenda (todos os itens) ficou entregue — o mais recente entre os itens. */
function batchDeliveredAt(batch: QuotationBatch<QuotationRequest>): string | null {
  const dates = batch.items.map((i) => i.delivered_at).filter((d): d is string => Boolean(d))
  if (dates.length === 0) return null
  return dates.reduce((max, d) => (d > max ? d : max))
}

const metodoLabel = (m: string | null) => (m === 'mpesa' ? 'M-Pesa' : m === 'transferencia' ? 'Transferência' : '—')

/**
 * Contador decrescente até à data limite de entrega, com cor de alerta relativa ao
 * tempo total do pedido (criação -> prazo): verde com folga, laranja a meio do prazo,
 * vermelho perto do fim (ou já atrasado).
 */
function deliveryCountdown(dateStr: string, createdAtStr: string): { label: string; className: string } {
  const deadline = new Date(dateStr)
  deadline.setHours(23, 59, 59, 999)
  const diffDays = Math.ceil((deadline.getTime() - Date.now()) / 86_400_000)
  if (diffDays < 0) return { label: `${Math.abs(diffDays)}d em atraso`, className: 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400' }
  if (diffDays === 0) return { label: 'Entrega hoje', className: 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400' }

  const created = new Date(createdAtStr)
  const totalDays = Math.max(1, Math.ceil((deadline.getTime() - created.getTime()) / 86_400_000))
  const remainingRatio = diffDays / totalDays
  const label = `Faltam ${diffDays}d`
  if (remainingRatio <= 0.25) return { label, className: 'bg-red-100 text-red-700 dark:bg-red-950/30 dark:text-red-400' }
  if (remainingRatio <= 0.5) return { label, className: 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400' }
  return { label, className: 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400' }
}

// Ordem = fluxo real da encomenda: Pendentes -> Em produção -> Concluídas (pronta,
// falta o cliente pagar o remanescente de 30%) -> Entregues (tudo terminado, incl.
// pagamento). Rejeitadas (a equipa recusou) e Canceladas (o cliente desistiu)
// ficam fora do fluxo principal, por isso vão no fim — e são baldes distintos,
// para não misturar as duas origens diferentes.
const BUCKET_ITEMS: { value: StatusBucket; label: string; icon: React.ElementType }[] = [
  { value: 'pending', label: 'Pendentes', icon: Clock },
  { value: 'approved', label: 'Em produção', icon: Factory },
  { value: 'delivered', label: 'Concluídas', icon: PackageCheck },
  { value: 'done', label: 'Entregues', icon: CheckCircle2 },
  { value: 'rejected', label: 'Rejeitadas', icon: Ban },
  { value: 'cancelled', label: 'Canceladas', icon: XCircle },
]

const CATEGORY_LABELS = [...BRANDS.map((b) => b.label), 'Outros']

type NavMode = 'categoria' | 'bucket' | 'historico'

// Cache rápida (sessionStorage) para a lista aparecer junto com a barra lateral em vez de
// esperar pela ida ao servidor a cada visita — a mesma abordagem já usada noutras secções do
// painel (Pacotes, Contas). Limpa automaticamente no logout (prefixo vd_panel_).
const COTACOES_CACHE_KEY = 'vd_panel_cotacoes_v1'

function readCotacoesCache(): QuotationRequest[] | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(COTACOES_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : null
  } catch {
    return null
  }
}

function writeCotacoesCache(data: QuotationRequest[]) {
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(COTACOES_CACHE_KEY, JSON.stringify(data))
  } catch {
    /* quota */
  }
}

export function CotacoesSection() {
  const [cotacoes, setCotacoes] = useState<QuotationRequest[]>(() => readCotacoesCache() ?? [])
  const [loading, setLoading] = useState(() => readCotacoesCache() === null)
  const [navMode, setNavMode] = useState<NavMode>('categoria')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [activeBucket, setActiveBucket] = useState<StatusBucket>('pending')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null)
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null)
  const [unreadByBatch, setUnreadByBatch] = useState<Record<string, number>>({})
  // Cards cuja bolinha de mensagens já foi vista nesta sessão (ao abrir o chat)
  // — some de imediato, sem esperar por um refetch da lista inteira.
  const [dismissedUnread, setDismissedUnread] = useState<Set<string>>(new Set())
  const numeros = useBatchNumeros()

  // expandedBatchId é um único estado partilhado por todas as vistas — sem
  // isto, uma encomenda aberta em "Recebidas" ou num balde continuava aberta
  // "por arrasto" ao mudar para o Histórico (a mesma encomenda pode existir
  // em ambas as vistas). Mudar de vista fecha sempre tudo outra vez.
  useEffect(() => {
    setExpandedBatchId(null)
    setExpandedCompany(null)
  }, [navMode, activeCategory, activeBucket])

  // A cache (sessionStorage) só ficava sincronizada quando a lista inteira
  // recarregava — qualquer alteração local (ex.: definir o valor de um item
  // "Sob Consulta") actualizava o estado mas não a cache, por isso a próxima
  // entrada na encomenda mostrava por instantes o valor antigo guardado.
  // Manter a cache sempre em linha com o estado ao vivo resolve isso de vez.
  useEffect(() => {
    writeCotacoesCache(cotacoes)
  }, [cotacoes])

  const fetchCotacoes = useCallback(async (opts?: { background?: boolean }) => {
    if (!opts?.background) setLoading(true)
    try {
      const res = await fetch('/api/admin/cotacoes')
      const data = await res.json()
      if (data.success) {
        setCotacoes(data.cotacoes)
        setUnreadByBatch(data.unreadByBatch || {})
      }
    } catch (error) {
      console.error('Erro ao carregar cotações:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCotacoes({ background: readCotacoesCache() !== null })
  }, [fetchCotacoes])

  const { setChrome } = useAdminSectionChrome()
  useEffect(() => {
    setChrome({
      toolbar: (
        <button className={panelBtnSecondary} onClick={() => fetchCotacoes()} disabled={loading}>
          {loading ? <Spinner className="w-4 h-4" /> : <RefreshCw className="w-4 h-4" />}
          <span>Actualizar</span>
        </button>
      ),
    })
    return () => setChrome(null)
  }, [loading, fetchCotacoes, setChrome])

  // Pagos (qualquer estado além de "pending" = aguarda pagamento) sobem para o
  // topo da lista — sort estável, mantém a ordem por data dentro de cada grupo.
  const batches = useMemo(() => {
    const grouped = groupIntoBatches(cotacoes)
    return [...grouped].sort((a, b) => {
      const aPaid = a.status !== 'pending'
      const bPaid = b.status !== 'pending'
      if (aPaid === bPaid) return 0
      return aPaid ? -1 : 1
    })
  }, [cotacoes])
  // "Recebidas"/categorias só mostram o que ainda precisa de triagem (pendente,
  // por aprovar/rejeitar) — assim que uma encomenda é aprovada ("Em produção"),
  // rejeitada, entregue ou concluída, já foi tramitada e sai daqui, só continua
  // visível no balde correspondente (Em produção/Rejeitadas/Entregues/Concluídas).
  const activeBatches = useMemo(() => batches.filter((b) => statusBucket(b.status) === 'pending'), [batches])
  const categoryGroups = useMemo(() => groupBatchesByBrand(activeBatches), [activeBatches])

  // O balde "Entregues" só mostra o que foi entregue há até DELIVERED_BUCKET_DAYS —
  // depois disso passa a existir só no Histórico da equipa (arquivo permanente).
  const bucketBatches = useMemo(() => {
    const map = {} as Record<StatusBucket, QuotationBatch<QuotationRequest>[]>
    for (const b of BUCKET_ITEMS) {
      let list = filterBatchesByBucket(batches, b.value)
      if (b.value === 'done') {
        list = list.filter((batch) => {
          const days = daysSinceDelivered(batchDeliveredAt(batch))
          return days === null || days <= DELIVERED_BUCKET_DAYS
        })
      }
      map[b.value] = list
    }
    return map
  }, [batches])
  const bucketCounts = useMemo(() => {
    const counts: Record<StatusBucket, number> = { pending: 0, approved: 0, delivered: 0, rejected: 0, cancelled: 0, done: 0 }
    for (const b of BUCKET_ITEMS) counts[b.value] = bucketBatches[b.value].length
    return counts
  }, [bucketBatches])

  // Histórico da equipa — um card por empresa com quem já trabalhámos (nº de
  // encomendas, data da primeira encomenda, data da última entrega), que abre para
  // mostrar as próprias encomendas já entregues. Arquivo permanente, ao contrário do
  // balde "Entregues" (só 7 dias) — e separado da aba "Histórico" de cada encomenda
  // (QuotationHistoryTimeline), que continua a mostrar o registo de mudanças de estado.
  const deliveredByCompany = useMemo(() => {
    const delivered = filterBatchesByBucket(batches, 'done')
    const byCompany = new Map<string, QuotationBatch<QuotationRequest>[]>()
    for (const b of delivered) {
      const company = b.primaryItem.empresa
      const list = byCompany.get(company) ?? []
      list.push(b)
      byCompany.set(company, list)
    }
    return [...byCompany.entries()]
      .map(([company, companyBatches]) => {
        const allCompanyBatches = batches.filter((b) => b.primaryItem.empresa === company)
        const firstOrderAt = allCompanyBatches.reduce((min, b) => (b.createdAt < min ? b.createdAt : min), allCompanyBatches[0].createdAt)
        const lastDeliveryAt = companyBatches.reduce((max: string | null, b) => {
          const d = batchDeliveredAt(b) ?? b.primaryItem.data_limite_entrega
          return !max || d > max ? d : max
        }, null as string | null)
        return { company, batches: companyBatches, orderCount: companyBatches.length, firstOrderAt, lastDeliveryAt }
      })
      .sort((a, b) => a.company.localeCompare(b.company, 'pt'))
  }, [batches])

  // "Recebidas" (sem categoria escolhida) mostra tudo numa lista só — nunca
  // stacka todas as categorias ao mesmo tempo, porque isso repetia a mesma
  // encomenda mista (ex.: cartões + webdesign) em várias secções ao mesmo
  // tempo. Só ao escolher uma categoria específica é que filtra.
  const visibleGroups = useMemo(() => {
    if (navMode === 'bucket') {
      return [{ label: null as string | null, batches: bucketBatches[activeBucket] }]
    }
    if (activeCategory === null) return [{ label: null as string | null, batches: activeBatches }]
    return categoryGroups.filter((g) => g.label === activeCategory).map((g) => ({ label: null as string | null, batches: g.batches }))
  }, [navMode, activeBucket, activeCategory, activeBatches, categoryGroups, bucketBatches])

  const updateStatus = async (itemId: string, status: QuotationRequest['status']) => {
    let rejectionReason: string | null = null
    if (status === 'rejected') {
      rejectionReason = window.prompt('Motivo da rejeição (enviado ao cliente por email):', '')
      if (rejectionReason === null) return
    }

    setUpdatingId(itemId)
    try {
      const res = await fetch('/api/admin/cotacoes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: itemId, status, rejectionReason }),
      })
      const data = await res.json()
      if (data.success) {
        setCotacoes((prev) => prev.map((c) => (c.id === itemId ? { ...c, status, rejection_reason: rejectionReason } : c)))
      }
    } catch (error) {
      console.error('Erro ao actualizar cotação:', error)
    } finally {
      setUpdatingId(null)
    }
  }

  // Define o valor final de um item submetido como "Sob Consulta" — usado
  // pelo admin depois de fechar o orçamento com o cliente por fora. O
  // servidor recalcula o total e avisa o cliente por email (ver
  // notifyQuoteClientPriceDefined); o painel dele já lê o valor novo assim
  // que recarregar, sem mais nenhuma acção aqui.
  const setPrecoItem = async (itemId: string, precoUnitarioMt: number) => {
    setUpdatingId(itemId)
    try {
      const res = await fetch('/api/admin/cotacoes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: itemId, precoUnitarioMt }),
      })
      const data = await res.json()
      if (data.success) {
        setCotacoes((prev) => prev.map((c) => (c.id === itemId
          ? { ...c, preco_unitario_mt: data.cotacao.preco_unitario_mt, total_mt: data.cotacao.total_mt, sob_consulta: false }
          : c)))
      } else {
        window.alert(data.error || 'Não foi possível definir o valor.')
      }
    } catch (error) {
      console.error('Erro ao definir valor:', error)
    } finally {
      setUpdatingId(null)
    }
  }

  const updateDeliveryDate = async (batchId: string, dataLimiteEntrega: string) => {
    try {
      const res = await fetch('/api/admin/cotacoes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchId, dataLimiteEntrega }),
      })
      const data = await res.json()
      if (data.success) {
        setCotacoes((prev) => prev.map((c) => (c.batch_id === batchId ? { ...c, data_limite_entrega: dataLimiteEntrega } : c)))
      }
    } catch (error) {
      console.error('Erro ao actualizar prazo de entrega:', error)
    }
  }

  const navBtnClass = (active: boolean) =>
    `w-full flex items-center gap-2 px-2.5 py-2 rounded border-l-2 text-sm font-medium transition-colors text-left ${
      active
        ? 'border-red-600 bg-red-50 text-red-600 dark:border-red-500 dark:bg-red-950/20 dark:text-red-400'
        : 'border-transparent text-gray-600 hover:bg-gray-50 dark:text-zinc-400 dark:hover:bg-zinc-800/50'
    }`

  return (
    <div>
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-5 items-start">
        <nav className="sticky top-0 z-10 w-full shrink-0 space-y-0.5 overflow-y-auto border-b border-gray-200 bg-white p-3 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 lg:h-[calc(100vh-76px)] lg:w-[220px] lg:border-b-0 lg:border-r lg:rounded-br">
          <button
            type="button"
            onClick={() => { setNavMode('categoria'); setActiveCategory(null) }}
            className={navBtnClass(navMode === 'categoria')}
          >
            <Inbox className="w-4 h-4 shrink-0" />
            <span className="flex-1 text-left">Recebidas</span>
          </button>

          {BUCKET_ITEMS.map((b) => {
            const Icon = b.icon
            return (
              <button
                key={b.value}
                type="button"
                onClick={() => { setNavMode('bucket'); setActiveBucket(b.value) }}
                className={navBtnClass(navMode === 'bucket' && activeBucket === b.value)}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="flex-1">{b.label}</span>
                <span className="text-xs text-gray-400 dark:text-zinc-500">{bucketCounts[b.value]}</span>
              </button>
            )
          })}

          <button
            type="button"
            onClick={() => setNavMode('historico')}
            className={navBtnClass(navMode === 'historico')}
          >
            <History className="w-4 h-4 shrink-0" /> Histórico
          </button>
        </nav>

        <div className={`min-w-0 flex-1 w-full ${navMode === 'categoria' ? '' : 'mt-4 lg:mt-5'}`}>
          {navMode === 'categoria' && (
            <div className="mb-4 w-full overflow-x-auto bg-white shadow-sm dark:bg-zinc-900">
              <div className="flex flex-nowrap min-w-max">
                {[{ id: null as string | null, label: 'Todas' }, ...CATEGORY_LABELS.map((label) => ({ id: label, label }))].map((tab) => {
                  const isActive = activeCategory === tab.id
                  return (
                    <button
                      key={tab.label}
                      type="button"
                      onClick={() => setActiveCategory(tab.id)}
                      className={`group relative overflow-hidden px-4 py-3 text-sm font-bold whitespace-nowrap transition-colors ${
                        isActive
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-gray-600 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400'
                      }`}
                    >
                      <span
                        className={`inline-block transition-transform duration-300 ${
                          isActive ? 'translate-x-1.5' : 'group-hover:translate-x-1.5'
                        }`}
                      >
                        {tab.label}
                      </span>
                      <span
                        className={`absolute inset-x-0 bottom-0 h-0.5 bg-red-600 transition-transform duration-300 dark:bg-red-500 ${
                          isActive ? 'translate-x-0' : '-translate-x-full group-hover:translate-x-0'
                        }`}
                      />
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          {navMode === 'historico' ? (
            loading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-400 dark:text-zinc-500"><Spinner /> A carregar encomendas...</div>
            ) : deliveredByCompany.length === 0 ? (
              <div className={`${panelSectionCard} p-8 text-center text-sm text-gray-500 dark:text-zinc-400`}>
                Ainda não há encomendas entregues.
              </div>
            ) : (
              <div className="space-y-3">
                {deliveredByCompany.map(({ company, batches: companyBatches, orderCount, firstOrderAt, lastDeliveryAt }) => {
                  const isOpen = expandedCompany === company
                  return (
                    <div key={company} className={panelSectionCard}>
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={() => setExpandedCompany(isOpen ? null : company)}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedCompany(isOpen ? null : company) } }}
                        className="flex w-full items-center gap-3 p-4 text-left cursor-pointer"
                      >
                        <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-bold text-gray-900 dark:text-white">{company}</p>
                          <p className="text-xs text-gray-500 dark:text-zinc-400">
                            {orderCount} {orderCount === 1 ? 'encomenda' : 'encomendas'} · 1ª encomenda em {new Date(firstOrderAt).toLocaleDateString('pt-PT')}
                            {lastDeliveryAt && ` · última entrega em ${new Date(lastDeliveryAt).toLocaleDateString('pt-PT')}`}
                          </p>
                        </div>
                        <ChevronDown className={`w-4 h-4 shrink-0 text-gray-400 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                      </div>
                      {isOpen && (
                        <div className="space-y-3 border-t border-gray-100 p-4 dark:border-zinc-800" onClick={(e) => e.stopPropagation()}>
                          {companyBatches.map((batch, idx) => (
                            <BatchCard
                              key={batch.batchId}
                              number={idx + 1}
                              batch={batch}
                              numero={displayNumero(numeros, batch.batchId)}
                              isExpanded={expandedBatchId === batch.batchId}
                              onToggle={() => setExpandedBatchId(expandedBatchId === batch.batchId ? null : batch.batchId)}
                              updatingId={updatingId}
                              onUpdateStatus={updateStatus}
                              onUpdateDeliveryDate={updateDeliveryDate}
                              onSetPreco={setPrecoItem}
                              unreadCount={dismissedUnread.has(batch.batchId) ? 0 : (unreadByBatch[batch.batchId] ?? 0)}
                              onDismissUnread={() => setDismissedUnread((prev) => new Set(prev).add(batch.batchId))}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          ) : loading ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-400 dark:text-zinc-500"><Spinner /> A carregar encomendas...</div>
          ) : visibleGroups.every((g) => g.batches.length === 0) ? (
            <div className={`${panelSectionCard} p-8 text-center text-sm text-gray-500 dark:text-zinc-400`}>
              Nenhuma encomenda encontrada aqui.
            </div>
          ) : (
            <div className="space-y-6">
              {(() => {
                let cardNumber = 0
                return visibleGroups.filter((g) => g.batches.length > 0).map((group) => (
                  <div key={group.label ?? '__bucket'}>
                    {group.label && (
                      <p className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-zinc-500 mb-2">
                        {group.label}
                      </p>
                    )}
                    <div className="space-y-3">
                      {group.batches.map((batch) => {
                        cardNumber += 1
                        return (
                          <BatchCard
                            key={batch.batchId}
                            number={cardNumber}
                            batch={batch}
                            numero={displayNumero(numeros, batch.batchId)}
                            isExpanded={expandedBatchId === batch.batchId}
                            onToggle={() => setExpandedBatchId(expandedBatchId === batch.batchId ? null : batch.batchId)}
                            updatingId={updatingId}
                            onUpdateStatus={updateStatus}
                            onUpdateDeliveryDate={updateDeliveryDate}
                            onSetPreco={setPrecoItem}
                            unreadCount={dismissedUnread.has(batch.batchId) ? 0 : (unreadByBatch[batch.batchId] ?? 0)}
                            onDismissUnread={() => setDismissedUnread((prev) => new Set(prev).add(batch.batchId))}
                          />
                        )
                      })}
                    </div>
                  </div>
                ))
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

type BatchTab = 'itens' | 'mensagem' | 'anexos' | 'cotacao' | 'factura' | 'historico' | 'empresa'

// 'factura' só entra na lista quando a encomenda já tem factura emitida (ver
// hasFactura em BatchCard) — antes de 'approved' não há número nenhum.
// Layouts continuam só dentro da conversa em "Mensagem". Anexos (sobretudo
// comprovativos de pagamento) ganharam aba própria para nunca ficarem
// enterrados numa conversa longa sem a equipa reparar.
const BATCH_TABS: { id: BatchTab; label: string }[] = [
  { id: 'itens', label: 'Itens da encomenda' },
  { id: 'mensagem', label: 'Mensagem' },
  { id: 'anexos', label: 'Anexos' },
  { id: 'historico', label: 'Histórico' },
  { id: 'empresa', label: 'Dados da empresa' },
  { id: 'cotacao', label: 'Cotação' },
  { id: 'factura', label: 'Factura' },
]

/** Mesma heurística usada no resto do painel para normalizar números moçambicanos para wa.me. */
function phoneToWhatsAppDigits(raw: string): string {
  const digits = raw.replace(/\D/g, '').replace(/^0+/, '')
  if (digits.length === 9) return `258${digits}`
  return digits
}

function BatchCard({
  number,
  batch,
  numero,
  isExpanded,
  onToggle,
  updatingId,
  onUpdateStatus,
  onUpdateDeliveryDate,
  onSetPreco,
  unreadCount = 0,
  onDismissUnread,
}: {
  number: number
  batch: QuotationBatch<QuotationRequest>
  numero: string
  isExpanded: boolean
  onToggle: () => void
  updatingId: string | null
  onUpdateStatus: (itemId: string, status: QuotationRequest['status']) => void
  onSetPreco: (itemId: string, precoUnitarioMt: number) => void
  onUpdateDeliveryDate: (batchId: string, dataLimiteEntrega: string) => void
  unreadCount?: number
  onDismissUnread?: () => void
}) {
  const [activeTab, setActiveTab] = useState<BatchTab>('itens')
  // Cotação/Factura só arrancam a carregar quando a aba é aberta pela primeira
  // vez (evita 2 iframes extra em toda a encomenda expandida) — mas depois de
  // carregados ficam montados e só se escondem/mostram por CSS, para trocar de
  // aba não obrigar a recarregar o documento outra vez do zero.
  const [mountedTabs, setMountedTabs] = useState<Set<BatchTab>>(() => new Set(['itens'] as BatchTab[]))
  const openTab = (tab: BatchTab) => {
    setActiveTab(tab)
    setMountedTabs((prev) => (prev.has(tab) ? prev : new Set(prev).add(tab)))
    if (tab === 'mensagem') onDismissUnread?.()
  }
  const [editingDate, setEditingDate] = useState(false)
  const [editingPrecoItemId, setEditingPrecoItemId] = useState<string | null>(null)
  const [precoDraft, setPrecoDraft] = useState('')
  const [saldoNegativo, setSaldoNegativo] = useState(false)

  const startEditingPreco = (item: QuotationRequest) => {
    setEditingPrecoItemId(item.id)
    setPrecoDraft(item.preco_unitario_mt > 0 ? String(item.preco_unitario_mt) : '')
  }
  const commitPreco = (itemId: string) => {
    const valor = Number(precoDraft)
    if (!Number.isFinite(valor) || valor <= 0) return
    onSetPreco(itemId, valor)
    setEditingPrecoItemId(null)
  }
  const statusSelectRefs = useRef<Record<string, HTMLSelectElement | null>>({})
  const openStatusPicker = (itemId: string) => {
    const el = statusSelectRefs.current[itemId]
    if (!el) return
    el.focus()
    el.showPicker?.()
  }
  const [invoiceNumber, setInvoiceNumber] = useState<string | null>(null)
  const [payments, setPayments] = useState<{ phase: string; metodo: string | null; valor_mt: number; confirmed_at: string }[]>([])
  const anchor = batch.primaryItem
  const hasFactura = ['approved', 'delivered', 'done'].includes(batch.status)

  // Número de factura (série própria, sequencial) e livro de pagamentos —
  // só existem a partir de 'approved'; carregados sob pedido (ao expandir)
  // em vez de para todas as encomendas da lista de uma vez.
  useEffect(() => {
    if (!isExpanded || !hasFactura) return
    let cancelled = false
    fetch(`/api/cotacoes/${anchor.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled || !data.success) return
        setInvoiceNumber(data.invoiceNumber ?? null)
        setPayments(data.payments ?? [])
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [isExpanded, hasFactura, anchor.id])
  const whatsappDigits = phoneToWhatsAppDigits(anchor.telefone || '')
  const whatsappHref = whatsappDigits
    ? `https://wa.me/${whatsappDigits}?text=${encodeURIComponent(`Olá ${anchor.responsavel || ''}, sobre a sua encomenda Nº ${numero} (${anchor.empresa}):`)}`
    : null
  const meta = statusMeta(displayStatusValue(batch.status), batch.sobConsulta)
  const resumo = batch.sobConsulta
    ? 'Pedido personalizado — aguarda contacto'
    : batch.items.length === 1
      ? `${anchor.categoria_label} — ${anchor.produto}`
      : `${batch.items.length} serviços`

  return (
    <div className={panelSectionCard}>
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle() } }}
        className="w-full flex items-start gap-3 p-4 text-left cursor-pointer"
      >
        <span className="shrink-0 rounded border border-red-200 bg-red-50 px-1.5 py-0.5 font-mono text-xs font-bold text-red-600 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400 tabular-nums">
          #{number}
        </span>
        <div className="min-w-0 flex-1 flex flex-col gap-1">
          <div className="grid grid-cols-1 gap-x-[25px] gap-y-1.5 md:grid-cols-2 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="min-w-0 flex items-center gap-2 justify-self-start">
              <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
              <span className="min-w-0 truncate font-bold text-gray-900 dark:text-white">{anchor.empresa}</span>
              <span className="w-fit shrink-0 rounded border border-gray-300 bg-gray-50 px-1.5 py-0.5 font-mono text-xs font-bold text-black whitespace-nowrap dark:border-zinc-600 dark:bg-zinc-800 dark:text-white">
                Nº {numero}
              </span>
              {hasFactura && invoiceNumber && (
                <span className="w-fit shrink-0 rounded border border-red-200 bg-red-50 px-1.5 py-0.5 font-mono text-xs font-bold text-red-700 whitespace-nowrap dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400">
                  {invoiceNumber}
                </span>
              )}
              {unreadCount > 0 && (
                <span
                  className="w-fit shrink-0 flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white whitespace-nowrap"
                  title={`${unreadCount} mensagem${unreadCount === 1 ? '' : 's'} do cliente por responder`}
                >
                  <MessageCircle className="w-3 h-3" /> {unreadCount}
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 justify-self-start lg:grid-cols-[14rem_6rem] lg:items-center lg:gap-2 lg:justify-self-end">
              <span className={`w-fit justify-self-end px-2.5 py-1 rounded text-xs font-bold whitespace-nowrap border ${meta.color}`}>
                {meta.label}
              </span>
              <span className="justify-self-start text-xs text-gray-500 dark:text-zinc-400 whitespace-nowrap">
                {new Date(anchor.created_at).toLocaleDateString('pt-PT')}
              </span>
            </div>
          </div>
          <p className="text-xs text-gray-500 dark:text-zinc-400 truncate">{resumo}</p>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-gray-100 dark:border-zinc-800" onClick={(e) => e.stopPropagation()}>
          <div className={`${panelTabBar} px-4 pt-2`}>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="flex flex-wrap gap-5">
                {BATCH_TABS.filter((t) => t.id !== 'factura' || hasFactura).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => openTab(t.id)}
                    className={`${panelTabBtn} ${activeTab === t.id ? panelTabBtnActive : panelTabBtnInactive} inline-flex items-center gap-1.5`}
                  >
                    {t.label}
                    {t.id === 'mensagem' && unreadCount > 0 && (
                      <span className="inline-flex items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
                        {unreadCount}
                      </span>
                    )}
                    {t.id === 'itens' && saldoNegativo && (
                      <AlertTriangle
                        className="w-3.5 h-3.5 text-red-600 dark:text-red-400"
                        aria-label="Saldo negativo: despesas de produção ultrapassam o valor da encomenda"
                      />
                    )}
                  </button>
                ))}
              </div>
              <div className="pb-2.5 shrink-0 flex items-center gap-2 text-sm">
                <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                {editingDate ? (
                  <input
                    type="date"
                    autoFocus
                    defaultValue={anchor.data_limite_entrega.slice(0, 10)}
                    className={`${panelField} py-1 text-sm`}
                    onBlur={(e) => { onUpdateDeliveryDate(batch.batchId, e.target.value); setEditingDate(false) }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') { onUpdateDeliveryDate(batch.batchId, e.currentTarget.value); setEditingDate(false) }
                      if (e.key === 'Escape') setEditingDate(false)
                    }}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingDate(true)}
                    className="font-bold text-gray-900 dark:text-white hover:text-red-600 dark:hover:text-red-400 hover:underline decoration-dotted underline-offset-2 transition-colors"
                    title="Clique para alterar o prazo"
                  >
                    Entrega até {new Date(anchor.data_limite_entrega).toLocaleDateString('pt-PT')}
                  </button>
                )}
                {/* Estado da encomenda junto ao prazo — só informativo, sem dropdown nem
                    acções (a acção "Entregar" e a eliminação de itens vivem agora no
                    dropdown de estado por item, na aba "Itens da encomenda"). */}
                {batch.status === 'done' ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Entregue
                  </span>
                ) : batch.status === 'rejected' ? (
                  <span className="px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400">
                    Rejeitada
                  </span>
                ) : batch.status === 'cancelled' ? (
                  <span className="px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap bg-gray-200 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400">
                    Cancelada
                  </span>
                ) : (
                  (() => {
                    const countdown = deliveryCountdown(anchor.data_limite_entrega, anchor.created_at)
                    return (
                      <span className={`px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap ${countdown.className}`}>
                        {countdown.label}
                      </span>
                    )
                  })()
                )}
              </div>
            </div>
          </div>

          <div className="p-4 text-sm">
            {activeTab === 'itens' && (
              <div className="space-y-4">
                {anchor.notas && (
                  <p className="text-gray-500 dark:text-zinc-400 italic">"{anchor.notas}"</p>
                )}

                <div className="space-y-2">
                  <div className="rounded-lg border border-gray-100 dark:border-zinc-800 overflow-hidden divide-y divide-gray-100 dark:divide-zinc-800">
                    <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 dark:bg-zinc-800/60">
                      <span className="min-w-0 flex-1 font-bold text-gray-900 dark:text-white">Descrição</span>
                      <span className="w-24 shrink-0 text-right font-bold text-gray-900 dark:text-white whitespace-nowrap">V. unitário</span>
                      <span className="w-24 shrink-0 text-right font-bold text-gray-900 dark:text-white whitespace-nowrap">V. total</span>
                      <span className="ml-2 w-3.5 shrink-0" aria-hidden="true" />
                    </div>
                    {batch.items.map((item, idx) => {
                      return (
                        <div
                          key={item.id}
                          className={`flex items-center gap-3 px-3 py-2.5 ${
                            idx % 2 === 0 ? 'bg-white dark:bg-zinc-900' : 'bg-gray-50 dark:bg-zinc-800/40'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <span className={`text-gray-700 dark:text-zinc-300 ${item.sob_consulta ? 'block whitespace-pre-wrap' : 'block truncate'}`}>
                              {item.categoria_label} — {item.produto} (x{item.quantidade})
                            </span>
                            {item.rejection_reason && (
                              <span className="block truncate text-xs text-rose-600 dark:text-rose-400">Motivo: {item.rejection_reason}</span>
                            )}
                          </div>
                          <div className="relative shrink-0 flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openStatusPicker(item.id)}
                              disabled={updatingId === item.id}
                              className="shrink-0 text-gray-400 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-500 transition-colors disabled:opacity-50"
                              title="Clique para alterar o estado"
                            >
                              <ChevronDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openStatusPicker(item.id)}
                              disabled={updatingId === item.id}
                              className={`shrink-0 whitespace-nowrap rounded px-2.5 py-1 text-xs font-bold transition hover:brightness-95 disabled:opacity-50 ${
                                STATUS_OPTIONS.find((s) => s.value === displayStatusValue(item.status))?.badge ?? ''
                              }`}
                              title="Clique para alterar o estado"
                            >
                              {STATUS_OPTIONS.find((s) => s.value === displayStatusValue(item.status))?.label ?? item.status}
                            </button>
                            <select
                              ref={(el) => { statusSelectRefs.current[item.id] = el }}
                              className="sr-only"
                              tabIndex={-1}
                              value={displayStatusValue(item.status)}
                              disabled={updatingId === item.id}
                              onChange={(e) => onUpdateStatus(item.id, e.target.value as QuotationRequest['status'])}
                            >
                              {SELECTABLE_STATUS_OPTIONS.map((s) => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                              ))}
                            </select>
                          </div>
                          {editingPrecoItemId === item.id ? (
                            <span className="flex shrink-0 items-center gap-1.5">
                              <input
                                autoFocus
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="Valor"
                                value={precoDraft}
                                onChange={(e) => setPrecoDraft(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') commitPreco(item.id)
                                  if (e.key === 'Escape') setEditingPrecoItemId(null)
                                }}
                                className={`${panelField} w-24 py-1 text-right text-sm`}
                              />
                              <button
                                type="button"
                                onClick={() => commitPreco(item.id)}
                                disabled={updatingId === item.id}
                                className="shrink-0 text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 transition-colors disabled:opacity-50"
                                title="Guardar valor"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                            </span>
                          ) : (
                            <>
                              <span className="w-24 shrink-0 text-right text-sm whitespace-nowrap">
                                {item.sob_consulta ? (
                                  <span className="text-gray-300 dark:text-zinc-600">—</span>
                                ) : (
                                  <span className="text-gray-500 dark:text-zinc-400">{formatMt(item.preco_unitario_mt)} MT</span>
                                )}
                              </span>
                              <span className="w-24 shrink-0 text-right text-sm font-semibold whitespace-nowrap">
                                {item.sob_consulta ? (
                                  <button
                                    type="button"
                                    onClick={() => startEditingPreco(item)}
                                    className="text-red-600 dark:text-red-500 font-extrabold hover:underline"
                                    title="Clique para definir o valor"
                                  >
                                    Sob Consulta
                                  </button>
                                ) : (
                                  <span className="text-gray-700 dark:text-zinc-300">{formatMt(item.preco_unitario_mt * item.quantidade)} MT</span>
                                )}
                              </span>
                            </>
                          )}
                          <span className="ml-2 w-3.5 shrink-0 flex items-center justify-center">
                            {editingPrecoItemId !== item.id && !item.sob_consulta && item.sob_consulta_original && (
                              <button
                                type="button"
                                onClick={() => startEditingPreco(item)}
                                disabled={updatingId === item.id}
                                className="shrink-0 text-gray-400 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-500 transition-colors disabled:opacity-50"
                                title="Reeditar o valor (item Sob Consulta)"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </span>
                        </div>
                      )
                    })}
                    <div className="flex items-center gap-3 px-3 py-2 bg-gray-50 dark:bg-zinc-800/60">
                      <div className="min-w-0 flex-1 text-right">
                        <span className="text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-zinc-500">Total da encomenda</span>
                      </div>
                      <span className="w-24 shrink-0 text-right text-sm font-bold whitespace-nowrap">
                        {batch.sobConsulta ? (
                          <span className="text-red-600 dark:text-red-500 font-extrabold">Sob Consulta</span>
                        ) : saldoNegativo ? (
                          <span className="text-red-600 dark:text-red-500">-{formatMt(batch.totalMt)} MT</span>
                        ) : (
                          <span className="text-gray-900 dark:text-white">{formatMt(batch.totalMt)} MT</span>
                        )}
                      </span>
                      <span className="ml-2 w-3.5 shrink-0" aria-hidden="true" />
                    </div>
                  </div>

                  <QuotationBatchExpenses
                    batchId={batch.batchId}
                    receitaMt={batch.sobConsulta ? null : batch.totalMt}
                    onSaldoChange={setSaldoNegativo}
                  />
                </div>
              </div>
            )}

            {mountedTabs.has('cotacao') && (
              <iframe
                src={`/cotacao/${anchor.id}?embed=1`}
                title="Cotação"
                className={`h-[80vh] w-full rounded-lg border border-gray-200 dark:border-zinc-800 ${activeTab === 'cotacao' ? '' : 'hidden'}`}
              />
            )}
            {mountedTabs.has('factura') && hasFactura && (
              <div className={`space-y-4 ${activeTab === 'factura' ? '' : 'hidden'}`}>
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-zinc-500">Factura do adiantamento</p>
                  <iframe
                    src={`/cotacao/${anchor.id}?embed=1&tipo=factura&fase=adiantamento`}
                    title="Factura do adiantamento"
                    className="h-[60vh] w-full rounded-lg border border-gray-200 dark:border-zinc-800"
                  />
                </div>
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-zinc-500">Factura do remanescente</p>
                  {batch.status === 'done' ? (
                    <iframe
                      src={`/cotacao/${anchor.id}?embed=1&tipo=factura&fase=remanescente`}
                      title="Factura do remanescente"
                      className="h-[60vh] w-full rounded-lg border border-gray-200 dark:border-zinc-800"
                    />
                  ) : (
                    <div className={`${panelSectionCard} p-4 text-sm text-gray-500 dark:text-zinc-400`}>
                      Fica disponível assim que o remanescente for confirmado e a encomenda ficar concluída.
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'mensagem' && (
              <div className="mx-auto max-w-xl">
                <QuotationMessagesThread quotationId={anchor.id} viewerRole="admin" />
              </div>
            )}
            {activeTab === 'anexos' && (
              <div className="mx-auto max-w-xl">
                <QuotationAttachmentsPanel quotationId={anchor.id} />
              </div>
            )}
            {activeTab === 'historico' && <QuotationHistoryTimeline quotationId={anchor.id} />}

            {activeTab === 'empresa' && (
              <div className="space-y-1.5">
                <p className="text-gray-800 dark:text-zinc-200 font-medium">
                  {anchor.responsavel}{anchor.cargo ? ` — ${anchor.cargo}` : ''}
                </p>
                <p className="text-gray-500 dark:text-zinc-400 flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {anchor.telefone}</p>
                <p className="text-gray-500 dark:text-zinc-400 flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {anchor.email}</p>
                {anchor.nif && <p className="text-gray-500 dark:text-zinc-400">NIF: {anchor.nif}</p>}

                {payments.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-zinc-800">
                    <p className="text-xs font-bold uppercase text-gray-400 dark:text-zinc-500 mb-1.5">Pagamentos confirmados</p>
                    <div className="space-y-1">
                      {payments.map((p) => (
                        <p key={p.phase} className="text-gray-600 dark:text-zinc-300">
                          {p.phase === 'advance' ? 'Adiantamento' : 'Remanescente'}: {formatMt(p.valor_mt)} MT
                          {p.metodo ? ` (${p.metodo})` : ''} — {new Date(p.confirmed_at).toLocaleDateString('pt-PT')}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Mensagens deixou de ser um popup flutuante — vive agora na aba "Mensagem",
              acima, com o mesmo badge de por-responder. O WhatsApp continua como atalho à
              parte (abre uma aba/app externa; não há forma de incorporar o WhatsApp Web
              dentro do painel sem uma integração própria, API oficial do WhatsApp Business). */}
          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noreferrer"
              title="WhatsApp"
              className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-green-600 text-white shadow-lg transition-transform hover:scale-105 hover:bg-green-700"
            >
              <span className="text-xl leading-none">📱</span>
            </a>
          )}
        </div>
      )}
    </div>
  )
}
