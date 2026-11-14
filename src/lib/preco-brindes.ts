// Valor por unidade dos brindes do catálogo (/brindes), em meticais: o preço de lista do fornecedor (rand) cambiado, mais o que
// a VisualDesign paga para o pôr em Maputo e a margem, mais o IVA (Silva, 14/11/2026: «mostrar o valor real do produto, que já
// inclui tudo»; só a impressão fica de fora: é pedida ao fornecedor e especifica-se na cotação).
//
// Mesmo cálculo da calculadora de importação (calculadora-custo-importacao.ts), por unidade, base CFR (o frete entra no valor
// aduaneiro), IVA da importação recuperável (fora do custo), margem pretendida como divisor e o IVA da venda por cima, como
// na cotação ao cliente. O teste (preco-brindes.test.mjs) confere este cálculo com o da calculadora.
// Sem imports: o teste corre com `node --test`, que não resolve imports sem extensão.

export type EstimativaBrindes = { erroPct: number; transportePct: number; direitosPct: number; margemPct: number; ivaPct: number }

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
  const posto = custo * (1 + e.transportePct / 100) * (1 + e.direitosPct / 100)
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
