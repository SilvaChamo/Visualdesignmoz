'use client'

// Calculadora de custo de importação (custo "posto no armazém"): várias linhas de produto, direitos por linha, IVA ou
// taxas dos EUA, custos partilhados repartidos por valor, peso ou volume, e preço com a margem pretendida.
// A conta está em src/lib/calculadora-custo-importacao.ts; aqui só há o formulário e a apresentação (Tailwind, dentro do
// cartão principal do painel: Admin › Contabilidade › Calculadora). O desenho adapta-se à largura do cartão (consultas de
// contentor @xl/@2xl/@4xl/@5xl), não à do ecrã, porque o menu do painel já ocupa um bom bocado.
// Os textos estão em português; o inglês está em traducoes/26-calculadora-importacao.ts.

import { useMemo, useRef, useState } from 'react'
import { Copy, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useI18n } from '@/lib/i18n'
import { cambioEntre } from '@/lib/cambio'
import { useCambio } from './useCambio'
import { translate } from '../i18n'
import {
  EXEMPLO_ENTRADA,
  calcularCustoImportacao,
  type BaseAduaneira,
  type CodigoErro,
  type EntradaCalculo,
  type ModoImposto,
  type Reparticao,
  type ResultadoCalculo,
  type TipoEntradaEua,
} from '@/lib/calculadora-custo-importacao'

const MAX_LINHAS = 12

interface LinhaForm {
  id: number
  nome: string
  unidades: string
  custo: string
  /** custo unitário da impressão, na moeda do país (soma-se ao custo antes de cambiar) */
  impressao: string
  direitos: string
  peso: string
  volume: string
}

interface Form {
  modo: ModoImposto
  reparticao: Reparticao
  base: BaseAduaneira
  /** moeda em que o fornecedor factura as mercadorias, escolhida pelo país de origem (MZN = sem conversão) */
  origem: string
  nomeImposto: 'IVA' | 'VAT' | 'GST'
  frete: string
  seguro: string
  corretor: string
  porto: string
  entrega: string
  outros: string
  /** comissão, em % sobre o valor total sem imposto de cada produto (nos produtos aparece em valor) */
  comissaoPct: string
  perdasPct: string
  margemPct: string
  entrada: TipoEntradaEua
  mpfPct: string
  mpfMin: string
  mpfMax: string
  mpfFixo: string
  hmfPct: string
  maritimo: boolean
  impostoPct: string
  impostoSobreDireitos: boolean
  impostoSobreFrete: boolean
  recuperavel: boolean
}

/** países de onde se compra: o botão escolhe a moeda do fornecedor e o câmbio do dia (as restantes despesas são em meticais) */
const ORIGENS: { codigo: string; pais: string; custo: string }[] = [
  { codigo: 'MZN', pais: 'Moçambique', custo: 'Custo unitário (FOB)' },
  { codigo: 'ZAR', pais: 'África do Sul', custo: 'Custo unitário em Rand (ZAR)' },
  { codigo: 'CNY', pais: 'China', custo: 'Custo unitário em Yuan (CNY)' },
  { codigo: 'BRL', pais: 'Brasil', custo: 'Custo unitário em Real (BRL)' },
  { codigo: 'INR', pais: 'Índia', custo: 'Custo unitário em Rupia (INR)' },
  { codigo: 'AED', pais: 'Emirados Árabes', custo: 'Custo unitário em Dirham (AED)' },
  { codigo: 'EUR', pais: 'Portugal e zona euro', custo: 'Custo unitário em Euro (EUR)' },
  { codigo: 'GBP', pais: 'Reino Unido', custo: 'Custo unitário em Libra (GBP)' },
  { codigo: 'JPY', pais: 'Japão', custo: 'Custo unitário em Iene (JPY)' },
  { codigo: 'USD', pais: 'EUA e outros (dólar)', custo: 'Custo unitário em Dólar (USD)' },
  { codigo: 'TZS', pais: 'Tanzânia', custo: 'Custo unitário em Xelim (TZS)' },
  { codigo: 'ZMW', pais: 'Zâmbia', custo: 'Custo unitário em Kwacha (ZMW)' },
  { codigo: 'MWK', pais: 'Malawi', custo: 'Custo unitário em Kwacha (MWK)' },
]

type CodigoUI = CodigoErro | 'cambio'

const ERROS: Record<CodigoUI, string> = {
  cambio: 'Falta o câmbio do dia: tente de novo ou escolha Moçambique.',
  'sem-linhas': 'Adicione pelo menos uma linha de produto.',
  'campos-remessa': 'Os campos da remessa não podem estar vazios nem negativos.',
  perdas: 'As unidades que não se vendem têm de ser menos de 100%.',
  margem: 'A margem pretendida tem de ser inferior a 100%.',
  unidades: 'As unidades têm de ser números inteiros acima de zero.',
  'campos-linha': 'O custo unitário, os direitos, o peso e o volume não podem estar vazios nem negativos.',
  'custo-zero': 'Indique um custo unitário acima de zero em pelo menos uma linha.',
  'sem-peso': 'Indique o peso por unidade para repartir pelo peso.',
  'sem-volume': 'Indique o volume por unidade para repartir pelo volume.',
  'sem-vendaveis': 'Cada linha precisa de pelo menos uma unidade vendável.',
}

const novaLinha = (id: number, v?: Partial<Omit<LinhaForm, 'id'>>): LinhaForm => ({
  id,
  nome: '',
  unidades: '100',
  custo: '1',
  impressao: '0',
  direitos: '0',
  peso: '0',
  volume: '0',
  ...v,
})

/** Valores de partida: a cotação real BF-MWBWHJVJ-JHTJ da Brandful (África do Sul), de 11/11/2026 e válida até 11/12/2026.
 *  Os preços são em rand e sem o IVA sul-africano (15%). `preparacao` é a taxa de preparação da arte (setup), paga uma vez por produto:
 *  divide-se pelas unidades e entra como «custo unitário da impressão». */
const COTACAO: { nome: string; unidades: number; preco: number; preparacao: number }[] = [
  { nome: 'Altitude Doodle Ball Pen - Yellow', unidades: 400, preco: 7.3, preparacao: 400 },
  { nome: 'Altitude Matrix Ball Pen', unidades: 2034, preco: 5.8, preparacao: 400 },
  { nome: 'Altitude Zeta Ball Pen', unidades: 400, preco: 8.3, preparacao: 400 },
  { nome: 'Altitude Jotter A5 Soft Cover Notebook', unidades: 200, preco: 28, preparacao: 400 },
  { nome: 'Altitude Stanford A5 Hard Cover Notebook', unidades: 200, preco: 47, preparacao: 400 },
  { nome: 'Altitude Vitality BMI Measuring Tape - 1.4 Metre', unidades: 200, preco: 33, preparacao: 400 },
  { nome: 'Altitude Spector Pencil Case', unidades: 200, preco: 36, preparacao: 400 },
  { nome: 'Altitude Oakridge A5 Soft Cover Notebook', unidades: 200, preco: 70, preparacao: 800 },
  { nome: 'Altitude Silky Stylus Ball Pen', unidades: 400, preco: 15.5, preparacao: 400 },
]

function linhasDoExemplo(): LinhaForm[] {
  return COTACAO.map((p, k) =>
    novaLinha(k + 1, {
      nome: p.nome,
      unidades: String(p.unidades),
      custo: String(p.preco),
      impressao: String(Math.round((p.preparacao / p.unidades) * 1e8) / 1e8),
      direitos: '0',
      peso: '0',
      volume: '0',
    }),
  )
}

function formDoExemplo(): Form {
  const e = EXEMPLO_ENTRADA
  return {
    modo: e.modo,
    reparticao: e.reparticao,
    base: e.base,
    origem: 'ZAR',
    nomeImposto: 'IVA',
    // a cotação não traz frete, seguro nem despesas de entrega: preenchem-se à mão
    frete: '0',
    seguro: '0',
    corretor: '0',
    porto: '0',
    entrega: '0',
    outros: '0',
    comissaoPct: '0',
    perdasPct: String(e.perdasPct),
    margemPct: String(e.margemPct),
    entrada: e.entrada,
    mpfPct: String(e.mpfPct),
    mpfMin: String(e.mpfMin),
    mpfMax: String(e.mpfMax),
    mpfFixo: String(e.mpfFixo),
    hmfPct: String(e.hmfPct),
    maritimo: e.maritimo,
    impostoPct: String(e.impostoPct),
    impostoSobreDireitos: e.impostoSobreDireitos,
    impostoSobreFrete: e.impostoSobreFrete,
    recuperavel: e.recuperavel,
  }
}

/** número escrito pelo utilizador; vazio dá NaN (erro), ou 0 quando o campo é opcional */
function num(s: string, vazioZero = false): number {
  const t = s.trim().replace(',', '.')
  if (t === '') return vazioZero ? 0 : NaN
  const v = Number(t)
  return Number.isFinite(v) ? v : NaN
}

/** custo unitário cambiado de uma linha: (custo + impressão) × câmbio (no produto local não há impressão) */
const custoCambiado = (l: LinhaForm, compra: number, local = false) => (num(l.custo) + (local ? 0 : num(l.impressao, true))) * compra

/** `compra` = quanto vale em meticais 1 unidade da moeda do fornecedor (1 se não há conversão): só o custo unitário das
 *  mercadorias se escreve na moeda do fornecedor; o frete, o seguro e os outros custos já são na moeda do resultado. */
function paraEntrada(f: Form, linhas: LinhaForm[], compra: number, reparticao: Reparticao = f.reparticao): EntradaCalculo {
  // o custo unitário do cálculo: (custo + impressão) na moeda do país, cambiado; no produto local não há impressão
  const local = f.modo !== 'eua' && f.origem === 'MZN'
  const custos = linhas.map((l) => custoCambiado(l, compra, local))
  // a comissão é uma % do valor total sem imposto (unidades × custo unitário); se faltar algo nas linhas, o cálculo já o aponta
  const valorTotal = linhas.reduce((t, l, k) => t + num(l.unidades) * custos[k], 0)
  const comissao = (num(f.comissaoPct, true) / 100) * valorTotal
  return {
    modo: f.modo,
    reparticao,
    base: f.base,
    linhas: linhas.map((l, k) => ({
      nome: l.nome.trim() || `Linha ${k + 1}`,
      unidades: num(l.unidades),
      custo: custos[k],
      direitos: num(l.direitos),
      peso: num(l.peso, true),
      volume: num(l.volume, true),
    })),
    frete: num(f.frete),
    seguro: num(f.seguro),
    corretor: num(f.corretor),
    porto: num(f.porto),
    entrega: num(f.entrega),
    outros: num(f.outros),
    comissao: Number.isFinite(comissao) ? comissao : 0,
    perdasPct: num(f.perdasPct),
    margemPct: num(f.margemPct),
    entrada: f.entrada,
    mpfPct: num(f.mpfPct),
    mpfMin: num(f.mpfMin),
    mpfMax: num(f.mpfMax),
    mpfFixo: num(f.mpfFixo),
    hmfPct: num(f.hmfPct),
    maritimo: f.maritimo,
    impostoPct: num(f.impostoPct),
    impostoSobreDireitos: f.impostoSobreDireitos,
    impostoSobreFrete: f.impostoSobreFrete,
    recuperavel: f.recuperavel,
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// peças de interface

const CAMPO =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 tabular-nums shadow-sm outline-none transition focus:border-red-500 focus:ring-2 focus:ring-red-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
const ROTULO = 'mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-400'
const CARTAO = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 @xl:p-6'
const TITULO = 'text-lg font-bold text-slate-900 dark:text-slate-100'
const NOTA = 'text-xs leading-relaxed text-slate-500 dark:text-slate-400'

function Campo({ id, rotulo, valor, aoMudar, aoSair, passo = 'any', sufixo }: { id: string; rotulo: string; valor: string; aoMudar: (v: string) => void; aoSair?: () => void; passo?: string; sufixo?: string }) {
  return (
    <div>
      <label htmlFor={id} className={ROTULO}>
        {rotulo}
      </label>
      <div className="relative">
        <input id={id} type="number" inputMode="decimal" min={0} step={passo} value={valor} onChange={(e) => aoMudar(e.target.value)} onBlur={aoSair} className={sufixo ? `${CAMPO} pr-14 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none` : CAMPO} />
        {sufixo && (
          <span aria-hidden className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-bold text-slate-400 dark:text-slate-500">
            {sufixo}
          </span>
        )}
      </div>
    </div>
  )
}

/** campo só de leitura (um valor calculado) */
function CampoLeitura({ id, rotulo, valor }: { id: string; rotulo: string; valor: string }) {
  return (
    <div>
      <label htmlFor={id} className={ROTULO}>
        {rotulo}
      </label>
      <input id={id} type="text" readOnly aria-readonly="true" value={valor} className={CAMPO.replace('bg-white', 'bg-slate-50').replace('dark:bg-slate-800', 'dark:bg-slate-800/60')} />
    </div>
  )
}

/** campo que mostra um valor calculado a partir de um total e deixa editá-lo: ao escrever, `aoEditar` muda o total; enquanto se
 *  escreve mantém-se o texto tal como foi escrito (para não apagar a vírgula), e ao sair volta a mostrar o valor calculado */
function CampoLigado({ id, rotulo, valor, aoEditar, sufixo }: { id: string; rotulo: string; valor: string; aoEditar: (v: string) => void; sufixo?: string }) {
  const [texto, setTexto] = useState<string | null>(null)
  return (
    <Campo
      id={id}
      rotulo={rotulo}
      valor={texto ?? valor}
      aoMudar={(v) => {
        setTexto(v)
        aoEditar(v)
      }}
      aoSair={() => setTexto(null)}
      sufixo={sufixo}
    />
  )
}

function Opcoes<T extends string>({ rotuloAria, valor, opcoes, aoMudar }: { rotuloAria: string; valor: T; opcoes: { valor: T; texto: string }[]; aoMudar: (v: T) => void }) {
  return (
    <div role="group" aria-label={rotuloAria} className="inline-flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
      {opcoes.map((o) => {
        const ligado = o.valor === valor
        return (
          <button
            key={o.valor}
            type="button"
            aria-pressed={ligado}
            onClick={() => aoMudar(o.valor)}
            className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition ${
              ligado ? 'bg-red-600 text-white shadow-sm' : 'text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            {o.texto}
          </button>
        )
      })}
    </div>
  )
}

function Caixa({ id, texto, marcada, aoMudar }: { id: string; texto: string; marcada: boolean; aoMudar: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300">
      <input id={id} type="checkbox" checked={marcada} onChange={(e) => aoMudar(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-red-600" />
      <span>{texto}</span>
    </label>
  )
}

export interface LinhaTabela {
  celulas: string[]
  total?: boolean
}

/** Tabela no computador; no telemóvel cada linha passa a um bloco (título + pares nome/valor), sem barra de deslocar. */
export function Tabela({
  rotuloAria,
  colunas,
  linhas,
  alinharTodasEsquerda = false,
  quebra = 'md',
}: {
  rotuloAria: string
  colunas: string[]
  linhas: LinhaTabela[]
  alinharTodasEsquerda?: boolean
  /** a partir de que largura é tabela (abaixo disso, blocos); as tabelas de muitas colunas pedem 'lg' */
  quebra?: 'md' | 'lg'
}) {
  return (
    <>
      <div role="region" aria-label={rotuloAria} className={`hidden overflow-x-auto ${quebra === 'lg' ? '@5xl:block' : '@2xl:block'}`}>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              {colunas.map((c, k) => (
                <th key={k} scope="col" className={`px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 ${k === 0 || alinharTodasEsquerda ? 'text-left' : 'text-right'}`}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={i} className={`border-b border-slate-100 last:border-0 dark:border-slate-800 ${l.total ? 'bg-slate-50 font-bold dark:bg-slate-800/60' : ''}`}>
                {l.celulas.map((c, k) => (
                  <td key={k} className={`px-3 py-2.5 tabular-nums text-slate-800 dark:text-slate-200 ${k === 0 || alinharTodasEsquerda ? 'text-left' : 'text-right'}`}>
                    {c}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className={`space-y-3 ${quebra === 'lg' ? '@5xl:hidden' : '@2xl:hidden'}`}>
        {linhas.map((l, i) => (
          <div key={i} className={`overflow-hidden rounded-xl border pt-3.5 ${l.total ? 'border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-800/60' : 'border-slate-200 dark:border-slate-700'}`}>
            <p className="mb-2 px-3.5 text-sm font-bold text-slate-900 dark:text-slate-100">{l.celulas[0]}</p>
            <dl className="cci-linhas border-t border-slate-200 dark:border-slate-700">
              {l.celulas.slice(1).map((c, k) =>
                c ? (
                  <div key={k} className="flex items-baseline justify-between gap-3 px-3.5 py-2 text-sm">
                    <dt className="text-slate-500 dark:text-slate-400">{colunas[k + 1]}</dt>
                    <dd className="text-right font-medium tabular-nums text-slate-800 dark:text-slate-200">{c}</dd>
                  </div>
                ) : null,
              )}
            </dl>
          </div>
        ))}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------------------------------------------------

export function CalculadoraCustoImportacao() {
  const { lang } = useI18n()
  const [form, setForm] = useState<Form>(formDoExemplo)
  const [linhas, setLinhas] = useState<LinhaForm[]>(linhasDoExemplo)
  const [estado, setEstado] = useState('')
  const ultimaLinha = useRef<HTMLInputElement | null>(null)
  // o número da próxima linha; as do exemplo são 1, 2… (iguais no servidor e no navegador)
  const proximoId = useRef(COTACAO.length + 1)

  const locale = lang === 'en' ? 'en-US' : 'pt-MZ'
  const eua = form.modo === 'eua'
  // o resultado e as despesas são em meticais (nos EUA, em dólares); só o custo das mercadorias vem na moeda do país escolhido
  const moeda = eua ? 'USD' : 'MZN'
  const origem = eua ? 'USD' : form.origem
  const dinheiro = useMemo(() => {
    try {
      const f = new Intl.NumberFormat(locale, { style: 'currency', currency: moeda, minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: 'always' })
      return (v: number) => f.format(Math.round(v * 1e6) / 1e6)
    } catch {
      return (v: number) => `${moeda} ${v.toFixed(2)}`
    }
  }, [locale, moeda])
  const pct = (v: number) => `${new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1, useGrouping: 'always' }).format(v)}%`
  const inteiro = (v: number) => new Intl.NumberFormat(locale, { useGrouping: 'always' }).format(v)
  const taxaTexto = (s: string) => new Intl.NumberFormat(locale, { maximumFractionDigits: 4, useGrouping: 'always' }).format(num(s))

  // câmbio do dia da moeda do fornecedor para o resultado; só muda ao escolher o país de origem
  const cambio = useCambio()
  const compra = cambioEntre(cambio.dados?.taxas, origem, moeda)
  const semCambio = !(compra > 0)
  const dataCambio = cambio.dados?.atualizado ? new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeZone: 'Africa/Maputo' }).format(new Date(cambio.dados.atualizado)) : ''
  const cambioFmt = (v: number) => new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumSignificantDigits: 6, useGrouping: 'always' }).format(v)
  const convertido = (custo: string) => (compra > 0 && Number.isFinite(num(custo)) ? dinheiro(num(custo) * compra) : '')
  const comConversao = origem !== moeda
  // produto local (moçambicano): não há câmbio nem impressão em moeda estrangeira, e o custo unitário escreve-se em meticais
  const local = !eua && form.origem === 'MZN'

  const r: ResultadoCalculo | { ok: false; erro: 'cambio' } = useMemo(
    () => (semCambio ? { ok: false as const, erro: 'cambio' as const } : calcularCustoImportacao(paraEntrada(form, linhas, compra))),
    [form, linhas, semCambio, compra],
  )
  const alternativas = useMemo(
    () => (['valor', 'peso', 'volume'] as Reparticao[]).map((m) => (semCambio ? { ok: false as const, erro: 'cambio' as const } : calcularCustoImportacao(paraEntrada(form, linhas, compra, m)))),
    [form, linhas, semCambio, compra],
  )

  const mudar = <K extends keyof Form>(k: K, v: Form[K]) => {
    setEstado('')
    setForm((f) => ({ ...f, [k]: v }))
  }
  const mudarLinha = (id: number, k: keyof Omit<LinhaForm, 'id'>, v: string) => {
    setEstado('')
    setLinhas((ls) => ls.map((l) => (l.id === id ? { ...l, [k]: v } : l)))
  }
  const mudarOrigem = (codigo: string) => {
    setEstado('')
    setForm((f) => ({ ...f, origem: codigo }))
  }
  const mudarModo = (modo: ModoImposto) => {
    setForm((f) => ({ ...f, modo, base: modo === 'eua' ? 'fob' : 'cif' }))
    setEstado(modo === 'eua' ? 'Modo EUA: base FOB, MPF e HMF.' : 'Modo IVA: base CIF. Defina a taxa do seu destino.')
  }
  const adicionarLinha = () => {
    if (linhas.length >= MAX_LINHAS) return
    const id = proximoId.current++
    setLinhas((ls) => [...ls, novaLinha(id)])
    setEstado('Linha adicionada. Indique as unidades, o custo, os direitos, o peso e o volume.')
    setTimeout(() => ultimaLinha.current?.focus(), 0)
  }
  const removerLinha = (id: number) => {
    setLinhas((ls) => ls.filter((l) => l.id !== id))
    setEstado('Linha removida.')
  }
  const repor = () => {
    setForm(formDoExemplo())
    setLinhas(linhasDoExemplo())
    proximoId.current = COTACAO.length + 1
    setEstado('Exemplo reposto.')
  }

  // campos ligados a um total da remessa: o transporte e a entrega domiciliária por unidade (o total ÷ as unidades de todas as
  // linhas); ao editá-los muda o total. A comissão é uma % da remessa; em cada produto aparece em valor.
  const unidadesTotal = linhas.reduce((t, l) => t + num(l.unidades), 0)
  const comissaoPct = num(form.comissaoPct, true)
  const casas = (v: number) => (Number.isFinite(v) ? String(Math.round(v * 1e4) / 1e4) : '')
  const porUnidade = (total: string) => (unidadesTotal > 0 ? casas(num(total) / unidadesTotal) : '')
  const editarPorUnidade = (campo: 'frete' | 'entrega') => (v: string) => {
    if (v.trim() === '') return mudar(campo, '')
    const n = num(v)
    if (unidadesTotal > 0 && Number.isFinite(n)) mudar(campo, String(Math.round(n * unidadesTotal * 1e6) / 1e6))
  }
  // os valores calculados que cada linha de produto mostra (por unidade, salvo onde se diz que é total)
  const valoresLinha = (l: LinhaForm, k: number) => {
    const dinheiroOuVazio = (n: number) => (Number.isFinite(n) ? dinheiro(n) : '')
    const cambiado = custoCambiado(l, compra, local)
    const rl = r.ok ? r.linhas[k] : undefined
    return {
      cambiado: dinheiroOuVazio(cambiado),
      unitario: dinheiroOuVazio(cambiado),
      totalSemImposto: dinheiroOuVazio(num(l.unidades) * cambiado),
      // a impressão do produto inteiro (custo unitário da impressão × unidades, cambiado)
      impressao: dinheiroOuVazio(local ? 0 : num(l.impressao, true) * num(l.unidades) * compra),
      comissao: dinheiroOuVazio((cambiado * comissaoPct) / 100),
      despesas: rl ? dinheiro(rl.total - rl.mercadorias) : '',
      entrega: rl ? dinheiro(rl.total) : '',
    }
  }

  const nomeReparticao = { valor: 'Valor', peso: 'Peso', volume: 'Volume' }[form.reparticao]
  const nomeBase = { fob: 'FOB', cfr: 'CFR', cif: 'CIF' }[form.base]

  async function copiar() {
    if (!r.ok) {
      setEstado(ERROS[r.erro])
      return
    }
    // o texto copiado não passa pela tradução da página: traduz-se aqui, com o dicionário do painel
    const tr = (k: string, ...a: string[]) => translate(lang, k).replace(/\{(\d)\}/g, (_, i) => a[Number(i)] ?? '')
    const linhasTexto = [
      tr('Custo total posto no armazém: {0} ({1} acima do valor das mercadorias)', dinheiro(r.total), pct(r.acima)),
      tr('A pagar à alfândega na entrada: {0}', dinheiro(r.aPagarNaEntrada)),
      tr('Custos partilhados repartidos por {0}.', tr(nomeReparticao).toLowerCase()),
      ...(comConversao ? [tr('Câmbio: {0}', `1 ${origem} = ${cambioFmt(compra)} ${moeda}`)] : []),
      ...r.linhas.map((l) => tr('{0}: {1} por unidade posto no armazém, {2} para {3} unidades vendáveis', l.nome, dinheiro(l.porUnidade), dinheiro(l.total), inteiro(l.vendaveis))),
      tr('Estimativa só para planeamento. As taxas foram indicadas por quem calculou: confirme-as na pauta aduaneira, com o transitário ou com o despachante.'),
    ]
    try {
      await navigator.clipboard.writeText(linhasTexto.join('\n'))
      setEstado('Resultados copiados.')
    } catch {
      setEstado('Não foi possível copiar. Seleccione a tabela e copie-a à mão.')
    }
  }

  // ---- quadros de resultados -------------------------------------------------------------------------------------
  const colunasProdutos = [
    'Produto',
    'Unidades vendáveis',
    'Mercadorias',
    'Direitos',
    'Taxas ou imposto',
    'Frete e partilhados',
    'Total posto no armazém',
    'Por unidade',
    Number.isFinite(num(form.margemPct)) ? `Preço com ${taxaTexto(form.margemPct)}% de margem` : 'Preço com a margem pretendida',
  ]
  const linhasProdutos: LinhaTabela[] = r.ok
    ? [
        ...r.linhas.map((l) => ({
          celulas: [l.nome, inteiro(l.vendaveis), dinheiro(l.mercadorias), dinheiro(l.direitos), dinheiro(l.taxas + l.impostoNoCusto), dinheiro(l.frete + l.seguro + l.partilhados), dinheiro(l.total), dinheiro(l.porUnidade), dinheiro(l.preco)],
        })),
        {
          celulas: ['Remessa', inteiro(r.vendaveis), dinheiro(r.mercadorias), dinheiro(r.direitos), dinheiro(r.mpf + r.hmf + (r.recuperavel ? 0 : r.imposto)), dinheiro(r.frete + r.seguro + r.partilhados), dinheiro(r.total), '', ''],
          total: true,
        },
      ]
    : []

  const linhasMetodos: LinhaTabela[] = r.ok
    ? r.linhas.map((l, k) => {
        const por = alternativas.map((a) => (a.ok ? a.linhas[k].porUnidade : null))
        const validos = por.filter((v): v is number => v !== null)
        return {
          celulas: [
            l.nome,
            ...por.map((v, j) => (v === null ? (j === 1 ? 'Adicione os pesos' : 'Adicione os volumes') : dinheiro(v))),
            validos.length > 1 ? dinheiro(Math.max(...validos) - Math.min(...validos)) : '–',
          ],
        }
      })
    : []

  const linhasDecomposicao: LinhaTabela[] = []
  if (r.ok) {
    const nomeRep = { valor: 'Repartido por valor', peso: 'Repartido por peso', volume: 'Repartido por volume' }[form.reparticao]
    // [rótulo, como foi calculado, valor, entra no custo?]
    const linhasBase: [string, string, number, boolean][] = [
      ['Valor das mercadorias', linhas.length === 1 ? `${linhas.length} linha, unidades × custo unitário` : `${linhas.length} linhas, unidades × custo unitário`, r.mercadorias, true],
      [
        `Valor aduaneiro (${nomeBase})`,
        form.base === 'fob' ? 'Só as mercadorias' : form.base === 'cfr' ? 'Mercadorias + frete' : 'Mercadorias + frete + seguro',
        r.valorAduaneiro,
        false,
      ],
      ['Direitos aduaneiros', 'Valor aduaneiro de cada linha × a sua taxa', r.direitos, true],
    ]
    if (eua) {
      const mpfComo =
        form.entrada === 'nenhuma'
          ? 'Não cobrado nesta entrada'
          : r.mpfLimite === 'fixo'
            ? 'Taxa fixa da entrada informal'
            : r.mpfLimite === 'min'
              ? `${dinheiro(r.valorAduaneiro)} × ${taxaTexto(form.mpfPct)}%, elevado ao mínimo`
              : r.mpfLimite === 'max'
                ? `${dinheiro(r.valorAduaneiro)} × ${taxaTexto(form.mpfPct)}%, limitado ao máximo`
                : `${dinheiro(r.valorAduaneiro)} × ${taxaTexto(form.mpfPct)}%`
      linhasBase.push(['MPF', mpfComo, r.mpf, true])
      linhasBase.push(['HMF', form.maritimo ? `${dinheiro(r.valorAduaneiro)} × ${taxaTexto(form.hmfPct)}%` : 'Não é carga marítima', r.hmf, true])
    } else {
      const baseComo =
        form.impostoSobreDireitos && form.impostoSobreFrete
          ? 'Valor aduaneiro + direitos + frete e seguro fora do valor'
          : form.impostoSobreDireitos
            ? 'Valor aduaneiro + direitos'
            : form.impostoSobreFrete
              ? 'Valor aduaneiro + frete e seguro fora do valor'
              : 'Valor aduaneiro'
      linhasBase.push([`Base do ${form.nomeImposto}`, baseComo, r.baseImposto, false])
      linhasBase.push([r.recuperavel ? `${form.nomeImposto} (recuperável, fora do custo)` : form.nomeImposto, `${dinheiro(r.baseImposto)} × ${taxaTexto(form.impostoPct)}%`, r.imposto, !r.recuperavel])
    }
    linhasBase.push(['Frete', nomeRep, r.frete, true])
    linhasBase.push(['Seguro', 'Repartido por valor', r.seguro, true])
    linhasBase.push(['Despachante ou corretor', nomeRep, r.corretor, true])
    linhasBase.push(['Manuseamento no porto ou terminal', nomeRep, r.porto, true])
    linhasBase.push(['Entrega interna', nomeRep, r.entrega, true])
    linhasBase.push(['Outros encargos', nomeRep, r.outros, true])
    if (r.comissao > 0) linhasBase.push(['Comissão', 'Repartida por valor', r.comissao, true])
    for (const [rot, como, valor, entra] of linhasBase) {
      linhasDecomposicao.push({ celulas: [rot, como, dinheiro(valor), entra ? pct((valor / r.total) * 100) : '–'] })
    }
    linhasDecomposicao.push({ celulas: ['Custo total posto no armazém', `Acima das mercadorias: ${pct(r.acima)}`, dinheiro(r.total), pct(100)], total: true })
    linhasDecomposicao.push({ celulas: ['A pagar à alfândega na entrada', eua ? 'Direitos + MPF + HMF' : `Direitos + ${form.nomeImposto}`, dinheiro(r.aPagarNaEntrada), '–'] })
  }

  const avisos: string[] = []
  if (r.ok) {
    if (eua && form.base !== 'fob') avisos.push('Nos EUA os direitos incidem sobre o valor de transacção, que não inclui o frete nem o seguro internacionais. O FOB costuma ser a base mais próxima.')
    if (eua && r.mpfLimite === 'min' && num(form.mpfPct) > 0) avisos.push(`O MPF está no mínimo: abaixo de cerca de ${dinheiro(num(form.mpfMin) / (num(form.mpfPct) / 100))} de valor declarado aplica-se o mínimo.`)
    if (eua && r.mpfLimite === 'max') avisos.push('O MPF está limitado ao máximo nesta entrada.')
    if (num(form.perdasPct) > 0) avisos.push('As unidades perdidas arredondam-se para cima, linha a linha, antes de dividir.')
  } else {
    avisos.push(ERROS[r.erro])
  }

  const ids = (nome: string) => `cci-${nome}`

  return (
    // data-ic-sem: o painel não põe ícone dentro dos campos da calculadora (icones-campos.ts)
    <div className="@container" data-ic-sem>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      {/* resumo: em cima, a toda a largura (sem barra lateral) */}
      <aside className="space-y-3">
        <div className="rounded-2xl bg-slate-900 p-5 text-white shadow-lg @xl:p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">Custo total posto no armazém</p>
          <p className="mt-1 text-3xl font-black tabular-nums @xl:text-4xl" data-testid="cci-total">
            {r.ok ? dinheiro(r.total) : 'Incompleto'}
          </p>
          <p className="mt-1.5 text-sm text-slate-300" data-testid="cci-sub">
            {r.ok ? `${pct(r.acima)} acima do valor de ${dinheiro(r.mercadorias)} das mercadorias · ${inteiro(r.vendaveis)} unidades vendáveis` : ERROS[r.erro]}
          </p>

          <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-white/15 pt-4">
            <div>
              <dt className="text-xs text-slate-300">A pagar à alfândega na entrada</dt>
              <dd className="mt-0.5 text-base font-bold tabular-nums">{r.ok ? dinheiro(r.aPagarNaEntrada) : '–'}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-300">Frete e entrega</dt>
              <dd className="mt-0.5 text-base font-bold tabular-nums">{r.ok ? dinheiro(r.frete + r.seguro + r.partilhados) : '–'}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs text-slate-300">Repartido por</dt>
              <dd className="mt-0.5 text-base font-bold">{nomeReparticao}</dd>
            </div>
          </dl>

          {r.ok && (
            <ul className="mt-4 space-y-2 border-t border-white/15 pt-4">
              {r.linhas.map((l, k) => (
                <li key={k} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 text-slate-200">{l.nome}</span>
                  <strong className="shrink-0 tabular-nums">{`${dinheiro(l.porUnidade)} por unidade`}</strong>
                </li>
              ))}
            </ul>
          )}
        </div>

        {avisos.length > 0 && (
          <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-xs leading-relaxed text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            {avisos.map((a, k) => (
              <p key={k}>{a}</p>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={copiar} className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-red-700">
            <Copy className="h-4 w-4" aria-hidden />
            Copiar resultados
          </button>
          <button type="button" onClick={repor} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800">
            <RotateCcw className="h-4 w-4" aria-hidden />
            Repor o exemplo
          </button>
        </div>
        <p role="status" aria-live="polite" className="min-h-4 text-xs font-medium text-slate-600 dark:text-slate-400" data-testid="cci-estado">
          {estado}
        </p>
      </aside>

      {/* formulário */}
      <div className="space-y-6">
        <div className={CARTAO}>
          <p className={`${ROTULO} mb-2`}>Tipo de destino</p>
          <div className="flex flex-wrap items-center gap-3">
            <Opcoes
              rotuloAria="Tipo de destino"
              valor={form.modo}
              aoMudar={mudarModo}
              opcoes={[
                { valor: 'eua', texto: 'Importação nos EUA (CBP)' },
                { valor: 'iva', texto: 'País com IVA (ex.: Moçambique)' },
              ]}
            />
            {!eua && (
              <select
                id={ids('origem')}
                aria-label="País de origem das mercadorias"
                value={form.origem}
                onChange={(e) => mudarOrigem(e.target.value)}
                className={`${CAMPO.replace('w-full ', '')} min-w-48 py-2.5`}
              >
                {ORIGENS.map((o) => (
                  <option key={o.codigo} value={o.codigo}>
                    {o.pais}
                  </option>
                ))}
              </select>
            )}
          </div>
          {!eua && (
            <>
              {comConversao && (
                <p className={`${NOTA} mt-3`} role="status" data-testid="cci-cambio">
                  {cambio.dados ? (
                    <>
                      {cambio.estado === 'erro'
                        ? `Sem ligação ao câmbio do dia: a usar o último guardado (${dataCambio}): 1 ${origem} = ${cambioFmt(compra)} ${moeda}. Fonte:`
                        : `Câmbio do dia (${dataCambio}): 1 ${origem} = ${cambioFmt(compra)} ${moeda}. Fonte:`}{' '}
                      <a href="https://www.exchangerate-api.com" target="_blank" rel="noopener noreferrer" className="font-semibold underline underline-offset-2">
                        Rates By Exchange Rate API
                      </a>
                      . Pode ser diferente do câmbio do banco e da alfândega.
                    </>
                  ) : cambio.estado === 'a-ler' ? (
                    'A obter o câmbio do dia…'
                  ) : (
                    <>
                      Não foi possível obter o câmbio do dia.{' '}
                      <button type="button" onClick={() => void cambio.ler()} className="font-bold text-red-600 underline underline-offset-2">
                        Tentar de novo
                      </button>
                    </>
                  )}
                </p>
              )}
            </>
          )}
        </div>

        <div className={CARTAO}>
          <h2 className={TITULO}>Produtos desta remessa</h2>
          <div className="mt-4 space-y-4">
            {linhas.map((l, k) => {
              const v = valoresLinha(l, k)
              const sufixoMoeda = eua ? undefined : 'MZN'
              return (
                <div key={l.id} data-linha className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{`Linha ${k + 1}`}</span>
                    {linhas.length > 1 && (
                      <button type="button" onClick={() => removerLinha(l.id)} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50 dark:hover:bg-red-500/10">
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        Remover
                      </button>
                    )}
                  </div>
                  <div className="space-y-3">
                    {/* o nome do produto, numa só linha, em cima */}
                    <div>
                      <label htmlFor={ids(`l${l.id}-nome`)} className={ROTULO}>
                        Produto
                      </label>
                      <input
                        id={ids(`l${l.id}-nome`)}
                        ref={k === linhas.length - 1 ? ultimaLinha : undefined}
                        type="text"
                        value={l.nome}
                        onChange={(e) => mudarLinha(l.id, 'nome', e.target.value)}
                        className={CAMPO}
                      />
                    </div>
                    {/* 1.ª fila de campos (câmbio): custo na moeda do país, custo da impressão e o custo cambiado; no produto local não existe */}
                    {!local && (
                      <div className="grid grid-cols-2 gap-3 @xl:grid-cols-3">
                        <Campo id={ids(`l${l.id}-custo`)} rotulo={eua ? 'Custo unitário (FOB)' : (ORIGENS.find((o) => o.codigo === origem)?.custo ?? 'Custo unitário (FOB)')} valor={l.custo} aoMudar={(x) => mudarLinha(l.id, 'custo', x)} />
                        <Campo id={ids(`l${l.id}-impressao`)} rotulo={`Custo unitário da impressão (${origem})`} valor={l.impressao} aoMudar={(x) => mudarLinha(l.id, 'impressao', x)} />
                        {comConversao && <CampoLeitura id={ids(`l${l.id}-custo-mzn`)} rotulo="Custo unitário em metical (MZN)" valor={v.cambiado} />}
                      </div>
                    )}
                    {/* 2.ª fila de campos: unidades, custo unitário na moeda do resultado e valor total sem imposto */}
                    <div className="grid grid-cols-2 gap-3 @xl:grid-cols-3">
                      <Campo id={ids(`l${l.id}-unidades`)} rotulo="Unidades" valor={l.unidades} aoMudar={(x) => mudarLinha(l.id, 'unidades', x)} passo="1" />
                      {local ? (
                        <Campo id={ids(`l${l.id}-custo`)} rotulo={`Custo unitário em (${moeda})`} valor={l.custo} aoMudar={(x) => mudarLinha(l.id, 'custo', x)} />
                      ) : (
                        <CampoLeitura id={ids(`l${l.id}-custo-final`)} rotulo={`Custo unitário em (${moeda})`} valor={v.unitario} />
                      )}
                      <CampoLeitura id={ids(`l${l.id}-total-sem-imposto`)} rotulo={eua ? 'Valor total sem imposto' : `Valor total sem ${form.nomeImposto}`} valor={v.totalSemImposto} />
                    </div>
                    {/* linha 4: transporte e entrega domiciliária por unidade (o total da remessa repartido pelas unidades) e a taxa de direitos */}
                    <div className="grid grid-cols-2 gap-3 @xl:grid-cols-3">
                      <CampoLigado id={ids(`l${l.id}-transporte`)} rotulo="Transporte por unidade" valor={porUnidade(form.frete)} aoEditar={editarPorUnidade('frete')} sufixo={sufixoMoeda} />
                      <Campo id={ids(`l${l.id}-direitos`)} rotulo="Taxa de direitos (%)" valor={l.direitos} aoMudar={(x) => mudarLinha(l.id, 'direitos', x)} />
                      <CampoLigado id={ids(`l${l.id}-entrega`)} rotulo="Entrega domiciliária por unidade" valor={porUnidade(form.entrega)} aoEditar={editarPorUnidade('entrega')} sufixo={sufixoMoeda} />
                    </div>
                    {/* linha 5: valor da impressão e comissão por unidade (a % da comissão está nos custos da remessa; aqui é valor) */}
                    <div className="grid grid-cols-2 gap-3 @xl:grid-cols-3">
                      <CampoLeitura id={ids(`l${l.id}-valor-impressao`)} rotulo="Valor da impressão" valor={v.impressao} />
                      <CampoLeitura id={ids(`l${l.id}-comissao`)} rotulo="Comissão por unidade" valor={v.comissao} />
                    </div>
                    {/* linha 6: peso e volume (dois campos), valor das despesas e valor total do produto na entrega */}
                    <div className="grid grid-cols-2 gap-3 @xl:grid-cols-3">
                      <div className="col-span-2 grid grid-cols-2 gap-3 @xl:col-span-1">
                        <Campo id={ids(`l${l.id}-peso`)} rotulo="Peso por unidade" valor={l.peso} aoMudar={(x) => mudarLinha(l.id, 'peso', x)} />
                        <Campo id={ids(`l${l.id}-volume`)} rotulo="Volume por unidade" valor={l.volume} aoMudar={(x) => mudarLinha(l.id, 'volume', x)} />
                      </div>
                      <CampoLeitura id={ids(`l${l.id}-despesas`)} rotulo="Valor total das despesas" valor={v.despesas} />
                      <CampoLeitura id={ids(`l${l.id}-entrega-total`)} rotulo="Valor total do produto na entrega" valor={v.entrega} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <button
            type="button"
            onClick={adicionarLinha}
            disabled={linhas.length >= MAX_LINHAS}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-dashed border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-red-400 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-200"
          >
            <Plus className="h-4 w-4" aria-hidden />
            Adicionar linha de produto
          </button>
          <p className={`${NOTA} mt-4`}>
            As taxas de direitos são exemplos: tire as suas da pauta aduaneira, para cada código do SH e origem. O peso e o volume podem estar em qualquer unidade, desde que todas as linhas usem a mesma.
          </p>
          <p className={`${NOTA} mt-2`}>
            Valores de partida: cotação BF-MWBWHJVJ-JHTJ da Brandful (África do Sul), de 11/11/2026 e válida até 11/12/2026, em rand e sem o IVA sul-africano. A impressão é a taxa de preparação da arte (setup) dividida pelas unidades. A cotação não traz o frete, o seguro, os direitos, o peso nem o volume: preencha-os.
          </p>
        </div>

        <div className={CARTAO}>
          <h2 className={TITULO}>Custos da remessa</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 @xl:grid-cols-3">
            <Campo id={ids('frete')} rotulo="Frete internacional" valor={form.frete} aoMudar={(v) => mudar('frete', v)} sufixo={eua ? undefined : 'MZN'} />
            <Campo id={ids('seguro')} rotulo="Seguro de carga" valor={form.seguro} aoMudar={(v) => mudar('seguro', v)} sufixo={eua ? undefined : 'MZN'} />
            <Campo id={ids('corretor')} rotulo="Despachante ou corretor" valor={form.corretor} aoMudar={(v) => mudar('corretor', v)} sufixo={eua ? undefined : 'MZN'} />
            <Campo id={ids('porto')} rotulo="Manuseamento no porto ou terminal" valor={form.porto} aoMudar={(v) => mudar('porto', v)} sufixo={eua ? undefined : 'MZN'} />
            <Campo id={ids('entrega')} rotulo="Entrega interna" valor={form.entrega} aoMudar={(v) => mudar('entrega', v)} sufixo={eua ? undefined : 'MZN'} />
            <Campo id={ids('outros')} rotulo="Outros encargos" valor={form.outros} aoMudar={(v) => mudar('outros', v)} sufixo={eua ? undefined : 'MZN'} />
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 @xl:grid-cols-3">
            <div>
              <label htmlFor={ids('base')} className={ROTULO}>
                Base do valor aduaneiro
              </label>
              <select id={ids('base')} value={form.base} onChange={(e) => mudar('base', e.target.value as BaseAduaneira)} className={CAMPO}>
                <option value="fob">FOB: só as mercadorias</option>
                <option value="cfr">CFR: mercadorias + frete</option>
                <option value="cif">CIF: mercadorias + frete + seguro</option>
              </select>
            </div>
            <Campo id={ids('perdas')} rotulo="Unidades que não consegue vender (%)" valor={form.perdasPct} aoMudar={(v) => mudar('perdasPct', v)} />
            <Campo id={ids('margem')} rotulo="Margem bruta pretendida (%)" valor={form.margemPct} aoMudar={(v) => mudar('margemPct', v)} />
            <Campo id={ids('comissao')} rotulo="Comissão (%)" valor={form.comissaoPct} aoMudar={(v) => mudar('comissaoPct', v)} />
          </div>

          <p className={`${ROTULO} mb-2 mt-5`}>Repartir os custos partilhados por</p>
          <Opcoes
            rotuloAria="Repartir os custos partilhados por"
            valor={form.reparticao}
            aoMudar={(v) => mudar('reparticao', v)}
            opcoes={[
              { valor: 'valor', texto: 'Valor' },
              { valor: 'peso', texto: 'Peso' },
              { valor: 'volume', texto: 'Volume' },
            ]}
          />
          <p className={`${NOTA} mt-3`}>
            Os direitos e o imposto de importação calculam-se por linha. O seguro e as taxas dos EUA seguem o valor. O frete, o despachante, o porto, a entrega interna e os outros encargos seguem o método escolhido.
          </p>
        </div>

        {eua ? (
          <div className={CARTAO}>
            <h2 className={TITULO}>Taxas de entrada nos EUA</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 @xl:grid-cols-3">
              <div className="col-span-2 @xl:col-span-1">
                <label htmlFor={ids('entrada')} className={ROTULO}>
                  Tipo de entrada
                </label>
                <select id={ids('entrada')} value={form.entrada} onChange={(e) => mudar('entrada', e.target.value as TipoEntradaEua)} className={CAMPO}>
                  <option value="formal">Formal: MPF sobre o valor</option>
                  <option value="informal">Informal: MPF fixo</option>
                  <option value="nenhuma">Sem MPF</option>
                </select>
              </div>
              <Campo id={ids('mpfpct')} rotulo="Taxa MPF (%)" valor={form.mpfPct} aoMudar={(v) => mudar('mpfPct', v)} />
              <Campo id={ids('mpfmin')} rotulo="MPF mínimo" valor={form.mpfMin} aoMudar={(v) => mudar('mpfMin', v)} />
              <Campo id={ids('mpfmax')} rotulo="MPF máximo" valor={form.mpfMax} aoMudar={(v) => mudar('mpfMax', v)} />
              <Campo id={ids('mpffixo')} rotulo="MPF fixo (informal)" valor={form.mpfFixo} aoMudar={(v) => mudar('mpfFixo', v)} />
              <Campo id={ids('hmfpct')} rotulo="Taxa HMF (%)" valor={form.hmfPct} aoMudar={(v) => mudar('hmfPct', v)} />
            </div>
            <div className="mt-4">
              <Caixa id={ids('maritimo')} texto="Chega por mar a um porto dos EUA (aplica-se o HMF)" marcada={form.maritimo} aoMudar={(v) => mudar('maritimo', v)} />
            </div>
            <p className={`${NOTA} mt-4`}>
              Valores de referência da CBP para o ano fiscal de 2027 (desde 1 de Outubro de 2026). A CBP actualiza-os todos os anos a 1 de Outubro: confirme-os antes de os usar.
            </p>
          </div>
        ) : (
          <div className={CARTAO}>
            <h2 className={TITULO}>Imposto de importação</h2>
            <div className="mt-4 grid grid-cols-2 gap-3 @xl:max-w-md">
              <div>
                <label htmlFor={ids('nomeimposto')} className={ROTULO}>
                  Nome do imposto
                </label>
                <select id={ids('nomeimposto')} value={form.nomeImposto} onChange={(e) => mudar('nomeImposto', e.target.value as Form['nomeImposto'])} className={CAMPO}>
                  <option value="IVA">IVA</option>
                  <option value="VAT">VAT</option>
                  <option value="GST">GST</option>
                </select>
              </div>
              <Campo id={ids('impostopct')} rotulo="Taxa (%)" valor={form.impostoPct} aoMudar={(v) => mudar('impostoPct', v)} />
            </div>
            <div className="mt-4 space-y-3">
              <Caixa id={ids('sobredireitos')} texto="O imposto incide também sobre os direitos aduaneiros" marcada={form.impostoSobreDireitos} aoMudar={(v) => mudar('impostoSobreDireitos', v)} />
              <Caixa id={ids('sobrefrete')} texto="Somar à base o frete e o seguro que não estão no valor aduaneiro" marcada={form.impostoSobreFrete} aoMudar={(v) => mudar('impostoSobreFrete', v)} />
              <Caixa id={ids('recuperavel')} texto="O imposto é recuperável (não entra no custo)" marcada={form.recuperavel} aoMudar={(v) => mudar('recuperavel', v)} />
            </div>
            <p className={`${NOTA} mt-4`}>
              A taxa de partida (16%) é a taxa geral do IVA em Moçambique. Confirme a sua com a Autoridade Tributária ou com o despachante: as empresas registadas que recuperam o IVA da importação costumam deixá-lo fora do custo do stock.
            </p>
          </div>
        )}
      </div>

      {/* quadros de resultados, a toda a largura */}
      {r.ok && (
        <div className="space-y-6">
          <div className={CARTAO}>
            <h2 className={`${TITULO} mb-4`}>Custo por unidade, por produto</h2>
            <Tabela rotuloAria="Custo posto no armazém por produto" colunas={colunasProdutos} linhas={linhasProdutos} quebra="lg" />
          </div>
          <div className={CARTAO}>
            <h2 className={`${TITULO} mb-4`}>Por unidade, segundo cada método de repartição</h2>
            <Tabela rotuloAria="Custo por unidade segundo o método de repartição" colunas={['Produto', 'Por valor', 'Por peso', 'Por volume', 'Diferença entre métodos']} linhas={linhasMetodos} />
          </div>
          <div className={CARTAO}>
            <h2 className={`${TITULO} mb-4`}>Decomposição completa da remessa</h2>
            <Tabela rotuloAria="Decomposição do custo posto no armazém" colunas={['Componente', 'Como foi calculado', 'Valor', 'Peso no total']} linhas={linhasDecomposicao} />
          </div>
          <p className={NOTA}>Estimativa só para planeamento: não é um orçamento de frete nem uma decisão da alfândega. O cálculo é feito no seu navegador; do servidor só vem o câmbio do dia.</p>
        </div>
      )}
    </div>
    </div>
  )
}
