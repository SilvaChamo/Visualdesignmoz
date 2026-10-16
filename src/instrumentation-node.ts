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
