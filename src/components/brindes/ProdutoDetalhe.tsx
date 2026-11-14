'use client'

// A parte de cima da ficha de um produto de brindes: galeria, cor, quantidades por tamanho (com o stock de cada um),
// personalização (posição e método) e a barra de baixo para juntar ao pedido de cotação. As secções de informação
// (especificações, personalização, stock, medidas) vêm por baixo, feitas no servidor.

import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowRight, Check, Heart, Minus, Palette, Plus, Truck } from 'lucide-react'
import { GaleriaProduto } from '@/components/brindes/GaleriaProduto'
import { usePedido } from '@/components/brindes/pedido'
import { caminhoImagem } from '@/lib/catalogo-imagens'
import { nomeCor } from '@/lib/catalogo-cores'
import { useCurrency } from '@/contexts/CurrencyContext'
import { nomeMetodo, nomePosicao } from '@/lib/catalogo-personalizacao'
import { DetalheMetodo } from '@/components/brindes/DetalheMetodo'
import type { Ficha } from '@/lib/catalogo-fichas'

export interface ProdutoFicha {
  sku: string
  nome: string
  marca: string | null
  esgotado: boolean
  kit: boolean
  promo: boolean
  /** da lista: fim dos endereços das fotos e cores, para quando não há ficha */
  imagens: string[]
  cores: { nome: string; hex: string }[]
  /** valor do fornecedor por unidade, em meticais (null: sem câmbio) */
  precoMt: number | null
}

const num = (n: number) => n.toLocaleString('pt-PT')
const data = (iso: string) => iso.split('-').reverse().join('/')
const fundo = (h: string[]) => (h.length > 1 ? `linear-gradient(135deg, ${h[0]} 50%, ${h[1]} 50%)` : h[0] || '#d4d4d8')

const cartao = 'rounded-xl border border-zinc-200/80 bg-white p-5 dark:border-white/10 dark:bg-zinc-900'
const titulo = 'text-base font-extrabold text-zinc-900 dark:text-white'

export function ProdutoDetalhe({ produto, ficha }: { produto: ProdutoFicha; ficha: Ficha | null }) {
  const { itens, adicionar, removerProduto, temProduto, pedirCotacao } = usePedido()
  const { formatPrice } = useCurrency()

  // o fornecedor traz por vezes uma cor vazia (produtos sem cores): nesse caso valem as cores da lista
  const cores = useMemo(() => {
    const dela = ficha?.cores.filter((c) => c.c && c.n) ?? []
    return dela.length ? dela : produto.cores.map((c) => ({ c: c.nome, n: c.nome, h: [c.hex], i: null, x: [] as string[] }))
  }, [ficha, produto.cores])
  const tamanhos = ficha?.tam ?? []
  const [corIdx, setCorIdx] = useState(0)
  const [foto, setFoto] = useState(0)
  const cor = cores[corIdx] ?? null

  // fotos: as da cor escolhida primeiro, depois as gerais do produto
  const galeria = useMemo(() => {
    const out: string[] = []
    const junta = (rel: string | null | undefined) => {
      if (!rel) return
      const c = caminhoImagem(produto.sku, rel)
      if (!out.includes(c)) out.push(c)
    }
    if (cor?.i) junta(cor.i)
    cor?.x.forEach(junta)
    ficha?.gal.forEach(([r]) => junta(r))
    produto.imagens.forEach(junta)
    return out.slice(0, 14)
  }, [cor, ficha, produto.sku, produto.imagens])

  // quantidades
  const min = ficha?.min ?? 1
  const passo = ficha?.inc ?? 1
  const [porTamanho, setPorTamanho] = useState<Record<string, number>>({})
  const [unica, setUnica] = useState(Math.max(min, 50))
  const total = tamanhos.length ? tamanhos.reduce((s, t) => s + (porTamanho[t] ?? 0), 0) : unica

  // stock
  // sem stock por cor (produto sem cores), o fornecedor dá o stock numa linha só, com «-» no lugar da cor
  const stockDe = (codigo: string | undefined, tam: string): [number, number, string] | null => (ficha ? (ficha.v[codigo ?? '']?.[tam] ?? ficha.v['-']?.[tam] ?? null) : null)
  const stockDaCor = (codigo: string) => {
    const l = Object.values(ficha?.v[codigo] ?? ficha?.v['-'] ?? {})
    return { stock: l.reduce((s, x) => s + x[0], 0), chega: l.reduce((s, x) => s + x[1], 0), data: l.map((x) => x[2]).filter(Boolean).sort()[0] ?? '' }
  }
  const sc = cor ? stockDaCor(cor.c) : { stock: 0, chega: 0, data: '' }
  const temStock = ficha ? ficha.st > 0 : !produto.esgotado

  // avisos: pediu mais do que há em stock
  const avisos = tamanhos.length
    ? tamanhos.filter((t) => (porTamanho[t] ?? 0) > (stockDe(cor?.c, t)?.[0] ?? Infinity)).map((t) => ({ t, pediu: porTamanho[t], stock: stockDe(cor?.c, t)?.[0] ?? 0, chega: stockDe(cor?.c, t)?.[1] ?? 0, data: stockDe(cor?.c, t)?.[2] ?? '' }))
    : ficha && cor && unica > sc.stock && Object.keys(ficha.v[cor.c] ?? ficha.v['-'] ?? {}).length
      ? [{ t: '', pediu: unica, stock: sc.stock, chega: sc.chega, data: sc.data }]
      : []

  // personalização
  const posicoes = ficha?.pos ?? []
  const [personalizar, setPersonalizar] = useState(true)
  const [posIdx, setPosIdx] = useState(0)
  const [metodoIdx, setMetodoIdx] = useState<number | null>(null)
  const pos = posicoes[posIdx]
  const metodo = pos && metodoIdx !== null ? pos.m[metodoIdx] : null

  const valido = tamanhos.length ? total > 0 : total >= min
  const detalhe = [
    cor ? `Cor: ${nomeCor(cor.n)}` : null,
    tamanhos.length ? `Tamanhos: ${tamanhos.filter((t) => porTamanho[t]).map((t) => `${t}×${porTamanho[t]}`).join(', ')}` : `Quantidade: ${unica} un.`,
    personalizar ? `Personalização: ${pos ? nomePosicao(pos.n) : 'a definir'}${metodo ? ` — ${nomeMetodo(metodo.n)}` : ''}` : 'Sem personalização',
  ]
    .filter(Boolean)
    .join(' · ')
  const item = { sku: produto.sku, nome: produto.nome, marca: produto.marca, detalhe }
  const jaNoPedido = itens.some((x) => x.sku === produto.sku && x.detalhe === detalhe)

  const [aviso, setAviso] = useState(false)
  const juntar = () => {
    adicionar(item)
    setAviso(true)
    setTimeout(() => setAviso(false), 3500)
  }
  const escolhidoBase = temProduto(produto.sku)
  const mudaCor = (i: number) => {
    setCorIdx(i)
    setFoto(0)
  }
  const altera = (t: string, v: number) => setPorTamanho((q) => ({ ...q, [t]: Math.max(0, Math.min(99999, Math.floor(v) || 0)) }))

  const selos = (
    <>
      {produto.esgotado && <span className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-bold text-white">Sem stock</span>}
      {produto.promo && !produto.esgotado && <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white">Promoção</span>}
      {produto.kit && <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-zinc-900 shadow-sm">Kit</span>}
    </>
  )

  return (
    <>
      <div className="grid grid-cols-1 gap-8 md:grid-cols-12 md:gap-8 lg:gap-12">
        <div className="md:sticky md:top-[110px] md:order-1 md:col-span-6 md:self-start">
          <GaleriaProduto imagens={galeria} nome={produto.nome} indice={Math.min(foto, galeria.length - 1)} aoMudar={setFoto} selos={selos} />
        </div>

        <div className="space-y-5 md:order-2 md:col-span-6">
          <div>
            {produto.marca && <span className="mb-2 block text-sm font-bold uppercase tracking-[0.2em] text-red-600 dark:text-red-500">{produto.marca}</span>}
            <h1 className="text-xl font-bold leading-snug text-zinc-900 dark:text-white sm:text-2xl">{produto.nome}</h1>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-zinc-200/80 py-3 text-sm dark:border-white/10">
            <span className="flex gap-1.5 text-zinc-500 dark:text-zinc-400">
              <span>Referência:</span>
              <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200">{produto.sku}</span>
            </span>
            <span className={`flex items-center gap-1.5 font-semibold ${temStock ? 'text-emerald-600 dark:text-emerald-500' : 'text-zinc-500'}`}>
              <span className={`h-2 w-2 rounded-full ${temStock ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
              <span>{temStock ? 'Em stock' : 'Sem stock'}</span>
              {ficha && temStock && (
                <span className="font-normal text-zinc-500 dark:text-zinc-400">
                  <span>{num(ficha.st)}</span> <span>unidades no fornecedor</span>
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={() => (escolhidoBase ? removerProduto(produto.sku) : adicionar({ sku: produto.sku, nome: produto.nome, marca: produto.marca }))}
              aria-pressed={escolhidoBase}
              className={`ml-auto inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${escolhidoBase ? 'border-red-600 bg-red-600 text-white' : 'border-zinc-300 text-zinc-700 hover:border-red-600 hover:text-red-600 dark:border-zinc-700 dark:text-zinc-300'}`}
            >
              <Heart className={`h-3.5 w-3.5 ${escolhidoBase ? 'fill-current' : ''}`} />
              <span>{escolhidoBase ? 'Na selecção' : 'Juntar à selecção'}</span>
            </button>
          </div>

          <div className={`${cartao} flex items-start gap-4`}>
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-red-600/10 text-red-600">
              <Truck className="h-5 w-5" />
            </div>
            <div>
              {produto.precoMt === null ? (
                <p className="text-xl font-extrabold text-zinc-900 dark:text-white">Preço sob consulta</p>
              ) : (
                <p className="flex flex-wrap items-baseline gap-x-2 text-zinc-900 dark:text-white">
                  <span className="text-3xl font-extrabold">{formatPrice(produto.precoMt)}</span>
                  <span className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">por unidade</span>
                </p>
              )}
              <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                {produto.precoMt === null
                  ? 'Indicamos o valor na cotação, com a personalização incluída e a disponibilidade confirmada. O prazo de produção e de entrega também se confirma na cotação.'
                  : 'O valor por unidade não inclui personalização. O valor final com a personalização, o prazo de produção e de entrega confirmam-se na cotação.'}
              </p>
            </div>
          </div>

          {cores.length > 0 && (
            <div className={cartao}>
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h2 className={titulo}>Cor</h2>
                <span className="text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{cor ? nomeCor(cor.n) : ''}</span>
              </div>
              <div className="flex flex-wrap gap-2.5" role="radiogroup" aria-label="Cor">
                {cores.map((c, i) => {
                  const s = ficha ? stockDaCor(c.c) : null
                  const sem = s ? s.stock === 0 && s.chega === 0 : false
                  return (
                    <button
                      key={c.c}
                      type="button"
                      role="radio"
                      aria-checked={i === corIdx}
                      aria-label={nomeCor(c.n)}
                      title={nomeCor(c.n)}
                      onClick={() => mudaCor(i)}
                      className={`relative h-10 w-10 cursor-pointer rounded-lg ring-1 ring-black/15 transition ${i === corIdx ? 'outline outline-2 outline-offset-2 outline-red-600' : 'hover:scale-105'} ${sem ? 'opacity-40' : ''}`}
                      style={{ background: fundo(c.h) }}
                    >
                      {i === corIdx && <Check className="absolute inset-0 m-auto h-5 w-5 text-white mix-blend-difference" />}
                    </button>
                  )
                })}
              </div>
              {ficha && cor && (
                <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {sc.stock > 0 ? (
                    <span className="font-semibold text-emerald-600 dark:text-emerald-500">
                      <span>{num(sc.stock)}</span> <span>em stock nesta cor</span>
                    </span>
                  ) : (
                    <span className="font-semibold text-zinc-500">Sem stock nesta cor</span>
                  )}
                  {sc.chega > 0 && (
                    <span>
                      <span>A chegar:</span> <span className="font-semibold">{num(sc.chega)}</span>
                      {sc.data && <span>{` · ${data(sc.data)}`}</span>}
                    </span>
                  )}
                </p>
              )}
            </div>
          )}

          <div className={cartao}>
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className={titulo}>Quantidade</h2>
              {min > 1 && (
                <span className="text-xs text-zinc-500">
                  <span>Mínimo:</span> <span className="font-semibold">{num(min)}</span>
                </span>
              )}
            </div>
            {tamanhos.length > 0 ? (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {tamanhos.map((t) => {
                  const s = stockDe(cor?.c, t)
                  const sem = s ? s[0] === 0 : false
                  return (
                    <label key={t} className="block">
                      <span className="mb-1 block text-center text-sm font-bold text-zinc-700 dark:text-zinc-300">{t}</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        value={porTamanho[t] ? porTamanho[t] : ''}
                        placeholder="0"
                        onChange={(e) => altera(t, Number(e.target.value))}
                        aria-label={`Quantidade tamanho ${t}`}
                        className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-2 text-center text-sm font-semibold text-zinc-900 focus:border-red-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                      />
                      {s && (
                        <span className={`mt-1 block text-center text-[11px] ${sem ? 'text-amber-600' : 'text-zinc-500 dark:text-zinc-400'}`}>
                          {sem ? (
                            s[1] > 0 ? (
                              <>
                                <span>chega</span> <span>{data(s[2]).slice(0, 5)}</span>
                              </>
                            ) : (
                              <span>sem stock</span>
                            )
                          ) : (
                            <>
                              <span>{num(s[0])}</span> <span>disp.</span>
                            </>
                          )}
                        </span>
                      )}
                    </label>
                  )
                })}
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setUnica((u) => Math.max(min, u - passo))} aria-label="Menos" className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border border-zinc-300 text-zinc-700 hover:border-red-600 hover:text-red-600 dark:border-zinc-700 dark:text-zinc-300">
                    <Minus className="h-4 w-4" />
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={min}
                    step={passo}
                    value={unica}
                    onChange={(e) => setUnica(Math.max(min, Math.floor(Number(e.target.value)) || min))}
                    aria-label="Quantidade"
                    className="h-11 w-32 rounded-lg border border-zinc-300 bg-white px-3 text-center text-base font-bold text-zinc-900 focus:border-red-600 focus:outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
                  />
                  <button type="button" onClick={() => setUnica((u) => u + passo)} aria-label="Mais" className="inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border border-zinc-300 text-zinc-700 hover:border-red-600 hover:text-red-600 dark:border-zinc-700 dark:text-zinc-300">
                    <Plus className="h-4 w-4" />
                  </button>
                  <span className="text-sm text-zinc-500">unidades</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {[25, 50, 100, 250, 500, 1000].filter((q) => q >= min).map((q) => (
                    <button key={q} type="button" onClick={() => setUnica(q)} className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-semibold transition-colors ${unica === q ? 'border-red-600 bg-red-600 text-white' : 'border-zinc-300 text-zinc-700 hover:border-red-600 hover:text-red-600 dark:border-zinc-700 dark:text-zinc-300'}`}>
                      {num(q)}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <p className="mt-4 flex gap-1.5 border-t border-zinc-200/80 pt-3 text-sm text-zinc-600 dark:border-white/10 dark:text-zinc-400">
              <span>Total:</span>
              <span className="font-extrabold text-zinc-900 dark:text-white">{num(total)}</span>
              <span>unidades</span>
            </p>
            {avisos.length > 0 && (
              <div className="mt-3 flex gap-2.5 rounded-lg bg-amber-50 p-3 text-xs leading-relaxed text-amber-900 dark:bg-amber-500/10 dark:text-amber-200" role="status">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="font-bold">Pediu mais do que há em stock agora.</p>
                  {avisos.map((a) => (
                    <p key={a.t || 'u'} className="mt-0.5">
                      {a.t && <span className="font-semibold">{`${a.t}: `}</span>}
                      <span>{`${num(a.pediu)} pedidas, ${num(a.stock)} em stock`}</span>
                      {a.chega > 0 ? (
                        <>
                          <span>; chegam</span> <span>{num(a.chega)}</span>
                          {a.data && <span>{` · ${data(a.data)}`}</span>}
                        </>
                      ) : (
                        <span>; confirmamos o resto com o fornecedor</span>
                      )}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className={`rounded-xl border p-5 transition-colors ${personalizar ? 'border-red-600/40 bg-red-50/60 dark:border-red-500/30 dark:bg-red-500/5' : 'border-zinc-200/80 bg-white dark:border-white/10 dark:bg-zinc-900'}`}>
            <label className="flex cursor-pointer items-start gap-3">
              <input type="checkbox" checked={personalizar} onChange={(e) => setPersonalizar(e.target.checked)} className="mt-1 h-4 w-4 accent-red-600" />
              <span>
                <span className="flex items-center gap-2 text-base font-extrabold text-zinc-900 dark:text-white">
                  <Palette className="h-4 w-4 text-red-600" />
                  <span>Personalizar com o meu logótipo</span>
                </span>
                <span className="mt-1 block text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  A personalização tem custo adicional. Confirmamos a posição e o método na cotação.
                </span>
              </span>
            </label>

            {personalizar && posicoes.length > 0 && (
              <div className="mt-4 space-y-3 border-t border-red-600/15 pt-4">
                <div>
                  <p className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-500">Posição</p>
                  <div className="flex flex-wrap gap-2">
                    {posicoes.map((q, i) => (
                      <button
                        key={q.p}
                        type="button"
                        onClick={() => {
                          setPosIdx(i)
                          setMetodoIdx(null)
                        }}
                        aria-pressed={i === posIdx}
                        className={`cursor-pointer rounded-lg border px-3 py-1.5 text-sm font-semibold transition-colors ${i === posIdx ? 'border-red-600 bg-red-600 text-white' : 'border-zinc-300 bg-white text-zinc-700 hover:border-red-600 hover:text-red-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300'}`}
                      >
                        {nomePosicao(q.n)}
                      </button>
                    ))}
                  </div>
                </div>
                {pos && pos.m.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-500">Método</p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setMetodoIdx(null)}
                        aria-pressed={metodoIdx === null}
                        className={`cursor-pointer rounded-lg border px-3 py-2 text-left text-sm transition-colors ${metodoIdx === null ? 'border-red-600 bg-white ring-1 ring-red-600 dark:bg-zinc-950' : 'border-zinc-300 bg-white hover:border-red-600 dark:border-zinc-700 dark:bg-zinc-950'}`}
                      >
                        <span className="block font-semibold text-zinc-900 dark:text-white">Definir na cotação</span>
                        <span className="block text-xs text-zinc-500">Aconselhamos o melhor método</span>
                      </button>
                      {pos.m.map((m, i) => (
                        <button
                          key={`${m.n}-${m.w}-${m.h}-${i}`}
                          type="button"
                          onClick={() => setMetodoIdx(i)}
                          aria-pressed={metodoIdx === i}
                          className={`cursor-pointer rounded-lg border px-3 py-2 text-left text-sm transition-colors ${metodoIdx === i ? 'border-red-600 bg-white ring-1 ring-red-600 dark:bg-zinc-950' : 'border-zinc-300 bg-white hover:border-red-600 dark:border-zinc-700 dark:bg-zinc-950'}`}
                        >
                          <span className="block font-semibold text-zinc-900 dark:text-white">{nomeMetodo(m.n)}</span>
                          <span className="block min-h-4 text-xs text-zinc-500">
                            <DetalheMetodo m={m} />
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {ficha === null && (
        <p className="mt-6 text-xs text-zinc-500">A ficha completa deste produto (stock por cor e tamanho, posições de personalização) confirma-se na cotação.</p>
      )}

      {/* barra de baixo: o que está escolhido e os botões */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-200 bg-white/95 backdrop-blur dark:border-white/10 dark:bg-zinc-950/95">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
          <div className="hidden flex-wrap items-center gap-2 text-xs font-semibold sm:flex">
            {cor && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                <span className="h-3 w-3 rounded-full ring-1 ring-black/20" style={{ background: fundo(cor.h) }} />
                <span>{nomeCor(cor.n)}</span>
              </span>
            )}
            <span className="inline-flex gap-1 rounded-full bg-zinc-100 px-3 py-1 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
              <span>{num(total)}</span>
              <span>unidades</span>
            </span>
            {personalizar && <span className="rounded-full bg-red-600/10 px-3 py-1 text-red-700 dark:text-red-400">Personalizado</span>}
            {aviso && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-white">
                <Check className="h-3 w-3" />
                <span>Adicionado ao pedido</span>
              </span>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              disabled={!valido || jaNoPedido}
              onClick={juntar}
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-red-600 px-4 py-2.5 text-sm font-bold text-red-600 transition-colors hover:bg-red-600/5 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
              <span>{!valido ? (tamanhos.length ? 'Escolha os tamanhos' : 'Indique a quantidade') : jaNoPedido ? 'Já no pedido' : 'Adicionar ao pedido'}</span>
            </button>
            <button
              type="button"
              disabled={!valido && itens.length === 0}
              onClick={() => pedirCotacao(valido && !jaNoPedido ? item : undefined)}
              className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-red-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span>Pedir cotação</span>
              {itens.length > 0 && <span className="rounded-full bg-white/25 px-2 text-xs">{itens.length}</span>}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
