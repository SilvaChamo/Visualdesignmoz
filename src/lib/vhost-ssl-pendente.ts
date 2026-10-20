/**
 * Domínios a que o painel está a criar ou a pedir o certificado SSL neste momento (Silva, 20/10/2026: o subdomínio novo
 * aparece logo na lista com "A processar SSL…", em vez de ficar em branco). Fica na memória do processo — serve só para
 * mostrar o estado; o certificado em si é o que o servidor diz (Let's Encrypt). Expira sozinho, para um pedido que morreu
 * a meio não ficar "a processar" para sempre.
 */
const VALE_MS = 10 * 60_000;
type Pendente = { ate: number; conta: string };
const g = globalThis as typeof globalThis & { __vhostSslPendente?: Map<string, Pendente> };
const pendentes = (g.__vhostSslPendente ??= new Map<string, Pendente>());

export function marcarSslPendente(dominio: string, conta = ''): void {
  pendentes.set(dominio.toLowerCase(), { ate: Date.now() + VALE_MS, conta });
}

export function limparSslPendente(dominio: string): void {
  pendentes.delete(dominio.toLowerCase());
}

export function sslPendente(dominio: string): boolean {
  const p = pendentes.get(dominio.toLowerCase());
  if (!p) return false;
  if (p.ate < Date.now()) {
    pendentes.delete(dominio.toLowerCase());
    return false;
  }
  return true;
}

/** Os domínios desta conta que estão a ser criados / a pedir o certificado (a lista junta-os aos que o servidor já tem, para
 *  o novo aparecer logo, mesmo que a leitura do servidor ainda não o traga) */
export function pendentesDaConta(conta: string): string[] {
  const agora = Date.now();
  return [...pendentes.entries()].filter(([, p]) => p.conta === conta && p.ate >= agora).map(([d]) => d);
}
