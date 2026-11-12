import { NextResponse } from 'next/server'
import { requirePanelBootstrapAccess } from '@/lib/panel-api-auth'
import { CODIGOS_MOEDAS, type CambioDoDia } from '@/lib/cambio'

export const dynamic = 'force-dynamic'

/**
 * /api/vhost/cambio — câmbio do dia para a calculadora de custo de importação (Silva, 12/11/2026: «a moeda, o câmbio do dia
 * para a troca de moeda estrangeira, seja da China, África do Sul, Moçambique ou dos países de onde Moçambique importa»).
 * GET (sessão do painel) { base: 'USD', taxas: { MZN: 63.7, CNY: 6.68, ZAR: 16.58, BRL: 5.57, … }, atualizado, proxima, fonte }
 * A fonte é a Exchange Rate API (open.er-api.com, acesso aberto, actualiza uma vez por dia e pede que se indique a origem).
 * Não se envia nada do utilizador: o pedido leva só o código USD. A resposta fica uma hora em memória; se a fonte falhar, devolve-se
 * a última lida com `desatualizado: true`. É a taxa de mercado: a do banco e a da alfândega podem ser diferentes (a calculadora
 * deixa editar cada uma).
 */
const FONTE = 'https://open.er-api.com/v6/latest/USD'
const UMA_HORA = 60 * 60 * 1000

let guardado: { dados: CambioDoDia; lidoEm: number } | null = null
let aLer: Promise<CambioDoDia> | null = null

async function lerFonte(): Promise<CambioDoDia> {
  const res = await fetch(FONTE, { cache: 'no-store', signal: AbortSignal.timeout(8000), headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error('A fonte respondeu ' + res.status)
  const j = (await res.json()) as { result?: string; rates?: Record<string, unknown>; time_last_update_unix?: number; time_next_update_unix?: number }
  if (j.result !== 'success' || !j.rates) throw new Error('Resposta da fonte sem taxas')
  const taxas: Record<string, number> = {}
  for (const c of CODIGOS_MOEDAS) {
    const v = j.rates[c]
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) taxas[c] = v
  }
  if (!taxas.MZN) throw new Error('A fonte não trouxe o metical')
  const iso = (u: unknown) => (typeof u === 'number' && Number.isFinite(u) ? new Date(u * 1000).toISOString() : '')
  return { base: 'USD', taxas, atualizado: iso(j.time_last_update_unix) || new Date().toISOString(), proxima: iso(j.time_next_update_unix), fonte: 'open.er-api.com' }
}

export async function GET() {
  const auth = await requirePanelBootstrapAccess()
  if ('error' in auth) return NextResponse.json({ erro: 'Inicie sessão.' }, { status: 401 })
  const semCache = { headers: { 'Cache-Control': 'no-store' } }
  const agora = Date.now()
  if (guardado && agora - guardado.lidoEm < UMA_HORA) return NextResponse.json(guardado.dados, semCache)
  try {
    aLer ??= lerFonte().finally(() => {
      aLer = null
    })
    const dados = await aLer
    guardado = { dados, lidoEm: Date.now() }
    return NextResponse.json(dados, semCache)
  } catch {
    if (guardado) return NextResponse.json({ ...guardado.dados, desatualizado: true }, semCache)
    return NextResponse.json({ erro: 'Não foi possível obter o câmbio do dia.' }, { status: 502, ...semCache })
  }
}
