/**
 * Limite de pedidos em memória para as rotas públicas (recuperação de palavra-passe, tickets, pesquisa de domínios).
 * O site corre num só processo (pm2 com 1 instância, ver regras.md), por isso a contagem em memória chega; reinicia com o
 * processo, o que é aceitável para travar abusos (não é uma defesa contra ataques distribuídos).
 *
 * O IP vem do `x-real-ip` posto pelo nginx e nunca do primeiro valor de `x-forwarded-for`: o nginx acrescenta ao que o
 * visitante escreveu, e ele podia variar esse valor para fugir ao limite (mesma razão de `login-rate-limit.ts`).
 */
const baldes = new Map<string, number[]>()

/** Regista um pedido e devolve true se `chave` passou de `max` pedidos na janela de `janelaMs`. */
export function passouOLimite(chave: string, max: number, janelaMs: number): boolean {
  const agora = Date.now()
  const recentes = (baldes.get(chave) || []).filter((t) => agora - t < janelaMs)
  recentes.push(agora)
  baldes.set(chave, recentes)
  if (baldes.size > 5000) {
    for (const [k, v] of baldes) if (!v.some((t) => agora - t < janelaMs)) baldes.delete(k)
  }
  return recentes.length > max
}

export function ipDoPedido(req: { headers: { get(nome: string): string | null } }): string {
  return req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for')?.split(',').pop()?.trim() || 'desconhecido'
}
