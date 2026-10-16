// Estado do painel (igual ao objeto S da maquete) e navegação: cada ecrã tem endereço próprio
// /host:2026/<nivel>/<ecra> (na maquete era #/<nivel>/<ecra>).
import { DESC, GLOBAL, LEVELS, MENU, ROLE_LEVELS } from './generated/data';
import type { Lang } from './i18n';
import type { Account, Level, MenuItem } from './types';
import { dbInicial, featsEfetivas, pacoteCompleto, type Db } from './paginas/dados';
import type { Pessoa, Servidor, ZonaDns } from './servidor';
import type { CustomComponents } from './theme';

// Endereço único do painel (pedido do Silva, 13/10/2026): https://visualdesignmoz.com/host:2026/… O servidor serve-o
// pela rota src/app/host (src/proxy.ts reescreve, sem redireccionar); os endereços antigos (/vhost/…, /host/2026/…,
// host.visualdesignmoz.com) redireccionam para aqui.
export const BASE = '/host:2026';
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
  /** Acessos por plano (Admin › Acessos por plano): por pacote, as páginas da Gestão escondidas aos clientes */
  acessos: Record<string, string[]>;
  /** Tema do painel de cada plano (Admin › Pacotes › Tema), para as contas que ainda não escolheram outro */
  temasPlano: Record<string, string>;
  /** versões PHP instaladas no servidor */
  php: string[];
  /** quem fez login */
  login: string;
  /** quem entrou, como está no perfil do site (nome, e-mail, empresa) */
  pessoa: Pessoa | null;
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

// O estado inicial é sempre o mesmo no servidor e no navegador; as preferências privadas da conta
// (tema, cores, cantos e marca) são lidas do servidor depois de a sessão do painel estar pronta.
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
      acessos: {},
      temasPlano: {},
      php: [],
      login: '',
      pessoa: null,
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

/** Domínio escolhido no seletor, por conta: fica até se escolher outro, mesmo depois de fechar o painel (como no DA) */
const chaveDominio = (conta: string) => 'vh-dominio:' + conta;
export function dominioGuardado(conta: string): string {
  try {
    return (conta && localStorage.getItem(chaveDominio(conta))) || '';
  } catch {
    return '';
  }
}
export function guardarDominio(conta: string, d: string) {
  try {
    if (conta) localStorage.setItem(chaveDominio(conta), d);
  } catch {}
}
export const meOf = (s: St) => (s.stack.length ? s.stack[s.stack.length - 1].u : s.login);
/** Conta vazia enquanto os dados do servidor não chegam (o painel mostra "a carregar") */
const VAZIA: Account = { name: '', email: '', role: 'admin', creator: '', pkg: '', state: 'ok', disk: '0 MB', domains: [], mails: [] };
export const acctOf = (s: St) => s.acc[meOf(s)] || VAZIA;
// Separadores da conta que se está a ver (a própria, ou a de "entrar como"): o painel de um cliente nunca tem o Admin.
// Com os dados lidos e sem conta no servidor (ex.: cliente só com domínio ou e-mail), só a Gestão — a conta vazia
// abaixo (VAZIA) tem o papel de administrador e não pode decidir os separadores.
export const allowedOf = (s: St) => (s.carga === 'ok' && !s.acc[meOf(s)] ? (['utilizador'] as Level[]) : ROLE_LEVELS[acctOf(s).role]);
/** Separador aberto ao entrar no painel ou numa conta: sempre "Gestão" (os dados da própria conta), para todos os que o
 *  têm (pedido do Silva, 14/10/2026 — antes voltava ao último separador em que se tinha trabalhado). */
export const nivelInicial = (s: St): Level => {
  const permitidos = allowedOf(s);
  return permitidos.includes('utilizador') ? 'utilizador' : permitidos[0];
};
/** Pacote efetivo da conta: os limites próprios (se tiver) ou os do pacote */
export const pacoteDe = (s: St, u: string) => {
  const a = s.acc[u];
  if (!a) return undefined;
  // pacote da conta no servidor (nos revendedores "pkg" é o pacote de revenda); administradores e revendedores
  // sem pacote conhecido ficam com tudo
  return s.db.custom[u] || s.db.pkgs[a.hpkg || a.pkg] || (a.role === 'admin' || a.role === 'revenda' ? pacoteCompleto() : undefined);
};
/** A página `id` da Gestão está escondida pelo plano da conta que se vê (Admin › Acessos por plano)? Só vale para
 *  contas de clientes (cliente/profissional): administradores e revendedores vêem sempre tudo. */
export const ocultoNoPlano = (s: St, id: string, lv: Level = s.level) => {
  if (lv !== 'utilizador') return false;
  const a = acctOf(s);
  return isUser(a.role) && !!s.acessos?.[a.pkg]?.includes(id);
};
export const hasFeatOf = (s: St, f?: string, id?: string, lv: Level = s.level) => {
  if (id && ocultoNoPlano(s, id, lv)) return false;
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

export const isLevel = (x: string): x is Level => x in LEVELS;

/** Páginas que passaram a separador de outra: o endereço antigo (links, favoritos) abre o separador */
const MUDOU: Record<string, string> = { subdominios: '/utilizador/dominios/subdominios' };

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
  if (isLevel(p[0]) && p[1] && MUDOU[p[1]] && !findItem(p[0], p[1])) return fromPath(s, MUDOU[p[1]]);
  const n: St = { ...s, path: '/' + p.map(encodeURIComponent).join('/'), deny: null, sub: p.slice(2) };
  const g = GLOBAL[p[0]];
  if (g) {
    n.page = p[0];
    n.gsub = g.sub ? (g.sub.some((x) => x.id === p[1]) ? p[1] : g.sub[0].id) : null;
  } else if (isLevel(p[0])) {
    const lv = p[0];
    const id = p[1] || 'inicio';
    n.page = id;
    if (!allowedOf(s).includes(lv)) {
      // Se for apenas o início do nível (ex: /admin ao entrar) e o utilizador não tem esse nível,
      // encaminha suavemente para o nível inicial permitido da conta em vez de bloquear com erro
      if (id === 'inicio') {
        const lvValido = nivelInicial(s);
        return fromPath(s, '/' + lvValido);
      }
      n.deny = { type: 'nivel', lv };
    }
    else {
      n.level = lv;
      const it = findItem(lv, id);
      if (!it) n.deny = { type: '404' };
      else {
        // abre-se só a categoria da página onde se está; no painel inicial fica tudo fechado (abre-se ao carregar)
        n.open = it.group !== 'Início' ? { [lv + '/' + it.group]: true } : {};
        if (!hasFeatOf(s, it.feat, it.id, lv)) n.deny = { type: 'pacote', it };
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
