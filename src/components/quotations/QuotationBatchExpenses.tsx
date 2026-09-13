'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Check, ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { panelField } from '@/lib/panel-ui'
import { formatMt } from '@/lib/pricing-catalog'
import { Spinner } from '@/components/ui/spinner'

type Expense = {
  id: string
  descricao: string
  valor_mt: number
  quantidade: number
}

function expenseTotal(d: Pick<Expense, 'valor_mt' | 'quantidade'>): number {
  return (d.valor_mt || 0) * (d.quantidade || 1)
}

export function QuotationBatchExpenses({
  batchId,
  receitaMt,
  onSaldoChange,
}: {
  batchId: string
  receitaMt?: number | null
  onSaldoChange?: (negativo: boolean) => void
}) {
  const [despesas, setDespesas] = useState<Expense[] | null>(null)
  const [draftDescricao, setDraftDescricao] = useState('')
  const [draftQuantidade, setDraftQuantidade] = useState('1')
  const [draftValor, setDraftValor] = useState('')
  const [collapsed, setCollapsed] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDescricao, setEditDescricao] = useState('')
  const [editQuantidade, setEditQuantidade] = useState('1')
  const [editValor, setEditValor] = useState('')

  useEffect(() => {
    fetch(`/api/admin/cotacoes/${batchId}/despesas`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success) setDespesas(data.despesas)
      })
      .catch((error) => console.error('Erro ao carregar despesas:', error))
  }, [batchId])

  const addExpense = async () => {
    const descricao = draftDescricao.trim()
    const valorMt = Number(draftValor) || 0
    const quantidade = Number(draftQuantidade) || 1
    if (!descricao && !valorMt) return

    try {
      const res = await fetch(`/api/admin/cotacoes/${batchId}/despesas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descricao, valorMt, quantidade }),
      })
      const data = await res.json()
      if (data.success) {
        setDespesas((prev) => [...(prev ?? []), data.despesa])
        setDraftDescricao('')
        setDraftQuantidade('1')
        setDraftValor('')
      }
    } catch (error) {
      console.error('Erro ao adicionar despesa:', error)
    }
  }

  const removeExpense = async (id: string) => {
    setDespesas((prev) => prev?.filter((d) => d.id !== id) ?? null)
    try {
      await fetch(`/api/admin/cotacoes/${batchId}/despesas/${id}`, { method: 'DELETE' })
    } catch (error) {
      console.error('Erro ao remover despesa:', error)
    }
  }

  const startEditing = (d: Expense) => {
    setEditingId(d.id)
    setEditDescricao(d.descricao)
    setEditQuantidade(String(d.quantidade || 1))
    setEditValor(String(d.valor_mt))
  }

  const commitEdit = async (id: string) => {
    const descricao = editDescricao.trim()
    const valorMt = Number(editValor) || 0
    const quantidade = Number(editQuantidade) || 1
    setEditingId(null)
    setDespesas((prev) => prev?.map((d) => (d.id === id ? { ...d, descricao, valor_mt: valorMt, quantidade } : d)) ?? null)
    try {
      await fetch(`/api/admin/cotacoes/${batchId}/despesas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ descricao, valorMt, quantidade }),
      })
    } catch (error) {
      console.error('Erro ao actualizar despesa:', error)
    }
  }

  const total = (despesas ?? []).reduce((sum, d) => sum + expenseTotal(d), 0)
  const saldoNegativo = typeof receitaMt === 'number' && total > receitaMt

  useEffect(() => {
    onSaldoChange?.(saldoNegativo)
  }, [saldoNegativo, onSaldoChange])

  if (!despesas) {
    return <p className="flex items-center gap-2 text-xs text-gray-400 dark:text-zinc-500"><Spinner /> A carregar despesas de produção...</p>
  }

  const totalLabel = total === 0 ? '00,00' : formatMt(total)
  const [first, ...rest] = despesas

  const renderExpenseFields = (d: Expense) => {
    if (editingId === d.id) {
      return (
        <>
          <input
            autoFocus
            type="text"
            value={editDescricao}
            onChange={(e) => setEditDescricao(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitEdit(d.id)
              if (e.key === 'Escape') setEditingId(null)
            }}
            className={`${panelField} min-w-0 flex-1 py-1 text-right text-sm`}
          />
          <input
            type="number"
            step="1"
            min="0"
            value={editQuantidade}
            onChange={(e) => setEditQuantidade(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitEdit(d.id)
              if (e.key === 'Escape') setEditingId(null)
            }}
            className={`${panelField} w-14 shrink-0 py-1 text-right text-sm`}
            title="Quantidade"
          />
          <input
            type="number"
            step="0.01"
            value={editValor}
            onChange={(e) => setEditValor(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitEdit(d.id)
              if (e.key === 'Escape') setEditingId(null)
            }}
            className={`${panelField} w-24 shrink-0 py-1 text-right text-sm`}
            title="Valor unitário"
          />
          <span className="w-24 shrink-0 whitespace-nowrap text-right text-sm text-gray-400 dark:text-zinc-500">
            {formatMt((Number(editValor) || 0) * (Number(editQuantidade) || 1))} MT
          </span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); commitEdit(d.id) }}
            className="ml-2 shrink-0 text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 transition-colors"
            title="Guardar"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
        </>
      )
    }
    return (
      <>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); startEditing(d) }}
          className="min-w-0 flex-1 truncate text-right font-normal text-gray-700 hover:text-red-600 dark:text-zinc-300 dark:hover:text-red-400 transition-colors"
          title="Clique para editar"
        >
          {d.descricao}
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); startEditing(d) }}
          className="w-14 shrink-0 whitespace-nowrap text-right font-normal text-gray-500 hover:text-red-600 dark:text-zinc-400 dark:hover:text-red-400 transition-colors"
          title="Clique para editar"
        >
          x{d.quantidade || 1}
        </button>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); startEditing(d) }}
          className="w-24 shrink-0 whitespace-nowrap text-right font-normal text-gray-700 hover:text-red-600 dark:text-zinc-300 dark:hover:text-red-400 transition-colors"
          title="Clique para editar (valor unitário)"
        >
          {formatMt(d.valor_mt)} MT
        </button>
        <span className="w-24 shrink-0 whitespace-nowrap text-right font-normal text-gray-700 dark:text-zinc-300">
          {formatMt(expenseTotal(d))} MT
        </span>
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); removeExpense(d.id) }}
          className="ml-2 shrink-0 text-gray-300 hover:text-red-600 dark:text-zinc-600 dark:hover:text-red-500 transition-colors"
          title="Remover"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </>
    )
  }

  return (
    <div className="space-y-2">
      <div className="rounded-lg border border-gray-100 dark:border-zinc-800 overflow-hidden">
        <div className="divide-y divide-gray-100 dark:divide-zinc-800">
          <div
            role="button"
            tabIndex={0}
            onClick={() => setCollapsed((v) => !v)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCollapsed((v) => !v) } }}
            className="flex items-center gap-3 px-3 py-2.5 text-sm bg-white dark:bg-zinc-900 cursor-pointer"
            title={collapsed ? 'Expandir despesas' : 'Colapsar despesas'}
          >
            <span className="shrink-0 text-gray-400 dark:text-zinc-500">
              {collapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </span>
            <span className="shrink-0 text-xs font-bold uppercase tracking-wide text-gray-600 dark:text-zinc-300 whitespace-nowrap">
              Adicionar material de produção
            </span>
            {collapsed ? (
              <>
                <span className="min-w-0 flex-1 truncate text-right text-xs font-bold uppercase tracking-wide text-gray-400 dark:text-zinc-500">
                  Total das despesas de produção
                </span>
                <span className="w-24 shrink-0 whitespace-nowrap text-right text-sm font-bold text-gray-900 dark:text-white">{totalLabel} MT</span>
                <span className="ml-2 w-3.5 shrink-0" aria-hidden="true" />
              </>
            ) : first ? (
              <>
                <span className="min-w-0 flex-1" />
                <span className="w-14 shrink-0 whitespace-nowrap text-right text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-zinc-500">Qtd</span>
                <span className="w-24 shrink-0 whitespace-nowrap text-right text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-zinc-500">V. unitário</span>
                <span className="w-24 shrink-0 whitespace-nowrap text-right text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-zinc-500">V. total</span>
                <span className="ml-2 w-3.5 shrink-0" aria-hidden="true" />
              </>
            ) : (
              <span className="flex-1" />
            )}
          </div>

          {!collapsed && first && (
            <div className="flex items-center gap-3 px-3 py-2.5 text-sm bg-white dark:bg-zinc-900">
              {renderExpenseFields(first)}
            </div>
          )}

          {!collapsed && rest.map((d) => (
            <div
              key={d.id}
              className="flex items-center gap-3 px-3 py-2.5 text-sm bg-white dark:bg-zinc-900"
            >
              {renderExpenseFields(d)}
            </div>
          ))}

          {!collapsed && (
            <div className="flex items-center gap-3 px-3 py-3 bg-gray-50 dark:bg-zinc-800/60">
              {saldoNegativo ? (
                <span className="flex min-w-0 flex-1 items-start gap-1.5 text-left text-xs text-red-700 dark:text-red-400">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>
                    Saldo negativo: as despesas de produção ({formatMt(total)} MT) ultrapassam o valor da encomenda ({formatMt(receitaMt as number)} MT).
                  </span>
                </span>
              ) : (
                <span className="min-w-0 flex-1" />
              )}
              <span className="shrink-0 whitespace-nowrap text-right text-sm font-bold text-gray-900 dark:text-white">
                Total das despesas de produção
              </span>
              <span className="w-24 shrink-0 whitespace-nowrap text-right text-sm font-bold text-gray-900 dark:text-white">
                {totalLabel} MT
              </span>
              <span className="ml-2 w-3.5 shrink-0" aria-hidden="true" />
            </div>
          )}
        </div>
      </div>

      {!collapsed && (
        <div className="flex items-center gap-3 pr-3">
          <span className="flex-1" />
          <input
            type="text"
            placeholder="Material/gasto"
            value={draftDescricao}
            onChange={(e) => setDraftDescricao(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addExpense() }}
            className={`${panelField} min-w-0 w-[280px] shrink-0`}
          />
          <input
            type="number"
            step="1"
            min="0"
            placeholder="Qtd"
            value={draftQuantidade}
            onChange={(e) => setDraftQuantidade(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addExpense() }}
            className={`${panelField} w-14 shrink-0 text-right`}
            title="Quantidade"
          />
          <input
            type="number"
            step="0.01"
            placeholder="V. unit."
            value={draftValor}
            onChange={(e) => setDraftValor(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addExpense() }}
            className={`${panelField} w-24 shrink-0 text-right`}
            title="Valor unitário"
          />
          <span className="w-24 shrink-0 whitespace-nowrap text-right text-sm text-gray-400 dark:text-zinc-500">
            {formatMt((Number(draftValor) || 0) * (Number(draftQuantidade) || 1))} MT
          </span>
          <button
            type="button"
            onClick={addExpense}
            className="ml-2 shrink-0 text-gray-400 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-500 transition-colors"
            title="Adicionar material"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  )
}
