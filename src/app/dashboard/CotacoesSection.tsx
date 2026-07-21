'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, FileText, Building2, Phone, Mail, Calendar, ExternalLink } from 'lucide-react'
import { panelCard, panelBtn, panelBtnPrimary, panelBtnSecondary, panelField, panelSectionPadding } from '@/lib/panel-ui'
import { formatMt } from '@/lib/pricing-catalog'

interface QuotationRequest {
  id: string
  empresa: string
  nif: string | null
  responsavel: string
  cargo: string | null
  telefone: string
  email: string
  categoria_label: string
  produto: string
  preco_unitario_mt: number
  quantidade: number
  data_limite_entrega: string
  total_mt: number
  sob_consulta: boolean
  metodo_pagamento: string | null
  status: 'pending' | 'payment_selected' | 'done' | 'cancelled'
  notas: string | null
  created_at: string
}

const STATUS_OPTIONS: { value: QuotationRequest['status']; label: string; badge: string }[] = [
  { value: 'pending', label: 'Pendente', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400' },
  { value: 'payment_selected', label: 'Pagamento Escolhido', badge: 'bg-blue-100 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400' },
  { value: 'done', label: 'Concluída', badge: 'bg-green-100 text-green-700 dark:bg-green-950/30 dark:text-green-400' },
  { value: 'cancelled', label: 'Cancelada', badge: 'bg-gray-200 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400' },
]

function statusMeta(status: string) {
  return STATUS_OPTIONS.find((s) => s.value === status) || STATUS_OPTIONS[0]
}

const metodoLabel = (m: string | null) => (m === 'mpesa' ? 'M-Pesa' : m === 'transferencia' ? 'Transferência' : '—')

export function CotacoesSection() {
  const [cotacoes, setCotacoes] = useState<QuotationRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | QuotationRequest['status']>('all')
  const [updatingId, setUpdatingId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const fetchCotacoes = useCallback(async () => {
    setLoading(true)
    try {
      const qs = filter !== 'all' ? `?status=${filter}` : ''
      const res = await fetch(`/api/admin/cotacoes${qs}`)
      const data = await res.json()
      if (data.success) setCotacoes(data.cotacoes)
    } catch (error) {
      console.error('Erro ao carregar cotações:', error)
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    fetchCotacoes()
  }, [fetchCotacoes])

  const updateStatus = async (id: string, status: QuotationRequest['status']) => {
    setUpdatingId(id)
    try {
      const res = await fetch('/api/admin/cotacoes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      const data = await res.json()
      if (data.success) {
        setCotacoes((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c)))
      }
    } catch (error) {
      console.error('Erro ao actualizar cotação:', error)
    } finally {
      setUpdatingId(null)
    }
  }

  return (
    <div className={panelSectionPadding}>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-red-600" />
            Cotações Recebidas
          </h2>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-0.5">
            Pedidos de cotação submetidos a partir de /precos.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            className={panelField}
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
          >
            <option value="all">Todos os estados</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <button className={panelBtnSecondary} onClick={fetchCotacoes} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-sm text-gray-400 dark:text-zinc-500">A carregar cotações...</div>
      ) : cotacoes.length === 0 ? (
        <div className={`${panelCard} p-8 text-center text-sm text-gray-500 dark:text-zinc-400`}>
          Nenhuma cotação encontrada para este filtro.
        </div>
      ) : (
        <div className="space-y-3">
          {cotacoes.map((c) => {
            const isExpanded = expandedId === c.id
            const meta = statusMeta(c.status)
            return (
              <div key={c.id} className={panelCard}>
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : c.id)}
                  className="w-full flex flex-wrap items-center gap-4 p-4 text-left"
                >
                  <div className="flex-1 min-w-[200px]">
                    <p className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
                      {c.empresa}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">
                      {c.categoria_label} — {c.produto} (x{c.quantidade})
                    </p>
                  </div>
                  <div className="text-sm text-gray-700 dark:text-zinc-300 font-semibold whitespace-nowrap">
                    {c.sob_consulta ? 'Sob Consulta' : `${formatMt(c.total_mt)} MT`}
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap ${meta.badge}`}>
                    {meta.label}
                  </span>
                  <span className="text-xs text-gray-400 dark:text-zinc-500 whitespace-nowrap">
                    {new Date(c.created_at).toLocaleDateString('pt-PT')}
                  </span>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100 dark:border-zinc-800 p-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="space-y-1.5">
                      <p className="text-xs font-bold uppercase text-gray-400 dark:text-zinc-500">Responsável</p>
                      <p className="text-gray-800 dark:text-zinc-200">{c.responsavel}{c.cargo ? ` — ${c.cargo}` : ''}</p>
                      <p className="text-gray-500 dark:text-zinc-400 flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {c.telefone}</p>
                      <p className="text-gray-500 dark:text-zinc-400 flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {c.email}</p>
                      {c.nif && <p className="text-gray-500 dark:text-zinc-400">NIF: {c.nif}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-xs font-bold uppercase text-gray-400 dark:text-zinc-500">Entrega & Pagamento</p>
                      <p className="text-gray-500 dark:text-zinc-400 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5" /> Até {new Date(c.data_limite_entrega).toLocaleDateString('pt-PT')}
                      </p>
                      <p className="text-gray-500 dark:text-zinc-400">Método: {metodoLabel(c.metodo_pagamento)}</p>
                      {c.notas && <p className="text-gray-500 dark:text-zinc-400 italic">"{c.notas}"</p>}
                    </div>

                    <div className="md:col-span-2 flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100 dark:border-zinc-800">
                      <span className="text-xs font-bold uppercase text-gray-400 dark:text-zinc-500 mr-1">Marcar como:</span>
                      {STATUS_OPTIONS.filter((s) => s.value !== c.status).map((s) => (
                        <button
                          key={s.value}
                          className={panelBtn + ' border border-gray-200 dark:border-zinc-700 bg-white dark:bg-transparent text-gray-700 dark:text-zinc-300 hover:bg-gray-50'}
                          disabled={updatingId === c.id}
                          onClick={(e) => { e.stopPropagation(); updateStatus(c.id, s.value) }}
                        >
                          {s.label}
                        </button>
                      ))}
                      <a
                        href={`/cotacao/${c.id}`}
                        target="_blank"
                        rel="noreferrer"
                        className={panelBtnPrimary + ' ml-auto'}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Ver documento</span>
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
