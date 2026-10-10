'use client';

// Painel VisualHost — versão React da maquete aprovada (VisualHost/maquete-visualhost.html).
// Mesma estrutura de HTML e mesmas classes, para o CSS da maquete (generated/maquete.css) se aplicar tal e qual.
import { Fragment, useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { VHContext, type VH } from './context';
import { GLOBAL, LEVELS, MENU, ROLES } from './generated/data';
import { dominioVisivel, type DadosServidor } from './servidor';
import { translate, type Lang } from './i18n';
import { LogoutModal, MoreMenuModal } from './modals';
import { SCREENS, denyScreen, placeholder } from './screens';
import { badgeColors, getThemeColors, hexToRgb, type CustomComponents } from './theme';

/** nomes antigos dos temas → nome atual (as cores gravadas ficam sempre no mesmo nome) */
const presetId = (id: string) => ({ red: 'visualdesign', blue: 'visualpro' })[id] || id;
import {
  BASE,
  LOGO,
  acctOf,
  allowedOf,
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

const stripBase = (p: string) => (p.startsWith(BASE) ? p.slice(BASE.length) : p) || '/';

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

export function VisualHostApp() {
  const pathname = usePathname() || BASE;
  const [st, setSt] = useState<St>(() => initialState(stripBase(pathname)));
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
  const searchRef = useRef<HTMLInputElement>(null);

  // Grava o estado novo (o painel de uma conta que deixou de ter acesso volta ao primeiro painel permitido)
  const commit = useCallback((next: St) => {
    const allowed = allowedOf(next);
    if (!allowed.includes(next.level)) next = { ...next, level: allowed[0] };
    ref.current = next;
    setSt(next);
  }, []);

  const pushUrl = (path: string, replace = false) => {
    const url = BASE + path;
    if (window.location.pathname !== url) window.history[replace ? 'replaceState' : 'pushState'](null, '', url);
  };

  const nav = useCallback(
    (path: string) => {
      const n = fromPath(ref.current, path);
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
    toastTimer.current = setTimeout(() => setToastMsg((m) => ({ ...m, on: false })), 2200);
  }, []);

  const closeM = useCallback(() => setModal(null), []);
  const closeSearch = useCallback(() => setSearch((x) => ({ ...x, open: false })), []);
  const openSearch = useCallback(() => setSearch({ open: true, q: '', si: 0 }), []);
  const closePop = () => setPop(null);

  // Aparência guardada no navegador (tema claro/escuro, separador do painel inicial, cores, cantos e marca);
  // endereço sem ecrã → primeiro painel da conta
  useEffect(() => {
    const n = { ...ref.current };
    try {
      if (localStorage.getItem('visualhost_theme') === 'dark') n.theme = 'dark';
      if (localStorage.getItem('visualhost_dashtab') === 'menu') n.dashTab = 'menu';
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
    commit(n);
    pushUrl(ref.current.path, true);
    const onPop = () => commit(fromPath(ref.current, stripBase(window.location.pathname)));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [commit]);

  // Dados reais do servidor (Hestia + registo do site): contas, pacotes, informação, zonas DNS e estado do servidor.
  // Sem sessão no site → pede para iniciar sessão. Depois de uma alteração, volta a ler (fresco).
  const carregar = useCallback(
    async (fresco = false) => {
      try {
        const r = await fetch('/api/vhost/dados' + (fresco ? '?fresco=1' : ''), { cache: 'no-store' });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) {
          commit({ ...ref.current, carga: 'erro', erro: { msg: j.erro || 'Não foi possível ler o servidor.', codigo: r.status } });
          return;
        }
        const d = j as DadosServidor;
        // domínios internos do sistema (files., supabase-…) fora de todas as listas do painel
        for (const c of Object.values(d.contas)) {
          c.domains = c.domains.filter((x) => dominioVisivel(x.name));
          c.mails = c.mails.filter((m) => dominioVisivel(m.dom));
        }
        const cur = ref.current;
        const primeira = cur.carga !== 'ok';
        const n0: St = {
          ...cur,
          acc: d.contas,
          login: d.me,
          stack: primeira ? [] : cur.stack.filter((x) => d.contas[x.u]),
          srv: d.servidor,
          dns: d.dns,
          php: d.php || [],
          lidoEm: d.lidoEm,
          carga: 'ok',
          erro: null,
          db: { ...cur.db, pkgs: d.pacotes, info: d.info },
        };
        const n = fromPath(n0, primeira ? inicial.current : cur.path);
        commit(n);
        if (primeira) pushUrl(n.path, true);
      } catch {
        commit({ ...ref.current, carga: 'erro', erro: { msg: 'Sem ligação ao site. Verifique a internet e tente de novo.', codigo: 0 } });
      }
    },
    [commit],
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
      toast(c ? 'Cores guardadas neste tema' : 'Cores do tema repostas');
    },
    previewThemeColors: (c) => commit({ ...ref.current, themePreview: c }),
    setRadius: (r) => {
      commit({ ...ref.current, radius: r });
      try {
        localStorage.setItem(LS.radius, r);
      } catch {}
      toast('Cantos atualizados');
    },
    setDominio: (d) => {
      commit({ ...ref.current, dominio: d });
      toast('Domínio: ' + d);
    },
    setBrand: (b) => {
      commit({ ...ref.current, brand: b });
      try {
        localStorage.setItem(LS.brand, JSON.stringify(b));
      } catch {}
      toast('Marca guardada');
    },
    openSearch,
    logout: () => setModal(<LogoutModal />),
  };

  const screenKey = GLOBAL[s.page] ? (s.gsub ? s.page + '/' + s.gsub : s.page) : level + '/' + s.page;
  const scr = s.deny ? denyScreen(vh) : (SCREENS[screenKey] || SCREENS[s.page] || placeholder)(vh);
  const title = t(scr.title);
  const desc = scr.desc !== undefined ? t(scr.desc) : descFor(s);
  const home = s.page === 'inicio' && !s.deny;
  const sec = GLOBAL[s.page]?.sub ? GLOBAL[s.page] : null;

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
  const colors = getThemeColors(st.colorPreset, st.customPrimary, over);
  const isDark = st.theme === 'dark';
  // As peças do site metidas no painel (procura de domínios, Mailmarketing, gestor de ficheiros) usam o modo
  // escuro do site (classe "dark" no <html>): enquanto o painel está aberto, segue o tema do painel.
  useEffect(() => {
    const h = document.documentElement;
    const antes = { dark: h.classList.contains('dark'), esquema: h.style.colorScheme };
    h.classList.toggle('dark', isDark);
    h.style.colorScheme = isDark ? 'dark' : 'light';
    return () => {
      h.classList.toggle('dark', antes.dark);
      h.style.colorScheme = antes.esquema;
    };
  }, [isDark]);
  const rgbPrim = hexToRgb(colors.primary);
  const darkGlassRail = rgbPrim && st.colorPreset !== 'black' && st.colorPreset !== 'puro_black'
    ? `rgba(${rgbPrim.r}, ${rgbPrim.g}, ${rgbPrim.b}, 0.16)`
    : 'rgba(255, 255, 255, 0.06)';
  const railBg = isDark && !over?.railBg ? darkGlassRail : colors.railBg;
  const badge = badgeColors(railBg, colors.primary);
  const themeStyles: Record<string, string> = {
    '--red': colors.primary,
    '--red-d': colors.dark,
    '--tint': isDark ? colors.tintDark : colors.tint,
    '--ok': colors.safe,
    '--warn': colors.warning,
    '--rail-bg': railBg,
    '--railon': colors.railOn,
    '--railhov': colors.railHov,
    '--rail-ink': colors.railInk,
    '--rail-ink-hover': colors.railInkHover,
    '--rail-ink-on': colors.railInkOn,
    ...(badge ? { '--rail-badge-bg': badge.bg, '--rail-badge-ink': badge.ink } : {}),
    '--r': st.radius || '4px',
  };
  const logo = st.brand.logo || LOGO;
  const marca = st.brand.name.trim() || 'VisualHost';

  // Enquanto os dados do servidor não chegam: o próprio painel em esqueleto (cinzento animado), sem menus nem
  // números. Sem sessão / sem acesso / servidor indisponível: aviso no mesmo desenho, com o que fazer a seguir.
  if (st.carga !== 'ok') {
    const er = st.erro;
    const aviso =
      er?.codigo === 401
        ? { fa: 'fa-lock', titulo: 'Inicie sessão para abrir o painel', texto: 'O painel mostra as contas, os domínios e os e-mails do servidor ligados à sua conta.', botao: <a className="btn r" href="/login?redirect=/vhost"><i className="fa-solid fa-right-to-bracket" />{t('Iniciar sessão')}</a> }
        : er?.codigo === 403
          ? { fa: 'fa-user-lock', titulo: er.msg, texto: 'Se acha que é um engano, fale connosco: ligamos a sua conta ao servidor.', botao: <a className="btn g" href="/"><i className="fa-solid fa-arrow-left" />{t('Voltar ao site')}</a> }
          : { fa: 'fa-plug-circle-xmark', titulo: er?.msg || '', texto: 'O servidor não respondeu a tempo. Os seus dados estão seguros.', botao: <button className="btn r" onClick={() => { commit({ ...ref.current, carga: 'a-carregar', erro: null }); carregar(); }}><i className="fa-solid fa-rotate" />{t('Tentar de novo')}</button> };
    const largura = [128, 152, 140, 118, 160, 134];
    return (
      <div className="vh" data-theme={st.theme} style={themeStyles as React.CSSProperties} lang="pt-PT" suppressHydrationWarning>
        <div className="app espera" aria-busy={st.carga === 'a-carregar'}>
          <aside className="sidebar">
            <div className="rail">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="rlogo" src={logo} alt={marca} style={st.brand.logo ? { objectFit: 'contain' } : undefined} />
              {!er &&
                [0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="rb">
                    <span className="sk sk-ic" />
                  </div>
                ))}
              <div className="grow" />
            </div>
            <div className="navcol">
              <div className="navhead">
                <h1 className="dash">Dashboard</h1>
                <p>{er ? t('Painel de alojamento') : <span className="sk" style={{ width: 90 }} />}</p>
              </div>
              <nav className="side">
                {!er && largura.map((w, i) => (
                  <div key={i} className="grp">
                    <span className="sk" style={{ width: w }} />
                  </div>
                ))}
              </nav>
            </div>
          </aside>
          <div className="right">
            <header className="top">
              <div className="ptitle">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="only-m" src={logo} alt="" />
                <div className="bt">
                  <h1>{er ? t('Painel VisualHost') : <span className="sk" style={{ width: 220, height: 20 }} />}</h1>
                  <small>{er ? '' : <span className="sk" style={{ width: 320 }} />}</small>
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
              {er ? (
                <div className="card espera-msg" id="espera">
                  <i className={'fa-solid ' + aviso.fa + ' big'} />
                  <b>{t(aviso.titulo)}</b>
                  <p>{t(aviso.texto)}</p>
                  {aviso.botao}
                </div>
              ) : (
                <div id="espera">
                  <div className="espera-stats">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className="card">
                        <span className="sk" style={{ width: '45%' }} />
                        <span className="sk" style={{ width: '30%', height: 22 }} />
                        <span className="sk" style={{ width: '100%', height: 6 }} />
                      </div>
                    ))}
                  </div>
                  <div className="card espera-tbl">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div key={i}>
                        <span className="sk sk-ic" style={{ width: 32, height: 32 }} />
                        <span className="sk" style={{ width: 160 + ((i * 37) % 80) }} />
                        <span className="sk" style={{ width: 90 }} />
                        <span className="sk" style={{ width: 70, marginLeft: 'auto' }} />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </main>
          </div>
        </div>
      </div>
    );
  }

  return (
    <VHContext.Provider value={vh}>
      <div className="vh" data-theme={st.theme} style={themeStyles as React.CSSProperties} lang={st.lang === 'en' ? 'en' : 'pt-PT'} suppressHydrationWarning>
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
            </div>

            <div className="navcol">
              <div className="navhead" id="navhead">
                <h1 className={'dash' + (home ? ' on' : '')} onClick={() => go('inicio')} title={t('Ir para o Dashboard')}>
                  Dashboard
                </h1>
                <p>{t('Olá, ' + s.acc[s.login].name.split(' ')[0])}</p>
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
                <Avatar a={a} />
                <div className="ai">
                  <span>
                    <b>{a.name}</b>
                  </span>
                  <small title={a.email || ''}>{a.email || ''}</small>
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
                  <h1 id="ptitle" title={title}>
                    {title}
                  </h1>
                  <small id="pdesc" title={desc}>
                    {desc}
                  </small>
                </div>
              </div>
              {/* na maquete esta faixa existe (vazia) no painel inicial e ocupa um espaço de 16px na barra */}
              {home && <div className="dash-tabs-bar" id="dashtabs" style={{ display: 'flex' }} />}
              <div className="sp" />
              <div className="topact">
                <span id="pageact" className="topact">
                  {scr.actions}
                </span>
                <span id="topfix" className="topact">
                  <button className="btn g iconbtn only-m" onClick={openSearch} title={t('Pesquisar')}>
                    <i className="fa-solid fa-magnifying-glass" />
                  </button>
                  <button className="btn g" onClick={vh.logout}>
                    <i className="fa-solid fa-right-from-bracket" />
                    {t('Sair')}
                  </button>
                  <button className="btn g iconbtn" onClick={vh.toggleTheme} title={t('Tema claro/escuro')}>
                    <i className={'fa-solid ' + (st.theme === 'dark' ? 'fa-sun' : 'fa-moon')} />
                  </button>
                </span>
              </div>
            </header>
            <main id="main">
              <ImpBanner />
              {!s.deny && <SwitcherBar title={scr.title} crumbs={scr.crumbs} />}
              {(s.page === 'inicio' || !s.page) && s.dashTab !== 'menu' && !s.deny ? (
                <Fragment key={st.path}>{scr.body}</Fragment>
              ) : (
                <div className="da-main-card">
                  <Fragment key={st.path}>{scr.body}</Fragment>
                </div>
              )}
              {!s.deny && <RouteFoot />}
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
        <div className={'toast' + (toastMsg.on ? ' on' : '')} id="toast">
          {toastMsg.text}
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
                <b>{a.name}</b>
                <span>{a.email || ''}</span>
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
