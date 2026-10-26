'use client';

// Painel VisualHost — versão React da maquete aprovada (VisualHost/maquete-visualhost.html).
// Mesma estrutura de HTML e mesmas classes, para o CSS da maquete (generated/maquete.css) se aplicar tal e qual.
import { Component, Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/contexts/ThemeContext';
import { BarraPagina, ConsultaPagina, FaixaAbas, PesquisaPagina, TopoCartao, VHContext, type ItemPesquisa, type VH } from './context';
import { GLOBAL, LEVELS, MENU, ROLES } from './generated/data';
import { SEM_MENU } from './menu-contas';
import { dominioVisivel, type DadosServidor } from './servidor';
import { CACHE_DADOS_VHOST, apagarDadosVhost, guardarDadosVhost, tirarEntrada } from '@/lib/vhost-cache';
import { idDispositivoPresenca } from '@/lib/vhost-presenca-id';
import { COOKIE_TEMA, lerTema, valorCookieTema, type TemaConta } from '@/lib/vhost-tema-conta';
import { translate, type Lang } from './i18n';
import { useI18n } from '@/lib/i18n';
import { EntradaPainel, EsperaEntrada, LINGUA_LS } from './entrada';
import { CodigoDoisPassos } from './dois-passos';
import { auth, supabase } from '@/lib/supabase-client';
import { MenuExtraModal, MoreMenuModal } from './modals';
import { SCREENS, denyScreen, placeholder, type Screen } from './screens';
import { PesquisaNaPagina } from './pesquisa-pagina';
import { useTituloAjustado } from './titulo-ajustado';
import { PANEL_INACTIVITY_MS, SAIR_POR_INATIVIDADE_ATIVO } from '@/lib/session-inactivity';
import { BarraTopo, EsperaPagina, atividadeComeca, instalarContador, type Espera } from './carga';
import { BarrasDa } from './carregador-da';
import { ClientSidePanel } from '@/components/vhost/comuns/ClientProductsHub';
import { useAvisosEncomendas } from './avisos-encomendas';
import { badgeColors, getThemeColors, hexToRgb, luminancia, type CustomComponents } from './theme';
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
  comAcessos,
  ico,
  initialState,
  isUser,
  meOf,
  MENU_SO_DOMINIO,
  soDominioDe,
  nomeNivel,
  dominioGuardado,
  guardarDominio,
  route,
  type DashTab,
  type St,
} from './state';
import { Avatar, ImpBanner, NoTopoCartao, RouteFoot, SwitcherBar } from './ui';
import { tituloDoCartao } from './titulos-cartao';
import { useBotoesTelemovel } from './botoes-telemovel';
import { useIconesCampos } from './icones-campos';
import type { Account, Level, MenuItem } from './types';

const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

// O mesmo ecrã com o endereço do browser (/vhost:2026/…) ou com o da rota no servidor (/vhost/…, por causa da
// reescrita em src/proxy.ts): os dois dão o mesmo caminho interno, sem diferenças entre servidor e browser
const PREFIXOS = [BASE, '/vhost%3A2026', '/vhost%3a2026', '/vhost'];
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
        if (hasFeatOf(s, it.feat, it.id, lv)) all.push({ lv, g, it, path: route(lv, it.id), k: (it.t + ' ' + T(it.t) + ' ' + g + ' ' + T(g) + ' ' + it.f.join(' ')).toLowerCase() });
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
    // depois de uma publicação, uma parte do código antigo pode já não existir no servidor: recarrega uma vez
    if (e instanceof Error && /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module/i.test(e.name + ' ' + e.message)) {
      try {
        if (sessionStorage.getItem('vh-chunk-recarga') !== location.pathname) {
          sessionStorage.setItem('vh-chunk-recarga', location.pathname);
          location.reload();
          return;
        }
      } catch {}
    }
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

/** Preferências locais sem tema de conta (separador do painel inicial e língua). */
function comPreferencias(s: St): St {
  const n = { ...s };
  try {
    if (localStorage.getItem('visualhost_dashtab') === 'menu') n.dashTab = 'menu';
    const lg = localStorage.getItem(LINGUA_LS) || localStorage.getItem('visualhost_lang');
    if (lg === 'pt' || lg === 'en') n.lang = lg;
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

/** "Entrar como" (contas que se estão a ver) guardado no separador do navegador: uma recarga da página (F5, versão nova,
 *  ou no computador local o código a compilar) já não devolve à conta de administrador a meio do trabalho (Silva,
 *  16/10/2026: "às vezes quando entro na conta do cliente o painel devolve-me atrás na conta admin"). Só vale para o
 *  mesmo login e para contas que esse login ainda vê; as rotas do servidor continuam a verificar cada pedido. */
const CHAVE_ENTRAR = 'vh-entrar-como';
function lerEntrarComo(login: string, contas: Record<string, unknown>): St['stack'] {
  try {
    const g = JSON.parse(sessionStorage.getItem(CHAVE_ENTRAR) || 'null') as { login?: string; stack?: St['stack'] } | null;
    if (!g || g.login !== login || !Array.isArray(g.stack)) return [];
    const stack = g.stack.filter((x) => x && typeof x.u === 'string' && contas[x.u] && isLevel(x.lv) && typeof x.pg === 'string');
    return stack.length === g.stack.length ? stack : [];
  } catch {
    return [];
  }
}
function guardarEntrarComo(login: string, stack: St['stack']) {
  try {
    if (login && stack.length) sessionStorage.setItem(CHAVE_ENTRAR, JSON.stringify({ login, stack }));
    else sessionStorage.removeItem(CHAVE_ENTRAR);
  } catch {}
}

/** Tema de cada conta como ficou da última vez neste navegador (e o da própria conta também num cookie, que a página do
 *  servidor lê): ao recarregar ou ao entrar noutra conta, o painel fica logo com as cores dela. Antes voltava ao tema de
 *  origem (claro) até o servidor responder — a "tela branca" de quem usa o tema escuro (Silva, 16/10/2026). Não tem
 *  nada de privado; apaga-se ao sair. */
const TEMAS_LS = 'vh-temas';
/** chave do tema de quem se está a ver: a própria pessoa, ou a conta em "Entrar como" */
const chaveTema = (s: St) => (s.stack.length ? 'conta:' + meOf(s) : 'pessoa:' + s.login);
const temaDe = (s: St): TemaConta => ({ theme: s.theme, colorPreset: s.colorPreset, customPrimary: s.customPrimary, themeOver: s.themeOver, radius: s.radius, brand: s.brand });
function lerTemasLocais(): Record<string, unknown> {
  try {
    const m = JSON.parse(localStorage.getItem(TEMAS_LS) || '{}');
    return m && typeof m === 'object' && !Array.isArray(m) ? m : {};
  } catch {
    return {};
  }
}
function lerTemaLocal(chave: string): TemaConta | null {
  return lerTema(lerTemasLocais()[chave]);
}
/** Guarda o tema da conta que se está a ver em `s` */
function lembrarTema(s: St) {
  if (!s.login) return;
  const chave = chaveTema(s);
  const tema = temaDe(s);
  try {
    const m = lerTemasLocais();
    delete m[chave];
    m[chave] = tema;
    // só as últimas contas vistas
    for (const k of Object.keys(m).slice(0, -20)) delete m[k];
    localStorage.setItem(TEMAS_LS, JSON.stringify(m));
  } catch {}
  if (!s.stack.length) {
    const seguro = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${COOKIE_TEMA}=${valorCookieTema(s.login, tema)}; path=/; max-age=31536000; SameSite=Lax${seguro}`;
  }
}
function esquecerTemas() {
  try {
    localStorage.removeItem(TEMAS_LS);
  } catch {}
  document.cookie = `${COOKIE_TEMA}=; path=/; max-age=0; SameSite=Lax`;
}
/** `s` com o tema guardado neste navegador para a conta que se vê (se houver) */
function comTemaLocal(s: St): St {
  const t = s.login ? lerTemaLocal(chaveTema(s)) : null;
  return t ? { ...s, ...t, themePreview: null } : s;
}

/** Estado com uma leitura do servidor, a abrir `caminhoDesejado` (o endereço com que o painel abriu, na primeira).
 *  `doNavegador` = false no desenho do servidor: sem o "Entrar como" guardado neste separador (o servidor não o vê) */
function comDados(cur: St, d: DadosServidor, caminhoDesejado: string, doNavegador = true): St {
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
    stack: !primeira ? cur.stack.filter((x) => d.contas[x.u]) : doNavegador ? lerEntrarComo(d.me, d.contas) : [],
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
/** A página anterior fica à vista até a seguinte ter conteúdo (Silva, 24/10/2026: "manter à vista o conteúdo da página anterior até o da
 *  próxima aparecer"). Este tempo é só a rede de segurança para um servidor que não responde (depois a nova abre, com o carregador do DA). */
const ESPERA_MAX_MS = 10_000;

/** Lugar de uma página: escondido enquanto as leituras sem nada em memória não acabam; depois avisa (uma vez) */
type RegistarFonte = (chave: string, id: string, fonte: () => ItemPesquisa[]) => () => void;

/** O que conta como "tem conteúdo": texto, ou um destes elementos (ícones sozinhos não chegam) */
const ELEMENTOS_COM_CONTEUDO = 'img,svg,input,select,textarea,iframe,canvas,table,video';

function PaginaSlot({ p, oculta, onPronta, registar }: { p: Pagina; oculta: boolean; onPronta: (chave: string) => void; registar: RegistarFonte }) {
  const [barra, setBarra] = useState<HTMLDivElement | null>(null);
  const [abasEl, setAbasEl] = useState<HTMLElement | null>(null);
  const faixaAbas = useMemo(() => ({ el: abasEl, set: setAbasEl }), [abasEl]);
  // linha de cima do cartão (indicação do domínio + botão da página ou "Ações"): o lugar é o do cartão, ou o que os
  // separadores dão logo por baixo da faixa deles
  const [topoCartao, setTopoCartao] = useState<HTMLElement | null>(null);
  const [topoTabs, setTopoTabs] = useState<HTMLElement | null>(null);
  const [opcoesEl, setOpcoesEl] = useState<HTMLElement | null>(null);
  const [pagEl, setPagEl] = useState<HTMLElement | null>(null);
  // a página (dentro do corpo) pôs ela própria o seu botão na linha de cima (ex.: FTP › Criar): o "Ações" das tabelas fica onde estava
  const [ocupado, setOcupado] = useState(false);
  const topo = useMemo(
    () => ({ el: p.semCartao || p.home ? null : topoTabs || topoCartao, setTabs: setTopoTabs, opcoesEl, setOpcoes: setOpcoesEl, pagEl, setPag: setPagEl, temBotao: !p.semCartao && !p.home && (!!p.scr.actions || ocupado), setOcupado, dominios: p.scr.dominios, dominioUrl: p.scr.dominioUrl }),
    [p.semCartao, p.home, p.scr.actions, p.scr.dominios, p.scr.dominioUrl, topoTabs, topoCartao, ocupado, opcoesEl, pagEl],
  );
  const pesquisa = useMemo(() => ({ registar: (id: string, fonte: () => ItemPesquisa[]) => registar(p.chave, id, fonte) }), [registar, p.chave]);
  // pesquisa da tabela posta na linha por baixo do título do cartão (DNS): o texto e se a tabela a pediu
  const [consultaQ, setConsultaQ] = useState('');
  const [consultaAtiva, setConsultaAtiva] = useState<boolean | 'junto'>(false);
  const consulta = useMemo(() => ({ q: consultaQ, setQ: setConsultaQ, ativo: consultaAtiva, ativar: setConsultaAtiva }), [consultaQ, consultaAtiva]);
  const falta = useRef(0);
  const montada = useRef(false);
  const avisada = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const chave = p.chave;
  // Nunca um cartão vazio (Silva, 20/10/2026): enquanto a página ainda não tem conteúdo — leituras por acabar, ou nada
  // desenhado — o cartão mostra o carregador do DA no meio. Só até haver conteúdo pela primeira vez: depois, ao
  // atualizar, o conteúdo continua à vista.
  const slotRef = useRef<HTMLDivElement>(null);
  const [carrega, setCarrega] = useState(false);
  const teveConteudo = useRef(false);
  const temConteudo = useCallback(() => {
    const el = slotRef.current;
    if (!el) return true;
    return [...el.children].some((c) => {
      if (c.classList.contains('pg-barra') || c.classList.contains('pg-carga')) return false;
      // a linha de cima do cartão (indicação do domínio, botão) não conta como conteúdo da página
      const copia = c.cloneNode(true) as Element;
      copia.querySelectorAll('.card-topo-slot').forEach((x) => x.remove());
      return (copia.textContent || '').trim() !== '' || !!copia.querySelector(ELEMENTOS_COM_CONTEUDO);
    });
  }, []);
  const avaliar = useCallback(() => {
    if (teveConteudo.current) return;
    const vazia = falta.current > 0 || !temConteudo();
    if (!vazia) teveConteudo.current = true;
    setCarrega(vazia);
  }, [temConteudo]);
  const verificar = useCallback(() => {
    clearTimeout(timer.current);
    // pequena folga: uma leitura que acaba e outra que começa logo a seguir não abrem a página a meio
    timer.current = setTimeout(() => {
      if (montada.current && falta.current === 0) {
        avaliar();
        // só se liberta a página quando já tem conteúdo (a anterior fica à vista até lá); uma página que falha liberta-se por onFalha, e
        // uma que nunca desenha nada, pela rede de segurança (ESPERA_MAX_MS)
        if (!avisada.current && (teveConteudo.current || temConteudo())) {
          avisada.current = true;
          onPronta(chave);
        }
      }
    }, 40);
  }, [onPronta, chave, avaliar, temConteudo]);
  // antes de pintar: se a página abre vazia, o cartão já nasce com o carregador (sem um instante de cartão em branco)
  useLayoutEffect(() => {
    avaliar();
  }, [avaliar]);
  // Só uma animação de cada vez (Silva, 24/10/2026): enquanto o cartão mostra as barras (primeira carga), a linha do topo esconde-se; a linha
  // do topo é para quando a página anterior ainda está à vista. O CSS (.vh-barras-no-cartao .vh-barra-topo) faz o resto.
  const barrasVisiveis = carrega && !oculta;
  useEffect(() => {
    if (!barrasVisiveis) return;
    document.documentElement.classList.add('vh-barras-no-cartao');
    return () => document.documentElement.classList.remove('vh-barras-no-cartao');
  }, [barrasVisiveis]);
  // páginas que desenham o conteúdo sem passar pelas leituras acima: quando o conteúdo aparece, o carregador sai
  useEffect(() => {
    const el = slotRef.current;
    if (!el || teveConteudo.current) return;
    const obs = new MutationObserver(() => {
      if (teveConteudo.current) return obs.disconnect();
      verificar();
    });
    obs.observe(el, { childList: true, subtree: true, characterData: true });
    return () => obs.disconnect();
  }, [verificar]);
  const espera = useMemo<Espera>(
    () => ({
      comecar: () => {
        falta.current++;
        if (!teveConteudo.current) setCarrega(true);
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
    <div ref={slotRef} className={'pg-slot' + (carrega && !oculta ? ' a-carregar' : '')} style={{ display: oculta ? 'none' : 'contents' }} aria-hidden={oculta || undefined}>
      <VHContext.Provider value={p.vh}>
        <EsperaPagina.Provider value={espera}>
          <PesquisaPagina.Provider value={pesquisa}>
          <BarraPagina.Provider value={barra}>
          <FaixaAbas.Provider value={faixaAbas}>
          <ConsultaPagina.Provider value={consulta}>
          <TopoCartao.Provider value={topo}>
          {/* pesquisa e botões da página, por cima do cartão (fica escondida enquanto vazia) */}
          <div className="pg-barra" ref={setBarra} />
          {p.semCartao ? (
            corpo
          ) : p.scr.lado ? (
            <div className="da-com-lado">
              <div className="da-main-card">
                {!topoTabs && <div className="card-topo-slot" ref={setTopoCartao} />}
                {corpo}
              </div>
              <aside className="da-lado">
                <FalhaPagina t={p.vh.t} onFalha={() => onPronta(chave)}>
                  {p.scr.lado}
                </FalhaPagina>
              </aside>
            </div>
          ) : (
            <div className="da-main-card">
              {!topoTabs && <div className="card-topo-slot" ref={setTopoCartao} />}
              {corpo}
            </div>
          )}
          {/* o botão da página, que estava na barra de cima, passa para a linha de cima do cartão */}
          {!p.semCartao && !p.home && p.scr.actions && <NoTopoCartao modelo={{ titulo: p.vh.t(tituloDoCartao(p.scr.title)), sub: p.scr.subTitulo ? p.vh.t(p.scr.subTitulo) : p.scr.descEl ?? (p.desc || undefined) }}>{p.scr.actions}</NoTopoCartao>}
          {carrega && !oculta && (
            <div className="da-main-card pg-carga">
              <BarrasDa />
            </div>
          )}
          </TopoCartao.Provider>
          </ConsultaPagina.Provider>
          </FaixaAbas.Provider>
          </BarraPagina.Provider>
          </PesquisaPagina.Provider>
        </EsperaPagina.Provider>
      </VHContext.Provider>
    </div>
  );
}

/** dados: a leitura que o servidor já fez ao desenhar a página (null se demorou ou falhou: o painel lê-a aqui) */
export function VisualHostApp({ versao = 'dev', dados = null, tema = null, semSessao = false }: { versao?: string; dados?: DadosServidor | null; tema?: TemaConta | null; semSessao?: boolean }) {
  // conta os pedidos ao site para a linha de carregamento do topo (antes de o painel pedir os dados)
  useState(() => instalarContador());
  const { lang: langSite, setLang: definirLangSite } = useI18n();
  const { theme: temaGlobal, system: temaAutomatico, setTheme: definirTemaGlobal, followSystem: seguirAparelho } = useTheme();
  const pathname = usePathname() || BASE;
  // Entrada pelo login do site: o painel abre sem recarregar a página (src/components/auth/LoginForm.tsx), por isso não
  // há página do servidor a acertar — abre logo com a aparência guardada e a leitura que o login acabou de fazer, sem a
  // página branca com a roda (pedido do Silva, 13/10/2026). Aberto pelo endereço (ou ao recarregar), começa como a
  // página do servidor, que já vem com os dados (sem preferências nem "Entrar como" deste navegador, que o servidor não
  // conhece: entram logo a seguir, antes de o navegador mostrar a página já ligada).
  const semServidor = useSyncExternalStore(nadaMuda, () => true, () => false);
  const [st, setSt] = useState<St>(() => {
    const s0 = initialState(stripBase(pathname));
    // sem sessão (o servidor já viu que não há cookie): começa logo na entrada do painel, igual no servidor e no navegador
    if (semSessao) return { ...s0, carga: 'erro', erro: { msg: 'Inicie sessão para ver o painel.', codigo: 401 } };
    if (!semServidor) {
      // o tema da conta que o servidor recebeu no cookie (igual no servidor e no navegador: a página já vem com ele)
      const s1 = tema ? { ...s0, ...tema, theme: temaGlobal } : { ...s0, theme: temaGlobal };
      return dados ? comDados(s1, dados, stripBase(pathname), false) : s1;
    }
    const n = comPreferencias(s0);
    const d = lerCache();
    return d ? { ...comTemaLocal(noNivelPermitido(comDados(n, d, stripBase(pathname)))), theme: temaGlobal } : { ...n, theme: temaGlobal };
  });
  const dadosDoServidor = useRef(semServidor ? null : dados);
  // entrada do próprio painel (só quando o servidor recusa a sessão): modo do tema escolhido lá e "a entrar" (roda)
  const [aEntrar, setAEntrar] = useState(false);
  /** já se renovou a sessão depois de uma recusa (só uma vez, até a leitura seguinte correr bem) */
  const renovouSessao = useRef(false);
  useBotoesTelemovel();
  useIconesCampos();
  /** endereço com que o painel abriu (para o reabrir depois de chegarem os dados do servidor) */
  const inicial = useRef(stripBase(pathname));
  const ref = useRef(st);
  ref.current = st;
  const temaGlobalRef = useRef(temaGlobal);
  temaGlobalRef.current = temaGlobal;

  const [modal, setModal] = useState<ReactNode>(null);
  const [gaveta, setGaveta] = useState(false);
  const [gavetaExtra, setGavetaExtra] = useState(false);
  const [toastMsg, setToastMsg] = useState({ text: '', on: false });
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [pop, setPop] = useState<Pop>(null);
  const [search, setSearch] = useState({ open: false, q: '', si: 0 });
  const modalRef = useRef<HTMLDivElement>(null);
  /** há uma janela aberta (o elemento da janela existe sempre, só se mostra com conteúdo) */
  const modalAberto = useRef(false);
  modalAberto.current = !!modal;
  const searchRef = useRef<HTMLInputElement>(null);
  const temaSaveQueue = useRef<Promise<void>>(Promise.resolve());
  const temaEdicoes = useRef(0);

  // Grava o estado novo (o painel de uma conta que deixou de ter acesso volta ao primeiro painel permitido)
  const commit = useCallback((next: St) => {
    next = noNivelPermitido(next);
    ref.current = next;
    setSt(next);
  }, []);

  useEffect(() => {
    if (ref.current.theme !== temaGlobal) commit({ ...ref.current, theme: temaGlobal, themePreview: null });
  }, [commit, temaGlobal]);

  // Uma só língua em todo o projecto: a que se escolhe na entrada, no site ou nas preferências vale para o site e para o painel.
  // Só segue quem não mudou: se mudou o site, o painel segue; se mudou o painel, o site segue (sem voltar atrás ao arrancar).
  const langVista = useRef({ site: langSite, painel: st.lang });
  useEffect(() => {
    const v = langVista.current;
    if (langSite !== v.site && st.lang !== langSite) commit({ ...ref.current, lang: langSite });
    else if (st.lang !== v.painel && langSite !== st.lang) definirLangSite(st.lang);
    v.site = langSite;
    v.painel = st.lang;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [langSite, st.lang]);

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
          // nunca à frente de quem usa (a recarga inteira era a tela branca e o "salto" para o início — Silva,
          // 16/10/2026): só com o separador escondido; à vista, o painel continua com a versão que tem
          if (recarregar && document.hidden && !modalAberto.current) window.location.reload();
        })
        .catch(() => {});
    };
    // versão nova já conhecida: recarrega quando o separador fica escondido (ao voltar, já está na versão nova)
    const aoEsconder = () => {
      if (document.hidden && versaoNova.current && !modalAberto.current) window.location.reload();
    };
    const aoVoltar = () => {
      aoEsconder();
      if (!document.hidden) verificar(false);
    };
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
      // (antes, com uma versão nova publicada, o clique abria a página inteira de novo: tela branca e "salto")
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

  const guardarTema = useCallback(
    (next: St) => {
      if (next.carga !== 'ok') return;
      temaEdicoes.current++;
      lembrarTema(next);
      const preferencias: TemaConta = {
        theme: next.theme,
        colorPreset: next.colorPreset,
        customPrimary: next.customPrimary,
        themeOver: next.themeOver,
        radius: next.radius,
        brand: next.brand,
      };
      const corpo = {
        ...(next.stack.length ? { conta: meOf(next) } : {}),
        preferencias,
      };
      const salvar = async () => {
        const resposta = await fetch('/api/vhost/tema-conta', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...FUNDO },
          body: JSON.stringify(corpo),
        });
        const resultado = (await resposta.json().catch(() => ({}))) as { erro?: string };
        if (!resposta.ok) throw new Error(resultado.erro || `HTTP ${resposta.status}`);
      };
      temaSaveQueue.current = temaSaveQueue.current
        .then(salvar, salvar)
        .catch((erro: unknown) => {
          console.error('[VisualHost] não foi possível guardar o tema da conta', erro);
          toast('Não foi possível guardar as preferências do painel.');
        });
    },
    [toast],
  );

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

  // Preferências locais sem tema de conta (separador do painel inicial e língua);
  // endereço sem ecrã → primeiro painel da conta
  useIsomorphicLayoutEffect(() => {
    commit(comPreferencias(ref.current));
    pushUrl(ref.current.path, true);
    const onPop = () => commit(fromPath(ref.current, stripBase(window.location.pathname)));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [commit]);

  const contaTema = st.stack.length ? meOf(st) : st.login;
  /** a conta tem tema próprio guardado? (null = ainda não se sabe) */
  const temaProprio = useRef<boolean | null>(null);
  const contaTemaImpersonada = st.stack.length > 0;
  useEffect(() => {
    if (st.carga !== 'ok' || !contaTema) return;
    const chave = (contaTemaImpersonada ? 'conta:' : 'pessoa:') + contaTema;
    const edicoesNoInicio = temaEdicoes.current;
    let ativo = true;
    const padrao: TemaConta = {
      theme: 'light',
      colorPreset: 'visualdesign',
      customPrimary: '',
      themeOver: {},
      radius: '4px',
      brand: { name: '', logo: '' },
    };
    // enquanto o servidor responde: o tema desta conta guardado neste navegador, ou fica o que está (nunca o de origem,
    // que no tema escuro era um clarão branco a cada recarga e ao entrar noutra conta)
    const local = lerTemaLocal(chave);
    if (local) commit({ ...ref.current, ...local, theme: temaGlobalRef.current, themePreview: null });
    const query = contaTemaImpersonada ? '?conta=' + encodeURIComponent(contaTema) : '';
    fetch('/api/vhost/tema-conta' + query, { cache: 'no-store', headers: FUNDO })
      .then(async (resposta) => {
        const dados = (await resposta.json().catch(() => ({}))) as { preferencias?: TemaConta | null; erro?: string };
        if (!resposta.ok) throw new Error(dados.erro || `HTTP ${resposta.status}`);
        return dados;
      })
      .then((dados) => {
        if (!ativo || edicoesNoInicio !== temaEdicoes.current) return;
        const atual = ref.current;
        const chaveAtual = (atual.stack.length ? 'conta:' : 'pessoa:') + (atual.stack.length ? meOf(atual) : atual.login);
        if (chaveAtual !== chave) return;
        temaProprio.current = !!dados.preferencias;
        // sem tema próprio, o tema do plano da conta (Admin › Pacotes › Tema); senão o de origem
        const doPlano = atual.temasPlano?.[acctOf(atual).pkg];
        const n = { ...atual, ...(dados.preferencias || (doPlano ? { ...padrao, colorPreset: doPlano } : padrao)), theme: temaGlobalRef.current, themePreview: null };
        commit(n);
        lembrarTema(n);
      })
      .catch((erro: unknown) => {
        if (!ativo) return;
        console.error('[VisualHost] não foi possível carregar o tema da conta', erro);
        toast('Não foi possível carregar as preferências do painel.');
      });
    return () => {
      ativo = false;
    };
  }, [st.carga, contaTema, contaTemaImpersonada, commit, toast]);

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

  // A leitura que o servidor já fez ao desenhar a página: entram já as preferências e o "Entrar como" deste navegador
  // (antes de o navegador mostrar a página ligada) e fica guardada para as próximas aberturas
  useIsomorphicLayoutEffect(() => {
    const d = dadosDoServidor.current;
    if (!d) return;
    dadosDoServidor.current = null;
    guardarCache(d);
    const n0 = comDados(comPreferencias({ ...ref.current, carga: 'a-carregar' }), d, inicial.current);
    // em "Entrar como" (guardado neste separador), já com o tema da conta que se está a ver
    const n = n0.stack.length ? comTemaLocal(n0) : n0;
    commit(n);
    if (n.path !== inicial.current) pushUrl(n.path, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Limpeza comum ao terminar a sessão, seja por "Sair" ou por inactividade.
  const limparSessao = useCallback(async () => {
    apagarCache();
    guardarEntrarComo('', []);
    esquecerTemas();
    tirarEntrada();
    try {
      await auth.signOut();
    } catch {}
  }, []);

  // Sair: termina a sessão e vai para o login do site, que volta a este ecrã depois de entrar (Silva, 16/10/2026:
  // "diretamente no login do site para se entrar no painel"). Único caso que vai para o login — é um clique explícito.
  const irParaLogin = useCallback(async (caminho = '') => {
    await limparSessao();
    window.location.assign('/login' + (caminho ? '?redirect=' + encodeURIComponent(BASE + caminho) : ''));
  }, [limparSessao]);

  // Inactividade: termina a sessão sem perguntar e volta à entrada (login) do próprio painel, no mesmo ecrã onde estava (Silva,
  // 24/10/2026: "ao ser desalogado por inactividade volta para o login do painel"; o Sair é que vai para o login do site).
  const irParaEntradaDoPainel = useCallback(
    async (caminho = '') => {
      await limparSessao();
      window.location.assign(BASE + (caminho && caminho !== '/' ? caminho : ''));
    },
    [limparSessao],
  );

  // Leitura antiga (o servidor guarda-a até 60 min e lê a nova por trás — Silva, 17/10/2026): volta a pedir aos 3, 6, 10,
  // 20 e 30 s até chegar uma desta hora. O conteúdo fica à vista e só muda quando chega o novo (nunca tela branca).
  const releitura = useRef<{ n: number; timer?: ReturnType<typeof setTimeout> }>({ n: 0 });
  const carregarRef = useRef<() => void>(() => {});
  const relerSeVelha = useCallback((d: DadosServidor) => {
    clearTimeout(releitura.current.timer);
    if ((d.idadeMs ?? 0) <= 60_000) {
      releitura.current.n = 0;
      return;
    }
    const espera = [3000, 6000, 10000, 20000, 30000][releitura.current.n++];
    if (espera) releitura.current.timer = setTimeout(() => carregarRef.current(), espera);
  }, []);

  // Dados reais do servidor (Hestia + registo do site): contas, pacotes, informação, zonas DNS e estado do servidor.
  // Sem sessão no site → login do site. Depois de uma alteração, volta a ler (fresco).
  const carregar = useCallback(
    async (fresco = false) => {
      // Nunca uma página em branco enquanto se lê o servidor (pedido do Silva): ao abrir, mostra logo a última leitura
      // guardada neste navegador e atualiza por trás quando a resposta chegar
      const daCache = !fresco && ref.current.carga !== 'ok' ? lerCache() : null;
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
          if (r.status === 401) {
            // O servidor recusou a sessão que o navegador tem (acontecia logo a seguir ao login do site: era o aviso
            // "Inicie sessão no site"). Renova-a aqui e lê outra vez, uma vez. Se continuar recusada: a entrada do
            // próprio painel — nunca o login do site, que vê a sessão aberta e devolve ao painel (andava às voltas,
            // Silva 16/10/2026).
            apagarCache();
            // Quem tinha sessão e ficou sem ela (a sessão acabou ou foi recusada): o login do site, não a entrada do
            // painel (Silva, 20/10/2026: "quando o site desaloga o utilizador, leva-o à página de login do site").
            // Vê-se antes de renovar: uma renovação falhada apaga a sessão local.
            const tinhaSessao = await supabase.auth.getSession().then((x: { data: { session: unknown } }) => !!x.data.session, () => false);
            if (!renovouSessao.current) {
              renovouSessao.current = true;
              const renovada = await supabase.auth.refreshSession().then((x: { error: unknown }) => !x.error, () => false);
              const r2 = renovada ? await fetch('/api/vhost/dados' + (fresco ? '?fresco=1' : ''), { cache: 'no-store' }).catch(() => null) : null;
              if (r2?.ok) {
                const d2 = (await r2.json()) as DadosServidor;
                renovouSessao.current = false;
                guardarCache(d2);
                aplicar(d2);
                relerSeVelha(d2);
                return;
              }
            }
            // irParaLogin termina a sessão local antes de ir (sem isso o login do site via a sessão e devolvia ao painel)
            if (tinhaSessao) {
              void irParaLogin(ref.current.path || '/');
              return;
            }
            setAEntrar(false);
            commit({ ...ref.current, carga: 'erro', erro: { msg: j.erro || 'Inicie sessão para ver o painel.', codigo: 401 } });
            return;
          }
          if (r.status === 403 || r.status === 428) apagarCache();
          // servidor lento ou em baixo com o painel já à vista (da última leitura): fica como está
          else if (ref.current.carga === 'ok') return;
          commit({ ...ref.current, carga: 'erro', erro: { msg: j.erro || 'Não foi possível ler o servidor.', codigo: r.status } });
          return;
        }
        const d = j as DadosServidor;
        renovouSessao.current = false;
        guardarCache(d);
        aplicar(d);
        relerSeVelha(d);
      } catch {
        if (ref.current.carga === 'ok') return; // o painel já está à vista (última leitura): fica como está
        commit({ ...ref.current, carga: 'erro', erro: { msg: 'O servidor demorou a responder. Verifique a ligação e tente de novo.', codigo: 0 } });
      }
    },
    [commit, aplicar, relerSeVelha, irParaLogin],
  );
  useIsomorphicLayoutEffect(() => {
    if (!semSessao) carregar();
  }, [carregar, semSessao]);
  useEffect(() => {
    carregarRef.current = () => void carregar();
    const r = releitura.current;
    return () => clearTimeout(r.timer);
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
      if (!el?.closest?.('#pop') && !el?.closest?.('#acct')) setPop(null);
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
  // Acessos por plano (Admin › Acessos por plano): o que cada plano esconde na barra lateral dos clientes
  useEffect(() => {
    if (!me) return;
    fetch('/api/vhost/acessos', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { acessos?: Record<string, string[]>; temas?: Record<string, string>; extras?: St['extrasPlano'] } | null) => {
        if (!j) return;
        const cur = ref.current;
        const temasPlano = j.temas || {};
        // sem tema próprio guardado, a conta fica com o tema do seu plano (Admin › Pacotes › Tema)
        const doPlano = temaProprio.current === false ? temasPlano[acctOf(cur).pkg] : '';
        const n = { ...comAcessos(cur, j.acessos || {}), temasPlano, extrasPlano: j.extras || {}, ...(doPlano ? { colorPreset: doPlano } : {}) };
        commit(n);
        if (doPlano) lembrarTema(n);
      })
      .catch(() => {});
  }, [me, commit]);
  // "Entrar como": guarda no separador a conta que se está a ver, para uma recarga não voltar à conta de administrador
  useEffect(() => {
    if (st.carga === 'ok' && st.login) guardarEntrarComo(st.login, st.stack);
  }, [st.carga, st.login, st.stack]);
  // Contas ligadas: regista a secção, o tempo nela e o texto dos controlos clicados (nunca dados de campos).
  const conectado = st.carga === 'ok' && !!st.login;
  const enviarPresenca = useCallback((evento?: {
    tipo: 'section' | 'click';
    secao: string;
    acao: string;
    duracaoSegundos?: number;
  }) => {
    const cur = ref.current;
    const secao = `${cur.level}/${cur.page}`;
    void fetch('/api/vhost/presenca', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: idDispositivoPresenca(),
        aVer: cur.stack.length ? meOf(cur) : '',
        pagina: cur.path,
        secao,
        evento: evento ? { ...evento, secao: evento.secao } : undefined,
      }),
      keepalive: true,
    }).then(async (resposta) => {
      // sessão já terminada (ou ainda sem entrar): não é um erro, o painel trata da entrada pelos outros pedidos — não se regista na consola
      if (resposta.status === 401) return;
      if (!resposta.ok) {
        const dados = (await resposta.json().catch(() => ({}))) as { erro?: string };
        throw new Error(dados.erro || `HTTP ${resposta.status}`);
      }
    }).catch((erro: unknown) => console.error('[VisualHost] não foi possível registar actividade:', erro));
  }, []);

  useEffect(() => {
    if (!conectado) return;
    const avisar = () => {
      if (document.visibilityState !== 'visible') return;
      enviarPresenca();
    };
    avisar();
    const id = setInterval(avisar, 30_000);
    document.addEventListener('visibilitychange', avisar);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', avisar);
    };
  }, [conectado, me, enviarPresenca]);

  const secaoAtiva = useRef<{ secao: string; desde: number } | null>(null);
  useEffect(() => {
    if (!conectado) {
      secaoAtiva.current = null;
      return;
    }
    const secao = `${st.level}/${st.page}`;
    const agora = Date.now();
    const anterior = secaoAtiva.current;
    if (anterior?.secao === secao) return;
    if (anterior) {
      enviarPresenca({
        tipo: 'section',
        secao: anterior.secao,
        acao: 'Saiu da secção',
        duracaoSegundos: Math.floor((agora - anterior.desde) / 1000),
      });
    }
    enviarPresenca({ tipo: 'section', secao, acao: 'Entrou na secção' });
    secaoAtiva.current = { secao, desde: agora };
  }, [conectado, st.level, st.page, enviarPresenca]);

  useEffect(() => {
    if (!conectado) return;
    const registarClique = (evento: MouseEvent) => {
      const origem = evento.target;
      if (!(origem instanceof Element)) return;
      const controlo = origem.closest('button, a, [role="button"], input[type="button"], input[type="submit"]');
      if (!(controlo instanceof HTMLElement)) return;
      const acao = (controlo.getAttribute('aria-label') || controlo.getAttribute('title') || controlo.innerText || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 120);
      if (!acao) return;
      const cur = ref.current;
      enviarPresenca({ tipo: 'click', secao: `${cur.level}/${cur.page}`, acao });
    };
    document.addEventListener('click', registarClique, true);
    return () => document.removeEventListener('click', registarClique, true);
  }, [conectado, enviarPresenca]);

  useEffect(() => {
    if (!conectado) return;
    const registarSaida = () => {
      const atual = secaoAtiva.current;
      if (!atual) return;
      enviarPresenca({
        tipo: 'section',
        secao: atual.secao,
        acao: 'Saiu do painel',
        duracaoSegundos: Math.floor((Date.now() - atual.desde) / 1000),
      });
      secaoAtiva.current = null;
    };
    window.addEventListener('pagehide', registarSaida);
    return () => window.removeEventListener('pagehide', registarSaida);
  }, [conectado, enviarPresenca]);
  // ao abrir o painel (ou quando a conta fica conhecida): o domínio escolhido da última vez nesta conta
  // (antes de desenhar — useLayoutEffect —: o seletor nunca mostra um instante o domínio principal e depois salta para o
  // escolhido, nem ao recarregar, nem ao voltar a entrar; Silva, 20/10/2026)
  useIsomorphicLayoutEffect(() => {
    if (!me || ref.current.dominio) return;
    const d = dominioGuardado(me);
    if (d) commit({ ...ref.current, dominio: d });
  }, [me, commit]);
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
  /** páginas do grupo «Extras» (Webmail, Mailmarketing, phpMyAdmin) que o plano da conta deixa ver: o menu extra da barra de baixo */
  const extrasVisiveis = allowed.includes('utilizador')
    ? (MENU.utilizador.find(([g]) => g === 'Extras')?.[1] ?? []).filter((it) => hasFeatOf(s, it.feat, it.id, 'utilizador'))
    : [];
  const t = (text: string) => translate(st.lang, text);
  // balões no menu: encomenda nova, cancelada ou actualizada (e pagamentos por confirmar, para o administrador)
  const avisosMenu = useAvisosEncomendas(st.carga === 'ok' && !!st.login && !st.stack.length, st.acc[st.login]?.role === 'admin', s.page === 'encomendas', toast);
  // quem só tem domínio (sem conta no servidor): menu reduzido
  const soDominio = soDominioDe({ ...st, level });
  const go = (id: string) => nav(route(level, id));
  /** planos de cliente do servidor (submenus de Admin › Configurações de acesso) */
  const planosAcesso = Object.keys(st.db.pkgs).filter((p) => p !== 'system');
  const setLevel = (l: Level) => nav('/' + l);

  const recusarLocal = () => {
    recusadoEm.current = 0;
    toast('Ainda não ligado ao servidor: nada foi alterado');
    recusadoEm.current = Date.now();
  };

  // Sair: termina a sessão e vai para o login do site, sem perguntar (a única entrada do painel, Silva, 16/10/2026)
  const sair = () => irParaLogin();

  const vh: VH = {
    s,
    t,
    me,
    a,
    allowed,
    hasFeat: (f, id) => hasFeatOf(s, f, id),
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
      // o domínio escolhido da última vez nessa conta; sem escolha → o domínio principal da conta que se está a ver
      const n0: St = { ...cur, dominio: dominioGuardado(u), stack: [...cur.stack, { u, lv: level, pg: cur.page }] };
      const lv = nivelInicial(n0);
      const n = fromPath({ ...n0, level: lv }, '/' + lv);
      commit(n);
      pushUrl(n.path);
      toast('Está a ver o painel de ' + u);
    },
    backToMine: () => {
      const cur = ref.current;
      const b = cur.stack[cur.stack.length - 1];
      // ao voltar ao próprio painel, as encomendas deixam de ser as da conta que se estava a ver (ver /api/vhost/encomendas-como)
      if (cur.stack.length === 1) void fetch('/api/vhost/encomendas-como', { method: 'DELETE' }).catch(() => {});
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
      const theme: St['theme'] = dark ? 'dark' : 'light';
      const next = { ...ref.current, theme };
      definirTemaGlobal(theme);
      commit(next);
      guardarTema(next);
      toast(dark ? 'Tema escuro' : 'Tema claro');
    },
    setColorPreset: (id, customPrimary) => {
      const cp = customPrimary ?? ref.current.customPrimary;
      const colorPreset = presetId(id);
      const next = { ...ref.current, colorPreset, customPrimary: cp, themePreview: null };
      commit(next);
      guardarTema(next);
      toast('Tema de cores aplicado');
    },
    saveThemeColors: (c) => {
      const k = ref.current.colorPreset;
      const themeOver = { ...ref.current.themeOver };
      if (c && Object.keys(c).length) themeOver[k] = c;
      else delete themeOver[k];
      const next = { ...ref.current, themeOver, themePreview: null };
      commit(next);
      guardarTema(next);
      toast(c ? 'Cores guardadas neste tema' : 'Cores do tema repostas');
    },
    previewThemeColors: (c) => commit({ ...ref.current, themePreview: c }),
    setRadius: (r) => {
      const next = { ...ref.current, radius: r };
      commit(next);
      guardarTema(next);
      toast('Cantos atualizados');
    },
    setAcessos: (acessos) => commit(comAcessos(ref.current, acessos)),
    setDominio: (d, aviso = true) => {
      guardarDominio(meOf(ref.current), d);
      commit({ ...ref.current, dominio: d });
      if (aviso) toast('Domínio: ' + d);
    },
    setBrand: (b) => {
      const next = { ...ref.current, brand: b };
      commit(next);
      guardarTema(next);
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

  // A página anterior só sai quando a nova terminou as leituras; não se revela uma página vazia por timeout.
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
      ...searchResults(s, q).map((h) => ({ k: 'f:' + h.path, txt: t(h.it.t), sub: (h.lv ? t(nomeNivel(h.lv)) + ' › ' : '') + t(h.g), fa: ico(h.it.fa), c: h.it.c, ir: () => nav(h.path) })),
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
  // A página anterior espera pela nova, mas nunca mais do que ESPERA_MAX_MS: uma leitura lenta do servidor (ou a actualização por trás)
  // não pode deixar a navegação parada — passado esse tempo a página nova abre já, com o carregador do DA no cartão, e o resto chega
  // quando chegar (Silva, 23/10/2026)
  useEffect(() => {
    if (!aEspera) return;
    const tm = setTimeout(() => libertar(chavePag), ESPERA_MAX_MS);
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
  // de 30 minutos sem tocar em nada (em nenhum separador; Silva, 26/10/2026), termina a sessão e volta à entrada do painel
  useEffect(() => {
    if (st.carga !== 'ok') return;
    if (!SAIR_POR_INATIVIDADE_ATIVO) return; // desligado por agora (ver session-inactivity.ts)
    const LIMITE = PANEL_INACTIVITY_MS; // 30 min, o mesmo valor de session-inactivity.ts
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
      irParaEntradaDoPainel(ref.current.path || '/');
    }, 30_000);
    return () => {
      evs.forEach((e) => window.removeEventListener(e, toque, { capture: true }));
      clearInterval(iv);
    };
  }, [st.carga, irParaEntradaDoPainel]);

  const colors = getThemeColors(st.colorPreset, st.customPrimary, over);
  const isDark = st.theme === 'dark';
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

  // Ao recarregar ou abrir o endereço, a página já vem do servidor com os dados (src/app/vhost/layout.tsx). Só se o
  // servidor demorou e não há leitura guardada neste navegador: a página branca, sem esqueleto nem roda (Silva,
  // 15/10/2026: "não quero spinner dentro do painel"), até o painel aparecer já com o menu. Sem cookie de sessão: o
  // login do site (proxy). Sessão recusada: a entrada do painel. Sem acesso / servidor indisponível: aviso com o que
  // fazer a seguir.
  if (st.carga !== 'ok') {
    const er = st.erro;
    // A entrada do próprio painel, no modelo do DA. `ocupado`: depois de entrar, fica à vista com o botão a girar até o
    // painel abrir (nenhuma página branca no meio — Silva, 19/10/2026).
    const entradaPainel = (ocupado: boolean) => (
      <div className="vh" data-theme={st.theme} style={themeStyles as React.CSSProperties} lang={st.lang === 'en' ? 'en' : 'pt-PT'} suppressHydrationWarning>
        <EntradaPainel
          ocupado={ocupado}
          escuro={isDark}
          automatico={temaAutomatico}
          lang={st.lang}
          voltarA={inicial.current && inicial.current !== '/' ? BASE + inicial.current : undefined}
          onTema={(modo) => {
            let theme: St['theme'];
            if (modo === 'system') {
              seguirAparelho();
              theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            } else {
              theme = modo;
              definirTemaGlobal(theme);
            }
            commit({ ...ref.current, theme });
          }}
          onLang={(l) => {
            commit({ ...ref.current, lang: l });
            try {
              localStorage.setItem(LINGUA_LS, l);
            } catch {}
          }}
          onEntrou={() => {
            setAEntrar(true);
            renovouSessao.current = false;
            commit({ ...ref.current, carga: 'a-carregar', erro: null });
            carregar();
          }}
        />
      </div>
    );
    // a ler (sem leitura no servidor nem neste navegador): depois de entrar pela entrada do painel, ela continua à vista
    if (!er)
      return aEntrar ? (
        entradaPainel(true)
      ) : (
        <div className="vh" data-theme={st.theme} style={themeStyles as React.CSSProperties} lang="pt-PT" suppressHydrationWarning>
          <EsperaEntrada roda={false} />
        </div>
      );
    // a conta tem os 2 passos ligados e a sessão ainda só tem a palavra-passe: o código da aplicação (o servidor responde 428)
    if (er.codigo === 428)
      return (
        <div className="vh" data-theme={st.theme} style={themeStyles as React.CSSProperties} lang={st.lang === 'en' ? 'en' : 'pt-PT'} suppressHydrationWarning>
          <CodigoDoisPassos
            escuro={isDark}
            lang={st.lang}
            onSair={sair}
            onOk={() => {
              setAEntrar(true);
              commit({ ...ref.current, carga: 'a-carregar', erro: null });
              carregar();
            }}
          />
        </div>
      );
    // sem sessão, ou sessão recusada pelo servidor mesmo depois de renovada: a entrada do painel
    if (er.codigo === 401) return entradaPainel(false);
    const aviso =
      er?.codigo === 403
          ? { fa: 'fa-user-lock', titulo: er.msg, texto: 'Se acha que é um engano, fale connosco: ligamos a sua conta ao servidor.', botao: <a className="btn g" href="/"><i className="fa-solid fa-arrow-left" />{t('Voltar ao site')}</a> }
          : { fa: 'fa-plug-circle-xmark', titulo: er?.msg || '', texto: 'O servidor não respondeu a tempo. Os seus dados estão seguros.', botao: (
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                <button className="btn r" onClick={() => { commit({ ...ref.current, carga: 'a-carregar', erro: null }); carregar(); }}><i className="fa-solid fa-rotate" />{t('Tentar de novo')}</button>
                <button className="btn g" onClick={sair}><i className="fa-solid fa-arrow-left" />{t('Sair')}</button>
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
            <header className="top painel-entrada">
              <div className="ptitle">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="only-m" src={logo} alt="" />
                <div className="bt">
                  <h1>
                    <span className="desktop-title">{t('Painel VisualHost')}</span>
                    <span className="mobile-title">{t('Painel')}</span>
                  </h1>
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
            {/* Barra de ícones: símbolo · mensagens · perfil · preferências · ficheiros · idioma · pesquisa */}
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
              {/* gestão de ficheiros: só o ícone, leva directo à página (só a quem o plano deixa ver) */}
              {hasFeatOf(s, findItem('utilizador', 'ficheiros')?.feat, 'ficheiros', 'utilizador') && (
                <div className={'rb' + (s.level === 'utilizador' && s.page === 'ficheiros' ? ' on' : '')} title={t('Gestor de ficheiros')} onClick={() => nav(route('utilizador', 'ficheiros'))}>
                  <i className="fa-solid fa-folder-open" />
                </div>
              )}
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
              <div className="lvl" id="lvl" style={allowed.length > 1 && !soDominio ? undefined : { display: 'none' }}>
                {allowed.map((k) => (
                  <button key={k} className={level === k && !sec ? 'on' : ''} onClick={() => setLevel(k)} title={t(nomeNivel(k))}>
                    {t(nomeNivel(k))}
                  </button>
                ))}
              </div>
              {/* Menu em categorias que abrem e fecham; sem a secção Início (o painel abre pelo símbolo ou por "Dashboard") */}
              <nav className="side" id="side">
                {soDominio ? (
                  <div className="tw-livre lateral-cliente">
                    <ClientSidePanel
                      displayName={pessoaNome}
                      sessionUser={pessoaEmail}
                      onNavigate={(secao) => {
                        if (secao === 'transferir') nav('/utilizador/dominios/transferir');
                        else if (secao === 'facturas' || secao === 'minhas-compras') go('facturacao');
                        else window.location.href = '/cliente';
                      }}
                    />
                  </div>
                ) : sec ? (
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
                    .filter(([g]) => g !== 'Início' && (!soDominio || MENU_SO_DOMINIO.includes(g)))
                    .map(([g, items]) => {
                      const vis = items.filter((it) => !SEM_MENU.has(it.id) && vh.hasFeat(it.feat, it.id));
                      if (!vis.length) return null;
                      const k = level + '/' + g;
                      return (
                        <Fragment key={k}>
                          <button
                            className={'grp' + (st.open[k] ? ' open' : '')}
                            onClick={() => {
                              // ao abrir um grupo, o primeiro item fica activo (Silva, 21/10/2026); fechar um grupo aberto só o fecha
                              const abrir = !st.open[k];
                              toggleGrp(k);
                              if (abrir && !(level === 'admin' && g === 'Configurações de acesso')) go(vis[0].id);
                            }}
                          >
                            <span>{t(soDominio && g === 'Compras e encomendas' ? 'Compras' : g)}</span>
                            {!st.open[k] && vis.some((it) => avisosMenu[it.id]) && <b className="nbal">{vis.reduce((soma, it) => soma + (avisosMenu[it.id]?.n || 0), 0)}</b>}
                            <i className="fa-solid fa-chevron-down chev" />
                          </button>
                          <div className="items">
                            <div className="in">
                              {/* Configurações de acesso: um submenu por plano, como os outros menus (Silva, 15/10/2026) */}
                              {level === 'admin' && g === 'Configurações de acesso' &&
                                planosAcesso.map((p, i) => (
                                  <a
                                    key={'plano:' + p}
                                    className={s.page === 'acessos' && (s.sub[0] ? s.sub[0] === p : i === 0) ? 'on' : ''}
                                    onClick={() => nav('/admin/acessos/' + encodeURIComponent(p))}
                                  >
                                    <span className="ic c1">
                                      <i className="fa-solid fa-box" />
                                    </span>
                                    <span className="lb" title={p}>
                                      {p}
                                    </span>
                                  </a>
                                ))}
                              {vis.filter((it) => !(level === 'admin' && it.id === 'acessos' && planosAcesso.length)).map((it) => (
                                <a key={it.id} className={!GLOBAL[s.page] && s.page === it.id ? 'on' : ''} onClick={() => go(it.id)}>
                                  <span className={'ic ' + it.c}>
                                    <i className={ico(it.fa)} />
                                  </span>
                                  <span className="lb" title={t(it.t)}>
                                    {t(it.t)}
                                  </span>
                                  {it.opt && <em>{t('opc.')}</em>}
                                  {avisosMenu[it.id] && (
                                    <b className="nbal" title={avisosMenu[it.id].titulo}>
                                      {avisosMenu[it.id].n}
                                    </b>
                                  )}
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
            <div className="top-impersonacao" style={{ position: 'sticky', top: 0, zIndex: 21, background: 'var(--card)' }}>
              <header className={'top' + (mostra.home ? ' painel-inicio' : '')}>
                <div className="ptitle">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="only-m" src={logo} alt="" style={st.brand.logo ? { objectFit: 'contain' } : undefined} />
                  <div className="bt">
                    <h1 id="ptitle" title={mostra.title}>
                      <span className="desktop-title">
                        {mostra.scr.icone && <i className={'fa-solid ' + mostra.scr.icone + ' ' + (mostra.scr.iconeCor || '')} style={{ color: 'var(--c, var(--red))', marginRight: 10 }} />}
                        {mostra.title}
                      </span>
                      <span className="mobile-title">{t('Painel')}</span>
                    </h1>
                    <small id="pdesc" className={mostra.scr.descBarra ? 'desc-barra' : undefined} title={mostra.scr.descBarra ? t(mostra.scr.descBarra) : mostra.desc}>
                      {mostra.scr.descBarra ? t(mostra.scr.descBarra) : mostra.scr.descEl ?? mostra.desc}
                    </small>
                  </div>
                </div>
                {/* na maquete esta faixa existe (vazia) no painel inicial e ocupa um espaço de 16px na barra */}
                {mostra.home && <div className="dash-tabs-bar" id="dashtabs" style={{ display: 'flex' }} />}
                <div className="sp" />
                <div className="topact">
                  <span id="pageact" className="topact">
                    {mostra.home ? null : mostra.semCartao || mostra.deny ? mostra.scr.actions : null}
                  </span>
                  <span id="topfix" className="topact">
                    {/* "Entrar como": em vez da faixa amarela, o botão de voltar ao painel de administração, na cor da antiga faixa (Silva, 23/10/2026) */}
                    {st.stack.length > 0 && (
                      <button className="btn g btn-imp" onClick={vh.backToMine} title={t('Voltar ao painel de administração')}>
                        <i className="fa-solid fa-arrow-left" />
                        {t('Voltar ao painel de administração')}
                      </button>
                    )}
                    {/* Busca: procura na página aberta (o cartão desliza por baixo da faixa do seletor) */}
                    <button className={'btn g lupa-topo' + (pesqPag.aberta ? ' on' : '')} onClick={() => setPesqPag((x) => ({ aberta: !x.aberta, q: '', i: 0 }))} title={t(mostra.home ? 'Pesquisar no painel' : 'Pesquisar nesta página')}>
                      <i className="fa-solid fa-magnifying-glass" />
                      {t('Busca')}
                    </button>
                    {/* Sair fica na barra compacta, ao lado do avatar; no telemóvel está no menu "Mais" (Silva, 15/10/2026) */}
                    <button className="btn g iconbtn" onClick={vh.toggleTheme} title={t('Tema claro/escuro')}>
                      <i className={'fa-solid ' + (st.theme === 'dark' ? 'fa-sun' : 'fa-moon')} />
                    </button>
                    {/* telemóvel: o menu deslizante (do lado direito), do tamanho dos outros botões (Silva, 15/10/2026) */}
                    <button className="btn g iconbtn only-m" onClick={() => setGaveta(true)} title={t('Menu')} aria-label={t('Menu')}>
                      <i className="fa-solid fa-bars" />
                    </button>
                  </span>
                </div>
              </header>
              <ImpBanner />
            </div>
            <main id="main">
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
          {/* sem o Início: a casa já está na faixa por baixo da barra de cima (Silva, 16/10/2026) */}
          {/* só as páginas que o plano da conta deixa ver (Admin › Acessos por plano) */}
          {/* o último botão abre o menu extra (Webmail, Mailmarketing e phpMyAdmin: o grupo «Extras»); o menu completo abre pelo ☰ da barra de cima (Silva, 26/10/2026) */}
          {[...TABBAR[level].filter(([id]) => id !== 'inicio' && vh.hasFeat(findItem(level, id)?.feat, id)), ...(extrasVisiveis.length ? [['extra', 'fa-puzzle-piece', 'Extra'] as [string, string, string]] : [])].map(([id, fa, label]) => (
            <a key={id} className={s.page === id ? 'on' : ''} onClick={() => (id === 'extra' ? setGavetaExtra(true) : go(id))}>
              <i className={'fa-solid ' + fa} />
              {t(label)}
            </a>
          ))}
        </nav>

        {/* menu deslizante do ☰ (telemóvel): o mesmo conteúdo do "Mais" */}
        <div className={'gaveta-bg' + (gaveta ? ' on' : '')} onClick={(e) => e.target === e.currentTarget && setGaveta(false)}>
          <aside className="gaveta" role="dialog" aria-label={t('Menu')}>
            {gaveta && <MoreMenuModal fechar={() => setGaveta(false)} />}
          </aside>
        </div>

        {/* o menu extra da barra de baixo abre no mesmo formato do menu deslizante do ☰ */}
        <div className={'gaveta-bg' + (gavetaExtra ? ' on' : '')} onClick={(e) => e.target === e.currentTarget && setGavetaExtra(false)}>
          <aside className="gaveta" role="dialog" aria-label={t('Menu extra')}>
            {gavetaExtra && <MenuExtraModal itens={extrasVisiveis} fechar={() => setGavetaExtra(false)} />}
          </aside>
        </div>

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
                        {x.lv ? t(nomeNivel(x.lv)) + ' › ' : ''}
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
