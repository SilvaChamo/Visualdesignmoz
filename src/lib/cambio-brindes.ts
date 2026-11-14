// Câmbio rand → metical para mostrar o valor dos brindes em meticais (catálogo /brindes). SÓ PARA O SERVIDOR.
// A mesma fonte da calculadora de importação (open.er-api.com, taxas por 1 USD, actualiza uma vez por dia); guarda-se uma hora em
// memória e, se a fonte falhar, usa-se a última lida. Sem nenhuma leitura devolve null e a página mostra «Preço sob consulta».

import { cambioEntre } from '@/lib/cambio'

const FONTE = 'https://open.er-api.com/v6/latest/USD'
const UMA_HORA = 60 * 60 * 1000

let guardado: { taxa: number; lidoEm: number } | null = null
let aLer: Promise<number> | null = null

async function lerFonte(): Promise<number> {
  const res = await fetch(FONTE, { cache: 'no-store', signal: AbortSignal.timeout(6000), headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`A fonte respondeu ${res.status}`)
  const j = (await res.json()) as { result?: string; rates?: Record<string, number> }
  const taxa = j.result === 'success' ? cambioEntre(j.rates, 'ZAR', 'MZN') : NaN
  if (!Number.isFinite(taxa) || taxa <= 0) throw new Error('Resposta da fonte sem rand ou metical')
  return taxa
}

/** Quantos meticais vale 1 rand agora, ou null se nunca se conseguiu ler. */
export async function cambioZarMzn(): Promise<number | null> {
  if (guardado && Date.now() - guardado.lidoEm < UMA_HORA) return guardado.taxa
  try {
    aLer ??= lerFonte().finally(() => {
      aLer = null
    })
    const taxa = await aLer
    guardado = { taxa, lidoEm: Date.now() }
    return taxa
  } catch {
    return guardado?.taxa ?? null
  }
}
