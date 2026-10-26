// Campos e listas das páginas de Gestão de contas (limites, funcionalidades, recursos, pacotes de revenda,
// modelos de mensagem). Copiados do DirectAdmin — ver VisualHost/04-da-gestao-de-contas.md.
// As contas, os pacotes de cliente e a informação das contas vêm do servidor (/api/vhost/dados).

import { PADRAO_RECURSOS } from '@/lib/pacote-hestia';

export type Unit = 'MB' | 'GB' | 'TB';
/** Um limite: valor, "Ilimitado" e (para tráfego/disco) a unidade */
export interface Lim {
  v: string;
  unl: boolean;
  unit?: Unit;
}

export interface Campo {
  k: string;
  t: string;
  en: string;
  unit?: boolean;
  ph?: string;
  help?: string;
  /** só existe no VisualHost (não vem do DirectAdmin) */
  vh?: boolean;
  /** o Hestia só aceita um número (sem "Ilimitado") */
  fixo?: boolean;
}

// ---------- Limites ----------
export const LIMITES_UTILIZADOR: Campo[] = [
  { k: 'bw', t: 'Tráfego', en: 'Bandwidth', unit: true },
  { k: 'disk', t: 'Espaço em disco', en: 'Disk Space', unit: true },
  { k: 'inode', t: 'Inodes', en: 'Inode' },
  { k: 'domains', t: 'Domínios', en: 'Domains' },
  { k: 'subdomains', t: 'Subdomínios', en: 'Sub-Domains' },
  { k: 'emails', t: 'Contas de e-mail', en: 'E-mail Accounts' },
  { k: 'forwarders', t: 'Reencaminhamentos', en: 'E-mail Forwarders' },
  { k: 'lists', t: 'Listas de correio', en: 'Mailing Lists' },
  { k: 'autoresponders', t: 'Respostas automáticas', en: 'Autoresponders' },
  { k: 'mysql', t: 'Bases de dados MySQL', en: 'MySQL Databases' },
  { k: 'pointers', t: 'Apontadores de domínio', en: 'Domain Pointers' },
  { k: 'ftp', t: 'Contas FTP', en: 'FTP Accounts' },
  { k: 'daily', t: 'Limite diário de envio de e-mail', en: 'E-mail Daily Limit' },
];
/** Limites que o próprio Hestia tem num pacote e que o formulário antigo (do DirectAdmin) não mostrava */
export const LIMITES_HESTIA: Campo[] = [
  { k: 'maildomains', t: 'Domínios de e-mail', en: 'Mail Domains', help: 'Quantos domínios podem ter caixas de correio.' },
  { k: 'dnsdomains', t: 'Domínios DNS', en: 'DNS Domains', help: 'Quantas zonas DNS a conta pode ter.' },
  { k: 'dnsrecords', t: 'Registos DNS por domínio', en: 'DNS Records', help: 'Máximo de registos em cada zona DNS.' },
  { k: 'cronjobs', t: 'Tarefas agendadas (cron)', en: 'Cron Jobs' },
  { k: 'backups', t: 'Cópias de segurança guardadas', en: 'Backups', fixo: true, help: 'Quantas cópias de segurança se guardam (0 desliga).' },
  { k: 'ratelimit', t: 'Envio de e-mail por hora (por caixa)', en: 'Mail Rate Limit', fixo: true, help: 'Máximo de mensagens que cada caixa envia por hora.' },
];
/** Campos de texto do pacote no Hestia (shell, servidores de nomes, cópias incrementais e modelos) */
export const MODELOS_WEB = ['default', 'nodejs'];
export const MODELOS_PROXY = ['default', 'caching', 'hosting', 'nodejs', 'nodejs-3010', 'supabase', 'visualdesign'];
export const MODELOS_BACKEND = ['default', 'PHP-8_3', 'no-php', 'socket'];
export const MODELOS_DNS = ['default', 'default-nomail', 'gmail', 'office365', 'zoho', 'child-ns'];
export const LIMITES_REVENDA: Campo[] = [
  ...LIMITES_UTILIZADOR.filter((c) => c.k !== 'daily'),
  { k: 'users', t: 'Contas de cliente', en: 'User Accounts', help: 'Cada cliente tem a sua própria conta no servidor, com o seu domínio' },
];

// ---------- Funcionalidades ----------
export const FUNC_UTILIZADOR: Campo[] = [
  { k: 'aftp', t: 'FTP anónimo', en: 'Anonymous FTP Accounts' },
  { k: 'cgi', t: 'Acesso CGI', en: 'CGI Access' },
  { k: 'git', t: 'Git', en: 'Git' },
  { k: 'wordpress', t: 'WordPress', en: 'WordPress' },
  { k: 'clamav', t: 'Antivírus (ClamAV)', en: 'ClamAV' },
  { k: 'php', t: 'Acesso PHP', en: 'PHP Access' },
  { k: 'spam', t: 'Anti-spam (SpamAssassin)', en: 'SpamAssassin' },
  { k: 'catchall', t: 'E-mail catch-all', en: 'Catch-All E-mail' },
  { k: 'ssl', t: 'Acesso SSL', en: 'SSL Access' },
  { k: 'ssh', t: 'Acesso SSH', en: 'SSH Access' },
  { k: 'cron', t: 'Tarefas cron', en: 'Cron Jobs' },
  { k: 'redis', t: 'Redis', en: 'Redis' },
  { k: 'sysinfo', t: 'Informação do sistema', en: 'System Info' },
  { k: 'loginkeys', t: 'Chaves de login', en: 'Login Keys' },
  { k: 'dns', t: 'Controlo de DNS', en: 'DNS Control' },
  { k: 'web', t: 'Ferramentas de site', en: 'Website tools', vh: true, help: 'Subdomínios, redirecionamentos, hotlink, logs e pastas protegidas' },
  { k: 'mailmarketing', t: 'Mailmarketing e campanhas', en: 'Mail marketing', vh: true },
  { k: 'suspendlimit', t: 'Suspender ao atingir o limite', en: 'Suspend at Limit' },
  { k: 'securitytxt', t: 'security.txt automático (RFC 9116)', en: 'Automatic security.txt (RFC9116)' },
  { k: 'jail', t: 'Acesso isolado (jail)', en: 'Jailed' },
];
export const FUNC_REVENDA: Campo[] = [
  ...FUNC_UTILIZADOR.filter((c) => ['aftp', 'cgi', 'git', 'wordpress', 'clamav', 'php', 'spam', 'catchall', 'ssl', 'ssh'].includes(c.k)),
  { k: 'sshusers', t: 'SSH para os clientes', en: 'SSH Access for Users' },
  { k: 'oversell', t: 'Permitir overselling', en: 'Allow Overselling', help: 'Vender mais espaço do que o pacote tem, contando que nem todos o usam' },
  ...FUNC_UTILIZADOR.filter((c) => ['cron', 'sysinfo', 'loginkeys', 'dns'].includes(c.k)),
];

// ---------- Limites de recursos ----------
export const RECURSOS: Campo[] = [
  { k: 'cpu', t: 'Quota de CPU', en: 'CPU Quota', ph: '100%', help: 'Quanto CPU a conta pode gastar: 100% = 1 núcleo, 250% = 2,5 núcleos (o servidor tem 6). Vale para o PHP dos sites e para os trabalhos agendados da conta. Não deixes ilimitado: uma conta sem limite pode gastar o CPU de todo o servidor e afectar os outros sites.' },
  { k: 'ioread', t: 'Leitura máxima do disco', en: 'IO Read Bandwidth Max', ph: '5M', help: 'Velocidade máxima de leitura do disco.' },
  { k: 'iopsread', t: 'Leituras por segundo', en: 'IOPS Read Max', ph: '1K', help: 'Máximo de operações de leitura do disco por segundo.' },
  { k: 'iowrite', t: 'Escrita máxima no disco', en: 'IO Write Bandwidth Max', ph: '5M', help: 'Velocidade máxima de escrita no disco.' },
  { k: 'iopswrite', t: 'Escritas por segundo', en: 'IOPS Write Max', ph: '1K', help: 'Máximo de operações de escrita no disco por segundo.' },
  { k: 'memhigh', t: 'Memória (abrandar acima de)', en: 'Memory High', ph: '1G', help: 'Acima deste valor, a conta fica mais lenta.' },
  { k: 'memmax', t: 'Memória máxima', en: 'Memory Max', ph: '1G', help: 'Memória da conta (MEMORY_LIMIT do Vhost): acima deste valor a conta fica mais lenta; acima de 1,5 vezes, os processos dela são terminados, sem afectar as outras contas.' },
  { k: 'swap', t: 'Swap máximo', en: 'Swap Max', ph: '512M', help: 'Memória de troca (disco) que a conta pode usar.' },
  { k: 'cpuperiod', t: 'Período da quota de CPU', en: 'CPU Quota Period', ph: '100ms', help: 'Janela de tempo em que a quota de CPU se aplica (ex.: 100ms).' },
  { k: 'tasks', t: 'Máximo de tarefas', en: 'Tasks Max', ph: '512', help: 'Máximo de processos que a conta pode ter ao mesmo tempo.' },
];

export const TEMAS = ['VisualHost'];
export const IDIOMAS = ['Português', 'English'];
export const ACME = ["Let's Encrypt", 'ZeroSSL'];
export const IPS = ['Endereço do servidor (partilhado)', '1 IP dedicado', '2 IPs dedicados'];
export const NS = ['ns1.visualhost.co.mz', 'ns2.visualhost.co.mz'];

// ---------- Pacotes ----------
export interface PacoteUtilizador {
  lim: Record<string, Lim>;
  feats: Record<string, boolean>;
  tema: string;
  idioma: string;
  acme: string;
  rec: Record<string, Lim>;
  /** campos de texto do pacote no Hestia (SHELL, NS, BACKUPS_INCREMENTAL e modelos) */
  hestia?: Record<string, string>;
}
export interface PacoteRevenda {
  lim: Record<string, Lim>;
  ips: string;
  feats: Record<string, boolean>;
  /** pode usar nameservers com a sua marca (no Hestia: v-change-user-ns). Substitui os "DNS pessoais" do DirectAdmin. */
  nsProprios: boolean;
  ipServidor: boolean;
  rec: Record<string, Lim>;
}

const L = (v: string | number, unit?: Unit): Lim => ({ v: String(v), unl: false, ...(unit ? { unit } : {}) });
const U = (unit?: Unit): Lim => ({ v: '', unl: true, ...(unit ? { unit } : {}) });
const recursosLivres = (): Record<string, Lim> => Object.fromEntries(RECURSOS.map((c) => [c.k, U()]));
/** Recursos de um pacote novo (Silva, 26/10/2026): CPU, período, memória e swap já com valor — nunca "ilimitado" por defeito */
const recursosPadrao = (): Record<string, Lim> => ({
  ...recursosLivres(),
  cpu: L(PADRAO_RECURSOS.CPU_QUOTA),
  cpuperiod: L(PADRAO_RECURSOS.CPU_QUOTA_PERIOD),
  memmax: L(PADRAO_RECURSOS.MEMORY_LIMIT),
  swap: L(PADRAO_RECURSOS.SWAP_LIMIT),
});

/** Tudo ligado e sem limites (administradores e revendedores na sua própria conta, quando o pacote não é conhecido) */
export function pacoteCompleto(): PacoteUtilizador {
  return {
    lim: {
      ...Object.fromEntries(LIMITES_UTILIZADOR.map((c) => [c.k, U(c.unit ? 'GB' : undefined)])),
      ...Object.fromEntries(LIMITES_HESTIA.map((c) => [c.k, c.fixo ? L(c.k === 'ratelimit' ? 200 : 1) : U()])),
    },
    feats: Object.fromEntries(FUNC_UTILIZADOR.map((c) => [c.k, !['aftp', 'cgi', 'redis'].includes(c.k)])),
    tema: TEMAS[0],
    idioma: IDIOMAS[0],
    acme: ACME[0],
    rec: recursosLivres(),
  };
}

export function pacoteVazio(): PacoteUtilizador {
  return {
    lim: {
      ...Object.fromEntries(LIMITES_UTILIZADOR.map((c) => [c.k, c.unit ? L(c.k === 'bw' ? 10 : 5, 'GB') : L(0)])),
      maildomains: L(1),
      dnsdomains: L(1),
      dnsrecords: U(),
      cronjobs: L(0),
      backups: L(1),
      ratelimit: L(200),
    },
    feats: Object.fromEntries(FUNC_UTILIZADOR.map((c) => [c.k, false])),
    tema: TEMAS[0],
    idioma: IDIOMAS[0],
    acme: ACME[0],
    rec: recursosPadrao(),
  };
}

export function pacoteRevendaVazio(): PacoteRevenda {
  return {
    lim: Object.fromEntries(LIMITES_REVENDA.map((c) => [c.k, c.unit ? L(c.k === 'bw' ? 50 : 20, 'GB') : L(10)])),
    ips: '0',
    feats: Object.fromEntries(FUNC_REVENDA.map((c) => [c.k, !['aftp', 'catchall', 'sshusers'].includes(c.k)])),
    nsProprios: false,
    ipServidor: true,
    rec: recursosPadrao(),
  };
}

// Os mesmos dois planos de revenda do site (panel-role-capabilities.ts: Essencial 15 contas / 50 GB, Expandido 150 / 500 GB).
// O Hestia não tem revendedores: o revendedor é uma conta normal e cada cliente seu tem conta própria, ligada a ele no VisualHost.
function pacotesRevendaIniciais(): Record<string, PacoteRevenda> {
  const essencial: PacoteRevenda = {
    ...pacoteRevendaVazio(),
    lim: { ...pacoteRevendaVazio().lim, bw: L(500, 'GB'), disk: L(50, 'GB'), domains: L(15), users: L(15) },
  };
  const expandido: PacoteRevenda = {
    ...pacoteRevendaVazio(),
    lim: { ...pacoteRevendaVazio().lim, bw: L(2, 'TB'), disk: L(500, 'GB'), domains: L(150), users: L(150) },
    ips: '1',
    feats: { ...pacoteRevendaVazio().feats, sshusers: true },
    nsProprios: true,
  };
  const completo: PacoteRevenda = {
    ...pacoteRevendaVazio(),
    lim: Object.fromEntries(LIMITES_REVENDA.map((c) => [c.k, U(c.unit ? 'GB' : undefined)])),
    ips: '2',
    feats: Object.fromEntries(FUNC_REVENDA.map((c) => [c.k, c.k !== 'aftp'])),
    nsProprios: true,
  };
  return { 'Revenda Essencial': essencial, 'Revenda Expandido': expandido, Completo: completo };
}

// ---------- Modelos de mensagem (adaptados dos predefinidos do DirectAdmin) ----------
export interface Modelo {
  assunto: string;
  msg: string;
}
export const MODELOS_PREDEFINIDOS: Record<'boas-vindas' | 'suspensao', Modelo> = {
  'boas-vindas': {
    assunto: 'A sua conta para |domain| está pronta a usar.',
    msg: `Caro cliente,

Obrigado por escolher a VisualDesign para alojar o seu site.

A sua conta foi criada com os seguintes dados:

Utilizador:	|username|
Palavra-passe:	|password|
Domínio:	|domain|

Para entrar já no painel, use este endereço com o seu utilizador e palavra-passe:

https://|ip|:|PORT|

Quando o domínio estiver a apontar para o servidor, também pode usar:

https://www.|domain|

Tráfego:	|bandwidth| MB
Espaço em disco:	|quota| MB

Domínios:	|vdomains|
Subdomínios:	|nsubdomains|

Contas de e-mail:	|nemails|
Reencaminhamentos:	|nemailf|
Respostas automáticas:	|nemailr|
Listas de correio:	|nemailml|
Servidor de entrada (POP/IMAP):	mail.|domain|
Servidor de saída (SMTP):	mail.|domain|

Contas FTP:	|ftp|
Servidor FTP:	ftp.|domain|

Servidores de nomes (configure-os no registo do domínio):

NS1:	|ns1|
NS2:	|ns2|

Bases de dados MySQL:	|mysql|
Apontadores de domínio:	|domainptr|
Acesso SSH:	|ssh|
SSL:	|ssl|
PHP:	|php|
Controlo de DNS:	|dnscontrol|

Obrigado mais uma vez pela confiança.
Se tiver alguma dúvida, fale connosco.`,
  },
  suspensao: {
    assunto: "A sua conta '|USERNAME|' foi suspensa. Motivo: '|REASON|'",
    msg: `Olá,

Esta mensagem é para o informar de que a sua conta '|USERNAME|' foi suspensa.
Motivo: |REASON|

Se acha que se trata de um erro, contacte-nos para mais informações.

|MSG_FOOTER|`,
  },
};

// ---------- Informação extra das contas (fictícia) ----------
export interface InfoConta {
  bw: string;
  ip: string;
  dbs: number;
  criada: string;
}

export function hoje(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}, ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export interface Db {
  pkgs: Record<string, PacoteUtilizador>;
  rpkgs: Record<string, PacoteRevenda>;
  /** limites próprios de uma conta (Personalizar / Modificar), em vez dos do pacote */
  custom: Record<string, PacoteUtilizador>;
  rcustom: Record<string, PacoteRevenda>;
  modelos: Record<'boas-vindas' | 'suspensao', Modelo>;
  info: Record<string, InfoConta>;
  comentarios: Record<string, string>;
}

export function dbInicial(): Db {
  return {
    pkgs: {},
    rpkgs: pacotesRevendaIniciais(),
    custom: {},
    rcustom: {},
    modelos: structuredClone(MODELOS_PREDEFINIDOS),
    info: {},
    comentarios: {},
  };
}

/** "10 GB", "∞" — para mostrar um limite */
export const limTxt = (l?: Lim) => (!l ? '—' : l.unl ? '∞' : l.v + (l.unit ? ' ' + l.unit : ''));

/** Funcionalidades efetivas: as do pacote, mais FTP e bases de dados (que dependem dos limites) */
export function featsEfetivas(p: PacoteUtilizador): Record<string, boolean> {
  const has = (l?: Lim) => !!l && (l.unl || Number(l.v) > 0);
  return { ...p.feats, ftp: has(p.lim.ftp), bd: has(p.lim.mysql) };
}

// ---------- O que o Hestia não guarda (fica no servidor do painel, por pacote) ----------
/** Campos do formulário de pacotes que o Hestia não tem (inodes, listas de correio, funcionalidades do painel, IO…):
 *  guardam-se à parte por pacote (Admin › Pacotes), para não se perderem ao gravar. */
export interface ExtrasPlano {
  lim?: Record<string, Lim>;
  feats?: Record<string, boolean>;
  rec?: Record<string, Lim>;
  idioma?: string;
  acme?: string;
}
const LIM_HESTIA = new Set(['bw', 'disk', 'domains', 'pointers', 'emails', 'mysql', ...LIMITES_HESTIA.map((c) => c.k)]);
const REC_HESTIA = new Set(['cpu', 'cpuperiod', 'memmax', 'swap']);
/** Funcionalidades que vêm do próprio pacote do Hestia (limite de cron e de DNS, shell) */
export const FEATS_HESTIA = new Set(['cron', 'dns', 'ssh', 'jail']);

const so = <T,>(o: Record<string, T> | undefined, fora: (k: string) => boolean) =>
  Object.fromEntries(Object.entries(o || {}).filter(([k]) => !fora(k))) as Record<string, T>;

/** O que se guarda à parte: tudo o que o formulário tem e não é um campo do pacote do Hestia */
export function extrasDoPacote(p: PacoteUtilizador): ExtrasPlano {
  return {
    lim: so(p.lim, (k) => LIM_HESTIA.has(k)),
    feats: so(p.feats, (k) => FEATS_HESTIA.has(k)),
    rec: so(p.rec, (k) => REC_HESTIA.has(k)),
    idioma: p.idioma,
    acme: p.acme,
  };
}

/** Pacote lido do Hestia + o que estava guardado à parte */
export function comExtras(p: PacoteUtilizador, e?: ExtrasPlano): PacoteUtilizador {
  if (!e) return p;
  return {
    ...p,
    lim: { ...p.lim, ...so(e.lim, (k) => LIM_HESTIA.has(k)) },
    feats: { ...p.feats, ...so(e.feats, (k) => FEATS_HESTIA.has(k)) },
    rec: { ...p.rec, ...so(e.rec, (k) => REC_HESTIA.has(k)) },
    idioma: e.idioma || p.idioma,
    acme: e.acme || p.acme,
  };
}
