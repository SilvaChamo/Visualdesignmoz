// Câmbio do dia para a calculadora de custo de importação (Admin › Contabilidade › Calculadora).
//
// As moedas são as dos países de onde Moçambique mais importa (China, África do Sul, Brasil, Índia, Emirados, Portugal e a
// zona euro, Reino Unido, Japão), mais os vizinhos (Tanzânia, Zâmbia, Malawi), o dólar dos EUA e o metical.
// A cotação vem da rota /api/vhost/cambio (src/app/api/vhost/cambio/route.ts), sempre em unidades de cada moeda por 1 USD.

/** Códigos ISO das moedas que a calculadora aceita (os textos em português ficam no componente) */
export const CODIGOS_MOEDAS = ['MZN', 'USD', 'EUR', 'ZAR', 'CNY', 'BRL', 'GBP', 'AED', 'INR', 'JPY', 'TZS', 'ZMW', 'MWK'] as const

export type CodigoMoeda = (typeof CODIGOS_MOEDAS)[number]

export interface CambioDoDia {
  /** as taxas são unidades de cada moeda por 1 USD */
  base: 'USD'
  taxas: Record<string, number>
  /** quando a fonte actualizou as taxas (ISO) */
  atualizado: string
  /** quando a fonte volta a actualizar (ISO) */
  proxima: string
  fonte: string
  /** a fonte não respondeu agora e estas são as últimas lidas */
  desatualizado?: boolean
}

/** Quanto vale 1 `de` na moeda `para`, ou NaN se falta alguma das taxas */
export function cambioEntre(taxas: Record<string, number> | undefined, de: string, para: string): number {
  if (de === para) return 1
  const a = taxas?.[de]
  const b = taxas?.[para]
  return a && b && a > 0 && b > 0 ? b / a : NaN
}
