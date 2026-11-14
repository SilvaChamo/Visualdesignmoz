// Valor por unidade dos brindes do catálogo (/brindes), em meticais: o preço de lista do fornecedor (rand) cambiado e passado pelo MESMO cálculo da
// calculadora de importação (calculadora-custo-importacao.ts, Admin › Contabilidade › Calculadora), com os valores que a calculadora tem em «Custos da
// remessa» e nos campos de margem de falha, margem, perdas, imposto e direitos (Silva, 14/11/2026: o valor do site só pode vir da calculadora).
// Cada produto leva a sua parte dos custos fixos da remessa, repartida por valor (o transporte, o seguro e as despesas ÷ o valor das mercadorias da
// remessa, aplicado ao custo de cada produto), e a margem de lucro soma-se por cima desse custo; no fim soma-se o IVA da venda. A impressão fica de fora
// (pede-se ao fornecedor e especifica-se na cotação). Sem nada guardado na calculadora vale `CONFIG_BRINDES_PADRAO`: só o câmbio, a margem de 50 % e o IVA.
// Sem imports: o teste corre com `node --test`, que não resolve imports sem extensão.

export interface ConfigBrindes {
  /** base do valor aduaneiro: o frete (e o seguro) entram nele se for cfr (cif) */
  base: 'fob' | 'cfr' | 'cif'
  /** o frete, o seguro e as despesas partilhadas da remessa, em fracção do valor das mercadorias da remessa (0,1 = 10 %) */
  freteRatio: number
  seguroRatio: number
  partilhadosRatio: number
  /** margem de falha sobre o preço do fornecedor, em % */
  erroPct: number
  /** unidades que não se vendem, em % */
  perdasPct: number
  /** margem bruta pretendida, em % do preço */
  margemPct: number
  /** direitos aduaneiros, em % (média das linhas, ponderada pelo valor); só valem se `alfandegaRatio` for 0 */
  direitosPct: number
  /** a alfândega e o lucro definidos em valor total na calculadora, em fracção do valor das mercadorias da remessa; acima de zero substituem os direitos (%) e a margem (%) */
  alfandegaRatio: number
  lucroRatio: number
  /** imposto da importação (IVA), em % e como se aplica */
  impostoPct: number
  impostoSobreDireitos: boolean
  impostoSobreFrete: boolean
  /** IVA da importação recuperável: fica fora do custo */
  recuperavel: boolean
  /** os campos da calculadora como estavam ao guardar (para os voltar a mostrar ao abrir) */
  campos?: Record<string, string>
}

/** O que vale enquanto a calculadora não guardou nada: o preço cambiado com a margem de 50 % da calculadora e o IVA; transporte, direitos e margem de falha a zero. */
export const CONFIG_BRINDES_PADRAO: ConfigBrindes = {
  base: 'cfr',
  freteRatio: 0,
  seguroRatio: 0,
  partilhadosRatio: 0,
  erroPct: 0,
  perdasPct: 0,
  margemPct: 50,
  direitosPct: 0,
  alfandegaRatio: 0,
  lucroRatio: 0,
  impostoPct: 16,
  impostoSobreDireitos: true,
  impostoSobreFrete: true,
  recuperavel: true,
}

/** IVA de Moçambique somado ao preço de venda, em % (o mesmo de iva.ts). */
export const IVA_VENDA_PCT = 16

/** Valor estimado por unidade, em meticais (sem impressão), a partir do preço do fornecedor em rand e do câmbio (1 rand = `taxa` meticais). */
export function valorPorUnidadeMt(precoZar: number, taxa: number, c: ConfigBrindes = CONFIG_BRINDES_PADRAO): number {
  const custo = precoZar * taxa * (1 + c.erroPct / 100)
  const frete = custo * c.freteRatio
  const seguro = custo * c.seguroRatio
  const freteNoValor = c.base !== 'fob'
  const seguroNoValor = c.base === 'cif'
  const valorAduaneiro = custo + (freteNoValor ? frete : 0) + (seguroNoValor ? seguro : 0)
  const direitos = c.alfandegaRatio > 0 ? custo * c.alfandegaRatio : (valorAduaneiro * c.direitosPct) / 100
  const baseImposto = valorAduaneiro + (c.impostoSobreDireitos ? direitos : 0) + (c.impostoSobreFrete ? (freteNoValor ? 0 : frete) + (seguroNoValor ? 0 : seguro) : 0)
  const imposto = c.recuperavel ? 0 : (baseImposto * c.impostoPct) / 100
  const total = custo + frete + seguro + direitos + imposto + custo * c.partilhadosRatio
  const porUnidade = total / (1 - c.perdasPct / 100)
  const preco = c.lucroRatio > 0 ? porUnidade + custo * c.lucroRatio : porUnidade / (1 - c.margemPct / 100)
  return preco * (1 + IVA_VENDA_PCT / 100)
}

const NUMEROS = ['freteRatio', 'seguroRatio', 'partilhadosRatio', 'erroPct', 'perdasPct', 'margemPct', 'direitosPct', 'impostoPct'] as const
// acrescentados depois: o que foi guardado antes não os tem e vale 0
const NUMEROS_OPCIONAIS = ['alfandegaRatio', 'lucroRatio'] as const
const BOOLEANOS = ['impostoSobreDireitos', 'impostoSobreFrete', 'recuperavel'] as const

/** Confere uma configuração vinda de fora (base de dados ou calculadora): números finitos e não negativos, margem e perdas abaixo de 100 %. */
export function configValida(x: unknown): ConfigBrindes | null {
  const o = (x ?? {}) as Record<string, unknown>
  if (o.base !== 'fob' && o.base !== 'cfr' && o.base !== 'cif') return null
  const v = { base: o.base } as ConfigBrindes
  for (const k of NUMEROS) {
    const n = o[k]
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 1e6) return null
    v[k] = n
  }
  for (const k of NUMEROS_OPCIONAIS) {
    const n = o[k] ?? 0
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 1e6) return null
    v[k] = n
  }
  for (const k of BOOLEANOS) {
    if (typeof o[k] !== 'boolean') return null
    v[k] = o[k] as boolean
  }
  if (v.margemPct >= 100 || v.perdasPct >= 100) return null
  if (o.campos && typeof o.campos === 'object') {
    const c: Record<string, string> = {}
    for (const [k, val] of Object.entries(o.campos as Record<string, unknown>)) if (typeof val === 'string' && val.length < 40) c[k] = val
    v.campos = c
  }
  return v
}
