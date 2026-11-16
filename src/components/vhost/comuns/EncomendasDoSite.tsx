'use client'

// Calculadora › «Encomendas do site»: os pedidos de cotação de brindes que os clientes enviam pelo site (tabela quotation_requests, a mesma de
// Cotações recebidas) aparecem aqui sozinhos, já com os dados da empresa e do responsável. Uma encomenda fica à vista até ser respondida no
// painel (o preço deixa de ser «sob consulta»); as respondidas passam a «Encomendas anteriores». Daqui carrega-se a encomenda na calculadora.

import { useEffect, useState } from 'react'
import { computeNumeroMap } from '@/lib/quotation-numero'
import { statusMeta } from '@/lib/quotation-status-labels'

export interface ItemEncomenda {
  sku: string | null
  nome: string
  unidades: number
  /** cor, tamanhos e personalização que o cliente escolheu */
  detalhe: string
}

export interface EncomendaSite {
  batchId: string
  numero: string
  empresa: string
  responsavel: string
  telefone: string
  email: string
  nif: string
  endereco: string
  criada: string
  estado: string
  porResponder: boolean
  itens: ItemEncomenda[]
}

interface Linha {
  id: string
  batch_id: string
  categoria_id: string
  created_at: string
  produto: string
  quantidade: number | string
  status: string
  sob_consulta: boolean
  empresa: string
  responsavel: string
  telefone: string
  email: string
  nif: string | null
  endereco: string | null
}

// o pedido de brindes escreve cada linha assim: «nome — ref. SKU (marca) — o que foi escolhido» (ver brindes/pedido.ts)
const REF = / — ref\. (\S+)(?: \([^)]*\))?(?: — (.*))?$/

function lerItem(l: Linha): ItemEncomenda {
  const m = REF.exec(l.produto)
  return { sku: m?.[1] ?? null, nome: m ? l.produto.slice(0, m.index) : l.produto, unidades: Math.max(1, Math.round(Number(l.quantidade) || 1)), detalhe: m?.[2] ?? '' }
}

export function encomendasDoSite(linhas: Linha[]): EncomendaSite[] {
  const numeros = computeNumeroMap(linhas)
  const lotes = new Map<string, Linha[]>()
  for (const l of linhas) lotes.set(l.batch_id, [...(lotes.get(l.batch_id) ?? []), l])
  const res: EncomendaSite[] = []
  for (const [batchId, ls] of lotes) {
    const brindes = ls.filter((l) => l.categoria_id === 'personalizado' && REF.test(l.produto))
    if (!brindes.length) continue
    const p = ls[0]
    res.push({
      batchId,
      numero: numeros.get(batchId) ?? batchId.slice(0, 8).toUpperCase(),
      empresa: p.empresa,
      responsavel: p.responsavel,
      telefone: p.telefone,
      email: p.email,
      nif: p.nif ?? '',
      endereco: p.endereco ?? '',
      criada: p.created_at,
      estado: statusMeta(p.status, p.sob_consulta).label,
      // fica por responder enquanto algum produto está «sob consulta» e ainda a aguardar (ver Cotações recebidas)
      porResponder: ls.some((l) => l.sob_consulta && l.status === 'pending'),
      itens: brindes.map(lerItem),
    })
  }
  return res.sort((a, b) => b.criada.localeCompare(a.criada))
}

const BOTAO = 'inline-flex cursor-pointer items-center rounded-[5px] border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-sm transition hover:border-red-500 hover:text-red-600 disabled:cursor-default disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200'

function UmaEncomenda({ e, atual, aoCarregar }: { e: EncomendaSite; atual: string | null; aoCarregar: (e: EncomendaSite) => void }) {
  const data = new Date(e.criada).toLocaleDateString('pt-MZ')
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-200 py-2.5 first:border-t-0 dark:border-slate-700">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-slate-900 dark:text-slate-100">
          {e.numero} · {e.empresa}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {e.responsavel} · {e.telefone} · {e.email} · {data} · {e.itens.length} produto(s) · {e.estado}
        </p>
      </div>
      <button type="button" disabled={atual === e.batchId} onClick={() => aoCarregar(e)} className={BOTAO}>
        {atual === e.batchId ? 'Na calculadora' : 'Carregar na calculadora'}
      </button>
    </li>
  )
}

export function EncomendasDoSite({ atual, aoCarregar, aoVoltar }: { atual: string | null; aoCarregar: (e: EncomendaSite) => void; aoVoltar?: () => void }) {
  const [lista, setLista] = useState<EncomendaSite[] | null>(null)
  const [erro, setErro] = useState(false)
  useEffect(() => {
    let vivo = true
    fetch('/api/admin/cotacoes', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j: { success?: boolean; cotacoes?: Linha[] }) => {
        if (!vivo) return
        if (j.success && Array.isArray(j.cotacoes)) setLista(encomendasDoSite(j.cotacoes))
        else setErro(true)
      })
      .catch(() => vivo && setErro(true))
    return () => {
      vivo = false
    }
  }, [])

  if (erro) return <p className="text-xs text-red-600">Não foi possível ler as encomendas do site.</p>
  if (!lista || !lista.length) return null
  const porResponder = lista.filter((e) => e.porResponder)
  const anteriores = lista.filter((e) => !e.porResponder)
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900" data-testid="cci-encomendas">
      <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Encomendas do site</h2>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Os pedidos de brindes que os clientes enviam ficam aqui até serem respondidos no painel.</p>
      {aoVoltar && (
        <button type="button" onClick={aoVoltar} className={`${BOTAO} mt-3`}>
          Voltar à lista própria
        </button>
      )}
      {porResponder.length > 0 ? (
        <ul className="mt-3">
          {porResponder.map((e) => (
            <UmaEncomenda key={e.batchId} e={e} atual={atual} aoCarregar={aoCarregar} />
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">Não há encomendas por responder.</p>
      )}
      {anteriores.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-semibold text-slate-700 dark:text-slate-300">Encomendas anteriores ({anteriores.length})</summary>
          <ul className="mt-2">
            {anteriores.slice(0, 30).map((e) => (
              <UmaEncomenda key={e.batchId} e={e} atual={atual} aoCarregar={aoCarregar} />
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
