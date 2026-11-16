import Link from 'next/link'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { NotchSection } from '@/components/home/NotchSection'
import { BrindesSobre } from '@/components/brindes/BrindesSobre'
import { BrindesHero } from '@/components/brindes/BrindesHero'
import { BarraPedido } from '@/components/brindes/BarraPedido'
import { PesquisaBrindes } from '@/components/brindes/PesquisaBrindes'
import { GrelhaProdutos, SeccaoProdutos } from '@/components/brindes/SeccaoProdutos'
import { CONTAGENS, MARCAS, TOTAL_PRODUTOS, emMt, faixaDePrecos, listarCatalogo, seccoesDestaque, seccoesDoGrupo } from '@/lib/catalogo-brindes'
import { valorPorUnidadeMt } from '@/lib/preco-brindes'
import { cambioZarMzn } from '@/lib/cambio-brindes'
import { estimativaBrindes } from '@/lib/estimativa-brindes'
import { SeletorLigacao } from '@/components/brindes/SeletorLigacao'
import { FAMILIAS_COR } from '@/lib/catalogo-cores'
import { GRUPOS, grupoPorId, hrefGrupo, subPorId } from '@/lib/catalogo-grupos'
import { Migalhas } from '@/components/brindes/FaixaCaminho'
import { FiltroPreco } from '@/components/brindes/FiltroPreco'
import { BRAND_LANDING_CONTENT } from '@/lib/brand-landing-content'

const DADOS = BRAND_LANDING_CONTENT['brindes']

// Fundo do catálogo: na página inicial encaixa com recorte no topo; nas interiores é liso e sobe 16 px para ficar por baixo das pontas do cinzento da busca
function FundoLista({ interior, children }: { interior: boolean; children: React.ReactNode }) {
  return interior ? (
    <div className="relative z-10 -mt-[16px] bg-zinc-50 dark:bg-zinc-950">{children}</div>
  ) : (
    <NotchSection shape="end" bg="bg-zinc-50 dark:bg-zinc-950">
      {children}
    </NotchSection>
  )
}

const ORDENS: { id: string; nome: string }[] = [
  { id: '', nome: 'Destaques' },
  { id: 'nome', nome: 'Nome (A–Z)' },
  { id: 'marca', nome: 'Marca' },
  { id: 'preco-asc', nome: 'Preço: menor → maior' },
  { id: 'preco-desc', nome: 'Preço: maior → menor' },
]

const texto = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''
// margem de preços (MT): só números inteiros não negativos
const preco = (v: string) => (/^\d{1,7}$/.test(v) ? Number(v) : null)

export default async function VisualGiftsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams
  const [catGrupo, catSub] = texto(sp.categoria).split('/')
  const grupo = grupoPorId(catGrupo || texto(sp.grupo))
  const sub = subPorId(grupo, catSub || texto(sp.sub))
  const cor = FAMILIAS_COR.find((c) => c.id === texto(sp.cor))?.id ?? ''
  const ordem = ORDENS.find((o) => o.id === texto(sp.ordem))?.id ?? ''
  const filtro = { q: texto(sp.q).slice(0, 80), marca: texto(sp.marca), grupo: grupo?.id ?? '', sub: sub?.id ?? '', cor, stock: texto(sp.stock) === '1', ordem }
  const pagina = Number(texto(sp.pagina))
  const pmin = preco(texto(sp.pmin))
  const pmax = preco(texto(sp.pmax))

  // sem filtros mostram-se secções (cada tipo de produto no seu lugar); com filtros, a lista com páginas
  const semFiltrosExtra = !filtro.q && !filtro.marca && !filtro.cor && !filtro.stock && !filtro.ordem && pmin === null && pmax === null
  const modo: 'inicio' | 'grupo' | 'lista' = !semFiltrosExtra || sub ? 'lista' : grupo ? 'grupo' : 'inicio'
  const taxa = await cambioZarMzn()
  const est = await estimativaBrindes()
  const mt = taxa ? (zar: number) => valorPorUnidadeMt(zar, taxa, est) : undefined
  const achados = modo === 'lista' ? listarCatalogo({ ...filtro, pagina, mt, precoMin: pmin ?? undefined, precoMax: pmax ?? undefined }) : null
  // os extremos dos niveladores: o menor e o maior preço do que se está a ver
  const extremos = mt && modo !== 'inicio' ? faixaDePrecos(filtro, mt) : null
  const faixa = extremos && extremos.max > extremos.min ? extremos : null
  const lista = achados && { ...achados, produtos: emMt(achados.produtos, taxa, est) }

  const parametros = (mudar: Partial<Record<'grupo' | 'sub' | 'cor' | 'stock' | 'ordem' | 'pmin' | 'pmax', string>> & { pagina?: number }) => {
    const v = { ...filtro, stock: filtro.stock ? '1' : '', pmin: pmin === null ? '' : String(pmin), pmax: pmax === null ? '' : String(pmax), ...mudar }
    const q = new URLSearchParams()
    if (v.q) q.set('q', v.q)
    if (v.marca) q.set('marca', v.marca)
    if (v.grupo) q.set('grupo', v.grupo)
    if (v.grupo && v.sub) q.set('sub', v.sub)
    if (v.cor) q.set('cor', v.cor)
    if (v.stock) q.set('stock', '1')
    if (v.ordem) q.set('ordem', v.ordem)
    if (v.pmin) q.set('pmin', v.pmin)
    if (v.pmax) q.set('pmax', v.pmax)
    if (mudar.pagina && mudar.pagina > 1) q.set('pagina', String(mudar.pagina))
    return q.toString()
  }
  const ligacao = (mudar: Parameters<typeof parametros>[0]) => {
    const str = parametros(mudar)
    return `/brindes${str ? `?${str}` : ''}#catalogo`
  }
  const semFiltros = !filtro.q && !filtro.marca && !filtro.grupo && !filtro.cor && !filtro.stock && !filtro.ordem && pmin === null && pmax === null
  const campo =
    'h-11 rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-900 focus:border-red-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100'
  // a seta nativa dos selectores fica colada à beira: desenha-se a nossa, a 14 px dela
  const selector = `${campo} cursor-pointer appearance-none pr-10`
  const seta = {
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 14px center',
    backgroundSize: '16px',
  } as const
  const chip = (ativo: boolean) =>
    `inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors ${
      ativo
        ? 'border-red-600 bg-red-600 text-white'
        : 'border-zinc-300 bg-white text-zinc-700 hover:border-red-600 hover:text-red-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:text-white'
    }`

  const seccoes = modo === 'inicio' ? seccoesDestaque(8).map((x) => ({ ...x, produtos: emMt(x.produtos, taxa, est) })) : []
  const seccoesGrupo = modo === 'grupo' && grupo ? seccoesDoGrupo(grupo.id, 4).map((x) => ({ ...x, produtos: emMt(x.produtos, taxa, est) })) : []

  return (
    <div className="min-h-screen bg-black/10 dark:bg-black">
      {modo === 'inicio' && <BrindesHero hero={DADOS.hero} />}

      {/* interiores: o topo do cinzento é liso (encostado à faixa do caminho) e só o fundo tem recorte: pontas para baixo e meio recuado */}
      <NotchSection shape={modo === 'inicio' ? 'mid' : 'start'} bg={modo === 'inicio' ? 'bg-zinc-200 dark:bg-black' : 'bg-black'} first={modo !== 'inicio'} className={modo !== 'inicio' ? 'z-20' : ''}>
        {/* interiores: fundo preto com a foto de um brinde por baixo (a fila de cores do fundo da foto, ajustada para cima) */}
        {modo !== 'inicio' && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/api/brindes/imagem?p=GF-AM-623-B%2FDEFAULT_1024X1024.jpg&w=1200" alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover object-bottom opacity-60" />
            <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-black via-black/60 to-black/10" />
          </>
        )}
        <div className={`container relative mx-auto max-w-7xl px-[41px] sm:px-[49px] ${modo === 'inicio' ? 'py-[46px]' : 'pb-[54px] pt-[157px]'}`}>
          <form method="get" action="/brindes#catalogo" className="grid grid-cols-1 items-center gap-3 md:grid-cols-[minmax(0,380px)_190px_170px_auto_auto] md:justify-center">
            {cor && <input type="hidden" name="cor" value={cor} />}
            {ordem && <input type="hidden" name="ordem" value={ordem} />}
            <PesquisaBrindes defaultValue={filtro.q} className={campo.replace('h-11', 'h-10')} />
            <select name="marca" defaultValue={filtro.marca} aria-label="Marca" className={selector} style={seta}>
              <option value="">Todas as marcas</option>
              {MARCAS.map((m) => (
                <option key={m.nome} value={m.nome}>{`${m.nome} (${m.n})`}</option>
              ))}
            </select>
            <select name="categoria" defaultValue={grupo ? (sub ? `${grupo.id}/${sub.id}` : grupo.id) : ''} aria-label="Categoria" className={selector} style={seta}>
              <option value="">Todas categorias</option>
              {GRUPOS.flatMap((g) => [
                <option key={g.id} value={g.id} className="font-bold">{g.nome}</option>,
                ...g.colunas.flatMap((c) => c.subs).map((x) => (
                  <option key={`${g.id}/${x.id}`} value={`${g.id}/${x.id}`}>{x.nome}</option>
                )),
              ])}
            </select>
            <label className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
              <input type="checkbox" name="stock" value="1" defaultChecked={filtro.stock} className="h-4 w-4 accent-red-600" />
              <span>Em stock</span>
            </label>
            <button type="submit" className="h-11 cursor-pointer rounded-md bg-red-600 px-6 text-sm font-bold text-white transition-colors hover:bg-red-700">
              Procurar
            </button>
          </form>
        </div>
      </NotchSection>

      <FundoLista interior={modo !== 'inicio'}>
        <div id="catalogo" className="scroll-mt-[90px] pb-14 pt-4">
          {modo !== 'inicio' && (
            <div className="relative -mt-4 mb-5 min-h-10">
              {/* faixa de fundo preto, em toda a largura, recortada como o cinzento de cima (as pontas inclinadas nos limites do conteúdo) */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0 -bottom-[3px] bg-black"
                style={{
                  '--cl': 'max(24px, calc(50% - 616px))',
                  clipPath:
                    'polygon(var(--cl) 0, calc(100% - var(--cl)) 0, calc(100% - var(--cl)) calc(100% - 24px), calc(100% - var(--cl) - 14px) 100%, calc(var(--cl) + 14px) 100%, var(--cl) calc(100% - 24px))',
                } as React.CSSProperties}
              />
              <div className="container relative mx-auto flex min-h-10 max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-[41px] py-1 sm:px-[49px] [&_nav]:text-zinc-100">
                <Migalhas
                  migalhas={[
                    { nome: 'Início', href: '/' },
                    { nome: 'VisualGifts', href: '/brindes' },
                    ...(grupo && sub ? [{ nome: grupo.nome, href: hrefGrupo(grupo) }] : []),
                  ]}
                  atual={sub?.nome ?? grupo?.nome ?? 'Pesquisa'}
                />
                {faixa && <FiltroPreco key={`${faixa.min}-${faixa.max}-${pmin}-${pmax}`} min={faixa.min} max={faixa.max} de={pmin} ate={pmax} base={parametros({ pmin: '', pmax: '' })} />}
              </div>
            </div>
          )}
          <div className="container mx-auto max-w-7xl px-[41px] sm:px-[49px]">
            {modo === 'lista' && (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <div className="flex flex-wrap gap-2" aria-label="Categoria seleccionada">
              <span className="inline-flex items-baseline gap-2 text-zinc-900 dark:text-white">
                <span className="text-xl font-bold">{sub?.nome ?? grupo?.nome ?? 'Todos'}</span>
                <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">{(sub && grupo ? CONTAGENS[`${grupo.id}/${sub.id}`] : grupo ? CONTAGENS[grupo.id] : TOTAL_PRODUTOS).toLocaleString('pt-PT')}</span>
              </span>
            </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">Ordenar por</span>
                <SeletorLigacao rotulo="Ordenar por" opcoes={ORDENS.map((o) => ({ ...o, href: ligacao({ ordem: o.id }) }))} atual={ordem} className={`${selector} w-[130px]`} style={seta} />
              </div>
            </div>
            )}

            {modo === 'lista' && lista && (
              <>
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
                return <SeccaoProdutos key={gid} titulo={g.id === 'brindes' ? 'Brindes personalizáveis' : g.nome} texto={g.id === 'brindes' ? 'Explore diversos brindes para a sua empresa e lazer' : g.ideal[0]} textoVermelho={g.id === 'brindes'} produtos={produtos} href={hrefGrupo(g)} rotulo={<><span>Explorar todos os</span> <span>{`(${CONTAGENS[g.id].toLocaleString('pt-PT')})`}</span></>} />
              })}

            {modo === 'grupo' &&
              grupo &&
              seccoesGrupo.map(({ sub: sid, produtos }) => {
                const s = subPorId(grupo, sid)
                if (!s) return null
                return <SeccaoProdutos key={sid} antetitulo={grupo.nome} titulo={s.nome} produtos={produtos} href={hrefGrupo(grupo, s)} rotulo={<><span>Explorar todos os</span> <span>{`(${CONTAGENS[`${grupo.id}/${s.id}`]})`}</span></>} />
              })}
          </div>
        </div>
      </FundoLista>

      <BrindesSobre />
      <BarraPedido />
    </div>
  )
}
