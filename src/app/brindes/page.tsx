import Link from 'next/link'
import { ArrowLeft, ArrowRight, Search } from 'lucide-react'
import { NotchSection } from '@/components/home/NotchSection'
import { BrindesSobre } from '@/components/brindes/BrindesSobre'
import { BrindesHero } from '@/components/brindes/BrindesHero'
import { BarraPedido } from '@/components/brindes/BarraPedido'
import { GrelhaProdutos, SeccaoProdutos } from '@/components/brindes/SeccaoProdutos'
import { ATUALIZADO_EM, CONTAGENS, CONTAGEM_CORES, MARCAS, TOTAL_PRODUTOS, emMt, listarCatalogo, seccoesDestaque, seccoesDoGrupo } from '@/lib/catalogo-brindes'
import { cambioZarMzn } from '@/lib/cambio-brindes'
import { FAMILIAS_COR } from '@/lib/catalogo-cores'
import { GRUPOS, grupoPorId, hrefGrupo, subPorId } from '@/lib/catalogo-grupos'
import { BRAND_LANDING_CONTENT } from '@/lib/brand-landing-content'

const DADOS = BRAND_LANDING_CONTENT['brindes']

const ORDENS: { id: string; nome: string }[] = [
  { id: '', nome: 'Destaques' },
  { id: 'nome', nome: 'Nome (A–Z)' },
  { id: 'marca', nome: 'Marca' },
]

const texto = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''

export default async function VisualGiftsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  const grupo = grupoPorId(texto(sp.grupo))
  const sub = subPorId(grupo, texto(sp.sub))
  const cor = FAMILIAS_COR.find((c) => c.id === texto(sp.cor))?.id ?? ''
  const ordem = ORDENS.find((o) => o.id === texto(sp.ordem))?.id ?? ''
  const filtro = { q: texto(sp.q).slice(0, 80), marca: texto(sp.marca), grupo: grupo?.id ?? '', sub: sub?.id ?? '', cor, stock: texto(sp.stock) === '1', ordem }
  const pagina = Number(texto(sp.pagina))

  // sem filtros mostram-se secções (cada tipo de produto no seu lugar); com filtros, a lista com páginas
  const semFiltrosExtra = !filtro.q && !filtro.marca && !filtro.cor && !filtro.stock && !filtro.ordem
  const modo: 'inicio' | 'grupo' | 'lista' = !semFiltrosExtra || sub ? 'lista' : grupo ? 'grupo' : 'inicio'
  const taxa = await cambioZarMzn()
  const achados = modo === 'lista' ? listarCatalogo({ ...filtro, pagina }) : null
  const lista = achados && { ...achados, produtos: emMt(achados.produtos, taxa) }

  const ligacao = (mudar: Partial<Record<'grupo' | 'sub' | 'cor' | 'stock' | 'ordem', string>> & { pagina?: number }) => {
    const v = { ...filtro, stock: filtro.stock ? '1' : '', ...mudar }
    const q = new URLSearchParams()
    if (v.q) q.set('q', v.q)
    if (v.marca) q.set('marca', v.marca)
    if (v.grupo) q.set('grupo', v.grupo)
    if (v.grupo && v.sub) q.set('sub', v.sub)
    if (v.cor) q.set('cor', v.cor)
    if (v.stock) q.set('stock', '1')
    if (v.ordem) q.set('ordem', v.ordem)
    if (mudar.pagina && mudar.pagina > 1) q.set('pagina', String(mudar.pagina))
    const str = q.toString()
    return `/brindes${str ? `?${str}` : ''}#catalogo`
  }
  const semFiltros = !filtro.q && !filtro.marca && !filtro.grupo && !filtro.cor && !filtro.stock && !filtro.ordem
  const dataAtualizacao = ATUALIZADO_EM.split('-').reverse().join('/')
  const campo =
    'h-11 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 focus:border-red-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100'
  const chip = (ativo: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${
      ativo
        ? 'border-red-600 bg-red-600 text-white'
        : 'border-zinc-300 bg-white text-zinc-700 hover:border-red-600 hover:text-red-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:text-white'
    }`

  const seccoes = modo === 'inicio' ? seccoesDestaque(8).map((x) => ({ ...x, produtos: emMt(x.produtos, taxa) })) : []
  const seccoesGrupo = modo === 'grupo' && grupo ? seccoesDoGrupo(grupo.id, 4).map((x) => ({ ...x, produtos: emMt(x.produtos, taxa) })) : []

  return (
    <div className="min-h-screen bg-black/10 dark:bg-black">
      <BrindesHero hero={DADOS.hero} />

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

            <form method="get" action="/brindes#catalogo" className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_200px_170px_auto]">
              {grupo && <input type="hidden" name="grupo" value={grupo.id} />}
              {grupo && sub && <input type="hidden" name="sub" value={sub.id} />}
              {cor && <input type="hidden" name="cor" value={cor} />}
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
                <input type="search" name="q" defaultValue={filtro.q} placeholder="Procurar por nome ou referência" aria-label="Procurar por nome ou referência" className={`${campo} w-full pl-9`} />
              </label>
              <select name="marca" defaultValue={filtro.marca} aria-label="Marca" className={campo}>
                <option value="">Todas as marcas</option>
                {MARCAS.map((m) => (
                  <option key={m.nome} value={m.nome}>{`${m.nome} (${m.n})`}</option>
                ))}
              </select>
              <select name="ordem" defaultValue={ordem} aria-label="Ordenar por" className={campo}>
                {ORDENS.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.nome}
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
                  <input type="checkbox" name="stock" value="1" defaultChecked={filtro.stock} className="h-4 w-4 accent-red-600" />
                  <span>Em stock</span>
                </label>
                <button type="submit" className="h-11 flex-1 cursor-pointer rounded-md bg-red-600 px-6 text-sm font-bold text-white transition-colors hover:bg-red-700">
                  Procurar
                </button>
              </div>
            </form>

            <div className="mb-6 flex flex-wrap items-center gap-2" role="navigation" aria-label="Filtrar por cor">
              <span className="mr-1 text-xs font-bold uppercase tracking-wider text-zinc-500">Cor</span>
              {FAMILIAS_COR.map((c) => (
                <Link
                  key={c.id}
                  href={ligacao({ cor: c.id === cor ? '' : c.id })}
                  title={`${c.nome} (${CONTAGEM_CORES[c.id] ?? 0})`}
                  aria-label={c.nome}
                  aria-current={c.id === cor}
                  className={`h-7 w-7 rounded-full ring-1 ring-black/20 transition ${c.id === cor ? 'outline outline-2 outline-offset-2 outline-red-600' : 'hover:scale-110'}`}
                  style={{ background: c.hex }}
                />
              ))}
              {!semFiltros && (
                <Link href="/brindes#catalogo" className="ml-auto inline-flex h-9 items-center rounded-md border border-zinc-300 px-4 text-sm font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800">
                  Limpar filtros
                </Link>
              )}
            </div>

            {modo === 'lista' && lista && (
              <>
                <div className="mb-6 flex flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
                  <p className="flex gap-1.5">
                    <span className="font-bold text-zinc-900 dark:text-white">{lista.total.toLocaleString('pt-PT')}</span>
                    <span>produtos encontrados</span>
                  </p>
                  <p className="text-xs">
                    <span>{taxa ? 'Valores do fornecedor por unidade, convertidos ao câmbio do dia e sem personalização.' : 'Preço sob consulta: indicamos o valor na cotação.'}</span>{' '}
                    <span>O valor final e a disponibilidade confirmam-se na cotação.</span>{' '}
                    <span>Catálogo actualizado em</span> <span>{dataAtualizacao}</span>.
                  </p>
                </div>
                {lista.produtos.length === 0 ? (
                  <p className="rounded-lg border border-zinc-200/80 bg-white p-10 text-center text-zinc-600 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-400">
                    Nenhum produto encontrado. Tente outra pesquisa ou limpe os filtros.
                  </p>
                ) : (
                  <GrelhaProdutos produtos={lista.produtos} />
                )}
                {lista.paginas > 1 && (
                  <nav aria-label="Páginas do catálogo" className="mt-10 flex items-center justify-center gap-4 text-sm">
                    {lista.pagina > 1 && (
                      <Link href={ligacao({ pagina: lista.pagina - 1 })} className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-4 py-2 font-semibold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
                        <ArrowLeft className="h-4 w-4" />
                        <span>Anterior</span>
                      </Link>
                    )}
                    <span className="text-zinc-600 dark:text-zinc-400">{`Página ${lista.pagina} de ${lista.paginas}`}</span>
                    {lista.pagina < lista.paginas && (
                      <Link href={ligacao({ pagina: lista.pagina + 1 })} className="inline-flex items-center gap-1.5 rounded-md border border-zinc-300 px-4 py-2 font-semibold hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
                        <span>Seguinte</span>
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    )}
                  </nav>
                )}
              </>
            )}

            {modo === 'inicio' &&
              seccoes.map(({ grupo: gid, produtos }) => {
                const g = grupoPorId(gid)
                if (!g) return null
                return <SeccaoProdutos key={gid} antetitulo="Explore" titulo={g.nome} texto={g.ideal[0]} produtos={produtos} href={hrefGrupo(g)} rotulo={<><span>Ver todos</span> <span>{`(${CONTAGENS[g.id].toLocaleString('pt-PT')})`}</span></>} />
              })}

            {modo === 'grupo' &&
              grupo &&
              seccoesGrupo.map(({ sub: sid, produtos }) => {
                const s = subPorId(grupo, sid)
                if (!s) return null
                return <SeccaoProdutos key={sid} antetitulo={grupo.nome} titulo={s.nome} produtos={produtos} href={hrefGrupo(grupo, s)} rotulo={<><span>Ver todos</span> <span>{`(${CONTAGENS[`${grupo.id}/${s.id}`]})`}</span></>} />
              })}
          </div>
        </div>
      </NotchSection>

      <BrindesSobre />
      <BarraPedido />
    </div>
  )
}
