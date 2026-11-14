// Uma secção de produtos («Explore mais …»): título, frase, botão «Ver mais» e uma grelha de cartões todos da mesma altura.

import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { CartaoProduto, type ProdutoCartao } from '@/components/brindes/CartaoProduto'

export function GrelhaProdutos({ produtos }: { produtos: ProdutoCartao[] }) {
  return (
    <div className="grid auto-rows-fr grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-5" data-testid="catalogo-grade">
      {produtos.map((p) => (
        <CartaoProduto key={p.sku} p={p} />
      ))}
    </div>
  )
}

export function SeccaoProdutos({ antetitulo, titulo, texto, produtos, href, rotulo = 'Ver mais' }: { antetitulo?: string; titulo: React.ReactNode; texto?: string; produtos: ProdutoCartao[]; href?: string; rotulo?: React.ReactNode }) {
  if (produtos.length === 0) return null
  return (
    <section className="py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          {antetitulo && <p className="mb-1 text-xs font-bold uppercase tracking-[0.2em] text-red-600 dark:text-red-500">{antetitulo}</p>}
          <h2 className="text-2xl font-extrabold uppercase tracking-tight text-zinc-900 dark:text-white sm:text-3xl">{titulo}</h2>
          {texto && <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{texto}</p>}
        </div>
        {href && (
          <Link href={href} className="inline-flex items-center gap-2 rounded-full border border-zinc-300 px-5 py-2 text-sm font-semibold text-zinc-800 transition-colors hover:border-red-600 hover:text-red-600 dark:border-zinc-700 dark:text-zinc-200">
            <span>{rotulo}</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
      <GrelhaProdutos produtos={produtos} />
    </section>
  )
}
