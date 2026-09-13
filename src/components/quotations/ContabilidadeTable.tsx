'use client'

import { Fragment, useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, RotateCcw } from 'lucide-react'
import {
  panelSectionCard,
  panelTabBar, panelTabBtn, panelTabBtnActive, panelTabBtnInactive,
} from '@/lib/panel-ui'
import { formatMt } from '@/lib/pricing-catalog'
import { ImageLightbox } from './ImageLightbox'
import { Spinner } from '@/components/ui/spinner'

// Valores negativos (lucro pode ficar negativo quando os custos ultrapassam
// a receita) saem sempre a vermelho, seja qual for a tabela/linha.
function moneyClass(value: number, positiveClass: string): string {
  return value < 0 ? 'text-red-600 dark:text-red-500' : positiveClass
}

type MonthRow = {
  month: string
  receitaMt: number
  custosProducaoMt: number
  ivaPercent: number
  ivaMt: number
  lucroMt: number
}

type FechoRow = {
  year: number
  receita_mt: number
  custos_producao_mt: number
  iva_percent: number
  iva_mt: number
  lucro_mt: number
  closed_at: string
  closed_by: string | null
}

type RegistoRow = {
  batch_id: string
  primary_item_id: string
  numero: string
  advance_invoice_number: string | null
  remainder_invoice_number: string | null
  empresa: string
  resumo: string
  receita_mt: number
  custos_producao_mt: number
  iva_percent: number
  iva_mt: number
  lucro_mt: number
  done_at: string
  deleted_at?: string | null
}

async function setRegistoDeleted(batchId: string, deleted: boolean): Promise<boolean> {
  try {
    const res = await fetch('/api/admin/contabilidade', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ batchId, deleted }),
    })
    const data = await res.json()
    return Boolean(data.success)
  } catch (error) {
    console.error('Erro ao actualizar registo de contabilidade:', error)
    return false
  }
}

const MES_LABEL = new Intl.DateTimeFormat('pt-PT', { month: 'long', timeZone: 'UTC' })

function mesLabel(month: string): string {
  const label = MES_LABEL.format(new Date(`${month}T00:00:00Z`))
  return label.charAt(0).toUpperCase() + label.slice(1)
}

function anoLabel(month: string): string {
  return month.slice(0, 4)
}

function monthKey(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`
}

function openDocumentPopup(itemId: string, tipo?: 'factura', fase?: 'adiantamento' | 'remanescente') {
  const w = 900
  const h = 1000
  const left = window.screenX + Math.max(0, (window.outerWidth - w) / 2)
  const top = window.screenY + Math.max(0, (window.outerHeight - h) / 2)
  const query = tipo ? `?embed=1&tipo=${tipo}${fase ? `&fase=${fase}` : ''}` : '?embed=1'
  window.open(`/cotacao/${itemId}${query}`, `documento-${itemId}-${tipo ?? 'cotacao'}-${fase ?? ''}`, `width=${w},height=${h},left=${left},top=${top},resizable=yes,scrollbars=yes`)
}

type ContabilidadeTab = 'balanco' | 'cotacoes' | 'facturas' | 'creditos' | 'renovacoes' | 'dominios' | 'hospedagem' | 'emails' | 'eliminadas'

const TABS: { id: ContabilidadeTab; label: string }[] = [
  { id: 'balanco', label: 'Balanço' },
  { id: 'cotacoes', label: 'Cotações' },
  { id: 'facturas', label: 'Facturas' },
  { id: 'creditos', label: 'Créditos' },
  { id: 'renovacoes', label: 'Renovações' },
  { id: 'dominios', label: 'Domínios' },
  { id: 'hospedagem', label: 'Hospedagem' },
  { id: 'emails', label: 'E-mails' },
  { id: 'eliminadas', label: 'Eliminadas' },
]

export function ContabilidadeTable() {
  const [meses, setMeses] = useState<MonthRow[] | null>(null)
  const [registos, setRegistos] = useState<RegistoRow[] | null>(null)
  const [eliminados, setEliminados] = useState<RegistoRow[] | null>(null)
  const [fechos, setFechos] = useState<FechoRow[] | null>(null)
  const [activeTab, setActiveTab] = useState<ContabilidadeTab>('balanco')
  // Balão por separador (Créditos/Renovações/Domínios/Hospedagem/E-mails) —
  // para não ter de ir a cada separador só para ver onde há algo pendente.
  const [pendentesPorTab, setPendentesPorTab] = useState<Partial<Record<ContabilidadeTab, number>>>({})

  useEffect(() => {
    const loadPendentes = () => {
      fetch('/api/admin/contabilidade-pendentes')
        .then((r) => r.json())
        .then((data) => {
          if (data?.success && data.stats?.porTab) setPendentesPorTab(data.stats.porTab)
        })
        .catch(() => {})
    }
    loadPendentes()
    const interval = setInterval(loadPendentes, 30000)
    return () => clearInterval(interval)
  }, [])

  const load = () => {
    fetch('/api/admin/contabilidade')
      .then((r) => r.json())
      .then((data) => {
        if (data.success) {
          setMeses(data.meses)
          setRegistos(data.registos ?? [])
          setEliminados(data.eliminados ?? [])
          setFechos(data.fechos ?? [])
        }
      })
      .catch((error) => console.error('Erro ao carregar contabilidade:', error))
  }

  useEffect(() => {
    load()
  }, [])

  if (!meses || !registos || !eliminados || !fechos) {
    return <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-400 dark:text-zinc-500"><Spinner /> A carregar contabilidade...</div>
  }

  return (
    <div>
      <div className={`${panelSectionCard} mb-4 px-4 pt-2`}>
        <div className={panelTabBar}>
          <div className="flex flex-wrap items-end gap-5">
            {TABS.map((t) => {
              const pendente = pendentesPorTab[t.id] || 0
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={`relative ${panelTabBtn} ${activeTab === t.id ? panelTabBtnActive : panelTabBtnInactive}`}
                >
                  {t.label}
                  {pendente > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold">
                      {pendente}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {activeTab === 'balanco' && (
        <div className="space-y-4">
          <BalancoTable meses={meses} registos={registos} />
          <FechoAnualCard meses={meses} fechos={fechos} onClosed={load} />
        </div>
      )}
      {activeTab === 'cotacoes' && <RegistosTable registos={registos} variant="cotacao" />}
      {activeTab === 'facturas' && <RegistosTable registos={registos} variant="factura" />}
      {activeTab === 'creditos' && <ResellerCreditsTable />}
      {activeTab === 'renovacoes' && <RenewalPaymentsTable />}
      {activeTab === 'dominios' && <CheckoutItemsByType types={['domain']} />}
      {activeTab === 'hospedagem' && <CheckoutItemsByType types={['hosting', 'ssl']} />}
      {activeTab === 'emails' && <CheckoutItemsByType types={['email']} />}
      {activeTab === 'eliminadas' && <EliminadasTable registos={eliminados} onChanged={load} />}
    </div>
  )
}

type CreditoPedido = {
  id: string
  da_username: string
  email: string | null
  valor_mt: number
  metodo_pagamento: string
  status: 'pending' | 'confirmed' | 'rejected'
  comprovativo_url: string | null
  rejection_reason: string | null
  created_at: string
  confirmed_at: string | null
}

const METODO_LABEL: Record<string, string> = { mpesa: 'M-Pesa', emola: 'e-Mola', transferencia: 'Transferência', stripe: 'Cartão' }
const CREDITO_STATUS_META: Record<CreditoPedido['status'], { label: string; className: string }> = {
  pending: { label: 'Pendente', className: 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400' },
  confirmed: { label: 'Confirmado', className: 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400' },
  rejected: { label: 'Rejeitado', className: 'bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400' },
}

function ResellerCreditsTable() {
  const [pedidos, setPedidos] = useState<CreditoPedido[] | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)

  const load = () => {
    fetch('/api/admin/reseller-creditos')
      .then((r) => r.json())
      .then((data) => { if (data.success) setPedidos(data.pedidos) })
      .catch((error) => console.error('Erro ao carregar créditos de revendedores:', error))
  }

  useEffect(() => {
    load()
  }, [])

  const respond = async (id: string, status: 'confirmed' | 'rejected') => {
    let rejectionReason: string | null = null
    if (status === 'rejected') {
      rejectionReason = window.prompt('Motivo da rejeição (opcional):', '')
      if (rejectionReason === null) return
    } else if (!window.confirm('Confirmar este carregamento? O valor é somado ao saldo do revendedor de imediato.')) {
      return
    }

    setUpdatingId(id)
    try {
      const res = await fetch(`/api/admin/reseller-creditos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, rejectionReason }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Não foi possível actualizar o pedido.')
      load()
    } catch (error: any) {
      window.alert(error.message || 'Falha ao comunicar com o servidor.')
    } finally {
      setUpdatingId(null)
    }
  }

  if (!pedidos) {
    return <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-400 dark:text-zinc-500"><Spinner /> A carregar pedidos de crédito...</div>
  }
  if (pedidos.length === 0) {
    return <div className={`${panelSectionCard} p-8 text-center text-sm text-gray-500 dark:text-zinc-400`}>Ainda não há pedidos de carregamento de saldo.</div>
  }

  return (
    <div className={`${panelSectionCard} overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-xs font-bold uppercase tracking-wide text-gray-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
              <th className="px-4 py-2 align-middle text-left">Item</th>
              <th className="px-4 py-2 align-middle text-left whitespace-nowrap">Valor</th>
              <th className="px-4 py-2 align-middle text-left whitespace-nowrap">Método</th>
              <th className="px-4 py-2 align-middle text-left whitespace-nowrap">Data</th>
              <th className="px-4 py-2 align-middle text-left">Cliente</th>
              <th className="px-4 py-2 align-middle text-left whitespace-nowrap">Anexo</th>
              <th className="px-4 py-2 align-middle text-left whitespace-nowrap">Estado</th>
              <th className="px-4 py-2 align-middle text-left whitespace-nowrap">Aceitação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
            {pedidos.map((p) => {
              const meta = CREDITO_STATUS_META[p.status]
              return (
                <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/30">
                  <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-white">
                    Carregamento de Saldo
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-left font-bold tabular-nums text-gray-900 dark:text-white">
                    {formatMt(p.valor_mt)} MT
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-gray-500 dark:text-zinc-400">
                    {METODO_LABEL[p.metodo_pagamento] || p.metodo_pagamento}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-gray-500 dark:text-zinc-400">
                    {new Date(p.created_at).toLocaleDateString('pt-PT')}
                  </td>
                  <td className="max-w-[12rem] truncate px-4 py-2.5 text-gray-500 dark:text-zinc-400">
                    {p.da_username}{p.email ? <span className="text-gray-400 dark:text-zinc-500"> · {p.email}</span> : null}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    {p.comprovativo_url ? (
                      <button
                        type="button"
                        onClick={() => setLightboxUrl(p.comprovativo_url)}
                        className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                      >
                        Ver anexo
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400 dark:text-zinc-500">Sem comprovativo</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-left">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${meta.className}`}>{meta.label}</span>
                    {p.status === 'rejected' && p.rejection_reason && (
                      <p className="mt-1 text-xs text-gray-400 dark:text-zinc-500">{p.rejection_reason}</p>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-left">
                    {p.status === 'pending' && (
                      <div className="flex items-center justify-start gap-2">
                        <button
                          type="button"
                          disabled={updatingId === p.id}
                          onClick={() => respond(p.id, 'confirmed')}
                          className="text-xs font-medium text-green-600 hover:underline disabled:opacity-50 dark:text-green-400"
                        >
                          Confirmar
                        </button>
                        <button
                          type="button"
                          disabled={updatingId === p.id}
                          onClick={() => respond(p.id, 'rejected')}
                          className="text-xs font-medium text-rose-600 hover:underline disabled:opacity-50 dark:text-rose-400"
                        >
                          Rejeitar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {lightboxUrl && <ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}
    </div>
  )
}

/**
 * dados de contacto de quem for preciso falar sobre este pedido — o anexo já
 * tem link directo ("Ver anexo") na linha compacta, não precisa de expandir.
 * 1ª coluna: a própria VisualDesign (fixo). 2ª coluna: o cliente do pedido
 * (do formulário de checkout — nome/telefone/morada/cidade/email já
 * recolhidos lá, ver accountForm em app/checkout/page.tsx).
 */
function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-sm">
      <span className="font-bold text-gray-500 dark:text-zinc-400">{label}: </span>
      <span className="text-gray-700 dark:text-zinc-300">{value}</span>
    </p>
  )
}

function ClienteInfoInline({ cliente, domainSlot }: { cliente: Cliente | null; domainSlot?: React.ReactNode }) {
  return (
    <div>
      {/* Cabeçalho único, de ponta a ponta, com fundo — diferente do checkout (que não tem fundo nenhum). */}
      <div className="mb-2 grid grid-cols-1 gap-x-4 overflow-hidden rounded-md bg-gray-100 sm:grid-cols-2 dark:bg-zinc-800">
        <p className="px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
          Dados da Empresa
        </p>
        <p className="border-t border-gray-200 px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-gray-500 sm:border-l sm:border-t-0 dark:border-zinc-600 dark:text-zinc-400">
          Dados do Responsável
        </p>
      </div>
      <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2">
        <div className="space-y-1">
          <InfoLine label="Empresa" value="VisualDesign" />
          <InfoLine label="Morada" value="Av. Karl Marx, Nº 177, Maputo — Moçambique" />
          <InfoLine label="Telefone" value="+258 87 757 5288" />
          <InfoLine label="Email" value="geral@visualdesignmoz.com" />
        </div>
        <div className="space-y-1 sm:border-l sm:border-gray-200 sm:pl-4 dark:border-zinc-700">
          <InfoLine label="Responsável" value={cliente?.nome || '—'} />
          <InfoLine label="Residência" value={[cliente?.morada, cliente?.cidade].filter(Boolean).join(', ') || '—'} />
          <InfoLine label="WhatsApp" value={cliente?.telefone || '—'} />
          <InfoLine label="Email" value={cliente?.email || '—'} />
          {domainSlot}
        </div>
      </div>
    </div>
  )
}

/**
 * #6 — corrige/define o domínio de uma hospedagem mesmo aqui, junto aos
 * dados do responsável, antes de confirmar o pagamento. Selector com os
 * domínios já no mesmo pedido + opção de escrever um novo manualmente.
 */
function HostingDomainFixField({
  pedidoItems,
  currentDomain,
  value,
  onChange,
}: {
  pedidoItems: { type: string; name: string }[]
  currentDomain?: string
  value: string
  onChange: (v: string) => void
}) {
  const isManual = value !== '' && !pedidoItems.some((i) => i.type === 'domain' && i.name.toLowerCase() === value.toLowerCase())
  const [showManual, setShowManual] = useState(isManual)
  const domainItems = pedidoItems.filter((i) => i.type === 'domain')

  return (
    <div className="mt-2">
      <p className="mb-1 text-xs font-bold text-gray-500 dark:text-zinc-400">Domínio da hospedagem</p>
      <select
        value={showManual ? '__manual__' : value}
        onChange={(e) => {
          if (e.target.value === '__manual__') {
            setShowManual(true)
            return
          }
          setShowManual(false)
          onChange(e.target.value)
        }}
        className="w-full rounded border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
      >
        <option value="">Sem domínio</option>
        {domainItems.map((d) => (
          <option key={d.name} value={d.name.toLowerCase()}>{d.name}</option>
        ))}
        <option value="__manual__">Escrever outro domínio…</option>
      </select>
      {showManual && (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value.toLowerCase().trim())}
          placeholder="ex: oseudominio.co.mz"
          className="mt-1.5 w-full rounded border border-gray-200 bg-white px-2.5 py-1.5 text-sm text-gray-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
        />
      )}
      {currentDomain && (
        <p className="mt-1 text-[10px] text-gray-400 dark:text-zinc-500">Domínio actual: {currentDomain}</p>
      )}
    </div>
  )
}

function BalancoTable({ meses, registos }: { meses: MonthRow[]; registos: RegistoRow[] }) {
  // Aberto por omissão — o objectivo é ver logo as encomendas de cada mês,
  // não escondê-las atrás de mais um clique.
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set())

  if (meses.length === 0) {
    return <div className={`${panelSectionCard} p-8 text-center text-sm text-gray-500 dark:text-zinc-400`}>Ainda não há dados de contabilidade.</div>
  }

  const toggleMonth = (month: string) => {
    setCollapsedMonths((prev) => {
      const next = new Set(prev)
      if (next.has(month)) next.delete(month)
      else next.add(month)
      return next
    })
  }

  return (
    <div className={`${panelSectionCard} overflow-hidden`}>
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800/50">
        <p className="font-bold text-gray-900 dark:text-white">Balanço mensal</p>
        <p className="text-xs text-gray-500 dark:text-zinc-400">Receita das encomendas entregues, menos custos e IVA — actualiza-se sozinho assim que uma encomenda é concluída.</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-xs font-bold uppercase tracking-wide text-gray-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
              <th className="px-4 py-2 align-middle text-left whitespace-nowrap">Mês</th>
              <th className="px-4 py-2 align-middle text-right whitespace-nowrap">Valor total</th>
              <th className="px-4 py-2 align-middle text-right whitespace-nowrap">Custo de produção</th>
              <th className="px-4 py-2 align-middle text-right whitespace-nowrap">IVA (16%)</th>
              <th className="px-4 py-2 align-middle text-right whitespace-nowrap">Lucro</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
            {meses.flatMap((m) => {
              const encomendasDoMes = registos
                .filter((r) => monthKey(r.done_at) === m.month)
                .sort((a, b) => b.numero.localeCompare(a.numero))
              const isCollapsed = collapsedMonths.has(m.month)

              const rows = [
                <tr
                  key={m.month}
                  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/30"
                  onClick={() => toggleMonth(m.month)}
                >
                  <td className="whitespace-nowrap px-4 py-2.5 font-bold text-gray-900 dark:text-white">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="shrink-0 text-gray-400 dark:text-zinc-500">
                        {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </span>
                      {mesLabel(m.month)} de {anoLabel(m.month)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right font-bold tabular-nums text-gray-900 dark:text-white">
                    {formatMt(m.receitaMt)} MT
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-zinc-300">
                    {formatMt(m.custosProducaoMt)} MT
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-zinc-300">
                    {formatMt(m.ivaMt)} MT
                  </td>
                  <td className={`whitespace-nowrap px-4 py-2.5 text-right font-bold tabular-nums ${moneyClass(m.lucroMt, 'text-gray-900 dark:text-white')}`}>
                    {formatMt(m.lucroMt)} MT
                  </td>
                </tr>,
              ]

              if (!isCollapsed) {
                if (encomendasDoMes.length === 0) {
                  rows.push(
                    <tr key={`${m.month}-vazio`}>
                      <td colSpan={5} className="px-4 py-2 pl-10 text-xs text-gray-400 dark:text-zinc-500">
                        Nenhuma encomenda concluída neste mês.
                      </td>
                    </tr>,
                  )
                } else {
                  rows.push(
                    ...encomendasDoMes.map((r, idx) => (
                      <tr key={r.batch_id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/30">
                        <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-zinc-400">
                          <span className="inline-flex items-baseline gap-2">
                            <span className="w-3.5 shrink-0 text-right tabular-nums text-gray-400 dark:text-zinc-500">{idx + 1}</span>
                            <span className="min-w-0">
                              <span className="font-mono font-bold text-red-600 dark:text-red-400">{r.numero}</span>
                              {' · '}
                              <span className="font-medium text-gray-700 dark:text-zinc-300">{r.empresa}</span>
                              {' — '}
                              <span className="truncate">{r.resumo}</span>
                            </span>
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right text-xs tabular-nums text-gray-500 dark:text-zinc-400">{formatMt(r.receita_mt)} MT</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right text-xs tabular-nums text-gray-500 dark:text-zinc-400">{formatMt(r.custos_producao_mt)} MT</td>
                        <td className="whitespace-nowrap px-4 py-2.5 text-right text-xs tabular-nums text-gray-500 dark:text-zinc-400">{formatMt(r.iva_mt)} MT</td>
                        <td className={`whitespace-nowrap px-4 py-2.5 text-right text-xs tabular-nums ${moneyClass(r.lucro_mt, 'text-gray-500 dark:text-zinc-400')}`}>{formatMt(r.lucro_mt)} MT</td>
                      </tr>
                    )),
                  )
                }
              }

              return rows
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function FechoAnualCard({
  meses,
  fechos,
  onClosed,
}: {
  meses: MonthRow[]
  fechos: FechoRow[]
  onClosed: () => void
}) {
  const [open, setOpen] = useState(false)
  const [closing, setClosing] = useState<number | null>(null)
  const [error, setError] = useState('')

  const years = [...new Set(meses.map((m) => Number(anoLabel(m.month))))].sort((a, b) => b - a)
  if (years.length === 0) return null

  const closeYear = async (year: number) => {
    const monthsInYear = meses.filter((m) => Number(anoLabel(m.month)) === year).length
    const confirmMsg = monthsInYear < 12
      ? `Este ano só tem ${monthsInYear} ${monthsInYear === 1 ? 'mês' : 'meses'} com movimento — tens a certeza que já pode ser fechado?`
      : `Fechar o exercício de ${year}? Os valores ficam congelados e as despesas desse ano deixam de poder ser editadas.`
    if (!window.confirm(confirmMsg)) return

    setClosing(year)
    setError('')
    try {
      const res = await fetch('/api/admin/contabilidade/fechar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) throw new Error(data.error || 'Não foi possível fechar o ano.')
      onClosed()
    } catch (err: any) {
      setError(err.message || 'Falha ao comunicar com o servidor.')
    } finally {
      setClosing(null)
    }
  }

  return (
    <div className={`${panelSectionCard} overflow-hidden`}>
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800/50 flex items-start justify-between gap-3">
        <div>
          <p className="font-bold text-gray-900 dark:text-white">Fecho de exercício anual</p>
          <p className="text-xs text-gray-500 dark:text-zinc-400">Revê os 12 meses antes de fechar — depois de fechado, o ano fica congelado e não pode voltar a mudar.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="shrink-0 whitespace-nowrap text-sm font-bold text-red-600 hover:underline dark:text-red-400"
        >
          Fechar o ano {open ? '▾' : '▸'}
        </button>
      </div>

      {/* Desliza para baixo em vez de aparecer instantaneamente — mesmo
          truque de grid-rows já usado em /precos para os acordeões. */}
      <div className={`grid transition-all duration-300 ease-in-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          {error && <p className="px-4 pt-3 text-xs text-rose-600 dark:text-rose-400">{error}</p>}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-xs font-bold uppercase tracking-wide text-gray-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
                  <th className="px-4 py-2 align-middle text-left whitespace-nowrap">Ano / Mês</th>
                  <th className="px-4 py-2 align-middle text-right whitespace-nowrap">Receita</th>
                  <th className="px-4 py-2 align-middle text-right whitespace-nowrap">Custo de produção</th>
                  <th className="px-4 py-2 align-middle text-right whitespace-nowrap">IVA (16%)</th>
                  <th className="px-4 py-2 align-middle text-right whitespace-nowrap">Lucro</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                {years.flatMap((year) => {
                  const fecho = fechos.find((f) => f.year === year)
                  const monthsInYear = meses.filter((m) => Number(anoLabel(m.month)) === year)
                  const receitaMt = fecho ? fecho.receita_mt : monthsInYear.reduce((sum, m) => sum + m.receitaMt, 0)
                  const custosProducaoMt = fecho ? fecho.custos_producao_mt : monthsInYear.reduce((sum, m) => sum + m.custosProducaoMt, 0)
                  const ivaMt = fecho ? fecho.iva_mt : monthsInYear.reduce((sum, m) => sum + m.ivaMt, 0)
                  const lucroMt = fecho ? fecho.lucro_mt : monthsInYear.reduce((sum, m) => sum + m.lucroMt, 0)

                  const rows = [
                    <tr key={`${year}-total`} className="bg-gray-50 dark:bg-zinc-800/40">
                      <td className="whitespace-nowrap px-4 py-2.5">
                        {fecho ? (
                          <a
                            href={`/contabilidade/fecho/${year}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-bold text-gray-900 hover:underline dark:text-white"
                            title="Ver documento do fecho"
                          >
                            {year} · Fechado em {new Date(fecho.closed_at).toLocaleDateString('pt-PT')}
                          </a>
                        ) : (
                          <span className="font-bold text-gray-900 dark:text-white">{year}</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right font-bold tabular-nums text-gray-900 dark:text-white">{formatMt(receitaMt)} MT</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-zinc-300">{formatMt(custosProducaoMt)} MT</td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-gray-700 dark:text-zinc-300">{formatMt(ivaMt)} MT</td>
                      <td className={`whitespace-nowrap px-4 py-2.5 text-right font-bold tabular-nums ${moneyClass(lucroMt, 'text-gray-900 dark:text-white')}`}>{formatMt(lucroMt)} MT</td>
                    </tr>,
                    ...monthsInYear.map((m) => (
                      <tr key={m.month}>
                        <td className="whitespace-nowrap py-1.5 pl-8 pr-4 text-xs text-gray-500 dark:text-zinc-400">{mesLabel(m.month)}</td>
                        <td className="whitespace-nowrap px-4 py-1.5 text-right text-xs tabular-nums text-gray-500 dark:text-zinc-400">{formatMt(m.receitaMt)} MT</td>
                        <td className="whitespace-nowrap px-4 py-1.5 text-right text-xs tabular-nums text-gray-500 dark:text-zinc-400">{formatMt(m.custosProducaoMt)} MT</td>
                        <td className="whitespace-nowrap px-4 py-1.5 text-right text-xs tabular-nums text-gray-500 dark:text-zinc-400">{formatMt(m.ivaMt)} MT</td>
                        <td className={`whitespace-nowrap px-4 py-1.5 text-right text-xs tabular-nums ${moneyClass(m.lucroMt, 'text-gray-500 dark:text-zinc-400')}`}>{formatMt(m.lucroMt)} MT</td>
                      </tr>
                    )),
                  ]

                  if (!fecho) {
                    rows.push(
                      <tr key={`${year}-fechar`}>
                        <td colSpan={5} className="px-4 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => closeYear(year)}
                            disabled={closing === year}
                            className="text-xs font-bold text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
                          >
                            {closing === year ? 'A fechar...' : `Fechar o ano ${year}`}
                          </button>
                        </td>
                      </tr>,
                    )
                  }

                  return rows
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

type FacturaDoc = {
  key: string
  numero: string
  empresa: string
  resumo: string
  valorMt: number
  done_at: string
  primary_item_id: string
  fase: 'adiantamento' | 'remanescente'
}

function toFacturaDocs(registos: RegistoRow[]): FacturaDoc[] {
  const docs: FacturaDoc[] = []
  for (const r of registos) {
    if (r.advance_invoice_number) {
      docs.push({
        key: `${r.batch_id}-adiantamento`,
        numero: r.advance_invoice_number,
        empresa: r.empresa,
        resumo: r.resumo,
        valorMt: Math.round(r.receita_mt * 0.7 * 100) / 100,
        done_at: r.done_at,
        primary_item_id: r.primary_item_id,
        fase: 'adiantamento',
      })
    }
    if (r.remainder_invoice_number) {
      docs.push({
        key: `${r.batch_id}-remanescente`,
        numero: r.remainder_invoice_number,
        empresa: r.empresa,
        resumo: r.resumo,
        valorMt: Math.round(r.receita_mt * 0.3 * 100) / 100,
        done_at: r.done_at,
        primary_item_id: r.primary_item_id,
        fase: 'remanescente',
      })
    }
  }
  return docs
}

function RegistosTable({ registos, variant }: { registos: RegistoRow[]; variant: 'cotacao' | 'factura' }) {
  if (variant === 'factura') {
    const docs = toFacturaDocs(registos)
    if (docs.length === 0) {
      return <div className={`${panelSectionCard} p-8 text-center text-sm text-gray-500 dark:text-zinc-400`}>Ainda não há facturas emitidas.</div>
    }
    return (
      <div className={`${panelSectionCard} overflow-hidden`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-xs font-bold uppercase tracking-wide text-gray-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
                <th className="px-4 py-2 align-middle text-right whitespace-nowrap">#</th>
                <th className="px-4 py-2 align-middle text-left whitespace-nowrap">Factura Nº</th>
                <th className="px-4 py-2 align-middle text-left whitespace-nowrap">Fase</th>
                <th className="px-4 py-2 align-middle text-left">Empresa</th>
                <th className="px-4 py-2 align-middle text-left">Resumo</th>
                <th className="px-4 py-2 align-middle text-right whitespace-nowrap">Data</th>
                <th className="px-4 py-2 align-middle text-right whitespace-nowrap">Valor</th>
                <th className="px-4 py-2 align-middle text-right whitespace-nowrap"> </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
              {docs.map((d, idx) => (
                <tr key={d.key} className="hover:bg-gray-50 dark:hover:bg-zinc-800/30">
                  <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-gray-400 dark:text-zinc-500">{idx + 1}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs font-bold text-red-600 dark:text-red-400">{d.numero}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-gray-500 dark:text-zinc-400">
                    {d.fase === 'adiantamento' ? 'Adiantamento (70%)' : 'Remanescente (30%)'}
                  </td>
                  <td className="max-w-[14rem] truncate px-4 py-2.5 font-medium text-gray-900 dark:text-white">{d.empresa}</td>
                  <td className="max-w-[16rem] truncate px-4 py-2.5 text-gray-500 dark:text-zinc-400">{d.resumo}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right text-gray-500 dark:text-zinc-400">
                    {new Date(d.done_at).toLocaleDateString('pt-PT')}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right font-bold tabular-nums text-gray-900 dark:text-white">
                    {formatMt(d.valorMt)} MT
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => openDocumentPopup(d.primary_item_id, 'factura', d.fase)}
                      className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                    >
                      Ver factura
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  if (registos.length === 0) {
    return <div className={`${panelSectionCard} p-8 text-center text-sm text-gray-500 dark:text-zinc-400`}>Ainda não há cotações concluídas.</div>
  }

  return (
    <div className={`${panelSectionCard} overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-xs font-bold uppercase tracking-wide text-gray-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
              <th className="px-4 py-2 align-middle text-right whitespace-nowrap">#</th>
              <th className="px-4 py-2 align-middle text-left whitespace-nowrap">Cotação Nº</th>
              <th className="px-4 py-2 align-middle text-left">Empresa</th>
              <th className="px-4 py-2 align-middle text-left">Resumo</th>
              <th className="px-4 py-2 align-middle text-right whitespace-nowrap">Data</th>
              <th className="px-4 py-2 align-middle text-right whitespace-nowrap">Valor</th>
              <th className="px-4 py-2 align-middle text-right whitespace-nowrap"> </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
            {registos.map((r, idx) => (
              <tr key={r.batch_id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/30">
                <td className="whitespace-nowrap px-4 py-2.5 text-right tabular-nums text-gray-400 dark:text-zinc-500">{idx + 1}</td>
                <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs font-bold text-red-600 dark:text-red-400">{r.numero}</td>
                <td className="max-w-[14rem] truncate px-4 py-2.5 font-medium text-gray-900 dark:text-white">{r.empresa}</td>
                <td className="max-w-[16rem] truncate px-4 py-2.5 text-gray-500 dark:text-zinc-400">{r.resumo}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right text-gray-500 dark:text-zinc-400">
                  {new Date(r.done_at).toLocaleDateString('pt-PT')}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right font-bold tabular-nums text-gray-900 dark:text-white">
                  {formatMt(r.receita_mt)} MT
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => openDocumentPopup(r.primary_item_id)}
                    className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                  >
                    Ver cotação
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function EliminadasTable({ registos, onChanged }: { registos: RegistoRow[]; onChanged: () => void }) {
  const [restoringId, setRestoringId] = useState<string | null>(null)

  const restore = async (r: RegistoRow) => {
    if (!window.confirm(`Restaurar o registo de "${r.empresa} — ${r.resumo}" para o Balanço?`)) return
    setRestoringId(r.batch_id)
    const ok = await setRegistoDeleted(r.batch_id, false)
    setRestoringId(null)
    if (ok) onChanged()
    else window.alert('Não foi possível restaurar este registo.')
  }

  if (registos.length === 0) {
    return <div className={`${panelSectionCard} p-8 text-center text-sm text-gray-500 dark:text-zinc-400`}>Não há registos eliminados.</div>
  }

  const sorted = [...registos].sort((a, b) => (b.deleted_at ?? '').localeCompare(a.deleted_at ?? ''))

  return (
    <div className={`${panelSectionCard} overflow-hidden`}>
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 dark:border-zinc-700 dark:bg-zinc-800/50">
        <p className="font-bold text-gray-900 dark:text-white">Eliminadas</p>
        <p className="text-xs text-gray-500 dark:text-zinc-400">
          Encomendas/facturas eliminadas pelo cliente ou pela equipa — saem do Balanço, Cotações e Facturas, mas ficam guardadas aqui.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-xs font-bold uppercase tracking-wide text-gray-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
              <th className="px-4 py-2 align-middle text-left whitespace-nowrap">Nº</th>
              <th className="px-4 py-2 align-middle text-left">Empresa</th>
              <th className="px-4 py-2 align-middle text-left">Resumo</th>
              <th className="px-4 py-2 align-middle text-right whitespace-nowrap">Valor</th>
              <th className="px-4 py-2 align-middle text-right whitespace-nowrap">Eliminada em</th>
              <th className="px-4 py-2 align-middle text-right whitespace-nowrap"> </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
            {sorted.map((r) => (
              <tr key={r.batch_id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/30">
                <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs font-bold text-red-600 dark:text-red-400">{r.numero}</td>
                <td className="max-w-[14rem] truncate px-4 py-2.5 font-medium text-gray-900 dark:text-white">{r.empresa}</td>
                <td className="max-w-[16rem] truncate px-4 py-2.5 text-gray-500 dark:text-zinc-400">{r.resumo}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right font-bold tabular-nums text-gray-900 dark:text-white">{formatMt(r.receita_mt)} MT</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right text-gray-500 dark:text-zinc-400">
                  {r.deleted_at ? new Date(r.deleted_at).toLocaleDateString('pt-PT') : '—'}
                </td>
                <td className="whitespace-nowrap px-4 py-2.5 text-right">
                  <button
                    type="button"
                    onClick={() => restore(r)}
                    disabled={restoringId === r.batch_id}
                    className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
                    title="Restaurar para o Balanço"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Restaurar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

type Cliente = {
  nome?: string | null
  email?: string | null
  telefone?: string | null
  morada?: string | null
  cidade?: string | null
  empresa?: string | null
}

type RenewalPedido = {
  id: string
  user_id: string
  renewal_type: 'domain' | 'hosting'
  service_name: string
  valor_mt: number
  metodo_pagamento: string
  status: 'pending' | 'confirmed' | 'rejected'
  comprovativo_url: string | null
  rejection_reason: string | null
  created_at: string
  cliente: Cliente | null
}

function RenewalPaymentsTable() {
  const [pedidos, setPedidos] = useState<RenewalPedido[] | null>(null)
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const load = () => {
    fetch('/api/admin/renewal-pagamentos')
      .then((r) => r.json())
      .then((data) => { if (data.success) setPedidos(data.pedidos) })
      .catch((error) => console.error('Erro ao carregar pagamentos de renovação:', error))
  }

  useEffect(() => {
    load()
  }, [])

  const respond = async (id: string, status: 'confirmed' | 'rejected') => {
    let rejectionReason: string | null = null
    if (status === 'rejected') {
      rejectionReason = window.prompt('Motivo da rejeição (opcional):', '')
      if (rejectionReason === null) return
    } else if (!window.confirm('Confirmar este pagamento? A validade avança 1 ano de imediato.')) {
      return
    }

    setUpdatingId(id)
    try {
      const res = await fetch(`/api/admin/renewal-pagamentos/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, rejectionReason }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Não foi possível actualizar o pedido.')
      load()
    } catch (error: any) {
      window.alert(error.message || 'Falha ao comunicar com o servidor.')
    } finally {
      setUpdatingId(null)
    }
  }

  if (!pedidos) {
    return <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-400 dark:text-zinc-500"><Spinner /> A carregar pagamentos de renovação...</div>
  }
  if (pedidos.length === 0) {
    return <div className={`${panelSectionCard} p-8 text-center text-sm text-gray-500 dark:text-zinc-400`}>Ainda não há pedidos de pagamento de renovação.</div>
  }

  return (
    <div className={`${panelSectionCard} overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-xs font-bold uppercase tracking-wide text-gray-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
              <th className="px-4 py-2 align-middle text-left">Item</th>
              <th className="px-4 py-2 align-middle text-left whitespace-nowrap">Valor</th>
              <th className="px-4 py-2 align-middle text-left whitespace-nowrap">Método</th>
              <th className="px-4 py-2 align-middle text-left whitespace-nowrap">Data</th>
              <th className="px-4 py-2 align-middle text-left">Cliente</th>
              <th className="px-4 py-2 align-middle text-left whitespace-nowrap">Anexo</th>
              <th className="px-4 py-2 align-middle text-left whitespace-nowrap">Estado</th>
              <th className="px-4 py-2 align-middle text-left whitespace-nowrap">Aceitação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
            {pedidos.map((p) => {
              const meta = CREDITO_STATUS_META[p.status]
              const isExpanded = expandedId === p.id
              return (
                <Fragment key={p.id}>
                <tr className="hover:bg-gray-50 dark:hover:bg-zinc-800/30">
                  <td className="max-w-[16rem] px-4 py-2.5 font-medium text-gray-900 dark:text-white">
                    <div className="flex items-start gap-1.5">
                      <button
                        type="button"
                        onClick={() => setExpandedId(isExpanded ? null : p.id)}
                        className="mt-0.5 shrink-0 text-gray-400 hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-200"
                        title="Ver dados da empresa"
                      >
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                      <div className="min-w-0 truncate">
                        {p.service_name}
                        <span className="block text-xs font-normal text-gray-400 dark:text-zinc-500">
                          {p.renewal_type === 'domain' ? 'Domínio' : 'Hospedagem'}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-left font-bold tabular-nums text-gray-900 dark:text-white">
                    {formatMt(p.valor_mt)} MT
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-gray-500 dark:text-zinc-400">
                    {METODO_LABEL[p.metodo_pagamento] || p.metodo_pagamento}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-gray-500 dark:text-zinc-400">
                    {new Date(p.created_at).toLocaleDateString('pt-PT')}
                  </td>
                  <td className="max-w-[12rem] truncate px-4 py-2.5 text-gray-500 dark:text-zinc-400">
                    {p.cliente?.nome || p.cliente?.empresa || p.cliente?.email || '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    {p.comprovativo_url ? (
                      <button
                        type="button"
                        onClick={() => setLightboxUrl(p.comprovativo_url)}
                        className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                      >
                        Ver anexo
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400 dark:text-zinc-500">Sem comprovativo</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-left">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${meta.className}`}>{meta.label}</span>
                    {p.status === 'rejected' && p.rejection_reason && (
                      <p className="mt-1 text-xs text-gray-400 dark:text-zinc-500">{p.rejection_reason}</p>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-left">
                    {p.status === 'pending' && (
                      <div className="flex items-center justify-start gap-2">
                        <button
                          type="button"
                          disabled={updatingId === p.id}
                          onClick={() => respond(p.id, 'confirmed')}
                          className="text-xs font-medium text-green-600 hover:underline disabled:opacity-50 dark:text-green-400"
                        >
                          Confirmar
                        </button>
                        <button
                          type="button"
                          disabled={updatingId === p.id}
                          onClick={() => respond(p.id, 'rejected')}
                          className="text-xs font-medium text-rose-600 hover:underline disabled:opacity-50 dark:text-rose-400"
                        >
                          Rejeitar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="bg-gray-50 dark:bg-zinc-900/40">
                    <td colSpan={8} className="px-4 py-4">
                      <ClienteInfoInline cliente={p.cliente} />
                    </td>
                  </tr>
                )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
      {lightboxUrl && <ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}
    </div>
  )
}

type CheckoutItem = {
  name: string
  type: string
  status?: 'pending' | 'paid' | 'failed'
  rejectionReason?: string | null
  hostingDomain?: string
}

type CheckoutPedido = {
  id: string
  user_id: string
  user_email: string | null
  cliente: Cliente | null
  items: CheckoutItem[]
  total_mt: number
  metodo_pagamento: string
  status: 'pending' | 'paid' | 'failed' | 'expired'
  comprovativo_url: string | null
  created_at: string
}

const ITEM_STATUS_META: Record<'pending' | 'paid' | 'failed' | 'expired', { label: string; className: string }> = {
  pending: { label: 'Pendente', className: 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400' },
  paid: { label: 'Confirmado', className: 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400' },
  failed: { label: 'Rejeitado', className: 'bg-rose-100 text-rose-700 dark:bg-rose-950/30 dark:text-rose-400' },
  expired: { label: 'Expirado', className: 'bg-gray-100 text-gray-700 dark:bg-zinc-800 dark:text-zinc-400' },
}

/**
 * Itens de um tipo (domínio/hospedagem/e-mail) de compras novas do carrinho
 * pagas por M-Pesa/Transferência — Cartão via Stripe não aparece aqui. Um
 * pedido pode ter itens de tipos diferentes (ex: domínio + hospedagem juntos);
 * cada item é aprovado separadamente (mesma lógica das Encomendas), por isso
 * aqui iteramos item a item, não pedido a pedido — o mesmo pedido pode
 * aparecer neste separador e noutro, cada vez só com o item relevante.
 */
function CheckoutItemsByType({ types }: { types: string[] }) {
  const [pedidos, setPedidos] = useState<CheckoutPedido[] | null>(null)
  const [updatingKey, setUpdatingKey] = useState<string | null>(null)
  const [deletingKey, setDeletingKey] = useState<string | null>(null)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  // #6: corrige/define o domínio de uma hospedagem mesmo aqui, antes de confirmar —
  // sem isto, um pedido de hospedagem sem domínio ficava preso sem forma de o resolver.
  const [domainDraft, setDomainDraft] = useState<Record<string, string>>({})

  const load = () => {
    fetch('/api/admin/checkout-pagamentos')
      .then((r) => r.json())
      .then((data) => { if (data.success) setPedidos(data.pedidos) })
      .catch((error) => console.error('Erro ao carregar pagamentos do carrinho:', error))
  }

  useEffect(() => {
    load()
  }, [])

  const respond = async (pedidoId: string, itemIndex: number, status: 'paid' | 'failed', hostingDomain?: string) => {
    let rejectionReason: string | null = null
    if (status === 'failed') {
      rejectionReason = window.prompt('Motivo da rejeição (opcional):', '')
      if (rejectionReason === null) return
    } else if (!window.confirm('Confirmar este item? O produto é activado de imediato.')) {
      return
    }

    const key = `${pedidoId}-${itemIndex}`
    setUpdatingKey(key)
    try {
      const res = await fetch(`/api/admin/checkout-pagamentos/${pedidoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIndex, status, rejectionReason, hostingDomain }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Não foi possível actualizar o item.')
      load()
    } catch (error: any) {
      window.alert(error.message || 'Falha ao comunicar com o servidor.')
    } finally {
      setUpdatingKey(null)
    }
  }

  const deleteHostingItem = async (pedidoId: string, itemIndex: number, domain?: string) => {
    const aviso = domain
      ? `Apagar esta encomenda de hospedagem (${domain})? Isto remove o pedido, o registo de hospedagem, e o site real no servidor. Não pode ser desfeito.`
      : 'Apagar esta encomenda de hospedagem? Isto remove o pedido e o registo de hospedagem. Não pode ser desfeito.'
    if (!window.confirm(aviso)) return

    const key = `${pedidoId}-${itemIndex}`
    setDeletingKey(key)
    try {
      const res = await fetch(`/api/admin/checkout-pagamentos/${pedidoId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIndex }),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error || 'Não foi possível apagar este item.')
      if (data.warnings?.length) window.alert(data.warnings.join('\n'))
      load()
    } catch (error: any) {
      window.alert(error.message || 'Falha ao comunicar com o servidor.')
    } finally {
      setDeletingKey(null)
    }
  }

  if (!pedidos) {
    return <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-400 dark:text-zinc-500"><Spinner /> A carregar pagamentos do carrinho...</div>
  }

  const rows = pedidos.flatMap((p) =>
    (p.items || [])
      .map((item, itemIndex) => ({ pedido: p, item, itemIndex }))
      .filter(({ item }) => types.includes(item.type)),
  )

  if (rows.length === 0) {
    return <div className={`${panelSectionCard} p-8 text-center text-sm text-gray-500 dark:text-zinc-400`}>Ainda não há pedidos de pagamento manual do carrinho nesta categoria.</div>
  }

  return (
    <div className={`${panelSectionCard} overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-xs font-bold uppercase tracking-wide text-gray-500 dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-400">
              <th className="px-4 py-2 align-middle text-left">Item</th>
              <th className="px-4 py-2 align-middle text-left whitespace-nowrap">Valor</th>
              <th className="px-4 py-2 align-middle text-left whitespace-nowrap">Método</th>
              <th className="px-4 py-2 align-middle text-left whitespace-nowrap">Data</th>
              <th className="px-4 py-2 align-middle text-left">Cliente</th>
              <th className="px-4 py-2 align-middle text-left whitespace-nowrap">Anexo</th>
              <th className="px-4 py-2 align-middle text-left whitespace-nowrap">Estado</th>
              <th className="px-4 py-2 align-middle text-left whitespace-nowrap">Aceitação</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
            {rows.map(({ pedido: p, item, itemIndex }) => {
              const itemStatus = item.status ?? p.status
              const key = `${p.id}-${itemIndex}`
              const outrosItens = (p.items || []).filter((_, i) => i !== itemIndex).map((i) => i.name)
              const meta = ITEM_STATUS_META[itemStatus] || ITEM_STATUS_META.pending
              const isExpanded = expandedKey === key
              return (
                <Fragment key={key}>
                <tr className="hover:bg-gray-50 dark:hover:bg-zinc-800/30">
                  <td className="max-w-[16rem] px-4 py-2.5 font-medium text-gray-900 dark:text-white">
                    <div className="flex items-start gap-1.5">
                      <button
                        type="button"
                        onClick={() => setExpandedKey(isExpanded ? null : key)}
                        className="mt-0.5 shrink-0 text-gray-400 hover:text-gray-700 dark:text-zinc-500 dark:hover:text-zinc-200"
                        title="Ver dados da empresa"
                      >
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      </button>
                      <div className="min-w-0 truncate">
                        {item.name}
                        {outrosItens.length > 0 && (
                          <span className="text-gray-400 dark:text-zinc-500"> (+ {outrosItens.join(', ')})</span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-left font-bold tabular-nums text-gray-900 dark:text-white">
                    {formatMt(p.total_mt)} MT
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-gray-500 dark:text-zinc-400">
                    {METODO_LABEL[p.metodo_pagamento] || p.metodo_pagamento}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-gray-500 dark:text-zinc-400">
                    {new Date(p.created_at).toLocaleDateString('pt-PT')}
                  </td>
                  <td className="max-w-[12rem] truncate px-4 py-2.5 text-gray-500 dark:text-zinc-400">
                    {p.cliente?.nome || p.cliente?.empresa || p.user_email || '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5">
                    {p.comprovativo_url ? (
                      <button
                        type="button"
                        onClick={() => setLightboxUrl(p.comprovativo_url)}
                        className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
                      >
                        Ver anexo
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400 dark:text-zinc-500">Sem comprovativo</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-left">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${meta.className}`}>{meta.label}</span>
                    {itemStatus === 'failed' && item.rejectionReason && (
                      <p className="mt-1 text-xs text-gray-400 dark:text-zinc-500">{item.rejectionReason}</p>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-left">
                    <div className="flex items-center justify-start gap-2">
                      {itemStatus === 'pending' && (
                        <>
                          <button
                            type="button"
                            disabled={updatingKey === key}
                            onClick={() => respond(p.id, itemIndex, 'paid', domainDraft[key])}
                            className="text-xs font-medium text-green-600 hover:underline disabled:opacity-50 dark:text-green-400"
                          >
                            Confirmar
                          </button>
                          <button
                            type="button"
                            disabled={updatingKey === key}
                            onClick={() => respond(p.id, itemIndex, 'failed')}
                            className="text-xs font-medium text-rose-600 hover:underline disabled:opacity-50 dark:text-rose-400"
                          >
                            Rejeitar
                          </button>
                        </>
                      )}
                      {item.type === 'hosting' && (
                        <button
                          type="button"
                          disabled={deletingKey === key}
                          onClick={() => deleteHostingItem(p.id, itemIndex, item.hostingDomain)}
                          className="text-xs font-medium text-gray-500 hover:underline disabled:opacity-50 dark:text-zinc-500"
                          title="Apagar encomenda, registo de hospedagem e site real no servidor"
                        >
                          Apagar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="bg-gray-50 dark:bg-zinc-900/40">
                    <td colSpan={8} className="px-4 py-4">
                      <ClienteInfoInline
                        cliente={p.cliente}
                        domainSlot={
                          item.type === 'hosting' ? (
                            <HostingDomainFixField
                              pedidoItems={p.items}
                              currentDomain={item.hostingDomain}
                              value={domainDraft[key] ?? item.hostingDomain ?? ''}
                              onChange={(v) => setDomainDraft((d) => ({ ...d, [key]: v }))}
                            />
                          ) : undefined
                        }
                      />
                    </td>
                  </tr>
                )}
                </Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
      {lightboxUrl && <ImageLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}
    </div>
  )
}
