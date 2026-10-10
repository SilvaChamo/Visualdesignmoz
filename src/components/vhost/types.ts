// Tipos do painel VisualHost (os dados vêm de generated/data.ts, gerado a partir da maquete).

export type Level = 'admin' | 'revenda' | 'utilizador';
export type Role = 'admin' | 'revenda' | 'profissional' | 'cliente';
/** Situação do ecrã no servidor (Hestia): faz · faz com ajuda do VisualHost · feito pelo VisualHost · ferramenta extra */
export type HxState = 'sim' | 'parcial' | 'app' | 'extra';

export interface MenuItem {
  id: string;
  fa: string;
  t: string;
  c: string;
  /** ecrã equivalente no DirectAdmin */
  da: string;
  /** funcionalidades previstas */
  f: string[];
  hx: { s: HxState; cmd: string; n: string };
  feat?: string;
  opt?: boolean;
  note?: string;
}

export type MenuGroup = [string, MenuItem[]];

export interface GlobalSection {
  t: string;
  fa?: string;
  sub?: MenuItem[];
  demo?: boolean;
}

export interface Removed {
  t: string;
  da: string;
  why: string;
}

export interface Domain {
  name: string;
  ssl: 'ok' | 'w';
  php: string;
  disk: string;
  status: 'ok' | 'w';
  wp?: boolean;
  // Dados reais do servidor (Hestia)
  bw?: string;
  /** apontadores (aliases) do site */
  aliases?: string[];
  docroot?: string;
  ftp?: { user: string; path: string }[];
  /** certificado Let's Encrypt automático */
  le?: boolean;
  /** só e-mail (sem site) */
  soEmail?: boolean;
}

export interface BaseDados {
  nome: string;
  user: string;
  tipo: string;
  charset: string;
  disco: string;
  suspensa: boolean;
  criada: string;
}

export interface Mailbox {
  user: string;
  dom: string;
  used: number;
  /** MB; 0 = sem limite */
  quota: number;
  /** data de criação (dd/mm/aaaa) */
  criada?: string;
  sent: number;
}

export interface Account {
  name: string;
  email: string;
  role: Role;
  creator: string;
  pkg: string;
  state: 'ok' | 'off';
  disk: string;
  domains: Domain[];
  mails: Mailbox[];
  // Dados reais do servidor (Hestia), quando vêm de /api/vhost/dados
  /** pacote da conta no servidor (nos revendedores, "pkg" é o pacote de revenda) */
  hpkg?: string;
  discoMb?: number;
  /** null = sem limite */
  discoLimMb?: number | null;
  bwMb?: number;
  bwLimMb?: number | null;
  ns?: string[];
  dbs?: BaseDados[];
}
