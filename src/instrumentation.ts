// Rede de segurança global: um erro tardio não apanhado num socket (SMTP, IMAP,
// DirectAdmin, etc.) chega como 'uncaughtException'/'unhandledRejection' ao
// processo Node e, sem isto, derruba o servidor inteiro — o site fica em baixo
// para todos os utilizadores a meio de outros pedidos, até o pm2 reiniciar.
// Isto não substitui corrigir a causa (ver smtp-mail.ts e imap-panel-shared.ts
// para exemplos já corrigidos) — é só a última linha de defesa contra o mesmo
// tipo de bug em código que ainda não tenhamos apanhado.
export async function register() {
  // os handlers ficam em instrumentation-node.ts: assim o Next.js não os mete no código do Edge Runtime
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation-node')
  }
}

/**
 * Gancho nativo do Next.js — apanha erros dentro do ciclo de vida de um
 * pedido (rota de API, server component, action) que de outra forma só
 * apareceriam na consola do servidor, sem ninguém ver. Complementa os
 * handlers acima, que só cobrem erros ao nível do processo.
 */
export async function onRequestError(
  err: unknown,
  request: { path: string; method: string },
) {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { logServerError } = await import('@/lib/error-log')
  await logServerError(`${request.method} ${request.path}`, err).catch(() => {})
}
