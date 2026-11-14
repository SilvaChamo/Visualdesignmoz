'use client'

// Cartão de produto do catálogo de brindes (listagem, secções e «mais produtos»). Todos da mesma altura; a letra e as
// margens crescem com a largura do cartão (cqw), com mínimo e máximo; o nome ocupa sempre duas linhas.
// Inteiro é uma ligação à ficha do produto; o botão do canto junta o produto ao pedido de cotação.

import Link from 'next/link'
import { Check, Plus } from 'lucide-react'
import { usePedido } from '@/components/brindes/pedido'
import { urlImagem } from '@/lib/catalogo-imagens'
import { nomeCor } from '@/lib/catalogo-cores'
import { useCurrency } from '@/contexts/CurrencyContext'

export interface ProdutoCartao {
  sku: string
  slug: string
  nome: string
  marca: string | null
  esgotado: boolean
  kit: boolean
  promo: boolean
  urgente: boolean
  imagem: string
  imagem2: string | null
  cores: { nome: string; hex: string }[]
  /** valor do fornecedor por unidade, em meticais (null: sem câmbio, mostra «Preço sob consulta») */
  precoMt: number | null
}

const MAX_CORES = 5

export function CartaoProduto({ p }: { p: ProdutoCartao }) {
  const { adicionar, removerProduto, temProduto } = usePedido()
  const { formatPrice } = useCurrency()
  const escolhido = temProduto(p.sku)
  const resto = p.cores.length - MAX_CORES

  return (
    <article className="@container group relative flex h-full flex-col" data-testid="cartao-produto">
      <Link
        href={`/brindes/produto/${p.slug}`}
        className="relative block aspect-square overflow-hidden rounded-[clamp(0.5rem,4cqw,0.875rem)] bg-zinc-100 ring-1 ring-transparent transition-shadow hover:shadow-lg hover:ring-red-600/30 dark:bg-zinc-800/80"
        aria-label={p.nome}
      >
        {/* eslint-disable @next/next/no-img-element */}
        <img
          src={urlImagem(p.imagem, 480)}
          alt={p.nome}
          loading="lazy"
          decoding="async"
          className={`absolute inset-0 h-full w-full object-contain p-[9%] transition-opacity duration-300 ${p.imagem2 ? 'group-hover:opacity-0' : ''} ${p.esgotado ? 'opacity-60' : ''}`}
        />
        {p.imagem2 && (
          <img
            src={urlImagem(p.imagem2, 480)}
            alt=""
            loading="lazy"
            decoding="async"
            aria-hidden
            className="absolute inset-0 h-full w-full object-contain p-[9%] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          />
        )}
        {/* eslint-enable @next/next/no-img-element */}
        <div className="absolute left-[4%] top-[4%] flex flex-col items-start gap-1">
          {p.esgotado && <span className="rounded-full bg-zinc-900 px-2.5 py-0.5 text-[clamp(0.55rem,3.6cqw,0.68rem)] font-bold text-white">Sem stock</span>}
          {p.promo && !p.esgotado && <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-[clamp(0.55rem,3.6cqw,0.68rem)] font-bold text-white">Promoção</span>}
          {p.kit && <span className="rounded-full bg-white px-2.5 py-0.5 text-[clamp(0.55rem,3.6cqw,0.68rem)] font-bold text-zinc-900 shadow-sm">Kit</span>}
        </div>
      </Link>

      <button
        type="button"
        onClick={() => (escolhido ? removerProduto(p.sku) : adicionar({ sku: p.sku, nome: p.nome, marca: p.marca }))}
        aria-pressed={escolhido}
        aria-label={escolhido ? 'Retirar do pedido' : 'Adicionar ao pedido'}
        title={escolhido ? 'Retirar do pedido' : 'Adicionar ao pedido'}
        className={`absolute right-[4%] top-[4%] inline-flex h-[clamp(1.6rem,11cqw,2.1rem)] w-[clamp(1.6rem,11cqw,2.1rem)] cursor-pointer items-center justify-center rounded-full shadow-md transition-colors ${
          escolhido ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-white text-zinc-700 hover:bg-red-600 hover:text-white'
        }`}
      >
        {escolhido ? <Check className="h-[55%] w-[55%]" /> : <Plus className="h-[55%] w-[55%]" />}
      </button>

      <div className="mt-[clamp(0.4rem,3cqw,0.7rem)] flex flex-1 flex-col gap-[clamp(0.15rem,1.4cqw,0.3rem)] px-[clamp(0.15rem,1.5cqw,0.35rem)]">
        <span className="h-[1.2em] truncate text-[clamp(0.58rem,3.9cqw,0.7rem)] font-bold uppercase tracking-wider text-red-600 dark:text-red-500">{p.marca ?? ' '}</span>
        <h3 className="line-clamp-2 h-[2.6em] text-[clamp(0.8rem,5.8cqw,0.9rem)] font-semibold leading-snug text-zinc-900 group-hover:text-red-600 dark:text-zinc-100">
          <Link href={`/brindes/produto/${p.slug}`} tabIndex={-1}>
            {p.nome}
          </Link>
        </h3>
        <div className="mt-auto flex h-[clamp(1rem,7cqw,1.3rem)] items-center justify-between gap-2">
          <span className="flex items-center gap-[3px]" aria-label={p.cores.map((c) => nomeCor(c.nome)).join(', ')}>
            {p.cores.slice(0, MAX_CORES).map((c) => (
              <span key={c.nome + c.hex} title={nomeCor(c.nome)} className="h-[clamp(0.6rem,4cqw,0.8rem)] w-[clamp(0.6rem,4cqw,0.8rem)] rounded-full ring-1 ring-black/15" style={{ background: c.hex }} />
            ))}
            {resto > 0 && <span className="ml-0.5 text-[clamp(0.55rem,3.6cqw,0.68rem)] font-semibold text-zinc-500">{`+${resto}`}</span>}
          </span>
          <span className={`text-[clamp(0.6rem,4cqw,0.72rem)] font-semibold ${p.esgotado ? 'text-zinc-500' : 'text-emerald-600 dark:text-emerald-500'}`}>{p.esgotado ? 'Sem stock' : 'Em stock'}</span>
        </div>
        {p.precoMt === null ? (
          <span className="text-[clamp(0.7rem,4.8cqw,0.85rem)] font-semibold text-zinc-500 dark:text-zinc-400">Preço sob consulta</span>
        ) : (
          <span className="text-[clamp(0.8rem,5.6cqw,1rem)] font-extrabold text-zinc-900 dark:text-white">{formatPrice(p.precoMt)}</span>
        )}
      </div>
    </article>
  )
}
