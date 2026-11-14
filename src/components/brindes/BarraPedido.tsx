'use client'

// A barra que aparece em baixo quando há produtos no pedido (listagem do catálogo).

import { ArrowRight, X } from 'lucide-react'
import { usePedido } from '@/components/brindes/pedido'

export function BarraPedido() {
  const { itens, limpar, pedirCotacao } = usePedido()
  if (itens.length === 0) return null
  return (
    <div className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-3xl items-center gap-3 rounded-xl bg-zinc-900 px-4 py-3 text-white shadow-2xl ring-1 ring-white/10">
      <span className="flex flex-1 items-baseline gap-1.5 text-sm">
        <span className="font-extrabold">{itens.length}</span>
        <span>produto(s) no pedido</span>
      </span>
      <button type="button" onClick={limpar} className="inline-flex cursor-pointer items-center gap-1 text-xs text-zinc-300 hover:text-white">
        <X className="h-3.5 w-3.5" />
        <span>Limpar</span>
      </button>
      <button
        type="button"
        onClick={() => pedirCotacao()}
        className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-red-700"
      >
        <span>Pedir Cotação</span>
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  )
}
