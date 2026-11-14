// Catálogo de brindes (VisualGifts): lê src/data/catalogo-brindes.json, que o script scripts/importar-catalogo-brindes.mjs escreve.
//
// SÓ PARA O SERVIDOR: o ficheiro de dados é grande e traz o preço do fornecedor em rand de cada produto.
// A página mostra o valor do fornecedor convertido em meticais (Silva, 14/11/2026: «tirar sob consulta e colocar o valor deles
// cambiado»): `emMt` troca o rand pelo metical ao câmbio do dia, e só o metical vai para o browser.
// Não importar este ficheiro a partir de componentes 'use client'.

import dados from '@/data/catalogo-brindes.json'
import { GRUPOS, grupoPorId, subPorId, type Grupo, type Sub } from '@/lib/catalogo-grupos'
import { familiaDaCor } from '@/lib/catalogo-cores'

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
  slug: string
  nome: string
  marca: string | null
  categoria: string | null
  esgotado: boolean
  kit: boolean
  promo: boolean
  urgente: boolean
  imagem: string
  /** a segunda foto (aparece ao passar o rato) */
  imagem2: string | null
  cores: { nome: string; hex: string }[]
  /** valor do fornecedor por unidade, em rand (a página só mostra o metical: ver `emMt`) */
  precoZar: number
}

/** o produto como a página o recebe: com o valor do fornecedor em meticais (null se não houve câmbio) em vez de rand */
export type ProdutoComPreco = Omit<ProdutoPublico, 'precoZar'> & { precoMt: number | null }

/** Troca o rand pelo metical ao câmbio dado (1 rand = `taxa` meticais). */
export const emMt = (lista: ProdutoPublico[], taxa: number | null): ProdutoComPreco[] =>
  lista.map(({ precoZar, ...resto }) => ({ ...resto, precoMt: taxa ? Math.round(precoZar * taxa) : null }))

const PRODUTOS = (dados as unknown as { produtos: ProdutoImportado[] }).produtos
export const ATUALIZADO_EM: string = (dados as unknown as { atualizadoEm: string }).atualizadoEm
export const TOTAL_PRODUTOS = PRODUTOS.length

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

// «Destaques»: o que está em stock primeiro, com promoção e com mais cores e fotos (produtos mais completos)
const pontos = (p: ProdutoImportado) => (p.esgotado ? -100 : 0) + (p.promo ? 4 : 0) + Math.min(p.cores?.length ?? 0, 10) * 0.6 + Math.min(p.imagens.length, 4)

// índice feito uma vez por processo: o texto onde se procura, as contagens dos filtros, o grupo e a subcategoria de cada produto
const INDICE = PRODUTOS.map((p, ordem) => {
  const cat = p.categoria ? idDaCategoria(p.categoria) : null
  const filtro = { n: semAcentos(p.nome), c: cat ?? '' }
  const grupo = GRUPOS.find((g) => g.todos(filtro))
  const sub = grupo?.colunas.flatMap((c) => c.subs).find((s) => s.teste(filtro))
  return {
    p,
    ordem,
    texto: semAcentos(`${p.nome} ${p.sku} ${p.marca ?? ''}`),
    cat,
    filtro,
    grupo,
    sub,
    familias: new Set((p.cores ?? []).map((c) => familiaDaCor(c.hex))),
    pontos: pontos(p),
  }
})
type Entrada = (typeof INDICE)[number]

const POR_SLUG = new Map(INDICE.map((i) => [i.p.slug, i]))

const publico = ({ p, cat }: Entrada): ProdutoPublico => ({
  sku: p.sku,
  slug: p.slug,
  nome: p.nome,
  marca: p.marca,
  categoria: cat,
  esgotado: p.esgotado,
  kit: p.kit,
  promo: p.promo,
  urgente: p.urgente,
  imagem: p.imagens[0],
  imagem2: p.imagens[1] ?? null,
  cores: (p.cores ?? []).map((c) => ({ nome: c.nome, hex: c.hex })),
  precoZar: p.precoZar,
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

/** quantos produtos há de cada família de cor (para os filtros) */
export const CONTAGEM_CORES: Record<string, number> = (() => {
  const r: Record<string, number> = {}
  for (const i of INDICE) for (const f of i.familias) r[f] = (r[f] ?? 0) + 1
  return r
})()

export interface FiltroCatalogo {
  q?: string
  /** grupo do menu (brindes, uniformes, seguranca, mais-produtos) e, dentro dele, a subcategoria */
  grupo?: string
  sub?: string
  categoria?: string
  marca?: string
  /** família de cor (preto, azul, …) */
  cor?: string
  /** só o que está em stock */
  stock?: boolean
  /** destaques (por defeito), nome (A–Z) ou marca */
  ordem?: string
  pagina?: number
}

export const POR_PAGINA = 48

const ordenar = (lista: Entrada[], ordem?: string) => {
  const r = [...lista]
  if (ordem === 'nome') r.sort((a, b) => a.p.nome.localeCompare(b.p.nome, 'en'))
  else if (ordem === 'marca') r.sort((a, b) => (a.p.marca ?? '~').localeCompare(b.p.marca ?? '~', 'en') || a.p.nome.localeCompare(b.p.nome, 'en'))
  else r.sort((a, b) => b.pontos - a.pontos || a.ordem - b.ordem)
  return r
}

const filtrar = (f: FiltroCatalogo) => {
  const termos = semAcentos(f.q ?? '').split(/\s+/).filter(Boolean)
  const grupo = grupoPorId(f.grupo)
  const sub = subPorId(grupo, f.sub)
  return INDICE.filter(
    (i) =>
      (!grupo || grupo.todos(i.filtro)) &&
      (!sub || sub.teste(i.filtro)) &&
      (!f.categoria || i.cat === f.categoria) &&
      (!f.marca || i.p.marca === f.marca) &&
      (!f.cor || i.familias.has(f.cor)) &&
      (!f.stock || !i.p.esgotado) &&
      termos.every((t) => i.texto.includes(t)),
  )
}

export function listarCatalogo(f: FiltroCatalogo) {
  const achados = ordenar(filtrar(f), f.ordem)
  const total = achados.length
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA))
  const pagina = Math.min(Math.max(1, Math.floor(f.pagina || 1)), paginas)
  const produtos = achados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA).map(publico)
  return { produtos, total, pagina, paginas }
}

/** quantos produtos há com estes filtros (sem os trazer): os números dos separadores */
export const contarCatalogo = (f: FiltroCatalogo) => filtrar(f).length

/** quantos produtos tem cada grupo e subcategoria (para os separadores da página) */
export const CONTAGENS = (() => {
  const r: Record<string, number> = {}
  for (const g of GRUPOS) {
    r[g.id] = INDICE.filter((i) => g.todos(i.filtro)).length
    for (const c of g.colunas) for (const sb of c.subs) r[`${g.id}/${sb.id}`] = INDICE.filter((i) => g.todos(i.filtro) && sb.teste(i.filtro)).length
  }
  return r
})()

/** `n` produtos variados: o melhor de cada subcategoria à vez (não vêm todos do mesmo tipo), só do que tem fotos e stock */
function variados(grupo: Grupo, subs: Sub[], n: number, excluir: Set<string> = new Set()): Entrada[] {
  const porSub = subs.map((s) => ordenar(INDICE.filter((i) => !excluir.has(i.p.sku) && grupo.todos(i.filtro) && s.teste(i.filtro) && !i.p.esgotado)))
  const r: Entrada[] = []
  const nomes = new Set<string>() // dois produtos com o mesmo nome (outra referência) não aparecem lado a lado
  for (let volta = 0; r.length < n && volta < 40; volta++) {
    for (const lista of porSub) {
      const e = lista[volta]
      if (e && r.length < n && !nomes.has(e.p.nome)) {
        nomes.add(e.p.nome)
        r.push(e)
      }
    }
  }
  return r
}

const subsDe = (g: Grupo) => g.colunas.flatMap((c) => c.subs)

/** as secções da página sem filtros: cada grupo com `n` produtos variados */
export const seccoesDestaque = (n = 8) => GRUPOS.map((g) => ({ grupo: g.id, produtos: variados(g, subsDe(g), n).map(publico) }))

/** as secções de um grupo: cada subcategoria com os seus melhores `n` produtos */
export const seccoesDoGrupo = (grupoId: string, n = 4) => {
  const g = grupoPorId(grupoId)
  if (!g) return []
  return subsDe(g)
    .map((s) => ({ sub: s.id, produtos: variados(g, [s], n).map(publico) }))
    .filter((x) => x.produtos.length > 0)
}

/** os produtos do cartão do banner: o melhor de cada subcategoria indicada */
export function destaques(escolhas: [grupo: string, sub: string][]): ProdutoPublico[] {
  const r: ProdutoPublico[] = []
  for (const [g, s] of escolhas) {
    const grupo = grupoPorId(g)
    const sub = subPorId(grupo, s)
    if (grupo && sub) r.push(...variados(grupo, [sub], 1).map(publico))
  }
  return r
}

export function produtoPorSlug(slug: string) {
  const i = POR_SLUG.get(slug)
  if (!i) return null
  return { produto: publico(i), imagens: i.p.imagens, grupo: i.grupo ?? null, sub: i.sub ?? null }
}

/** o que mostrar por baixo de um produto: mais da mesma subcategoria, mais do mesmo grupo e mais da mesma marca */
export function relacionados(sku: string, n = 8) {
  const e = INDICE.find((i) => i.p.sku === sku)
  if (!e) return { daSub: [], doGrupo: [], daMarca: [] }
  const ja = new Set([sku])
  const dir = (lista: Entrada[]) => {
    lista.forEach((x) => ja.add(x.p.sku))
    return lista.map(publico)
  }
  const grupo = e.grupo
  const daSub = grupo && e.sub ? dir(variados(grupo, [e.sub], n, ja)) : []
  const doGrupo = grupo
    ? dir(
        variados(
          grupo,
          subsDe(grupo).filter((s) => s.id !== e.sub?.id),
          n,
          ja,
        ),
      )
    : []
  const daMarca = e.p.marca ? dir(ordenar(INDICE.filter((i) => i.p.marca === e.p.marca && !ja.has(i.p.sku) && !i.p.esgotado)).slice(0, n)) : []
  return { daSub, doGrupo, daMarca, grupo: grupo ?? null, sub: e.sub ?? null }
}
