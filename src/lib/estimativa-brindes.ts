// Percentagens do valor estimado dos brindes que valem agora: as guardadas na calculadora (tabela brindes_estimativa, uma linha) ou,
// se não houver nenhuma (ou a tabela ainda não existir), os valores de partida de preco-brindes.ts. SÓ PARA O SERVIDOR.
// Guarda-se um minuto em memória: uma alteração na calculadora vê-se logo na instância que a gravou e, nas outras, em menos de um minuto.

import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { ESTIMATIVA_BRINDES, CHAVES_REMESSA, custoFixoPorUnidadeMt, custosRemessaValidos, estimativaValida, type CustosRemessa, type EstimativaBrindes } from '@/lib/preco-brindes'

const UM_MINUTO = 60 * 1000
let guardado: { valores: EstimativaBrindes; guardada: boolean; custos: CustosRemessa | null; lidoEm: number } | null = null

const COLUNA: Record<string, string> = { entregaDom: 'entrega_dom' }
const coluna = (k: string) => COLUNA[k] ?? k

async function ler() {
  if (guardado && Date.now() - guardado.lidoEm < UM_MINUTO) return guardado
  let valores = ESTIMATIVA_BRINDES
  let guardada = false
  let custos: CustosRemessa | null = null
  try {
    const sb = getSupabaseAdmin()!
    const { data } = await sb.from('brindes_estimativa').select('erro_pct, transporte_pct, direitos_pct, margem_pct, iva_pct').eq('id', 1).maybeSingle()
    const ok = data && estimativaValida({ erroPct: data.erro_pct, transportePct: data.transporte_pct, direitosPct: data.direitos_pct, margemPct: data.margem_pct, ivaPct: data.iva_pct })
    if (ok) {
      valores = ok
      guardada = true
    }
    const { data: c } = await sb.from('brindes_custos_remessa').select([...CHAVES_REMESSA.map(coluna), 'unidades'].join(', ')).eq('id', 1).maybeSingle()
    if (c) custos = custosRemessaValidos(Object.fromEntries([...CHAVES_REMESSA, 'unidades'].map((k) => [k, Number((c as unknown as Record<string, unknown>)[coluna(k)])])))
  } catch {
    // sem base de dados ou sem tabela: valores de partida e nenhum custo fixo
  }
  guardado = { valores, guardada, custos, lidoEm: Date.now() }
  return guardado
}

export async function estimativaGuardada(): Promise<{ valores: EstimativaBrindes; guardada: boolean }> {
  return ler()
}

/** Os custos fixos da remessa guardados na calculadora (null se nunca se guardou nenhum). */
export async function custosRemessaGuardados(): Promise<CustosRemessa | null> {
  return (await ler()).custos
}

/** O que vale agora para o valor dos brindes: as percentagens e os custos fixos da remessa repartidos por unidade (`fixoMt`). */
export async function estimativaBrindes(): Promise<EstimativaBrindes> {
  const g = await ler()
  return { ...g.valores, fixoMt: custoFixoPorUnidadeMt(g.custos) }
}

export function esquecerEstimativa() {
  guardado = null
}
