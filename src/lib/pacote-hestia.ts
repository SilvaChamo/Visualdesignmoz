/**
 * Formulário de pacotes (Admin › Pacotes) → ficheiro do pacote no Hestia.
 * Os formatos são os que o Hestia 1.10 deste servidor valida em v-add-user-package (lidos no servidor a 19/10/2026):
 * inteiros ou "unlimited" na maioria dos limites; RATE_LIMIT e BACKUPS só inteiros; BACKUPS_INCREMENTAL yes/no;
 * CPU_QUOTA "N%"; CPU_QUOTA_PERIOD "100ms"/"1s"; MEMORY_LIMIT e SWAP_LIMIT "512M"/"2G"; SHELL um dos de /etc/shells;
 * NS nomes de domínio separados por vírgulas; modelos com o nome de um modelo existente.
 */

export type FormLim = { v: string; unl: boolean; unit?: string };

/** Shells aceites pelo Hestia deste servidor (/etc/shells) */
export const SHELLS_HESTIA = ['nologin', 'bash', 'rbash', 'jailbash', 'sh', 'dash', 'screen', 'tmux'] as const;

/** Campos do pacote que o formulário guarda como texto */
export const CAMPOS_TEXTO_HESTIA = ['SHELL', 'NS', 'BACKUPS_INCREMENTAL', 'WEB_TEMPLATE', 'PROXY_TEMPLATE', 'BACKEND_TEMPLATE', 'DNS_TEMPLATE'] as const;

const inteiro = (v: unknown) => (/^\d{1,9}$/.test(String(v ?? '').trim()) ? String(Number(String(v).trim())) : null);

/** "400" ou "400%" → "400%" (o Hestia só aceita N%, com N ≥ 1) */
export function normCpu(v: string): string | null {
  const m = /^\s*([1-9]\d{0,5})\s*%?\s*$/.exec(v);
  return m ? m[1] + '%' : null;
}
/** "100", "100ms" ou "1s" → "100ms" / "1s" */
export function normPeriodo(v: string): string | null {
  const m = /^\s*(\d{1,6})\s*(ms|s)?\s*$/i.exec(v);
  return m ? m[1] + (m[2] ? m[2].toLowerCase() : 'ms') : null;
}
/** "2", "2g", "2 GB", "512M", "1024" → "2G" / "512M" / "1024" (o Hestia aceita número + K, M, G ou T) */
export function normTamanho(v: string): string | null {
  const m = /^\s*(\d{1,9})\s*([KMGT])?(?:I?B)?\s*$/i.exec(v);
  return m ? m[1] + (m[2] ? m[2].toUpperCase() : '') : null;
}

/** Limites do formulário → campos do Hestia (e o que está mal, em português, para mostrar a quem edita) */
export function camposHestia(
  lim: Record<string, FormLim>,
  feats: Record<string, boolean>,
  rec: Record<string, FormLim> = {},
  texto: Record<string, string> = {},
): { campos: Record<string, string>; erros: string[]; exatos: string[] } {
  const campos: Record<string, string> = {};
  const erros: string[] = [];
  const nomeDe = (k: string) => k;
  /** limite com "ilimitado" (disco e tráfego em MB; a unidade vem do formulário) */
  const limite = (campo: string, k: string, mb = false) => {
    const l = lim[k];
    if (!l) return;
    if (l.unl) {
      campos[campo] = 'unlimited';
      return;
    }
    const n = inteiro(l.v);
    if (n === null) {
      erros.push(`${nomeDe(k)}: indique um número inteiro.`);
      return;
    }
    const x = Number(n);
    campos[campo] = String(mb ? (l.unit === 'TB' ? x * 1024 * 1024 : l.unit === 'GB' ? x * 1024 : x) : x);
  };
  /** limite que o Hestia só aceita como número (sem "ilimitado") */
  const soNumero = (campo: string, k: string) => {
    const l = lim[k];
    if (!l) return;
    const n = inteiro(l.v);
    if (n === null) erros.push(`${campo}: indique um número inteiro.`);
    else campos[campo] = n;
  };
  limite('DISK_QUOTA', 'disk', true);
  limite('BANDWIDTH', 'bw', true);
  limite('WEB_DOMAINS', 'domains');
  limite('WEB_ALIASES', 'pointers');
  limite('MAIL_ACCOUNTS', 'emails');
  limite('DATABASES', 'mysql');
  limite('MAIL_DOMAINS', 'maildomains');
  limite('DNS_DOMAINS', 'dnsdomains');
  limite('DNS_RECORDS', 'dnsrecords');
  limite('CRON_JOBS', 'cronjobs');
  soNumero('BACKUPS', 'backups');
  soNumero('RATE_LIMIT', 'ratelimit');
  // os que o formulário mandou com o valor exato (os outros, vindos só de sim/não, não mudam um valor que já cumpre)
  const exatos = ['MAIL_DOMAINS', 'DNS_DOMAINS', 'CRON_JOBS'].filter((k) => campos[k] !== undefined);
  // sem os limites do Hestia no formulário (contas, pedidos antigos): o que eles diziam como sim/não
  if (campos.CRON_JOBS === undefined) campos.CRON_JOBS = feats.cron === false ? '0' : 'unlimited';
  if (campos.DNS_DOMAINS === undefined) campos.DNS_DOMAINS = feats.dns === false ? '0' : 'unlimited';
  if (campos.MAIL_DOMAINS === undefined) {
    if (campos.MAIL_ACCOUNTS === '0') campos.MAIL_DOMAINS = '0';
    else if (campos.MAIL_ACCOUNTS) campos.MAIL_DOMAINS = 'unlimited';
  }

  // recursos (só têm efeito com RESOURCES_LIMIT='yes' no Hestia, mas gravam-se sempre)
  const recurso = (campo: string, k: string, norm: (v: string) => string | null, exemplo: string) => {
    const l = rec[k];
    if (!l) return;
    if (l.unl || !String(l.v ?? '').trim()) {
      campos[campo] = 'unlimited';
      return;
    }
    const v = norm(String(l.v));
    if (v === null) erros.push(`${campo}: formato inválido (ex.: ${exemplo}).`);
    else campos[campo] = v;
  };
  recurso('CPU_QUOTA', 'cpu', normCpu, '400%');
  recurso('CPU_QUOTA_PERIOD', 'cpuperiod', normPeriodo, '100ms');
  recurso('MEMORY_LIMIT', 'memmax', normTamanho, '2G');
  recurso('SWAP_LIMIT', 'swap', normTamanho, '1G');

  // texto: shell, servidores de nomes, cópias incrementais e modelos
  const t = (k: string) => String(texto[k] ?? '').trim();
  if (t('SHELL')) {
    if ((SHELLS_HESTIA as readonly string[]).includes(t('SHELL'))) {
      campos.SHELL = t('SHELL');
      exatos.push('SHELL');
    }
    else erros.push(`SHELL: use um de ${SHELLS_HESTIA.join(', ')}.`);
  } else campos.SHELL = feats.ssh ? (feats.jail ? 'jailbash' : 'bash') : 'nologin';
  if (t('NS')) {
    const ns = t('NS').split(',').map((x) => x.trim().toLowerCase());
    if (ns.length > 0 && ns.every((x) => /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(x))) campos.NS = ns.join(',');
    else erros.push('NS: nomes de servidores de nomes separados por vírgulas (ex.: ns1.exemplo.com,ns2.exemplo.com).');
  }
  if (t('BACKUPS_INCREMENTAL')) {
    if (/^(yes|no)$/.test(t('BACKUPS_INCREMENTAL'))) campos.BACKUPS_INCREMENTAL = t('BACKUPS_INCREMENTAL');
    else erros.push('BACKUPS_INCREMENTAL: yes ou no.');
  }
  for (const k of ['WEB_TEMPLATE', 'PROXY_TEMPLATE', 'BACKEND_TEMPLATE', 'DNS_TEMPLATE']) {
    if (!t(k)) continue;
    if (/^[A-Za-z0-9._-]{1,40}$/.test(t(k))) campos[k] = t(k);
    else erros.push(`${k}: nome de modelo inválido.`);
  }
  return { campos, erros, exatos };
}

/** Junta os campos do formulário ao ficheiro de um pacote do Hestia (linhas `CHAVE='valor'`) e devolve o ficheiro novo.
 *  Os campos que só vêm como sim/não (quando o formulário não manda o limite exato) não mudam um valor que já cumpre o
 *  pedido: um pacote com 1 domínio de e-mail continua com 1 em vez de passar a ilimitado. */
const CAMPOS_SIM_NAO = new Set(['MAIL_DOMAINS', 'DNS_DOMAINS', 'CRON_JOBS', 'SHELL']);
const desligado = (v: string) => /^(0|nologin|)$/i.test(v);

export function juntarCamposPacote(atual: string, campos: Record<string, string>, editar: boolean, exatos: string[] = []): string {
  const linhas = new Map<string, string>();
  for (const l of atual.split('\n')) {
    const m = l.match(/^([A-Z_]+)='(.*)'$/);
    if (m) linhas.set(m[1], m[2]);
  }
  for (const [k, v] of Object.entries(campos)) {
    if (!/^[A-Z_]+$/.test(k) || !/^[A-Za-z0-9_.,:%-]*$/.test(v)) continue;
    const antes = linhas.get(k);
    // `exatos`: campos que o formulário mandou com o valor exato — esses gravam-se sempre como vieram
    if (editar && antes !== undefined && CAMPOS_SIM_NAO.has(k) && !exatos.includes(k) && desligado(antes) === desligado(v)) continue;
    linhas.set(k, v);
  }
  return [...linhas].map(([k, v]) => `${k}='${v}'`).join('\n') + '\n';
}
