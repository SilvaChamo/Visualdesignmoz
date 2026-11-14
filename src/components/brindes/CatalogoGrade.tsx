'use client'

// Grelha de produtos do catálogo de brindes (VisualGifts) com a selecção para o pedido de cotação.
// Recebe só dados públicos (sem preço). A selecção fica no sessionStorage, para sobreviver à mudança de página;
// «Pedir Cotação» entrega-a a /cotacao pela mesma chave de /precos, como pedidos personalizados (um por produto).

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { ArrowRight, Check, Plus, X } from 'lucide-react'
import { CUSTOM_CATEGORIA_ID, SELECAO_STORAGE_KEY } from '@/lib/pricing-catalog'

interface Produto {
  sku: string
  nome: string
  marca: string | null
  esgotado: boolean
  kit: boolean
  imagem: string
}

type Escolhido = { sku: string; nome: string; marca: string | null }

const CHAVE = 'visualdesign_brindes_selecao'
const PREFIXO_IMAGENS = 'https://amrcdn.amrod.co.za/amrodprod-blob/ProductImages/'

export function CatalogoGrade({ produtos }: { produtos: Produto[] }) {
  const router = useRouter()
  const [escolhidos, setEscolhidos] = useState<Escolhido[]>([])

  useEffect(() => {
    try {
      const guardado = sessionStorage.getItem(CHAVE)
      if (guardado) setEscolhidos(JSON.parse(guardado))
    } catch {
      /* sem armazenamento: a selecção só vale nesta página */
    }
  }, [])

  // sempre sobre a lista mais recente: dois cliques seguidos não se atropelam
  const atualizar = (muda: (lista: Escolhido[]) => Escolhido[]) =>
    setEscolhidos((lista) => {
      const nova = muda(lista)
      try {
        sessionStorage.setItem(CHAVE, JSON.stringify(nova))
      } catch {
        /* idem */
      }
      return nova
    })

  const estaEscolhido = (sku: string) => escolhidos.some((e) => e.sku === sku)
  const alternar = (p: Produto) =>
    atualizar((lista) => (lista.some((e) => e.sku === p.sku) ? lista.filter((e) => e.sku !== p.sku) : [...lista, { sku: p.sku, nome: p.nome, marca: p.marca }]))

  const pedirCotacao = () => {
    if (escolhidos.length === 0) return
    const itens = escolhidos.map((e) => ({
      categoriaId: CUSTOM_CATEGORIA_ID,
      categoriaLabel: 'Pedido Personalizado',
      // o texto livre do pedido personalizado (máx. 255): nome, referência do produto e marca
      produto: `${e.nome} — ref. ${e.sku}${e.marca ? ` (${e.marca})` : ''}`.slice(0, 255),
    }))
    sessionStorage.setItem(SELECAO_STORAGE_KEY, JSON.stringify(itens))
    router.push(`/cotacao?categoria=${CUSTOM_CATEGORIA_ID}`)
  }

  return (
    <>
      <div className="grid auto-rows-fr grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4" data-testid="catalogo-grade">
        {produtos.map((p) => {
          const escolhido = estaEscolhido(p.sku)
          return (
            <article
              key={p.sku}
              className={`@container flex h-full flex-col overflow-hidden rounded-lg border bg-white transition-colors dark:bg-zinc-900 ${
                escolhido ? 'border-red-600 dark:border-red-500' : 'border-zinc-200/80 dark:border-white/10'
              }`}
            >
              <div className="relative aspect-square bg-white">
                <Image
                  src={`${PREFIXO_IMAGENS}${encodeURI(p.imagem)}`}
                  alt={p.nome}
                  fill
                  sizes="(min-width: 1024px) 22vw, (min-width: 768px) 30vw, 46vw"
                  className="object-contain p-3"
                />
                {(p.esgotado || p.kit) && (
                  <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
                    {p.esgotado && <span className="rounded bg-zinc-900 px-2 py-0.5 text-[11px] font-bold text-white">Sem stock</span>}
                    {p.kit && <span className="rounded bg-red-600 px-2 py-0.5 text-[11px] font-bold text-white">Kit</span>}
                  </div>
                )}
              </div>
              {/* letras e margens crescem com a largura do cartão (cqw), com mínimo e máximo; o nome ocupa sempre 2 linhas */}
              <div className="flex flex-1 flex-col gap-[clamp(0.15rem,1.2cqw,0.3rem)] p-[clamp(0.5rem,5cqw,0.85rem)]">
                <span className="h-[1.2em] truncate text-[clamp(0.6rem,4.2cqw,0.72rem)] font-bold uppercase tracking-wider text-red-600 dark:text-red-500">{p.marca ?? '\u00a0'}</span>
                <h3 className="line-clamp-2 h-[2.5em] text-[clamp(0.75rem,5.6cqw,0.95rem)] font-semibold leading-tight text-zinc-900 dark:text-zinc-100">{p.nome}</h3>
                <span className="truncate font-mono text-[clamp(0.6rem,4.2cqw,0.72rem)] text-zinc-500 dark:text-zinc-400">{p.sku}</span>
                <span className="text-[clamp(0.75rem,5.4cqw,0.95rem)] font-bold text-red-600 dark:text-red-500">Sob Consulta</span>
                <button
                  type="button"
                  onClick={() => alternar(p)}
                  aria-pressed={escolhido}
                  className={`mt-auto inline-flex w-full cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-[clamp(0.35rem,2.6cqw,0.55rem)] text-[clamp(0.62rem,4.4cqw,0.78rem)] font-bold transition-colors ${
                    escolhido
                      ? 'border-red-600 bg-red-600 text-white hover:bg-red-700'
                      : 'border-red-600/50 text-red-600 hover:bg-red-600/5 dark:border-red-500/50 dark:text-red-500'
                  }`}
                >
                  {escolhido ? <Check className="h-3.5 w-3.5 shrink-0" /> : <Plus className="h-3.5 w-3.5 shrink-0" />}
                  <span className="truncate">{escolhido ? 'Adicionado ao pedido' : 'Adicionar ao pedido'}</span>
                </button>
              </div>
            </article>
          )
        })}
      </div>

      {escolhidos.length > 0 && (
        <div className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-3xl items-center gap-3 rounded-lg bg-zinc-900 px-4 py-3 text-white shadow-2xl ring-1 ring-white/10">
          <span className="flex-1 text-sm">{`${escolhidos.length} produto(s) no pedido`}</span>
          <button
            type="button"
            onClick={() => atualizar(() => [])}
            className="inline-flex cursor-pointer items-center gap-1 text-xs text-zinc-300 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
            <span>Limpar</span>
          </button>
          <button
            type="button"
            onClick={pedirCotacao}
            className="inline-flex cursor-pointer items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-red-700"
          >
            <span>{`Pedir Cotação (${escolhidos.length})`}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </>
  )
}
