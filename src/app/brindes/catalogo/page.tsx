import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Search } from 'lucide-react'
import { NotchSection } from '@/components/home/NotchSection'
import { CatalogoGrade } from '@/components/brindes/CatalogoGrade'
import { ATUALIZADO_EM, CATEGORIAS, MARCAS, listarCatalogo } from '@/lib/catalogo-brindes'

export const metadata: Metadata = {
  title: 'Catálogo de Brindes Corporativos | VisualGifts',
  description: 'Milhares de brindes, vestuário e artigos promocionais para personalizar com a sua marca. Escolha os produtos e peça a cotação.',
}

type Pesquisa = { q?: string; categoria?: string; marca?: string; pagina?: string }

const texto = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''

export default async function CatalogoBrindesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  const filtro: Pesquisa = { q: texto(sp.q).slice(0, 80), categoria: texto(sp.categoria), marca: texto(sp.marca), pagina: texto(sp.pagina) }
  const { produtos, total, pagina, paginas } = listarCatalogo({ ...filtro, pagina: Number(filtro.pagina) })

  const ligacao = (p: number) => {
    const q = new URLSearchParams()
    if (filtro.q) q.set('q', filtro.q)
    if (filtro.categoria) q.set('categoria', filtro.categoria)
    if (filtro.marca) q.set('marca', filtro.marca)
    if (p > 1) q.set('pagina', String(p))
    const s = q.toString()
    return `/brindes/catalogo${s ? `?${s}` : ''}`
  }
  const comFiltros = Boolean(filtro.q || filtro.categoria || filtro.marca)
  const campo =
    'h-11 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 focus:border-red-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100'
  const dataAtualizacao = ATUALIZADO_EM.split('-').reverse().join('/')

  return (
    <div className="min-h-screen bg-white text-foreground dark:bg-black">
      <NotchSection shape="start" bg="bg-black" first>
        <div className="relative overflow-hidden pb-[80px] pt-[180px]">
          <div className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-15" style={{ backgroundImage: "url('/assets/BG.jpg')" }} />
          <div className="absolute inset-0 bg-black/55" />
          <div className="container relative z-10 mx-auto max-w-7xl px-6 text-center">
            <span className="mb-2 block text-xs font-bold uppercase tracking-wider text-red-500 sm:text-sm">VisualGifts — Catálogo de Brindes</span>
            <h1 className="mb-4 text-4xl font-extrabold tracking-tight text-white">Brindes para personalizar com a sua marca</h1>
            <p className="mx-auto max-w-2xl text-lg font-normal text-zinc-300">
              Escolha os produtos que lhe interessam, junte-os ao pedido e peça a cotação com a personalização.
            </p>
          </div>
        </div>
      </NotchSection>

      <NotchSection shape="end" bg="bg-zinc-50 dark:bg-zinc-950">
        <div className="py-12">
          <div className="container mx-auto max-w-7xl px-6">
            <form method="get" action="/brindes/catalogo" className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-[1fr_220px_200px_auto]">
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
              <select name="categoria" defaultValue={filtro.categoria} aria-label="Categoria" className={campo}>
                <option value="">Todas as categorias</option>
                {CATEGORIAS.map((c) => (
                  <option key={c.id} value={c.id}>{`${c.nome} (${c.n})`}</option>
                ))}
              </select>
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
                {comFiltros && (
                  <Link href="/brindes/catalogo" className="inline-flex h-11 items-center rounded-md border border-zinc-300 px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
                    Limpar filtros
                  </Link>
                )}
              </div>
            </form>

            <div className="mb-6 flex flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
              <p>{`${total.toLocaleString('pt-PT')} produtos encontrados`}</p>
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
                  <Link href={ligacao(pagina - 1)} className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-4 py-2 font-semibold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
                    <ArrowLeft className="h-4 w-4" />
                    <span>Anterior</span>
                  </Link>
                ) : null}
                <span className="text-zinc-600 dark:text-zinc-400">{`Página ${pagina} de ${paginas}`}</span>
                {pagina < paginas ? (
                  <Link href={ligacao(pagina + 1)} className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-4 py-2 font-semibold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
                    <span>Seguinte</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : null}
              </nav>
            )}
          </div>
        </div>
      </NotchSection>
    </div>
  )
}
