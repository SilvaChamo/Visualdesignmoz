import Link from 'next/link'
import { ArrowLeft, ArrowRight, Search } from 'lucide-react'
import { NotchSection } from '@/components/home/NotchSection'
import { BrindesSobre } from '@/components/brindes/BrindesSobre'
import { BrindesHero } from '@/components/brindes/BrindesHero'
import { CatalogoGrade } from '@/components/brindes/CatalogoGrade'
import { ATUALIZADO_EM, CONTAGENS, MARCAS, TOTAL_PRODUTOS, destaques, listarCatalogo } from '@/lib/catalogo-brindes'
import { GRUPOS, grupoPorId, subPorId } from '@/lib/catalogo-grupos'
import { BRAND_LANDING_CONTENT } from '@/lib/brand-landing-content'

const DADOS = BRAND_LANDING_CONTENT['brindes']

// um produto de cada tipo, para o cartão do banner: o cliente vê logo a variedade que há
const ESCOLHAS: [grupo: string, sub: string][] = [
  ['brindes', 'garrafas-de-agua'],
  ['uniformes', 'polos'],
  ['brindes', 'power-banks'],
  ['mais-produtos', 'mochilas'],
  ['seguranca', 'alta-visibilidade'],
  ['brindes', 'canetas'],
]

const texto = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''

export default async function VisualGiftsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  const grupo = grupoPorId(texto(sp.grupo))
  const sub = subPorId(grupo, texto(sp.sub))
  const filtro = { q: texto(sp.q).slice(0, 80), marca: texto(sp.marca), grupo: grupo?.id ?? '', sub: sub?.id ?? '' }
  const { produtos, total, pagina, paginas } = listarCatalogo({ ...filtro, pagina: Number(texto(sp.pagina)) })

  const ligacao = (mudar: { grupo?: string; sub?: string; pagina?: number }) => {
    const q = new URLSearchParams()
    const g = 'grupo' in mudar ? mudar.grupo : filtro.grupo
    const s = 'sub' in mudar ? mudar.sub : filtro.sub
    if (filtro.q) q.set('q', filtro.q)
    if (filtro.marca) q.set('marca', filtro.marca)
    if (g) q.set('grupo', g)
    if (g && s) q.set('sub', s)
    if (mudar.pagina && mudar.pagina > 1) q.set('pagina', String(mudar.pagina))
    const str = q.toString()
    return `/brindes${str ? `?${str}` : ''}#catalogo`
  }
  const semFiltros = !filtro.q && !filtro.marca && !filtro.grupo
  const dataAtualizacao = ATUALIZADO_EM.split('-').reverse().join('/')
  const campo =
    'h-11 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 focus:border-red-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100'
  const chip = (ativo: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${
      ativo
        ? 'border-red-600 bg-red-600 text-white'
        : 'border-zinc-300 bg-white text-zinc-700 hover:border-red-600 hover:text-red-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:text-white'
    }`

  const cartao = ESCOLHAS.flatMap(([g, s]) => destaques([[g, s]]).map((produto) => ({ produto, grupo: g, sub: s })))

  return (
    <div className="min-h-screen bg-black/10 dark:bg-black">
      <BrindesHero hero={DADOS.hero} destaques={cartao} total={TOTAL_PRODUTOS} />

      <NotchSection shape="end" bg="bg-zinc-50 dark:bg-zinc-950">
        <div id="catalogo" className="scroll-mt-[90px] pb-14 pt-12">
          <div className="container mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mb-5 flex flex-wrap gap-2" role="navigation" aria-label="Categorias de produtos">
              <Link href={ligacao({ grupo: '', sub: '' })} className={chip(!grupo)}>
                <span>Todos</span>
                <span className="text-xs opacity-70">{TOTAL_PRODUTOS.toLocaleString('pt-PT')}</span>
              </Link>
              {GRUPOS.map((g) => (
                <Link key={g.id} href={ligacao({ grupo: g.id, sub: '' })} className={chip(g.id === grupo?.id)}>
                  <span>{g.nome}</span>
                  <span className="text-xs opacity-70">{CONTAGENS[g.id].toLocaleString('pt-PT')}</span>
                </Link>
              ))}
            </div>

            {grupo && (
              <div className="mb-5 flex flex-wrap gap-2 border-l-2 border-red-600 pl-4" role="navigation" aria-label="Subcategorias">
                <Link href={ligacao({ grupo: grupo.id, sub: '' })} className={chip(!sub)}>
                  <span>Tudo</span>
                </Link>
                {grupo.colunas
                  .flatMap((c) => c.subs)
                  .map((s) => (
                    <Link key={s.id} href={ligacao({ grupo: grupo.id, sub: s.id })} className={chip(s.id === sub?.id)}>
                      <span>{s.nome}</span>
                      <span className="text-xs opacity-70">{CONTAGENS[`${grupo.id}/${s.id}`]}</span>
                    </Link>
                  ))}
              </div>
            )}

            <form method="get" action="/brindes#catalogo" className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px_auto]">
              {grupo && <input type="hidden" name="grupo" value={grupo.id} />}
              {grupo && sub && <input type="hidden" name="sub" value={sub.id} />}
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input
                  type="search"
                  name="q"
                  defaultValue={filtro.q}
                  placeholder="Procurar por nome ou referência"
                  aria-label="Procurar por nome ou referência"
                  className={`${campo} w-full pl-9`}
                />
              </label>
              <select name="marca" defaultValue={filtro.marca} aria-label="Marca" className={campo}>
                <option value="">Todas as marcas</option>
                {MARCAS.map((m) => (
                  <option key={m.nome} value={m.nome}>{`${m.nome} (${m.n})`}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <button type="submit" className="h-11 flex-1 cursor-pointer rounded-md bg-red-600 px-6 text-sm font-bold text-white transition-colors hover:bg-red-700">
                  Procurar
                </button>
                {!semFiltros && (
                  <Link
                    href="/brindes#catalogo"
                    className="inline-flex h-11 items-center rounded-md border border-zinc-300 px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Limpar filtros
                  </Link>
                )}
              </div>
            </form>

            <div className="mb-6 flex flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex gap-1.5">
                <span className="font-bold text-zinc-900 dark:text-white">{total.toLocaleString('pt-PT')}</span>
                <span>produtos encontrados</span>
              </p>
              <p className="text-xs">{`Preço sob consulta: indicamos o valor na cotação. A disponibilidade de cada produto confirma-se ao responder ao pedido. Catálogo actualizado em ${dataAtualizacao}.`}</p>
            </div>

            {produtos.length === 0 ? (
              <p className="rounded-lg border border-zinc-200/80 bg-white p-10 text-center text-zinc-600 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-400">
                Nenhum produto encontrado. Tente outra pesquisa ou limpe os filtros.
              </p>
            ) : (
              <CatalogoGrade produtos={produtos} />
            )}

            {paginas > 1 && (
              <nav aria-label="Páginas do catálogo" className="mt-10 flex items-center justify-center gap-4 text-sm">
                {pagina > 1 ? (
                  <Link href={ligacao({ pagina: pagina - 1 })} className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-4 py-2 font-semibold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
                    <ArrowLeft className="h-4 w-4" />
                    <span>Anterior</span>
                  </Link>
                ) : null}
                <span className="text-zinc-600 dark:text-zinc-400">{`Página ${pagina} de ${paginas}`}</span>
                {pagina < paginas ? (
                  <Link href={ligacao({ pagina: pagina + 1 })} className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-4 py-2 font-semibold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
                    <span>Seguinte</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : null}
              </nav>
            )}
          </div>
        </div>
      </NotchSection>

      <BrindesSobre />
    </div>
  )
}
