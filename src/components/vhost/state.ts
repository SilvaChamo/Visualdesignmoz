// Estado do painel (igual ao objeto S da maquete) e navegação: cada ecrã tem endereço próprio
// /vhost/<nivel>/<ecra> (na maquete era #/<nivel>/<ecra>).
import { DESC, GLOBAL, LEVELS, MENU, ROLE_LEVELS } from './generated/data';
import type { Lang } from './i18n';
import type { Account, Level, MenuItem } from './types';
import { dbInicial, featsEfetivas, pacoteCompleto, type Db } from './paginas/dados';
import type { Servidor, ZonaDns } from './servidor';
import type { CustomComponents } from './theme';

export const BASE = '/vhost';
/** Símbolo da VisualDesign (o mesmo ficheiro que VisualHost/assets/vd-simbolo.png) */
export const LOGO = '/icons/icon-96x96.png';

export type Deny = { type: 'nivel'; lv: Level } | { type: 'pacote'; it: MenuItem } | { type: '404' };
export type DashTab = 'widgets' | 'menu';

export interface St {
  /** contas reais do servidor (vêm de /api/vhost/dados; vazio enquanto carrega) */
  acc: Record<string, Account>;
  /** estado da leitura dos dados do servidor */
  carga: 'a-carregar' | 'ok' | 'erro';
  erro: { msg: string; codigo: number } | null;
  /** estado do servidor (só administradores) e zonas DNS visíveis */
  srv: Servidor | null;
  dns: ZonaDns[];
  lidoEm: string;
  /** domínio escolhido no seletor da faixa de navegação ('' = o primeiro da conta) */
  dominio: string;
  /** versões PHP instaladas no servidor */
  php: string[];
  /** quem fez login */
  login: string;
  /** "entrar como": cada entrada guarda para onde voltar */
  stack: { u: string; lv: Level; pg: string }[];
  path: string;
  level: Level;
  page: string;
  gsub: string | null;
  /** partes do endereço depois do ecrã: /admin/pacotes/Starter → ['Starter'] */
  sub: string[];
  /** dados das páginas de gestão (pacotes, modelos de mensagem, informação das contas) */
  db: Db;
  deny: Deny | null;
  open: Record<string, boolean>;
  notes: boolean;
  dashTab: DashTab;
  lang: Lang;
  theme: 'light' | 'dark';
  /** tema de cores escolhido (Personalizar painel); 'custom' = cor própria em customPrimary */
  colorPreset: string;
  customPrimary: string;
  /** cores mudadas à mão, guardadas em cada tema: { [tema]: cores } */
  themeOver: Record<string, CustomComponents>;
  /** cores a ser editadas e ainda não guardadas (pré-visualização no painel) */
  themePreview: CustomComponents | null;
  radius: string;
  /** marca do painel (nome e logótipo carregado) */
  brand: { name: string; logo: string };
}

/** Chaves no navegador (tudo o que é aparência fica no navegador de quem usa) */
export const LS = {
  preset: 'visualhost_color_preset',
  customPrimary: 'visualhost_custom_primary',
  over: 'visualhost_theme_over',
  overAntigo: 'visualhost_custom_components',
  radius: 'visualhost_radius',
  brand: 'visualhost_brand',
};

// O estado inicial é sempre o mesmo no servidor e no navegador; o que está guardado no navegador
// (tema claro/escuro, cores, cantos, marca) entra logo a seguir, em VisualHostApp.
export function initialState(path: string): St {
  return fromPath(
    {
      acc: {},
      carga: 'a-carregar',
      erro: null,
      srv: null,
      dns: [],
      lidoEm: '',
      dominio: '',
      php: [],
      login: '',
      stack: [],
      path: '',
      level: 'admin',
      page: 'inicio',
      gsub: null,
      sub: [],
      db: dbInicial(),
      deny: null,
      open: {},
      notes: false,
      dashTab: 'widgets',
      lang: 'pt',
      theme: 'light',
      colorPreset: 'visualdesign',
      customPrimary: '',
      themeOver: {},
      themePreview: null,
      radius: '4px',
      brand: { name: '', logo: '' },
    },
    path,
  );
}

export const meOf = (s: St) => (s.stack.length ? s.stack[s.stack.length - 1].u : s.login);
/** Conta vazia enquanto os dados do servidor não chegam (o painel mostra "a carregar") */
const VAZIA: Account = { name: '', email: '', role: 'admin', creator: '', pkg: '', state: 'ok', disk: '0 MB', domains: [], mails: [] };
export const acctOf = (s: St) => s.acc[meOf(s)] || VAZIA;
export const allowedOf = (s: St) => ROLE_LEVELS[acctOf(s).role];
/** Separador aberto ao entrar numa conta: "Gestão" (os dados da própria conta) em todos os painéis que o têm */
export const nivelInicial = (s: St): Level => (allowedOf(s).includes('utilizador') ? 'utilizador' : allowedOf(s)[0]);
/** Pacote efetivo da conta: os limites próprios (se tiver) ou os do pacote */
export const pacoteDe = (s: St, u: string) => {
  const a = s.acc[u];
  if (!a) return undefined;
  // pacote da conta no servidor (nos revendedores "pkg" é o pacote de revenda); administradores e revendedores
  // sem pacote conhecido ficam com tudo
  return s.db.custom[u] || s.db.pkgs[a.hpkg || a.pkg] || (a.role === 'admin' || a.role === 'revenda' ? pacoteCompleto() : undefined);
};
export const hasFeatOf = (s: St, f?: string) => {
  if (!f) return true;
  const p = pacoteDe(s, meOf(s));
  return p ? !!featsEfetivas(p)[f] : true;
};
export const isUser = (r: string) => r === 'profissional' || r === 'cliente';
export const ico = (fa: string) => (fa.startsWith('fa-brands') ? fa : 'fa-solid ' + fa);
export const initials = (n: string) => {
  const w = String(n || '?').trim().split(/\s+/);
  return (w.length > 1 ? w[0][0] + w[w.length - 1][0] : w[0][0]).toUpperCase();
};

export function findItem(lv: Level, id: string): (MenuItem & { group: string }) | null {
  for (const [g, items] of MENU[lv]) for (const it of items) if (it.id === id) return { ...it, group: g };
  return null;
}

export const route = (lv: Level, id: string) => (GLOBAL[id] ? '/' + id : id === 'inicio' ? '/' + lv : '/' + lv + '/' + id);

const isLevel = (x: string): x is Level => x in LEVELS;

/** Lê o endereço e atualiza o estado (na maquete: fromHash). Sem endereço, vai para o primeiro painel da conta. */
export function fromPath(s: St, path: string): St {
  const dec = (x: string) => {
    try {
      return decodeURIComponent(x);
    } catch {
      return x;
    }
  };
  const p = path.replace(/^\/+/, '').split('/').filter(Boolean).map(dec);
  if (!p.length) return fromPath(s, '/' + nivelInicial(s));
  const n: St = { ...s, path: '/' + p.map(encodeURIComponent).join('/'), deny: null, sub: p.slice(2) };
  const g = GLOBAL[p[0]];
  if (g) {
    n.page = p[0];
    n.gsub = g.sub ? (g.sub.some((x) => x.id === p[1]) ? p[1] : g.sub[0].id) : null;
  } else if (isLevel(p[0])) {
    const lv = p[0];
    const id = p[1] || 'inicio';
    n.page = id;
    if (!allowedOf(s).includes(lv)) n.deny = { type: 'nivel', lv };
    else {
      n.level = lv;
      const it = findItem(lv, id);
      if (!it) n.deny = { type: '404' };
      else {
        // abre-se só a categoria da página onde se está; no painel inicial fica tudo fechado (abre-se ao carregar)
        n.open = it.group !== 'Início' ? { [lv + '/' + it.group]: true } : {};
        if (!hasFeatOf(s, it.feat)) n.deny = { type: 'pacote', it };
      }
    }
  } else {
    n.page = p[0];
    n.deny = { type: '404' };
  }
  return n;
}

/** Item do menu da secção da barra de ícones aberta (Perfil, Preferências, Mensagens) */
export function gItem(s: St) {
  const g = GLOBAL[s.page];
  return g && g.sub ? g.sub.find((x) => x.id === s.gsub) : undefined;
}

/** Breve descrição da página (aparece por baixo do título, na barra de cima) */
export function descFor(s: St): string {
  const g = GLOBAL[s.page];
  const k = s.deny ? 'deny/' + s.deny.type : g ? (g.sub ? s.page + '/' + s.gsub : s.page) : s.level + '/' + s.page;
  const d = DESC[k];
  return d ? d[s.lang === 'en' ? 1 : 0] : '';
}
