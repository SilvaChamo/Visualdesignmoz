// As secções de informação da ficha de um produto de brindes (feitas no servidor): resumo e especificações,
// personalização (posições, métodos e áreas), stock por cor e tamanho, medidas e embalagem.
// Só factos do fornecedor, em português; o que não vem na ficha não aparece.

import { Download, Info, Ruler, Package, Palette, Layers } from 'lucide-react'
import { nomeCor } from '@/lib/catalogo-cores'
import { nomeMetodo, nomePosicao } from '@/lib/catalogo-personalizacao'
import { DetalheMetodo } from '@/components/brindes/DetalheMetodo'
import { PREFIXO_PDF, type Ficha } from '@/lib/catalogo-fichas'

const num = (n: number) => n.toLocaleString('pt-PT')
const data = (iso: string) => iso.split('-').reverse().join('/')
const fundo = (h: string[]) => (h.length > 1 ? `linear-gradient(135deg, ${h[0]} 50%, ${h[1]} 50%)` : h[0] || '#d4d4d8')

const ROTULOS: Record<string, string> = {
  Fit: 'Corte', Gender: 'Género', Length: 'Comprimento', Width: 'Largura', Height: 'Altura', Depth: 'Profundidade', Weight: 'Peso', Capacity: 'Capacidade',
  'Country of Origin': 'País de origem', Volume: 'Volume', Diameter: 'Diâmetro', Thickness: 'Espessura', Size: 'Tamanho', 'Battery Capacity': 'Capacidade da bateria', Memory: 'Memória',
}
const VALORES: Record<string, string> = {
  StandardFit: 'Standard', SlimFit: 'Justo', RelaxedFit: 'Folgado', RegularFit: 'Regular', Mens: 'Homem', SADC: 'África Austral (SADC)', SouthAfrica: 'África do Sul', China: 'China', Ladies: 'Senhora', Unisex: 'Unissexo', Kids: 'Criança', Boys: 'Rapaz', Girls: 'Rapariga',
}

const caixa = 'rounded-xl border border-zinc-200/80 bg-white p-6 dark:border-white/10 dark:bg-zinc-900'
const h2 = 'flex items-center gap-2.5 text-xl font-extrabold text-zinc-900 dark:text-white'

export interface Resumo {
  marca: string | null
  gama: string | null
  grupoNome: string | null
  ideal: string[]
}

export function InformacaoProduto({ ficha, resumo, atualizadoEm }: { ficha: Ficha | null; resumo: Resumo; atualizadoEm: string }) {
  const linhas: [string, string][] = []
  if (resumo.marca) linhas.push(['Marca', resumo.marca])
  if (resumo.gama) linhas.push(['Gama', resumo.gama])
  if (ficha?.mat) linhas.push(['Material', ficha.mat])
  if (ficha) {
    // o fornecedor põe 1 cm e 1 kg quando não sabe as medidas: isso não se mostra
    for (const [k, v] of Object.entries(ficha.esp)) if (v !== '1 cm' && v !== '1 kg') linhas.push([ROTULOS[k] ?? k, VALORES[v] ?? v])
    const comNome = ficha.cores.filter((c) => c.c && c.n)
    if (comNome.length) linhas.push(['Cores disponíveis', String(comNome.length)])
    if (ficha.tam.length) linhas.push(['Tamanhos', ficha.tam.length > 1 ? `${ficha.tam[0]} – ${ficha.tam[ficha.tam.length - 1]}` : ficha.tam[0]])
    if (ficha.pos.length) linhas.push(['Posições de personalização', String(ficha.pos.length)])
    if (ficha.min > 1) linhas.push(['Quantidade mínima', num(ficha.min)])
    const c = Object.values(ficha.cx)[0]
    if (c) linhas.push(['Unidades por caixa', num(c[0])])
  }

  // sem cores (o fornecedor dá o stock numa linha só, com «-» no lugar da cor): uma linha «Stock» sem cor
  const stockLinhas = ficha
    ? [
        ...ficha.cores.filter((c) => c.c && c.n).map((c) => ({ c, tam: ficha.v[c.c] ?? {} })),
        ...(ficha.v['-'] ? [{ c: { c: '-', n: '', h: [] as string[], i: null, x: [] as string[] }, tam: ficha.v['-'] }] : []),
      ].filter((x) => Object.keys(x.tam).length > 0)
    : []
  const colunas = ficha?.tam.length ? ficha.tam : ['-']
  const medidas = ficha ? Object.keys(ficha.med).filter((t) => ficha.med[t].some((x) => x > 1)) : []

  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-3">
        <section id="ficha-tecnica" className={`${caixa} lg:col-span-2`}>
          <h2 className={h2}>
            <Info className="h-5 w-5 text-red-600" />
            <span>Ficha técnica</span>
          </h2>
          <dl className="mt-4 grid gap-x-10 sm:grid-cols-2">
            {linhas.map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-4 border-b border-zinc-200/70 py-2.5 text-sm dark:border-white/10">
                <dt className="text-zinc-500 dark:text-zinc-400">{k}</dt>
                <dd className="text-right font-semibold text-zinc-900 dark:text-zinc-100">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className={caixa}>
          <h2 className={h2}>
            <Layers className="h-5 w-5 text-red-600" />
            <span>Ideal para</span>
          </h2>
          <ul className="mt-4 space-y-2.5">
            {resumo.ideal.map((t) => (
              <li key={t} className="flex items-start gap-2.5 text-sm text-zinc-700 dark:text-zinc-300">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-600" />
                <span>{t}</span>
              </li>
            ))}
          </ul>
          <p className="mt-5 rounded-lg bg-zinc-100 p-3 text-xs leading-relaxed text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            Diga-nos para que precisa e a quantidade: ajudamos a escolher a cor, o tamanho e a personalização.
          </p>
        </section>
      </div>

      {ficha && ficha.pos.length > 0 && (
        <section id="personalizacao" className={caixa}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className={h2}>
                <Palette className="h-5 w-5 text-red-600" />
                <span>Personalização</span>
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                Estas são as posições e os métodos possíveis neste produto, com a área máxima de cada um. Envie o seu logótipo (de preferência em vector: AI, EPS ou PDF) e confirmamos a posição e o método na cotação.
              </p>
            </div>
            {ficha.pdf && (
              <a href={`${PREFIXO_PDF}${ficha.pdf.split('/').map(encodeURIComponent).join('/')}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-800 transition-colors hover:border-red-600 hover:text-red-600 dark:border-zinc-700 dark:text-zinc-200">
                <Download className="h-4 w-4" />
                <span>Guia de personalização (PDF)</span>
              </a>
            )}
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {ficha.pos.map((q, n) => (
              <div key={q.p} className="rounded-xl border border-zinc-200/80 p-4 dark:border-white/10">
                <h3 className="flex items-center gap-2 text-sm font-extrabold text-zinc-900 dark:text-white">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-red-600 text-xs text-white">{n + 1}</span>
                  <span>{nomePosicao(q.n)}</span>
                </h3>
                <ul className="mt-3 space-y-1.5">
                  {q.m.map((m, i) => (
                    <li key={`${m.n}-${m.w}-${m.h}-${i}`} className="flex items-baseline justify-between gap-3 text-sm">
                      <span className="text-zinc-800 dark:text-zinc-200">{nomeMetodo(m.n)}</span>
                      <span className="text-right text-xs text-zinc-500 dark:text-zinc-400">
                        <DetalheMetodo m={m} />
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {stockLinhas.length > 0 && (
        <section id="stock" className={caixa}>
          <h2 className={h2}>
            <Package className="h-5 w-5 text-red-600" />
            <span>Stock por cor e tamanho</span>
          </h2>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            <span>Stock do fornecedor a</span> <span className="font-semibold">{data(atualizadoEm)}</span>
            <span>. Confirmamos a disponibilidade ao responder ao pedido.</span>
          </p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wider text-zinc-500 dark:border-white/10">
                  <th className="py-2 pr-4 font-bold">Cor</th>
                  {colunas.map((t) => (
                    <th key={t} className="px-3 py-2 text-right font-bold">
                      {t === '-' ? 'Stock' : t}
                    </th>
                  ))}
                  <th className="py-2 pl-4 text-right font-bold">A chegar</th>
                </tr>
              </thead>
              <tbody>
                {stockLinhas.map(({ c, tam }) => {
                  const chega = Object.values(tam).reduce((s, x) => s + x[1], 0)
                  const quando = Object.values(tam).map((x) => x[2]).filter(Boolean).sort()[0]
                  return (
                    <tr key={c.c} className="border-b border-zinc-100 last:border-0 dark:border-white/5">
                      <td className="py-2.5 pr-4">
                        <span className="flex items-center gap-2.5">
                          {c.n && <span className="h-5 w-5 shrink-0 rounded-md ring-1 ring-black/15" style={{ background: fundo(c.h) }} />}
                          <span className="font-semibold text-zinc-900 dark:text-zinc-100">{c.n ? nomeCor(c.n) : 'Stock'}</span>
                        </span>
                      </td>
                      {colunas.map((t) => {
                        const s = tam[t]?.[0]
                        return (
                          <td key={t} className={`px-3 py-2.5 text-right tabular-nums ${s ? 'font-semibold text-zinc-900 dark:text-zinc-100' : 'text-zinc-400'}`}>
                            {s === undefined ? '—' : num(s)}
                          </td>
                        )
                      })}
                      <td className="py-2.5 pl-4 text-right text-xs text-zinc-500">
                        {chega > 0 ? (
                          <span>
                            <span className="font-semibold text-zinc-800 dark:text-zinc-200">{num(chega)}</span>
                            {quando && <span>{` · ${data(quando)}`}</span>}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {ficha && (medidas.length > 0 || Object.keys(ficha.cx).length > 0) && (
        <section id="medidas" className={caixa}>
          <h2 className={h2}>
            <Ruler className="h-5 w-5 text-red-600" />
            <span>Medidas e embalagem</span>
          </h2>
          <div className="mt-4 grid gap-8 lg:grid-cols-2">
            {medidas.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wider text-zinc-500 dark:border-white/10">
                      <th className="py-2 pr-4 font-bold">Tamanho</th>
                      <th className="px-3 py-2 text-right font-bold">Comprimento (cm)</th>
                      <th className="px-3 py-2 text-right font-bold">Largura (cm)</th>
                      <th className="py-2 pl-3 text-right font-bold">Peso (kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {medidas.map((t) => (
                      <tr key={t} className="border-b border-zinc-100 last:border-0 dark:border-white/5">
                        <td className="py-2 pr-4 font-semibold text-zinc-900 dark:text-zinc-100">{t}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{ficha.med[t][0]}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{ficha.med[t][1]}</td>
                        <td className="py-2 pl-3 text-right tabular-nums">{ficha.med[t][2]}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {Object.keys(ficha.cx).length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-zinc-500">Caixa de transporte</h3>
                {(() => {
                  const c = Object.values(ficha.cx)[0]
                  const l: [string, string][] = [
                    ['Unidades por caixa', num(c[0])],
                    ['Medidas da caixa (cm)', `${c[1]} × ${c[2]} × ${c[3]}`],
                    ['Peso da caixa', `${c[4]} kg`],
                  ]
                  return (
                    <dl>
                      {l.map(([k, v]) => (
                        <div key={k} className="flex items-baseline justify-between gap-4 border-b border-zinc-200/70 py-2.5 text-sm dark:border-white/10">
                          <dt className="text-zinc-500 dark:text-zinc-400">{k}</dt>
                          <dd className="font-semibold text-zinc-900 dark:text-zinc-100">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  )
                })()}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
}
