// «cotacao:<lote>» e «cotacao-imagens:<lote>»: a folha de uma encomenda do site editada no painel do cliente (mesma tabela)
export type ChaveEstado = 'calculadora' | 'cotacao' | 'cotacao-imagens' | `cotacao:${string}` | `cotacao-imagens:${string}`

// Ler e gravar no servidor o estado da calculadora e da cotação (rota /api/admin/calculadora-estado).
export async function lerEstado<T>(chave: ChaveEstado): Promise<T | null> {
  try {
    const r = await fetch(`/api/admin/calculadora-estado?chave=${chave}`, { cache: 'no-store' })
    const j = (await r.json()) as { success?: boolean; estado?: T | null }
    return j.success ? (j.estado ?? null) : null
  } catch {
    return null
  }
}

export async function gravarEstado(chave: ChaveEstado, estado: object): Promise<boolean> {
  try {
    const r = await fetch('/api/admin/calculadora-estado', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chave, estado }) })
    return r.ok
  } catch {
    return false
  }
}

// como lerEstado, mas distingue «não há nada guardado» (ok, estado null) de «não foi possível ler» (sessão expirada, rede): só no primeiro caso se pode mostrar o exemplo
export async function lerEstadoSeguro<T>(chave: ChaveEstado): Promise<{ ok: boolean; estado: T | null }> {
  try {
    const r = await fetch(`/api/admin/calculadora-estado?chave=${chave}`, { cache: 'no-store' })
    const j = (await r.json()) as { success?: boolean; estado?: T | null }
    return j.success ? { ok: true, estado: j.estado ?? null } : { ok: false, estado: null }
  } catch {
    return { ok: false, estado: null }
  }
}
