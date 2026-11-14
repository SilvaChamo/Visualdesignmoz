// Percentagens do valor estimado dos brindes que valem agora: as guardadas na calculadora (tabela brindes_estimativa, uma linha) ou,
// se não houver nenhuma (ou a tabela ainda não existir), os valores de partida de preco-brindes.ts. SÓ PARA O SERVIDOR.
// Guarda-se um minuto em memória: uma alteração na calculadora vê-se logo na instância que a gravou e, nas outras, em menos de um minuto.

import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { ESTIMATIVA_BRINDES, estimativaValida, type EstimativaBrindes } from '@/lib/preco-brindes'

const UM_MINUTO = 60 * 1000
let guardado: { valores: EstimativaBrindes; guardada: boolean; lidoEm: number } | null = null

export async function estimativaGuardada(): Promise<{ valores: EstimativaBrindes; guardada: boolean }> {
  if (guardado && Date.now() - guardado.lidoEm < UM_MINUTO) return guardado
  let valores = ESTIMATIVA_BRINDES
  let guardada = false
  try {
    const { data } = await getSupabaseAdmin()!.from('brindes_estimativa').select('erro_pct, transporte_pct, direitos_pct, margem_pct, iva_pct').eq('id', 1).maybeSingle()
    const ok = data && estimativaValida({ erroPct: data.erro_pct, transportePct: data.transporte_pct, direitosPct: data.direitos_pct, margemPct: data.margem_pct, ivaPct: data.iva_pct })
    if (ok) {
      valores = ok
      guardada = true
    }
  } catch {
    // sem base de dados ou sem tabela: valores de partida
  }
  guardado = { valores, guardada, lidoEm: Date.now() }
  return guardado
}

export async function estimativaBrindes(): Promise<EstimativaBrindes> {
  return (await estimativaGuardada()).valores
}

export function esquecerEstimativa() {
  guardado = null
}
