// Valor por unidade dos brindes do catálogo (/brindes), em meticais: o preço de lista do fornecedor (rand) cambiado, mais o que
// a VisualDesign paga para o pôr em Maputo e a margem, mais o IVA (Silva, 14/11/2026: «mostrar o valor real do produto, que já
// inclui tudo»; só a impressão fica de fora: é pedida ao fornecedor e especifica-se na cotação).
//
// Mesmo cálculo da calculadora de importação (calculadora-custo-importacao.ts), por unidade, base CFR (o frete entra no valor
// aduaneiro), IVA da importação recuperável (fora do custo), margem pretendida como divisor e o IVA da venda por cima, como
// na cotação ao cliente. O teste (preco-brindes.test.mjs) confere este cálculo com o da calculadora.
// Sem imports: o teste corre com `node --test`, que não resolve imports sem extensão.

/** `fixoMt`: custos fixos da remessa (calculadora › Custos da remessa) repartidos por unidade, em MT, somados ao custo antes da margem; 0 ou vazio = nada. */
export type EstimativaBrindes = { erroPct: number; transportePct: number; direitosPct: number; margemPct: number; ivaPct: number; fixoMt?: number }

/** Valores de partida; os que valem são os guardados na calculadora (Admin › Contabilidade › Calculadora), lidos em estimativa-brindes.ts. */
export const ESTIMATIVA_BRINDES: EstimativaBrindes = {
  /** margem de falha: folga sobre o preço do fornecedor para câmbio, arredondamentos e preços que mudam, em % */
  erroPct: 10,
  /** transporte até Maputo, em % do valor das mercadorias (estimativa; o real vem na cotação) */
  transportePct: 10,
  /** direitos aduaneiros sobre o valor com transporte, em % (estimativa) */
  direitosPct: 20,
  /** margem bruta pretendida, em % do preço (a da calculadora) */
  margemPct: 50,
  /** IVA de Moçambique, em % (o mesmo de iva.ts) */
  ivaPct: 16,
}

/** Valor estimado por unidade, em meticais (sem impressão), a partir do preço do fornecedor em rand e do câmbio (1 rand = `taxa` meticais). */
export function valorPorUnidadeMt(precoZar: number, taxa: number, e: EstimativaBrindes = ESTIMATIVA_BRINDES): number {
  const custo = precoZar * taxa * (1 + e.erroPct / 100)
  const posto = custo * (1 + e.transportePct / 100) * (1 + e.direitosPct / 100) + (e.fixoMt ?? 0)
  return (posto / (1 - e.margemPct / 100)) * (1 + e.ivaPct / 100)
}

/** Confere uns valores vindos de fora (base de dados ou formulário): números finitos, de 0 a 1000 %, e a margem abaixo de 100 %. */
export function estimativaValida(x: unknown): EstimativaBrindes | null {
  const o = (x ?? {}) as Record<string, unknown>
  const v = {} as EstimativaBrindes
  for (const k of ['erroPct', 'transportePct', 'direitosPct', 'margemPct', 'ivaPct'] as const) {
    const n = typeof o[k] === 'string' && (o[k] as string).trim() !== '' ? Number(o[k]) : o[k]
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 1000) return null
    v[k] = n
  }
  return v.margemPct < 100 ? v : null
}

/** Os custos fixos da remessa da calculadora (em MT, totais) e as unidades da remessa por onde se repartem. */
export const CHAVES_REMESSA = ['frete', 'seguro', 'corretor', 'porto', 'entrega', 'entregaDom', 'outros'] as const
export type CustosRemessa = Record<(typeof CHAVES_REMESSA)[number], number> & { unidades: number }

/** Confere uns custos vindos de fora: números finitos e não negativos. */
export function custosRemessaValidos(x: unknown): CustosRemessa | null {
  const o = (x ?? {}) as Record<string, unknown>
  const v = {} as CustosRemessa
  for (const k of [...CHAVES_REMESSA, 'unidades'] as const) {
    const n = o[k]
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 1e12) return null
    v[k] = n
  }
  return v
}

/** O que cada unidade leva dos custos fixos da remessa: o total ÷ as unidades (0 se não houver custos ou unidades). */
export function custoFixoPorUnidadeMt(c: CustosRemessa | null): number {
  if (!c || !(c.unidades > 0)) return 0
  return CHAVES_REMESSA.reduce((t, k) => t + c[k], 0) / c.unidades
}
