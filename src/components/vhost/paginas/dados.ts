// Campos e listas das páginas de Gestão de contas (limites, funcionalidades, recursos, pacotes de revenda,
// modelos de mensagem). Copiados do DirectAdmin — ver VisualHost/04-da-gestao-de-contas.md.
// As contas, os pacotes de cliente e a informação das contas vêm do servidor (/api/vhost/dados).

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
  { k: 'cpu', t: 'Quota de CPU', en: 'CPU Quota', ph: '400%', help: 'Percentagem de um núcleo do processador. Mais de 100% para vários núcleos.' },
  { k: 'ioread', t: 'Leitura máxima do disco', en: 'IO Read Bandwidth Max', ph: '5M', help: 'Velocidade máxima de leitura do disco.' },
  { k: 'iopsread', t: 'Leituras por segundo', en: 'IOPS Read Max', ph: '1K', help: 'Máximo de operações de leitura do disco por segundo.' },
  { k: 'iowrite', t: 'Escrita máxima no disco', en: 'IO Write Bandwidth Max', ph: '5M', help: 'Velocidade máxima de escrita no disco.' },
  { k: 'iopswrite', t: 'Escritas por segundo', en: 'IOPS Write Max', ph: '1K', help: 'Máximo de operações de escrita no disco por segundo.' },
  { k: 'memhigh', t: 'Memória (abrandar acima de)', en: 'Memory High', ph: '1G', help: 'Acima deste valor, a conta fica mais lenta.' },
  { k: 'memmax', t: 'Memória máxima', en: 'Memory Max', ph: '2G', help: 'Limite absoluto: acima dele, os processos são terminados.' },
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

/** Tudo ligado e sem limites (administradores e revendedores na sua própria conta, quando o pacote não é conhecido) */
export function pacoteCompleto(): PacoteUtilizador {
  return {
    lim: Object.fromEntries(LIMITES_UTILIZADOR.map((c) => [c.k, U(c.unit ? 'GB' : undefined)])),
    feats: Object.fromEntries(FUNC_UTILIZADOR.map((c) => [c.k, !['aftp', 'cgi', 'redis'].includes(c.k)])),
    tema: TEMAS[0],
    idioma: IDIOMAS[0],
    acme: ACME[0],
    rec: recursosLivres(),
  };
}

export function pacoteVazio(): PacoteUtilizador {
  return {
    lim: Object.fromEntries(LIMITES_UTILIZADOR.map((c) => [c.k, c.unit ? L(c.k === 'bw' ? 10 : 5, 'GB') : L(0)])),
    feats: Object.fromEntries(FUNC_UTILIZADOR.map((c) => [c.k, false])),
    tema: TEMAS[0],
    idioma: IDIOMAS[0],
    acme: ACME[0],
    rec: recursosLivres(),
  };
}

export function pacoteRevendaVazio(): PacoteRevenda {
  return {
    lim: Object.fromEntries(LIMITES_REVENDA.map((c) => [c.k, c.unit ? L(c.k === 'bw' ? 50 : 20, 'GB') : L(10)])),
    ips: '0',
    feats: Object.fromEntries(FUNC_REVENDA.map((c) => [c.k, !['aftp', 'catchall', 'sshusers'].includes(c.k)])),
    nsProprios: false,
    ipServidor: true,
    rec: recursosLivres(),
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
