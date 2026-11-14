'use client'

// O pedido de cotação de brindes: a lista de produtos que o cliente foi juntando (com cor, tamanhos, quantidade e
// personalização). Fica no sessionStorage, para sobreviver à mudança de página, e todos os componentes da página
// (cartões, barra, ficha do produto) vêem a mesma lista. «Pedir cotação» entrega-a a /cotacao pela mesma chave de
// /precos, como pedidos personalizados (um por linha).

import { useCallback, useSyncExternalStore } from 'react'
import { useRouter } from 'next/navigation'
import { CUSTOM_CATEGORIA_ID, SELECAO_STORAGE_KEY } from '@/lib/pricing-catalog'

export interface ItemPedido {
  /** identifica a linha (o mesmo produto pode entrar mais de uma vez, com outra cor) */
  id: string
  sku: string
  nome: string
  marca: string | null
  /** o que o cliente escolheu: cor, tamanhos, quantidade, personalização */
  detalhe?: string
}

const CHAVE = 'visualdesign_brindes_selecao'
const EVENTO = 'vd-pedido-brindes'
const VAZIO: ItemPedido[] = []

let cache: { texto: string | null; itens: ItemPedido[] } = { texto: null, itens: VAZIO }

function ler(): ItemPedido[] {
  try {
    const texto = sessionStorage.getItem(CHAVE)
    if (texto === cache.texto) return cache.itens
    const lista = texto ? (JSON.parse(texto) as unknown) : []
    // a primeira versão guardava só {sku, nome, marca}: dá-lhes um id
    const itens = (Array.isArray(lista) ? lista : []).map((x: Partial<ItemPedido>, i) => ({ ...x, id: x.id ?? `${x.sku}-${i}` }) as ItemPedido)
    cache = { texto, itens }
    return itens
  } catch {
    return VAZIO
  }
}

function guardar(itens: ItemPedido[]) {
  try {
    sessionStorage.setItem(CHAVE, JSON.stringify(itens))
  } catch {
    /* sem armazenamento: a selecção só vale nesta página */
  }
  window.dispatchEvent(new Event(EVENTO))
}

const subscrever = (aviso: () => void) => {
  window.addEventListener(EVENTO, aviso)
  window.addEventListener('storage', aviso)
  return () => {
    window.removeEventListener(EVENTO, aviso)
    window.removeEventListener('storage', aviso)
  }
}

export function usePedido() {
  const router = useRouter()
  const itens = useSyncExternalStore(subscrever, ler, () => VAZIO)

  const adicionar = useCallback((item: Omit<ItemPedido, 'id'>) => {
    // uma linha com o que o cliente escolheu substitui a do mesmo produto sem detalhe (não vai duas vezes à cotação)
    const antes = item.detalhe ? ler().filter((x) => x.sku !== item.sku || x.detalhe) : ler()
    guardar([...antes, { ...item, id: `${item.sku}-${Date.now()}` }])
  }, [])
  const remover = useCallback((id: string) => guardar(ler().filter((x) => x.id !== id)), [])
  const removerProduto = useCallback((sku: string) => guardar(ler().filter((x) => x.sku !== sku)), [])
  const limpar = useCallback(() => guardar([]), [])
  const temProduto = useCallback((sku: string) => itens.some((x) => x.sku === sku), [itens])

  const pedirCotacao = useCallback(
    (extra?: Omit<ItemPedido, 'id'>) => {
      const todos = extra ? [...ler().filter((x) => x.sku !== extra.sku || x.detalhe), { ...extra, id: 'novo' }] : ler()
      if (todos.length === 0) return
      const linhas = todos.map((e) => ({
        categoriaId: CUSTOM_CATEGORIA_ID,
        categoriaLabel: 'Pedido Personalizado',
        // o texto livre do pedido personalizado (máx. 255): nome, referência, marca e o que foi escolhido
        produto: `${e.nome} — ref. ${e.sku}${e.marca ? ` (${e.marca})` : ''}${e.detalhe ? ` — ${e.detalhe}` : ''}`.slice(0, 255),
      }))
      sessionStorage.setItem(SELECAO_STORAGE_KEY, JSON.stringify(linhas))
      router.push(`/cotacao?categoria=${CUSTOM_CATEGORIA_ID}`)
    },
    [router],
  )

  return { itens, adicionar, remover, removerProduto, limpar, temProduto, pedirCotacao }
}
