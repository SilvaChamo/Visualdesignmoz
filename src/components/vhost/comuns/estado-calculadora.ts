// Ler e gravar no servidor o estado da calculadora e da cotação (rota /api/admin/calculadora-estado).
export async function lerEstado<T>(chave: 'calculadora' | 'cotacao' | 'cotacao-imagens'): Promise<T | null> {
  try {
    const r = await fetch(`/api/admin/calculadora-estado?chave=${chave}`, { cache: 'no-store' })
    const j = (await r.json()) as { success?: boolean; estado?: T | null }
    return j.success ? (j.estado ?? null) : null
  } catch {
    return null
  }
}

export async function gravarEstado(chave: 'calculadora' | 'cotacao' | 'cotacao-imagens', estado: object): Promise<boolean> {
  try {
    const r = await fetch('/api/admin/calculadora-estado', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chave, estado }) })
    return r.ok
  } catch {
    return false
  }
}
