'use client';

// Painel VisualHost — versão React da maquete aprovada (VisualHost/maquete-visualhost.html).
// Mesma estrutura de HTML e mesmas classes, para o CSS da maquete (generated/maquete.css) se aplicar tal e qual.
import { Component, Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { BarraPagina, FaixaAbas, PesquisaPagina, VHContext, type ItemPesquisa, type VH } from './context';
import { GLOBAL, LEVELS, MENU, ROLES } from './generated/data';
import { dominioVisivel, type DadosServidor } from './servidor';
import { CACHE_DADOS_VHOST, apagarDadosVhost, guardarDadosVhost, tirarEntrada } from '@/lib/vhost-cache';
import { translate, type Lang } from './i18n';
import { EntradaPainel, EsperaEntrada, LINGUA_LS, type ModoTema } from './entrada';
import { auth } from '@/lib/supabase-client';
import { MoreMenuModal } from './modals';
import { SCREENS, denyScreen, placeholder, type Screen } from './screens';
import { PesquisaNaPagina } from './pesquisa-pagina';
import { useTituloAjustado } from './titulo-ajustado';
import { SAIR_POR_INATIVIDADE_ATIVO } from '@/lib/session-inactivity';
import { BarraTopo, EsperaPagina, atividadeComeca, instalarContador, type Espera } from './carga';
import { aplicarCoresNoSite, badgeColors, getThemeColors, hexToRgb, luminancia, paletaDoSite, type CustomComponents } from './theme';
import { useTheme } from '@/contexts/ThemeContext';
import { FUNDO } from './carga';

/** nomes antigos dos temas → nome atual (as cores gravadas ficam sempre no mesmo nome) */
const presetId = (id: string) => ({ red: 'visualdesign', blue: 'visualpro' })[id] || id;
import {
  BASE,
  LOGO,
  acctOf,
  allowedOf,
  isLevel,
  nivelInicial,
  descFor,
  findItem,
  fromPath,
  gItem,
  hasFeatOf,
  ico,
  initialState,
  isUser,
  LS,
  meOf,
  route,
  type DashTab,
  type St,
} from './state';
import { Avatar, ImpBanner, RouteFoot, SwitcherBar } from './ui';
import type { Account, Level, MenuItem } from './types';

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

// O mesmo ecrã com o endereço do browser (/host:2026/…) ou com o da rota no servidor (/host/…, por causa da
// reescrita em src/proxy.ts): os dois dão o mesmo caminho interno, sem diferenças entre servidor e browser
const PREFIXOS = [BASE, '/host%3A2026', '/host%3a2026', '/host/2026', '/host'];
const stripBase = (p: string) => {
  const pre = PREFIXOS.find((b) => p === b || p.startsWith(b + '/'));
  return (pre ? p.slice(pre.length) : p).replace(/\/+$/, '') || '/';
};

const TABBAR: Record<Level, [string, string, string][]> = {
  admin: [
    ['inicio', 'fa-house', 'Início'],
    ['utilizadores', 'fa-users', 'Contas'],
    ['dns', 'fa-network-wired', 'DNS'],
    ['servicos', 'fa-gears', 'Serviços'],
  ],
  revenda: [
    ['inicio', 'fa-house', 'Início'],
    ['clientes', 'fa-users', 'Clientes'],
    ['pacotes', 'fa-boxes-stacked', 'Pacotes'],
    ['tickets', 'fa-life-ring', 'Tickets'],
  ],
  utilizador: [
    ['inicio', 'fa-house', 'Início'],
    ['dominios', 'fa-globe', 'Domínios'],
    ['email', 'fa-envelope', 'E-mail'],
    ['ficheiros', 'fa-folder-open', 'Ficheiros'],
  ],
};

// Pesquisa de funcionalidades (janela como a "Search for pages" do DA)
const SUGEST: Record<Level, string[]> = {
  admin: ['utilizadores', 'novo-cliente', 'dns', 'servicos', 'backups', 'pacotes', 'forca-bruta', 'logs'],
  revenda: ['clientes', 'novo-cliente', 'pacotes', 'dns', 'backups', 'tickets'],
  utilizador: ['dominios', 'email', 'dns', 'bd', 'ficheiros', 'ssl', 'wordpress', 'backups'],
};
type Hit = { lv: Level | null; g: string; it: MenuItem; path: string; k: string };

function searchResults(s: St, q: string): Hit[] {
  const T = (x: string) => translate(s.lang, x);
  const all: Hit[] = [];
  const allowed = allowedOf(s);
  for (const lv of [s.level, ...allowed.filter((x) => x !== s.level)])
    for (const [g, items] of MENU[lv])
      for (const it of items)
        if (hasFeatOf(s, it.feat)) all.push({ lv, g, it, path: route(lv, it.id), k: (it.t + ' ' + T(it.t) + ' ' + g + ' ' + T(g) + ' ' + it.f.join(' ')).toLowerCase() });
  for (const [id, g] of Object.entries(GLOBAL))
    if (g.sub) for (const x of g.sub) all.push({ lv: null, g: g.t, it: x, path: '/' + id + '/' + x.id, k: (x.t + ' ' + T(x.t) + ' ' + g.t + ' ' + x.f.join(' ')).toLowerCase() });
  const qq = q.trim().toLowerCase();
  if (!qq) return SUGEST[s.level].map((id) => all.find((x) => x.lv === s.level && x.it.id === id)).filter((x): x is Hit => !!x);
  const words = qq.split(/\s+/);
  return all
    .filter((x) => words.every((w) => x.k.includes(w)))
    .sort((a, b) => Number(b.it.t.toLowerCase().includes(qq)) - Number(a.it.t.toLowerCase().includes(qq)))
    .slice(0, 40);
}

type Pop = { kind: 'lang' | 'conta'; left: number; top?: number; bottom?: number } | null;

/** Uma página do painel como ficou desenhada (o que se vê enquanto a seguinte ainda não está pronta) */
type Pagina = { chave: string; ok: boolean; vh: VH; scr: Screen; title: string; desc: string; semCartao: boolean; deny: boolean; home: boolean };

/** Um erro numa página fica nessa página: o resto do painel continua a funcionar */
class FalhaPagina extends Component<{ children: ReactNode; t: (s: string) => string; onFalha: () => void }, { erro: boolean }> {
  state = { erro: false };
  static getDerivedStateFromError() {
    return { erro: true };
  }
  componentDidCatch(e: unknown) {
    console.error('[VisualHost] erro na página', e);
    this.props.onFalha(); // se estava à espera para aparecer, aparece já com o aviso
  }
  render() {
    if (!this.state.erro) return this.props.children;
    const { t } = this.props;
    return (
      <div className="card empty">
        <p>{t('Esta página não abriu por causa de um erro. Volte a tentar; se continuar, fale com o suporte.')}</p>
        <button className="btn r" onClick={() => location.reload()}>
          <i className="fa-solid fa-rotate-right" />
          {t('Recarregar')}
        </button>
      </div>
    );
  }
}

// Última leitura da conta guardada neste navegador, para o painel abrir logo com conteúdo (nunca em branco à espera do
// servidor — pedido do Silva, 13/10/2026). Não tem palavras-passe; apaga-se ao sair e quando a sessão é recusada.
const CACHE_DADOS = CACHE_DADOS_VHOST;
function lerCache(): DadosServidor | null {
  try {
    localStorage.removeItem('vh-dados');
    const v = localStorage.getItem(CACHE_DADOS);
    return v ? (JSON.parse(v) as DadosServidor) : null;
  } catch {
    return null;
  }
}
const guardarCache = (d: DadosServidor) => guardarDadosVhost(d);
const apagarCache = apagarDadosVhost;

/** Aparência guardada no navegador (tema claro/escuro, separador do painel inicial, língua, cores, cantos e marca) */
function comPreferencias(s: St): St {
  const n = { ...s };
  try {
    // claro/escuro: o mesmo do site todo (cookie vd-theme); "automático" (escolhido na página de entrada) segue o sistema
    const tm = localStorage.getItem('visualhost_theme');
    const doSite = (document.cookie.match(/(?:^|; )vd-theme=(light|dark)/) || [])[1] || localStorage.getItem('vd-theme');
    if (tm === 'auto') n.theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    else if (doSite === 'dark' || doSite === 'light') n.theme = doSite;
    else if (tm === 'dark') n.theme = 'dark';
    if (localStorage.getItem('visualhost_dashtab') === 'menu') n.dashTab = 'menu';
    const lg = localStorage.getItem(LINGUA_LS);
    if (lg === 'pt' || lg === 'en') n.lang = lg;
    n.colorPreset = presetId(localStorage.getItem(LS.preset) || n.colorPreset);
    n.customPrimary = localStorage.getItem(LS.customPrimary) || '';
    n.radius = localStorage.getItem(LS.radius) || n.radius;
    const over = localStorage.getItem(LS.over);
    if (over) n.themeOver = Object.fromEntries(Object.entries(JSON.parse(over) as Record<string, CustomComponents>).map(([k, v]) => [presetId(k), v]));
    // formato antigo (antes de 10/10): umas só cores para todos os temas → ficam no tema escolhido
    const antigo = localStorage.getItem(LS.overAntigo);
    if (antigo) {
      const c = JSON.parse(antigo) as CustomComponents | null;
      if (c && !n.themeOver[n.colorPreset]) n.themeOver = { ...n.themeOver, [n.colorPreset]: c };
      localStorage.setItem(LS.over, JSON.stringify(n.themeOver));
      localStorage.removeItem(LS.overAntigo);
    }
    const brand = localStorage.getItem(LS.brand);
    if (brand) n.brand = { name: '', logo: '', ...JSON.parse(brand) };
  } catch {}
  return n;
}

/** O painel de uma conta que deixou de ter acesso volta ao primeiro painel permitido */
function noNivelPermitido(next: St): St {
  const allowed = allowedOf(next);
  if (!allowed.includes(next.level)) {
    next = { ...next, level: allowed[0] };
    if (next.deny?.type === 'nivel' && !allowed.includes(next.deny.lv)) {
      next = fromPath(next, '/' + next.level);
    }
  }
  return next;
}

/** Estado com uma leitura do servidor, a abrir `caminhoDesejado` (o endereço com que o painel abriu, na primeira) */
function comDados(cur: St, d: DadosServidor, caminhoDesejado: string): St {
  // domínios internos do sistema (files., supabase-…) fora de todas as listas do painel
  for (const c of Object.values(d.contas)) {
    c.domains = c.domains.filter((x) => dominioVisivel(x.name));
    c.mails = c.mails.filter((m) => dominioVisivel(m.dom));
  }
  const primeira = cur.carga !== 'ok';
  const n0: St = {
    ...cur,
    acc: d.contas,
    login: d.me,
    pessoa: d.pessoa || null,
    stack: primeira ? [] : cur.stack.filter((x) => d.contas[x.u]),
    srv: d.servidor,
    dns: d.dns,
    php: d.php || [],
    lidoEm: d.lidoEm,
    carga: 'ok',
    erro: null,
    db: { ...cur.db, pkgs: d.pacotes, info: d.info },
  };
  // Se o caminho inicial pedido (ex: /admin vindo de outra sessão) não for permitido para esta conta,
  // abre diretamente o nível inicial da conta em vez de mostrar "Sem acesso" logo ao entrar
  const lvDesejado = caminhoDesejado.replace(/^\/+/, '').split('/')[0];
  const caminhoValido = isLevel(lvDesejado) && !allowedOf(n0).includes(lvDesejado) ? '/' + nivelInicial(n0) : caminhoDesejado;
  return fromPath(n0, caminhoValido);
}

const nadaMuda = () => () => {};

/** Lugar de uma página: escondido enquanto as leituras sem nada em memória não acabam; depois avisa (uma vez) */
type RegistarFonte = (chave: string, id: string, fonte: () => ItemPesquisa[]) => () => void;

function PaginaSlot({ p, oculta, onPronta, registar }: { p: Pagina; oculta: boolean; onPronta: (chave: string) => void; registar: RegistarFonte }) {
  const [barra, setBarra] = useState<HTMLDivElement | null>(null);
  const [abasEl, setAbasEl] = useState<HTMLElement | null>(null);
  const faixaAbas = useMemo(() => ({ el: abasEl, set: setAbasEl }), [abasEl]);
  const pesquisa = useMemo(() => ({ registar: (id: string, fonte: () => ItemPesquisa[]) => registar(p.chave, id, fonte) }), [registar, p.chave]);
  const falta = useRef(0);
  const montada = useRef(false);
  const avisada = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const chave = p.chave;
  const verificar = useCallback(() => {
    clearTimeout(timer.current);
    // pequena folga: uma leitura que acaba e outra que começa logo a seguir não abrem a página a meio
    timer.current = setTimeout(() => {
      if (montada.current && falta.current === 0 && !avisada.current) {
        avisada.current = true;
        onPronta(chave);
      }
    }, 40);
  }, [onPronta, chave]);
  const espera = useMemo<Espera>(
    () => ({
      comecar: () => {
        falta.current++;
        let feito = false;
        return () => {
          if (feito) return;
          feito = true;
          falta.current--;
          verificar();
        };
      },
    }),
    [verificar],
  );
  useEffect(() => {
    montada.current = true;
    verificar();
    return () => clearTimeout(timer.current);
  }, [verificar]);
  const corpo = (
    <FalhaPagina t={p.vh.t} onFalha={() => onPronta(chave)}>
      {p.scr.body}
    </FalhaPagina>
  );
  return (
    <div className="pg-slot" style={{ display: oculta ? 'none' : 'contents' }} aria-hidden={oculta || undefined}>
      <VHContext.Provider value={p.vh}>
        <EsperaPagina.Provider value={espera}>
          <PesquisaPagina.Provider value={pesquisa}>
          <BarraPagina.Provider value={barra}>
          <FaixaAbas.Provider value={faixaAbas}>
          {/* pesquisa e botões da página, por cima do cartão (fica escondida enquanto vazia) */}
          <div className="pg-barra" ref={setBarra} />
          {p.semCartao ? (
            corpo
          ) : p.scr.lado ? (
            <div className="da-com-lado">
              <div className="da-main-card">{corpo}</div>
              <aside className="da-lado">
                <FalhaPagina t={p.vh.t} onFalha={() => onPronta(chave)}>
                  {p.scr.lado}
                </FalhaPagina>
              </aside>
            </div>
          ) : (
            <div className="da-main-card">{corpo}</div>
          )}
          </FaixaAbas.Provider>
          </BarraPagina.Provider>
          </PesquisaPagina.Provider>
        </EsperaPagina.Provider>
      </VHContext.Provider>
    </div>
  );
}

/** temSessao: o servidor já viu se há cookie de sessão — sem sessão, a página de entrada aparece logo (sem piscar) */
export function VisualHostApp({ temSessao = true, versao = 'dev' }: { temSessao?: boolean; versao?: string }) {
  // conta os pedidos ao site para a linha de carregamento do topo (antes de o painel pedir os dados)
  useState(() => instalarContador());
  const pathname = usePathname() || BASE;
  // Entrada pelo login do site: o painel abre sem recarregar a página (src/components/auth/LoginForm.tsx), por isso não
  // há página do servidor a acertar — abre logo com a aparência guardada e a leitura que o login acabou de fazer, sem a
  // página branca com a roda (pedido do Silva, 13/10/2026). Aberto pelo endereço, começa como a página do servidor.
  const semServidor = useSyncExternalStore(nadaMuda, () => true, () => false);
  const [st, setSt] = useState<St>(() => {
    const s0 = initialState(stripBase(pathname));
    if (!semServidor) return s0;
    const n = comPreferencias(s0);
    const d = temSessao ? lerCache() : null;
    return d ? noNivelPermitido(comDados(n, d, stripBase(pathname))) : n;
  });
  // página de entrada (sem sessão): modo do tema escolhido lá (claro · automático · escuro) e "a entrar" (roda a girar)
  const [aEntrar, setAEntrar] = useState(false);
  const [semSessao, setSemSessao] = useState(!temSessao);
  const [modoTema, setModoTema] = useState<ModoTema>('light');
  useIsomorphicLayoutEffect(() => {
    try {
      const tm = localStorage.getItem('visualhost_theme');
      setModoTema(tm === 'dark' ? 'dark' : tm === 'auto' ? 'auto' : 'light');
    } catch {}
  }, []);
  /** endereço com que o painel abriu (para o reabrir depois de chegarem os dados do servidor) */
  const inicial = useRef(stripBase(pathname));
  const ref = useRef(st);
  ref.current = st;

  const [modal, setModal] = useState<ReactNode>(null);
  const [toastMsg, setToastMsg] = useState({ text: '', on: false });
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [pop, setPop] = useState<Pop>(null);
  const [search, setSearch] = useState({ open: false, q: '', si: 0 });
  const modalRef = useRef<HTMLDivElement>(null);
  /** há uma janela aberta (o elemento da janela existe sempre, só se mostra com conteúdo) */
  const modalAberto = useRef(false);
  modalAberto.current = !!modal;
  const searchRef = useRef<HTMLInputElement>(null);

  // Grava o estado novo (o painel de uma conta que deixou de ter acesso volta ao primeiro painel permitido)
  const commit = useCallback((next: St) => {
    next = noNivelPermitido(next);
    ref.current = next;
    setSt(next);
  }, []);

  // Claro/escuro do site todo (o painel e o site usam a mesma escolha)
  const siteTema = useTheme();
  /** Cores escolhidas no painel → site inteiro (pedido do Silva a 11/10): aplicadas já neste navegador e gravadas no
   *  servidor para todos os visitantes (o servidor só aceita do administrador) */
  const publicarTema = useCallback(() => {
    const n = ref.current;
    const over = n.themeOver[n.colorPreset];
    const vars = paletaDoSite(getThemeColors(n.colorPreset, n.customPrimary, over).primary);
    aplicarCoresNoSite(vars);
    fetch('/api/vhost/tema', { method: 'POST', headers: { 'Content-Type': 'application/json', ...FUNDO }, body: JSON.stringify({ preset: n.colorPreset, customPrimary: n.customPrimary || undefined, over: over || {}, radius: n.radius, vars }) }).catch(() => {});
  }, []);

  const pushUrl = (path: string, replace = false) => {
    const url = BASE + path;
    if (window.location.pathname !== url) window.history[replace ? 'replaceState' : 'pushState'](null, '', url);
  };

  // Versão nova publicada com o painel aberto (pedido do Silva, 14/10/2026: "o site nunca fica actualizado"): o
  // painel muda de página sem pedir código ao servidor, por isso um separador aberto ficava sempre na versão antiga.
  // Compara-se a versão com que a página abriu com a do servidor (/api/versao): ao voltar ao separador, sem nenhuma
  // janela aberta, recarrega já; de resto, o próximo clique no painel abre a página inteira (já na versão nova).
  const versaoNova = useRef(false);
  useEffect(() => {
    if (versao === 'dev') return;
    let fim = false;
    const verificar = (recarregar: boolean) => {
      if (versaoNova.current || document.hidden) return;
      fetch('/api/versao', { cache: 'no-store', headers: FUNDO })
        .then((r) => (r.ok ? r.json() : null))
        .then((j: { versao?: string } | null) => {
          if (fim || !j?.versao || j.versao === 'dev' || j.versao === versao) return;
          // nunca em ciclo (nada de piscar): só se passa uma vez para cada versão nova neste separador
          try {
            if (sessionStorage.getItem('vh-versao-pedida') === j.versao) return;
            sessionStorage.setItem('vh-versao-pedida', j.versao);
          } catch {}
          versaoNova.current = true;
          if (recarregar && !modalAberto.current) window.location.reload();
        })
        .catch(() => {});
    };
    const aoVoltar = () => !document.hidden && verificar(true);
    const t = setInterval(() => verificar(false), 120_000);
    document.addEventListener('visibilitychange', aoVoltar);
    window.addEventListener('focus', aoVoltar);
    return () => {
      fim = true;
      clearInterval(t);
      document.removeEventListener('visibilitychange', aoVoltar);
      window.removeEventListener('focus', aoVoltar);
    };
  }, [versao]);

  const nav = useCallback(
    (path: string) => {
      const n = fromPath(ref.current, path);
      if (versaoNova.current) {
        window.location.assign(BASE + n.path);
        return;
      }
      commit(n);
      pushUrl(n.path);
      window.scrollTo(0, 0);
    },
    [commit],
  );

  // Botões ainda não ligados ao servidor: o aviso "ainda não ligado" não pode ser tapado pela mensagem de
  // sucesso que o botão mostraria a seguir
  const recusadoEm = useRef(0);
  const toast = useCallback((msg: string) => {
    if (Date.now() - recusadoEm.current < 400) return;
    setToastMsg({ text: translate(ref.current.lang, msg), on: true });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg((m) => ({ ...m, on: false })), 5500);
  }, []);

  const pausarToast = useCallback(() => {
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
      toastTimer.current = undefined;
    }
  }, []);

  const retomarToast = useCallback(() => {
    if (toastMsg.on) {
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToastMsg((m) => ({ ...m, on: false })), 4000);
    }
  }, [toastMsg.on]);

  const fecharToast = useCallback(() => {
    clearTimeout(toastTimer.current);
    setToastMsg((m) => ({ ...m, on: false }));
  }, []);

  const closeM = useCallback(() => setModal(null), []);
  const closeSearch = useCallback(() => setSearch((x) => ({ ...x, open: false })), []);
  const openSearch = useCallback(() => setSearch({ open: true, q: '', si: 0 }), []);
  const closePop = () => setPop(null);

  // Aparência guardada no navegador (tema claro/escuro, separador do painel inicial, cores, cantos e marca);
  // endereço sem ecrã → primeiro painel da conta
  useIsomorphicLayoutEffect(() => {
    commit(comPreferencias(ref.current));
    pushUrl(ref.current.path, true);
    // cores do site escolhidas pelo administrador: valem aqui também, salvo se esta pessoa escolheu outras no painel
    fetch('/api/vhost/tema', { headers: FUNDO })
      .then((r) => r.json())
      .then((j: { tema?: { preset: string; customPrimary?: string; over?: CustomComponents; radius?: string; vars?: Record<string, string> } | null }) => {
        const g = j.tema;
        if (!g) return;
        let local = false;
        try {
          local = !!localStorage.getItem(LS.preset);
        } catch {}
        if (local) return;
        const preset = presetId(g.preset);
        commit({ ...ref.current, colorPreset: preset, customPrimary: g.customPrimary || ref.current.customPrimary, radius: g.radius || ref.current.radius, themeOver: g.over && Object.keys(g.over).length ? { ...ref.current.themeOver, [preset]: g.over } : ref.current.themeOver });
      })
      .catch(() => {});
    const onPop = () => commit(fromPath(ref.current, stripBase(window.location.pathname)));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [commit]);

  // Põe no painel os dados de uma leitura (do servidor, ou a última guardada neste navegador ao abrir)
  const aplicar = useCallback(
    (d: DadosServidor) => {
      const cur = ref.current;
      const primeira = cur.carga !== 'ok';
      const caminhoDesejado = primeira ? inicial.current : cur.path;
      const n = comDados(cur, d, caminhoDesejado);
      commit(n);
      if (primeira || n.path !== caminhoDesejado) pushUrl(n.path, true);
    },
    [commit],
  );

  // Dados reais do servidor (Hestia + registo do site): contas, pacotes, informação, zonas DNS e estado do servidor.
  // Sem sessão no site → pede para iniciar sessão. Depois de uma alteração, volta a ler (fresco).
  const carregar = useCallback(
    async (fresco = false) => {
      // Nunca uma página em branco enquanto se lê o servidor (pedido do Silva): ao abrir, mostra logo a última leitura
      // guardada neste navegador e atualiza por trás quando a resposta chegar
      const daCache = !fresco && ref.current.carga !== 'ok' && temSessao ? lerCache() : null;
      if (daCache) aplicar(daCache);
      try {
        // primeira leitura: a resposta que a página já pediu ao chegar (layout); depois, pedidos normais
        const w = window as typeof window & { __vhDados?: Promise<{ ok: boolean; status: number; j: { erro?: string } }> };
        const pre = !fresco ? w.__vhDados : undefined;
        if (pre) delete w.__vhDados;
        let r: { ok: boolean; status: number };
        let j: { erro?: string };
        if (pre) {
          const fim = atividadeComeca();
          try {
            const timeoutPre = new Promise<{ ok: boolean; status: number; j: { erro?: string } }>((resolve) =>
              setTimeout(() => resolve({ ok: false, status: 0, j: { erro: 'Timeout' } }), 9000),
            );
            const res = await Promise.race([pre, timeoutPre]);
            if (res && res.status !== 0) {
              ({ j, ...r } = res);
            } else {
              const ctrl = new AbortController();
              const tid = setTimeout(() => ctrl.abort(), 10000);
              try {
                const resF = await fetch('/api/vhost/dados' + (fresco ? '?fresco=1' : ''), { cache: 'no-store', signal: ctrl.signal });
                r = resF;
                j = await resF.json().catch(() => ({}));
              } finally {
                clearTimeout(tid);
              }
            }
          } finally {
            fim();
          }
        } else {
          const ctrl = new AbortController();
          const tid = setTimeout(() => ctrl.abort(), 10000);
          try {
            const res = await fetch('/api/vhost/dados' + (fresco ? '?fresco=1' : ''), { cache: 'no-store', signal: ctrl.signal });
            r = res;
            j = await res.json().catch(() => ({}));
          } finally {
            clearTimeout(tid);
          }
        }
        if (!r.ok) {
          if (r.status === 401 || r.status === 403) apagarCache();
          // servidor lento ou em baixo com o painel já à vista (da última leitura): fica como está
          else if (ref.current.carga === 'ok') return;
          setAEntrar(false);
          commit({ ...ref.current, carga: 'erro', erro: { msg: j.erro || 'Não foi possível ler o servidor.', codigo: r.status } });
          return;
        }
        const d = j as DadosServidor;
        guardarCache(d);
        aplicar(d);
      } catch {
        if (ref.current.carga === 'ok') return; // o painel já está à vista (última leitura): fica como está
        setAEntrar(false);
        commit({ ...ref.current, carga: 'erro', erro: { msg: 'O servidor demorou a responder. Verifique a ligação e tente de novo.', codigo: 0 } });
      }
    },
    [commit, aplicar, temSessao],
  );
  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeM();
        closeSearch();
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        openSearch();
      }
    };
    const onClick = (e: MouseEvent) => {
      const el = e.target as Element | null;
      if (!el?.closest?.('#pop') && !el?.closest?.('.rb.lang') && !el?.closest?.('#acct')) setPop(null);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('click', onClick);
    };
  }, [closeM, closeSearch, openSearch]);

  useEffect(() => {
    if (modal) modalRef.current?.querySelector('input')?.focus();
  }, [modal]);
  useEffect(() => {
    if (search.open) searchRef.current?.focus();
  }, [search.open]);
  useEffect(() => {
    document.querySelector('#splist .sp-it.on')?.scrollIntoView({ block: 'nearest' });
  }, [search.si, search.q]);

  // ---------- Estado visto pelos ecrãs ----------
  const me = meOf(st);
  const a: Account = acctOf(st);
  // Quem aparece no cabeçalho e no rodapé, sempre automático: na própria conta, a pessoa que entrou (perfil do site: nome,
  // e-mail, empresa); ao "entrar como" outra conta, os dados dessa conta. Nos painéis dos clientes, a empresa no lugar de
  // "Dashboard" (pedido do Silva: "Olá, Silva" e "Silva Chamo" no rodapé, não o nome da conta do servidor)
  const eu = me === st.login && st.pessoa?.nome ? st.pessoa : null;
  const pessoaNome = (eu?.nome || a.name || me).trim();
  const pessoaEmail = eu?.email || a.email || '';
  const empresa = ((eu ? eu.empresa : a.empresa) || '').trim();
  // sem empresa no perfil, o nome da conta (ex.: "Oshercollective")
  const tituloPainel = a.role !== 'admin' ? empresa || me.charAt(0).toUpperCase() + me.slice(1) : 'Dashboard';
  const allowed = allowedOf(st);
  const level = allowed.includes(st.level) ? st.level : allowed[0];
  const missing = !st.deny && !SCREENS[GLOBAL[st.page] ? st.page : level + '/' + st.page] && !(GLOBAL[st.page] ? gItem(st) : findItem(level, st.page));
  const s: St = { ...st, level, deny: st.deny || (missing ? { type: '404' } : null) };
  const t = (text: string) => translate(st.lang, text);
  const go = (id: string) => nav(route(level, id));
  const setLevel = (l: Level) => nav('/' + l);

  const recusarLocal = () => {
    recusadoEm.current = 0;
    toast('Ainda não ligado ao servidor: nada foi alterado');
    recusadoEm.current = Date.now();
  };

  // Sair: termina a sessão e mostra logo a página de entrada, sem perguntar nem recarregar (pedido do Silva: a página
  // piscava entre dois ecrãs antes do formulário). Quem entrou pelo login do site volta ao login do site (pedido do
  // Silva, 13/10/2026); quem entrou pelo login do painel fica na entrada do painel.
  const sair = async () => {
    apagarCache();
    const entrada = tirarEntrada();
    try {
      await auth.signOut();
    } catch {}
    if (entrada === 'site') {
      window.location.assign('/login');
      return;
    }
    setAEntrar(false);
    setSemSessao(true);
    setModal(null);
    inicial.current = '/';
    commit({ ...ref.current, carga: 'erro', erro: { msg: 'Inicie sessão no site.', codigo: 401 } });
    window.history.replaceState(null, '', BASE);
  };

  const vh: VH = {
    s,
    t,
    me,
    a,
    allowed,
    hasFeat: (f) => hasFeatOf(st, f),
    nav,
    go,
    setLevel,
    toast,
    openM: (content) => setModal(content),
    closeM,
    // As contas, os pacotes de cliente e a informação das contas são do servidor: só mudam por /api/vhost/acoes.
    // Um botão que ainda os mude só no navegador é recusado (nada muda e aparece o aviso).
    updateAcc: (fn) => {
      const acc = structuredClone(ref.current.acc);
      fn(acc);
      if (JSON.stringify(acc) !== JSON.stringify(ref.current.acc)) recusarLocal();
    },
    updateDb: (fn) => {
      const cur = ref.current;
      const acc = structuredClone(cur.acc);
      const db = structuredClone(cur.db);
      fn(db, acc);
      const servidor = (x: St['db'], a: St['acc']) => JSON.stringify([a, x.pkgs, x.custom, x.info]);
      if (servidor(db, acc) !== servidor(cur.db, cur.acc)) return recusarLocal();
      commit({ ...cur, db });
    },
    recarregar: (fresco = true) => carregar(fresco),
    enterAs: (u) => {
      const cur = ref.current;
      // domínio vazio → a página abre no domínio principal da conta que se está a ver
      const n0: St = { ...cur, dominio: '', stack: [...cur.stack, { u, lv: level, pg: cur.page }] };
      const lv = nivelInicial(n0);
      const n = fromPath({ ...n0, level: lv }, '/' + lv);
      commit(n);
      pushUrl(n.path);
      toast('Está a ver o painel de ' + u);
    },
    backToMine: () => {
      const cur = ref.current;
      const b = cur.stack[cur.stack.length - 1];
      const n = fromPath({ ...cur, stack: cur.stack.slice(0, -1), level: b.lv }, route(b.lv, b.pg));
      commit(n);
      pushUrl(n.path);
      toast('De volta ao seu painel');
    },
    setDashTab: (tab) => {
      // "Menu" mostra todas as páginas em cartões: as categorias abertas do menu lateral fecham-se (a deslizar)
      commit({ ...ref.current, dashTab: tab, ...(tab === 'menu' ? { open: {} } : {}) });
      try {
        localStorage.setItem('visualhost_dashtab', tab);
      } catch {}
    },
    setNotes: (on) => commit({ ...ref.current, notes: on }),
    setLang: (l: Lang) => {
      commit({ ...ref.current, lang: l });
      try {
        localStorage.setItem(LINGUA_LS, l);
      } catch {}
      closePop();
      toast(l === 'en' ? 'Language: English' : 'Idioma: Português');
    },
    toggleTheme: () => {
      const dark = ref.current.theme !== 'dark';
      const theme = dark ? 'dark' : 'light';
      commit({ ...ref.current, theme });
      try {
        localStorage.setItem('visualhost_theme', theme);
      } catch {}
      siteTema.setTheme(theme); // o site todo fica no mesmo modo
      toast(dark ? 'Tema escuro' : 'Tema claro');
    },
    // Cores: o tema escolhido e as cores mudadas à mão em cada tema ficam guardados no navegador
    setColorPreset: (id, customPrimary) => {
      const cp = customPrimary ?? ref.current.customPrimary;
      const colorPreset = presetId(id);
      commit({ ...ref.current, colorPreset, customPrimary: cp, themePreview: null });
      try {
        localStorage.setItem(LS.preset, colorPreset);
        if (cp) localStorage.setItem(LS.customPrimary, cp);
      } catch {}
      publicarTema();
      toast('Tema de cores aplicado');
    },
    saveThemeColors: (c) => {
      const k = ref.current.colorPreset;
      const themeOver = { ...ref.current.themeOver };
      if (c && Object.keys(c).length) themeOver[k] = c;
      else delete themeOver[k];
      commit({ ...ref.current, themeOver, themePreview: null });
      try {
        localStorage.setItem(LS.over, JSON.stringify(themeOver));
      } catch {}
      publicarTema();
      toast(c ? 'Cores guardadas neste tema' : 'Cores do tema repostas');
    },
    previewThemeColors: (c) => commit({ ...ref.current, themePreview: c }),
    setRadius: (r) => {
      commit({ ...ref.current, radius: r });
      try {
        localStorage.setItem(LS.radius, r);
      } catch {}
      publicarTema();
      toast('Cantos atualizados');
    },
    setDominio: (d, aviso = true) => {
      commit({ ...ref.current, dominio: d });
      if (aviso) toast('Domínio: ' + d);
    },
    setBrand: (b) => {
      commit({ ...ref.current, brand: b });
      try {
        localStorage.setItem(LS.brand, JSON.stringify(b));
      } catch {}
      toast('Marca guardada');
    },
    openSearch,
    logout: () => {
      sair();
    },
  };

  const screenKey = GLOBAL[s.page] ? (s.gsub ? s.page + '/' + s.gsub : s.page) : level + '/' + s.page;
  const scr = s.deny ? denyScreen(vh) : (SCREENS[screenKey] || SCREENS[s.page] || placeholder)(vh);
  const title = t(scr.title);
  const desc = scr.desc !== undefined ? t(scr.desc) : descFor(s);
  const home = s.page === 'inicio' && !s.deny;
  const sec = GLOBAL[s.page]?.sub ? GLOBAL[s.page] : null;

  // Troca de página como no DirectAdmin: a página nova prepara-se escondida e só substitui a anterior (título,
  // botões, caminho e conteúdo) quando as suas leituras acabam; com tudo em memória troca logo. Nunca espera > 10 s.
  // O domínio escolhido no seletor conta como página nova (pedido do Silva, 12/10): sem isto, mudar de domínio na
  // mesma página apagava o conteúdo e deixava-a vazia até chegarem os dados do domínio novo.
  const semCartao = (s.page === 'inicio' || !s.page) && s.dashTab !== 'menu' && !s.deny;
  const chavePag = st.path + (st.dominio ? '@' + st.dominio : '') + (s.deny ? '#' + s.deny.type : '') + (semCartao ? '' : '#cartao');
  const atual: Pagina = { chave: chavePag, ok: st.carga === 'ok', vh, scr, title, desc, semCartao, deny: !!s.deny, home };
  const pronta = useRef<Pagina | null>(null);
  const liberada = useRef('');
  const chaveAtual = useRef(chavePag);
  chaveAtual.current = chavePag;
  const [, refazer] = useReducer((x: number) => x + 1, 0);
  const aEspera = !!pronta.current && pronta.current.ok && atual.ok && pronta.current.chave !== chavePag && liberada.current !== chavePag;
  if (!aEspera) pronta.current = atual;
  const mostra = pronta.current || atual;
  // título e descrição da barra de cima: a letra diminui até caber, nunca cortados com "…"
  useTituloAjustado(mostra.chave + '|' + mostra.title + '|' + mostra.desc);
  // Lupa da barra de cima (pedido do Silva, 13/10/2026): procura na página aberta — as tabelas registam-se por página
  const fontesPag = useRef(new Map<string, Map<string, () => ItemPesquisa[]>>());
  const registarFonte = useCallback<RegistarFonte>((chave, id, fonte) => {
    const m = fontesPag.current.get(chave) || new Map<string, () => ItemPesquisa[]>();
    m.set(id, fonte);
    fontesPag.current.set(chave, m);
    return () => {
      const mm = fontesPag.current.get(chave);
      if (mm?.get(id) === fonte) mm.delete(id);
      if (mm && !mm.size) fontesPag.current.delete(chave);
    };
  }, []);
  const [pesqPag, setPesqPag] = useState({ aberta: false, q: '', i: 0 });
  // página inicial (ou página sem tabelas): funcionalidades do painel e domínios da conta
  const itensGerais = (q: string): ItemPesquisa[] => {
    const qq = q.trim().toLowerCase();
    return [
      ...searchResults(s, q).map((h) => ({ k: 'f:' + h.path, txt: t(h.it.t), sub: (h.lv ? t(LEVELS[h.lv]) + ' › ' : '') + t(h.g), fa: ico(h.it.fa), c: h.it.c, ir: () => nav(h.path) })),
      ...a.domains
        .filter((d) => !qq || d.name.includes(qq))
        .slice(0, qq ? 20 : 5)
        .map((d) => ({ k: 'd:' + d.name, txt: d.name, sub: t('Domínio'), fa: 'fa-solid fa-globe', c: 'c3', ir: () => nav('/' + s.level + '/dominios/' + encodeURIComponent(d.name)) })),
    ];
  };
  useEffect(() => setPesqPag((x) => (x.aberta ? { aberta: false, q: '', i: 0 } : x)), [mostra.chave]);
  const libertar = useCallback((k: string) => {
    if (k !== chaveAtual.current || liberada.current === k) return;
    liberada.current = k;
    refazer();
  }, []);
  useEffect(() => {
    if (!aEspera) return;
    const tm = setTimeout(() => libertar(chavePag), 10_000);
    return () => clearTimeout(tm);
  }, [aEspera, chavePag, libertar]);

  const toggleGrp = (k: string) => {
    const willOpen = !st.open[k];
    commit({ ...ref.current, open: willOpen ? { [k]: true } : { ...ref.current.open, [k]: false } });
  };
  const openPop = (kind: 'lang' | 'conta', el: HTMLElement) => {
    const r = el.getBoundingClientRect();
    setPop(kind === 'lang' ? { kind, left: r.right + 8, top: r.top } : { kind, left: r.right + 8, bottom: window.innerHeight - r.bottom });
  };

  const results = search.open ? searchResults(s, search.q) : [];
  const pickSearch = (i: number) => {
    const x = results[i];
    if (!x) return;
    closeSearch();
    nav(x.path);
  };
  const searchKey = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    const n = results.length;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSearch((x) => ({ ...x, si: Math.min(x.si + 1, n - 1) }));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSearch((x) => ({ ...x, si: Math.max(x.si - 1, 0) }));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pickSearch(search.si);
    }
  };

  // Cores do tema escolhido, com as cores mudadas à mão nesse tema (ou as que estão a ser editadas), e cantos
  const over = st.themePreview || st.themeOver[st.colorPreset];
  // Sessão: nunca pede para entrar enquanto se mexe no painel (os pedidos /api/vhost renovam-na — src/proxy.ts); ao fim
  // de 20 minutos sem tocar em nada (em nenhum separador), termina a sessão e mostra a página de entrada
  useEffect(() => {
    if (st.carga !== 'ok') return;
    if (!SAIR_POR_INATIVIDADE_ATIVO) return; // desligado por agora (ver session-inactivity.ts)
    const LIMITE = 20 * 60_000;
    const K = 'vh-ultimo-toque';
    let ultimo = Date.now();
    let gravado = 0;
    const toque = () => {
      ultimo = Date.now();
      if (ultimo - gravado < 15_000) return;
      gravado = ultimo;
      try {
        localStorage.setItem(K, String(ultimo));
      } catch {}
    };
    toque();
    const evs = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'] as const;
    evs.forEach((e) => window.addEventListener(e, toque, { passive: true, capture: true }));
    const iv = setInterval(async () => {
      let outro = 0;
      try {
        outro = Number(localStorage.getItem(K)) || 0;
      } catch {}
      if (Date.now() - Math.max(ultimo, outro) < LIMITE) return;
      clearInterval(iv);
      try {
        await auth.signOut();
      } catch {}
      setAEntrar(false);
      // como no DA: a entrada mostra o caminho da página onde estava e volta para lá depois de entrar
      inicial.current = ref.current.path || '/';
      commit({ ...ref.current, carga: 'erro', erro: { msg: 'Sessão terminada por inatividade.', codigo: 401 } });
    }, 30_000);
    return () => {
      evs.forEach((e) => window.removeEventListener(e, toque, { capture: true }));
      clearInterval(iv);
    };
  }, [st.carga, commit]);

  const colors = getThemeColors(st.colorPreset, st.customPrimary, over);
  const isDark = st.theme === 'dark';
  // O modo claro/escuro é o do site todo (classe "dark" no <html>): o painel aplica-o e não o desfaz ao sair
  useEffect(() => {
    const h = document.documentElement;
    h.classList.toggle('dark', isDark);
    h.style.colorScheme = isDark ? 'dark' : 'light';
  }, [isDark]);
  const rgbPrim = hexToRgb(colors.primary);
  const darkGlassRail = rgbPrim && st.colorPreset !== 'black' && st.colorPreset !== 'puro_black'
    ? `rgba(${rgbPrim.r}, ${rgbPrim.g}, ${rgbPrim.b}, 0.16)`
    : 'rgba(255, 255, 255, 0.06)';
  // No escuro, a barra compacta adapta-se: a cor do Personalizar só fica se já for escura; uma cor clara (ex.: cinzento)
  // passa ao vidro escuro do tema, com os ícones claros
  const railAdapta = isDark && (!over?.railBg || luminancia(colors.railBg) > 0.35);
  const railBg = railAdapta ? darkGlassRail : colors.railBg;
  const badge = badgeColors(railBg, colors.primary);
  const themeStyles: Record<string, string> = {
    '--red': colors.primary,
    '--red-d': colors.dark,
    '--tint': isDark ? colors.tintDark : colors.tint,
    '--ok': colors.safe,
    '--warn': colors.warning,
    '--rail-bg': railBg,
    '--railon': railAdapta ? 'rgba(255, 255, 255, 0.10)' : colors.railOn,
    '--railhov': railAdapta ? 'rgba(255, 255, 255, 0.06)' : colors.railHov,
    '--rail-ink': railAdapta && luminancia(colors.railInk) < 0.4 ? '#CBD5E1' : colors.railInk,
    '--rail-ink-hover': colors.railInkHover,
    '--rail-ink-on': colors.railInkOn,
    '--btn': colors.botoes,
    '--btn-d': colors.botoesD,
    '--btn-ink': colors.botoesInk,
    ...(badge ? { '--rail-badge-bg': badge.bg, '--rail-badge-ink': badge.ink } : {}),
    '--r': st.radius || '4px',
  };
  const logo = st.brand.logo || LOGO;
  const marca = st.brand.name.trim() || 'VisualHost';

  // Enquanto os dados do servidor não chegam: a página branca com a roda (como no DA), sem esqueleto — o painel aparece
  // já com o menu. Sem sessão: a página de entrada. Sem acesso / servidor indisponível: aviso com o que fazer a seguir.
  if (st.carga !== 'ok') {
    const er = st.erro;
    // sem sessão (cookie visto já no servidor) ou sessão recusada: a página de entrada no modelo do DA, sem piscar
    const entrada = er?.codigo === 401 || (!er && !aEntrar && semSessao);
    if (!er && !entrada) return (
      <div className="vh" data-theme={st.theme} style={themeStyles as React.CSSProperties} lang="pt-PT" suppressHydrationWarning>
        <EsperaEntrada />
      </div>
    );
    if (entrada)
      return (
        <div className="vh" data-theme={st.theme} style={themeStyles as React.CSSProperties} lang={st.lang === 'en' ? 'en' : 'pt-PT'} suppressHydrationWarning>
          <EntradaPainel
            escuro={isDark}
            modo={modoTema}
            lang={st.lang}
            voltarA={inicial.current && inicial.current !== '/' ? BASE + inicial.current : undefined}
            onModo={(m) => {
              setModoTema(m);
              const dark = m === 'dark' || (m === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
              commit({ ...ref.current, theme: dark ? 'dark' : 'light' });
              siteTema.setTheme(dark ? 'dark' : 'light');
              try {
                localStorage.setItem('visualhost_theme', m);
              } catch {}
            }}
            onLang={(l) => {
              commit({ ...ref.current, lang: l });
              try {
                localStorage.setItem(LINGUA_LS, l);
              } catch {}
            }}
            onEntrou={() => {
              setAEntrar(true);
              setSemSessao(false);
              commit({ ...ref.current, carga: 'a-carregar', erro: null });
              // usa a leitura guardada no servidor (abre logo); se tiver mais de 1 min, atualiza por trás, sem roda
              carregar().then(() => {
                const lido = ref.current.carga === 'ok' && ref.current.lidoEm ? Date.parse(ref.current.lidoEm) : 0;
                if (lido && Date.now() - lido > 60_000) carregar(true);
              });
            }}
          />
        </div>
      );
    const aviso =
      er?.codigo === 403
          ? { fa: 'fa-user-lock', titulo: er.msg, texto: 'Se acha que é um engano, fale connosco: ligamos a sua conta ao servidor.', botao: <a className="btn g" href="/"><i className="fa-solid fa-arrow-left" />{t('Voltar ao site')}</a> }
          : { fa: 'fa-plug-circle-xmark', titulo: er?.msg || '', texto: 'O servidor não respondeu a tempo. Os seus dados estão seguros.', botao: (
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button className="btn r" onClick={() => { commit({ ...ref.current, carga: 'a-carregar', erro: null }); carregar(); }}><i className="fa-solid fa-rotate" />{t('Tentar de novo')}</button>
                <button className="btn g" onClick={() => { setAEntrar(false); setSemSessao(true); commit({ ...ref.current, carga: 'a-carregar', erro: null }); }}><i className="fa-solid fa-arrow-left" />{t('Voltar à entrada')}</button>
              </div>
            ) };
    return (
      <div className="vh" data-theme={st.theme} style={themeStyles as React.CSSProperties} lang="pt-PT" suppressHydrationWarning>
        <BarraTopo />
        <div className="app espera">
          <aside className="sidebar">
            <div className="rail">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="rlogo" src={logo} alt={marca} style={st.brand.logo ? { objectFit: 'contain' } : undefined} />
              <div className="grow" />
            </div>
            <div className="navcol">
              <div className="navhead">
                <h1 className="dash">Dashboard</h1>
                <p>{t('Painel de alojamento')}</p>
              </div>
              <nav className="side" />
            </div>
          </aside>
          <div className="right">
            <header className="top">
              <div className="ptitle">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="only-m" src={logo} alt="" />
                <div className="bt">
                  <h1>{t('Painel VisualHost')}</h1>
                </div>
              </div>
              <div className="sp" />
              <div className="topact">
                <button className="btn g iconbtn" onClick={vh.toggleTheme} title={t('Tema claro/escuro')}>
                  <i className={'fa-solid ' + (st.theme === 'dark' ? 'fa-sun' : 'fa-moon')} />
                </button>
              </div>
            </header>
            <main id="main">
              <div className="card espera-msg" id="espera">
                <i className={'fa-solid ' + aviso.fa + ' big'} />
                <b>{t(aviso.titulo)}</b>
                <p>{t(aviso.texto)}</p>
                {aviso.botao}
              </div>
            </main>
          </div>
        </div>
      </div>
    );
  }

  return (
    <VHContext.Provider value={vh}>
      <div className="vh" data-theme={st.theme} style={themeStyles as React.CSSProperties} lang={st.lang === 'en' ? 'en' : 'pt-PT'} suppressHydrationWarning>
        <BarraTopo />
        <div className="app">
          <aside className="sidebar">
            {/* Barra de ícones: símbolo · mensagens · perfil · preferências · idioma · pesquisa */}
            <div className="rail" id="rail">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="rlogo" src={logo} alt={marca} title={marca + ' — Dashboard'} onClick={() => go('inicio')} style={st.brand.logo ? { objectFit: 'contain' } : undefined} />
              <div className={'rb' + (s.page === 'mensagens-sistema' ? ' on' : '')} title={t('Mensagens')} onClick={() => go('mensagens-sistema')}>
                <i className="fa-solid fa-comment-dots" />
              </div>
              <div className={'rb' + (s.page === 'perfil' ? ' on' : '')} title={t('Perfil')} onClick={() => go('perfil')}>
                <i className="fa-solid fa-user" />
              </div>
              <div className={'rb' + (s.page === 'preferencias' ? ' on' : '')} title={t('Preferências')} onClick={() => go('preferencias')}>
                <i className="fa-solid fa-gear" />
              </div>
              <div className="rb lang" title={t('Idioma')} onClick={(e) => openPop('lang', e.currentTarget)}>
                <i className="fa-solid fa-globe" />
                <b>{st.lang.toUpperCase()}</b>
              </div>
              <div className="rb" title={t('Pesquisar funcionalidades (Ctrl+K)')} onClick={openSearch}>
                <i className="fa-solid fa-magnifying-glass" />
              </div>
              <div className="grow" />
              {/* Sair também aqui, no fundo, ao lado do avatar (como no DA) — o da barra de cima fica */}
              <div className="rb sair" title={t('Sair')} onClick={vh.logout}>
                <i className="fa-solid fa-right-from-bracket fa-flip-horizontal" />
              </div>
            </div>

            <div className="navcol">
              <div className="navhead" id="navhead">
                <h1 className={'dash' + (home ? ' on' : '')} onClick={() => go('inicio')} title={t('Ir para o Dashboard')}>
                  {tituloPainel}
                </h1>
                <p>{t('Olá, ' + pessoaNome.split(' ')[0])}</p>
              </div>
              <div className="lvl" id="lvl" style={allowed.length > 1 ? undefined : { display: 'none' }}>
                {allowed.map((k) => (
                  <button key={k} className={level === k && !sec ? 'on' : ''} onClick={() => setLevel(k)} title={t(LEVELS[k])}>
                    {t(LEVELS[k])}
                  </button>
                ))}
              </div>
              {/* Menu em categorias que abrem e fecham; sem a secção Início (o painel abre pelo símbolo ou por "Dashboard") */}
              <nav className="side" id="side">
                {sec ? (
                  <>
                    <div className="grp open static">
                      <span>{t(sec.t)}</span>
                    </div>
                    <div className="items">
                      <div className="in">
                        {sec.sub!.map((x) => (
                          <a key={x.id} className={s.gsub === x.id ? 'on' : ''} onClick={() => nav('/' + s.page + '/' + x.id)}>
                            <span className={'ic ' + x.c}>
                              <i className={ico(x.fa)} />
                            </span>
                            <span className="lb" title={t(x.t)}>
                              {t(x.t)}
                            </span>
                          </a>
                        ))}
                      </div>
                    </div>
                  </>
                ) : (
                  MENU[level]
                    .filter(([g]) => g !== 'Início')
                    .map(([g, items]) => {
                      const vis = items.filter((it) => vh.hasFeat(it.feat));
                      if (!vis.length) return null;
                      const k = level + '/' + g;
                      return (
                        <Fragment key={k}>
                          <button className={'grp' + (st.open[k] ? ' open' : '')} onClick={() => toggleGrp(k)}>
                            <span>{t(g)}</span>
                            <i className="fa-solid fa-chevron-down chev" />
                          </button>
                          <div className="items">
                            <div className="in">
                              {vis.map((it) => (
                                <a key={it.id} className={!GLOBAL[s.page] && s.page === it.id ? 'on' : ''} onClick={() => go(it.id)}>
                                  <span className={'ic ' + it.c}>
                                    <i className={ico(it.fa)} />
                                  </span>
                                  <span className="lb" title={t(it.t)}>
                                    {t(it.t)}
                                  </span>
                                  {it.opt && <em>{t('opc.')}</em>}
                                </a>
                              ))}
                            </div>
                          </div>
                        </Fragment>
                      );
                    })
                )}
              </nav>
              <div className="acct" id="acct" title={t('Conta')} onClick={(e) => openPop('conta', e.currentTarget)}>
                {/* foto do primeiro e-mail com Gravatar: o da conta, o do perfil de quem entrou, o da conta de entrada; senão as iniciais */}
                <Avatar a={{ ...a, name: pessoaNome }} outros={[pessoaEmail, st.pessoa?.email, st.acc[st.login]?.email]} />
                <div className="ai">
                  <span>
                    <b>{pessoaNome}</b>
                  </span>
                  <small title={pessoaEmail}>{pessoaEmail}</small>
                </div>
              </div>
            </div>
          </aside>

          <div className="right">
            <header className="top">
              <div className="ptitle">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="only-m" src={logo} alt="" style={st.brand.logo ? { objectFit: 'contain' } : undefined} />
                <div className="bt">
                  <h1 id="ptitle" title={mostra.title}>
                    {mostra.title}
                  </h1>
                  <small id="pdesc" title={mostra.desc}>
                    {mostra.scr.descEl ?? mostra.desc}
                  </small>
                </div>
              </div>
              {/* na maquete esta faixa existe (vazia) no painel inicial e ocupa um espaço de 16px na barra */}
              {mostra.home && <div className="dash-tabs-bar" id="dashtabs" style={{ display: 'flex' }} />}
              <div className="sp" />
              <div className="topact">
                <span id="pageact" className="topact">
                  {mostra.scr.actions}
                </span>
                <span id="topfix" className="topact">
                  {/* Busca: procura na página aberta (o cartão desliza por baixo da faixa do seletor) */}
                  <button className={'btn g lupa-topo' + (pesqPag.aberta ? ' on' : '')} onClick={() => setPesqPag((x) => ({ aberta: !x.aberta, q: '', i: 0 }))} title={t(mostra.home ? 'Pesquisar no painel' : 'Pesquisar nesta página')}>
                    <i className="fa-solid fa-magnifying-glass" />
                    {t('Busca')}
                  </button>
                  {/* Sair fica na barra compacta, ao lado do avatar; no telemóvel (sem barra compacta) fica só o ícone aqui */}
                  <button className="btn g iconbtn only-m" onClick={vh.logout} title={t('Sair')} aria-label={t('Sair')}>
                    <i className="fa-solid fa-right-from-bracket fa-flip-horizontal" />
                  </button>
                  <button className="btn g iconbtn" onClick={vh.toggleTheme} title={t('Tema claro/escuro')}>
                    <i className={'fa-solid ' + (st.theme === 'dark' ? 'fa-sun' : 'fa-moon')} />
                  </button>
                </span>
              </div>
            </header>
            <main id="main">
              <ImpBanner />
              {!mostra.deny && <SwitcherBar title={mostra.scr.title} crumbs={mostra.scr.crumbs} dominios={mostra.scr.dominios} dominioUrl={mostra.scr.dominioUrl} />}
              {pesqPag.aberta && !mostra.deny && (
                <PesquisaNaPagina
                  t={t}
                  gerais={itensGerais}
                  geral={mostra.home}
                  titulo={mostra.title}
                  fontes={() => [...(fontesPag.current.get(mostra.chave)?.values() || [])].flatMap((f) => f())}
                  estado={pesqPag}
                  mudar={setPesqPag}
                  abrirPopup={(q) => {
                    setPesqPag({ aberta: false, q: '', i: 0 });
                    setSearch({ open: true, q, si: 0 });
                  }}
                />
              )}
              {(aEspera ? [mostra, atual] : [atual]).map((p) => (
                <PaginaSlot key={p.chave} p={p} oculta={aEspera && p === atual} onPronta={libertar} registar={registarFonte} />
              ))}
              {!mostra.deny && <RouteFoot />}
            </main>
          </div>
        </div>

        {/* Barra de baixo (só no telemóvel) */}
        <nav className="tabbar" id="tabbar">
          {[...TABBAR[level], ['mais', 'fa-bars', 'Mais'] as [string, string, string]].map(([id, fa, label]) => (
            <a key={id} className={s.page === id ? 'on' : ''} onClick={() => (id === 'mais' ? setModal(<MoreMenuModal />) : go(id))}>
              <i className={'fa-solid ' + fa} />
              {t(label)}
            </a>
          ))}
        </nav>

        <div className={'modal-bg' + (modal ? ' on' : '')} id="mbg" onClick={(e) => e.target === e.currentTarget && closeM()}>
          <div className="modal" id="modal" ref={modalRef}>
            {modal}
          </div>
        </div>
        <div
          className={'toast' + (toastMsg.on ? ' on' : '')}
          id="toast"
          onMouseEnter={pausarToast}
          onMouseLeave={retomarToast}
          onTouchStart={pausarToast}
          onTouchEnd={retomarToast}
        >
          <span>{toastMsg.text}</span>
          {toastMsg.on && (
            <button
              type="button"
              className="toast-fechar"
              onClick={fecharToast}
              title={t('Fechar notificação')}
              aria-label="Fechar"
            >
              &times;
            </button>
          )}
        </div>

        {/* Pequenos menus da barra de ícones (idioma) e da conta */}
        <div className={'pop' + (pop ? ' on' : '')} id="pop" style={pop ? { left: pop.left, top: pop.top, bottom: pop.bottom } : undefined}>
          {pop?.kind === 'lang' &&
            (
              [
                ['pt', 'Português'],
                ['en', 'English'],
              ] as const
            ).map(([k, label]) => (
              <a key={k} onClick={() => vh.setLang(k)}>
                <span>{label}</span>
                {st.lang === k && <i className="fa-solid fa-check" />}
              </a>
            ))}
          {pop?.kind === 'conta' && (
            <>
              <div className="pop-acct">
                <b>{pessoaNome}</b>
                <span>{pessoaEmail}</span>
                <span>
                  {me} · {ROLES[a.role]}
                  {isUser(a.role) ? ' · ' + a.pkg : ''}
                </span>
              </div>
              <a
                onClick={() => {
                  closePop();
                  go('perfil');
                }}
              >
                <span>{t('Perfil')}</span>
                <i className="fa-solid fa-user" />
              </a>
              <a
                onClick={() => {
                  closePop();
                  go('preferencias');
                }}
              >
                <span>{t('Preferências')}</span>
                <i className="fa-solid fa-gear" />
              </a>
              <a
                onClick={() => {
                  closePop();
                  vh.logout();
                }}
              >
                <span>{t('Sair')}</span>
                <i className="fa-solid fa-right-from-bracket" />
              </a>
            </>
          )}
        </div>

        <div className={'sp-bg' + (search.open ? ' on' : '')} id="spbg" onClick={(e) => e.target === e.currentTarget && closeSearch()}>
          <div className="spop" id="spop">
            <div className="sp-in">
              <i className="fa-solid fa-magnifying-glass" />
              <input
                ref={searchRef}
                placeholder={t('Pesquisar funcionalidades (ex.: e-mail, dns, backup)')}
                autoComplete="off"
                value={search.q}
                onChange={(e) => setSearch({ open: true, q: e.target.value, si: 0 })}
                onKeyDown={searchKey}
              />
              <button onClick={closeSearch} title={t('Fechar')}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <div className="sp-list" id="splist">
              {results.length ? (
                results.map((x, i) => (
                  <div key={x.path} className={'sp-it' + (i === search.si ? ' on' : '')} onMouseEnter={() => setSearch((q) => ({ ...q, si: i }))} onClick={() => pickSearch(i)}>
                    <span className={'ic ' + x.it.c}>
                      <i className={ico(x.it.fa)} />
                    </span>
                    <div>
                      <b>{t(x.it.t)}</b>
                      <span>
                        {x.lv ? t(LEVELS[x.lv]) + ' › ' : ''}
                        {t(x.g)}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="sp-empty">{t('Nenhuma funcionalidade encontrada')}</div>
              )}
            </div>
            <div className="sp-foot">
              <span>
                <kbd>↵</kbd>
                {t('abrir')}
              </span>
              <span>
                <kbd>↑</kbd>
                <kbd>↓</kbd>
                {t('navegar')}
              </span>
              <span>
                <kbd>Esc</kbd>
                {t('fechar')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </VHContext.Provider>
  );
}
