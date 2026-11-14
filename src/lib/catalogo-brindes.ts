// Catálogo de brindes (VisualGifts): lê src/data/catalogo-brindes.json, que o script scripts/importar-catalogo-brindes.mjs escreve.
//
// SÓ PARA O SERVIDOR: o ficheiro de dados tem o preço de custo em rand de cada produto, que nunca pode chegar ao browser.
// Quem mostra o catálogo recebe `ProdutoPublico` (sem preço); o preço (`precoZar`) fica para a calculadora de cotações.
// Não importar este ficheiro a partir de componentes 'use client'.

import dados from '@/data/catalogo-brindes.json'
import { GRUPOS, grupoPorId, subPorId } from '@/lib/catalogo-grupos'

export interface ProdutoImportado {
  sku: string
  slug: string
  nome: string
  marca: string | null
  /** preço de custo por unidade, em rand, sem IVA (sul-africano), antes da personalização */
  precoZar: number
  esgotado: boolean
  promo: boolean
  urgente: boolean
  kit: boolean
  /** fim do endereço das imagens (a primeira é a principal) */
  imagens: string[]
  categoria?: string | null
  cores?: { nome: string; hex: string }[]
  caixa?: { unidades: number; c: number; l: number; a: number; kg: number }
}

/** o que a página pode mostrar: tudo menos o preço de custo */
export interface ProdutoPublico {
  sku: string
  nome: string
  marca: string | null
  categoria: string | null
  esgotado: boolean
  kit: boolean
  imagem: string
}

export const PREFIXO_IMAGENS = 'https://amrcdn.amrod.co.za/amrodprod-blob/ProductImages/'

const PRODUTOS = (dados as unknown as { produtos: ProdutoImportado[] }).produtos
export const ATUALIZADO_EM: string = (dados as unknown as { atualizadoEm: string }).atualizadoEm

const CATEGORIAS_PT: Record<string, string> = {
  'Apparel': 'Vestuário',
  'Welcome Gifts': 'Brindes de boas-vindas',
  'Office Essentials': 'Escritório',
  'Bags': 'Malas e sacos',
  'Eco-Friendly': 'Ecológicos',
  'Display': 'Expositores',
  'Drinkware': 'Copos e garrafas',
  'Tech Gadgets': 'Tecnologia',
  'Outdoor': 'Ar livre',
  'Custom Products': 'Produtos à medida',
  'Executive Gifts': 'Brindes executivos',
  'Sports & Wellness': 'Desporto e bem-estar',
}

const semAcentos = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
const idDaCategoria = (c: string) => semAcentos(c).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

// índice feito uma vez por processo: o texto onde se procura e as contagens dos filtros
const INDICE = PRODUTOS.map((p) => {
  const cat = p.categoria ? idDaCategoria(p.categoria) : null
  return { p, texto: semAcentos(`${p.nome} ${p.sku} ${p.marca ?? ''}`), cat, filtro: { n: semAcentos(p.nome), c: cat ?? '' } }
})

const contar = (chaves: (string | null)[]) => {
  const m = new Map<string, number>()
  for (const k of chaves) if (k) m.set(k, (m.get(k) ?? 0) + 1)
  return m
}

export const CATEGORIAS = (() => {
  const nomes = new Map<string, string>()
  for (const p of PRODUTOS) if (p.categoria) nomes.set(idDaCategoria(p.categoria), p.categoria)
  const n = contar(INDICE.map((i) => i.cat))
  return [...nomes.entries()]
    .map(([id, en]) => ({ id, nome: CATEGORIAS_PT[en] ?? en, n: n.get(id) ?? 0 }))
    .sort((a, b) => b.n - a.n)
})()

export const MARCAS = (() => {
  const n = contar(PRODUTOS.map((p) => p.marca))
  return [...n.entries()].map(([nome, n]) => ({ nome, n })).sort((a, b) => b.n - a.n)
})()

export interface FiltroCatalogo {
  q?: string
  /** grupo do menu (brindes, uniformes, seguranca, mais-produtos) e, dentro dele, a subcategoria */
  grupo?: string
  sub?: string
  categoria?: string
  marca?: string
  pagina?: number
}

export const POR_PAGINA = 48

export function listarCatalogo(f: FiltroCatalogo) {
  const termos = semAcentos(f.q ?? '').split(/\s+/).filter(Boolean)
  const grupo = grupoPorId(f.grupo)
  const sub = subPorId(grupo, f.sub)
  const achados = INDICE.filter(
    (i) =>
      (!grupo || grupo.todos(i.filtro)) &&
      (!sub || sub.teste(i.filtro)) &&
      (!f.categoria || i.cat === f.categoria) &&
      (!f.marca || i.p.marca === f.marca) &&
      termos.every((t) => i.texto.includes(t)),
  )
  const total = achados.length
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA))
  const pagina = Math.min(Math.max(1, Math.floor(f.pagina || 1)), paginas)
  const produtos: ProdutoPublico[] = achados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA).map(({ p, cat }) => ({
    sku: p.sku,
    nome: p.nome,
    marca: p.marca,
    categoria: cat,
    esgotado: p.esgotado,
    kit: p.kit,
    imagem: p.imagens[0],
  }))
  return { produtos, total, pagina, paginas }
}

/** quantos produtos tem cada grupo e subcategoria (para os separadores da página) */
export const CONTAGENS = (() => {
  const r: Record<string, number> = {}
  for (const g of GRUPOS) {
    r[g.id] = INDICE.filter((i) => g.todos(i.filtro)).length
    for (const c of g.colunas) for (const sb of c.subs) r[`${g.id}/${sb.id}`] = INDICE.filter((i) => g.todos(i.filtro) && sb.teste(i.filtro)).length
  }
  return r
})()

/** o primeiro produto com stock de cada subcategoria indicada (grupo, subcategoria): as imagens do banner */
export function destaques(escolhas: [grupo: string, sub: string][]): ProdutoPublico[] {
  const r: ProdutoPublico[] = []
  for (const [g, s] of escolhas) {
    const grupo = grupoPorId(g)
    const sub = subPorId(grupo, s)
    const i = INDICE.find((x) => !x.p.esgotado && grupo?.todos(x.filtro) && sub?.teste(x.filtro))
    if (i) r.push({ sku: i.p.sku, nome: i.p.nome, marca: i.p.marca, categoria: i.cat, esgotado: false, kit: i.p.kit, imagem: i.p.imagens[0] })
  }
  return r
}

export const TOTAL_PRODUTOS = PRODUTOS.length
