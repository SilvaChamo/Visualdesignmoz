/** Junta os campos do formulário ao ficheiro de um pacote do Hestia (linhas `CHAVE='valor'`) e devolve o ficheiro novo.
 *  Os campos que o formulário só mostra como sim/não (domínios de e-mail, DNS, tarefas agendadas, shell) não mudam um
 *  valor que já cumpre o pedido: um pacote com 1 domínio de e-mail continua com 1 em vez de passar a ilimitado. */
const CAMPOS_SIM_NAO = new Set(['MAIL_DOMAINS', 'DNS_DOMAINS', 'CRON_JOBS', 'SHELL']);
const desligado = (v: string) => /^(0|nologin|)$/i.test(v);

export function juntarCamposPacote(atual: string, campos: Record<string, string>, editar: boolean): string {
  const linhas = new Map<string, string>();
  for (const l of atual.split('\n')) {
    const m = l.match(/^([A-Z_]+)='(.*)'$/);
    if (m) linhas.set(m[1], m[2]);
  }
  for (const [k, v] of Object.entries(campos)) {
    if (!/^[A-Z_]+$/.test(k) || !/^[A-Za-z0-9_.,:-]*$/.test(v)) continue;
    const antes = linhas.get(k);
    if (editar && antes !== undefined && CAMPOS_SIM_NAO.has(k) && desligado(antes) === desligado(v)) continue;
    linhas.set(k, v);
  }
  return [...linhas].map(([k, v]) => `${k}='${v}'`).join('\n') + '\n';
}
