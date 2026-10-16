/**
 * Confirma na Cloudflare o resultado do Turnstile (o "não sou um robô" do registo — src/components/auth/Turnstile.tsx).
 * A chave secreta vem de TURNSTILE_SECRET_KEY (segredo do GitHub que a publicação põe no .env.local do servidor). Sem
 * ela, não verifica e deixa passar — assim o registo não pára enquanto a chave não estiver posta. Se a Cloudflare não
 * responder, também deixa passar (não bloqueia os registos por uma falha de rede).
 */
export async function turnstileValido(token: unknown, ip?: string | null): Promise<boolean> {
  const segredo = (process.env.TURNSTILE_SECRET_KEY || '').trim()
  if (!segredo) return true
  if (typeof token !== 'string' || !token || token.length > 2048) return false
  try {
    const corpo = new URLSearchParams({ secret: segredo, response: token })
    if (ip) corpo.set('remoteip', ip)
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: corpo, signal: AbortSignal.timeout(8000) })
    const j = (await r.json().catch(() => ({}))) as { success?: boolean }
    return j.success === true
  } catch (e) {
    console.error('[turnstile] verificação indisponível', e)
    return true
  }
}
