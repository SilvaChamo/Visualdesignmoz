/**
 * O M-Pesa está em ambiente de teste? Com MPESA_ENV definido vale o que lá está ('sandbox' ou outro). Sem MPESA_ENV (ex.: o
 * projecto a correr no computador do Silva, sem o .env do servidor) vale o servidor da Vodacom configurado: o cliente M-Pesa
 * usa o de teste por omissão (mpesa-client.ts), por isso o passo do número aparece também aí (Silva, 29/10/2026).
 */
export function mpesaEmSandbox(): boolean {
  const env = (process.env.MPESA_ENV || '').trim().toLowerCase();
  if (env) return env === 'sandbox';
  const host = (process.env.MPESA_HOST || '').trim().toLowerCase();
  return !host || host.includes('sandbox');
}
