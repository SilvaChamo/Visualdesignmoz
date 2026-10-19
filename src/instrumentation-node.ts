// Só no Node.js: o instrumentation.ts importa este ficheiro quando NEXT_RUNTIME === 'nodejs'. Fica à parte porque
// o Next.js também compila o instrumentation.ts para o Edge Runtime, onde process.on não existe (dava "A Node.js API
// is used (process.on) which is not supported in the Edge Runtime", mesmo com o return antes).
import { logServerError } from '@/lib/error-log'

process.on('uncaughtException', (err) => {
  console.error('[instrumentation] uncaughtException — processo mantido vivo:', err)
  logServerError('uncaughtException', err).catch(() => {})
})

process.on('unhandledRejection', (reason) => {
  console.error('[instrumentation] unhandledRejection — processo mantido vivo:', reason)
  logServerError('unhandledRejection', reason).catch(() => {})
})

// Painel VisualHost: lê o servidor (Hestia) logo que o site arranca — depois de cada publicação, a primeira página do
// painel já vem desenhada com os dados, em vez de esperar pela leitura e abrir sem conteúdo (Silva, 16/10/2026: "tela
// branca quando refresco a página"). A memória da leitura é a do processo inteiro (ver vhost-servidor.ts).
if (process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE !== 'phase-production-build') {
  setTimeout(() => {
    import('@/lib/vhost-servidor').then((m) => m.lerServidor()).catch(() => {})
  }, 2000).unref()
}
