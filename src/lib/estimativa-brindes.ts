// A configuração do valor dos brindes que vale agora: a que a calculadora guardou (tabela brindes_custos_remessa, coluna `calculo`, uma linha) ou,
// se não houver nenhuma (ou a tabela ainda não existir), a de partida de preco-brindes.ts. SÓ PARA O SERVIDOR.
// Guarda-se um minuto em memória: uma alteração na calculadora vê-se logo na instância que a gravou e, nas outras, em menos de um minuto.

import { getSupabaseAdmin } from '@/lib/supabase-admin'
import { CONFIG_BRINDES_PADRAO, configValida, type ConfigBrindes } from '@/lib/preco-brindes'

const UM_MINUTO = 60 * 1000
let guardado: { config: ConfigBrindes | null; lidoEm: number } | null = null

/** A configuração guardada pela calculadora, ou null se nunca guardou nenhuma. */
export async function configGuardada(): Promise<ConfigBrindes | null> {
  if (guardado && Date.now() - guardado.lidoEm < UM_MINUTO) return guardado.config
  let config: ConfigBrindes | null = null
  try {
    const { data } = await getSupabaseAdmin()!.from('brindes_custos_remessa').select('calculo').eq('id', 1).maybeSingle()
    config = configValida(data?.calculo)
  } catch {
    // sem base de dados ou sem tabela: valores de partida
  }
  guardado = { config, lidoEm: Date.now() }
  return config
}

/** O que vale agora para o valor dos brindes. */
export async function estimativaBrindes(): Promise<ConfigBrindes> {
  return (await configGuardada()) ?? CONFIG_BRINDES_PADRAO
}

export function esquecerEstimativa() {
  guardado = null
}
