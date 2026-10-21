'use client';

// Peças repetidas dos ecrãs. Geram o mesmo HTML (e as mesmas classes) que a maquete,
// para que o CSS de generated/maquete.css se aplique tal e qual.
import { Fragment, useContext, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { TopoCartao, useVH } from './context';
import { ChangeRoleModal } from './modals';
import { noServidor } from './paginas/acoes';
import { HX, LEVELS, MENU, ROLES } from './generated/data';
import { findItem, gItem, ico, initials, nomeNivel, route } from './state';
import type { Account, HxState, MenuItem, Role } from './types';
import type { Screen } from './screens';
import { GLOBAL } from './generated/data';

export const RC: Record<Role, string> = { admin: 'c8', revenda: 'c2', profissional: 'c3', cliente: 'c5' };
export const RI: Record<Role, string> = { admin: 'fa-user-gear', revenda: 'fa-user-tie', profissional: 'fa-briefcase', cliente: 'fa-user' };

// Avatar: foto ligada ao e-mail (Gravatar, por SHA-256); sem foto, fundo preto com as iniciais do nome da conta
const GRAV: Record<string, string> = {};
async function gravatarHash(email: string) {
  if (!GRAV[email]) {
    const h = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email));
    GRAV[email] = [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  return GRAV[email];
}

/** Foto do Gravatar do primeiro e-mail que a tiver (o da conta e depois os `outros`); só sem nenhuma ficam as iniciais */
export function Avatar({ a, outros = [] }: { a: Account; outros?: (string | undefined)[] }) {
  const lista = [...new Set([a.email, ...outros].map((e) => (e || '').trim().toLowerCase()).filter(Boolean))];
  const chave = lista.join(',');
  const [tentativa, setTentativa] = useState({ chave, i: 0 });
  const i = tentativa.chave === chave ? tentativa.i : 0;
  const email = lista[i] || '';
  const [src, setSrc] = useState<string | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    let off = false;
    setSrc(null);
    setShown(false);
    if (!email || !globalThis.crypto?.subtle) return;
    gravatarHash(email)
      .then((h) => !off && setSrc('https://www.gravatar.com/avatar/' + h + '?s=80&d=404'))
      .catch(() => {});
    return () => {
      off = true;
    };
  }, [email]);
  return (
    <div className="av" title={a.email || a.name}>
      <span>{initials(a.name)}</span>
      {src && <img alt="" hidden={!shown} src={src} onLoad={() => setShown(true)} onError={() => (setSrc(null), setTentativa({ chave, i: i + 1 }))} />}
    </div>
  );
}

export function Stat({ title, v, m, p }: { title: ReactNode; v: ReactNode; m: string; p: number }) {
  const { t } = useVH();
  return (
    <div className="card stat">
      <small>{typeof title === 'string' ? t(title) : title}</small>
      <strong>
        {v} <span>{t(m)}</span>
      </strong>
      <div className="bar">
        <span style={{ width: Math.min(p, 100) + '%' }} />
      </div>
    </div>
  );
}

export function Tool({ fa, c, title, sub, onClick }: { fa: string; c: string; title: string; sub: string; onClick: () => void }) {
  const { t } = useVH();
  return (
    <div className="card tool" onClick={onClick}>
      <div className={'ic ' + c} style={{ width: 30, height: 30, fontSize: 22 }}>
        <i className={ico(fa)} />
      </div>
      <div>
        <b>{t(title)}</b>
        <span>{t(sub)}</span>
      </div>
    </div>
  );
}

export function MyAccountTool() {
  const { a, setLevel } = useVH();
  return (
    <Tool
      fa="fa-house-user"
      c="c3"
      title="A minha conta"
      sub={`${a.domains.length} domínios · ${a.mails.length} e-mails · nível Utilizador`}
      onClick={() => setLevel('utilizador')}
    />
  );
}

export function HxTag({ s }: { s: HxState }) {
  return <span className={'tag hx-' + s}>{HX[s]}</span>;
}

export function HxCard({ hx }: { hx: MenuItem['hx'] }) {
  return (
    <div className="card">
      <small>No servidor Contabo (Hestia)</small>
      <HxTag s={hx.s} />
      {hx.n && <p style={{ marginTop: 8, lineHeight: 1.5 }}>{hx.n}</p>}
      {hx.cmd && (
        <p style={{ marginTop: 8, color: 'var(--muted)', fontSize: 12.5 }}>
          Comandos: <code>{hx.cmd}</code>
        </p>
      )}
    </div>
  );
}

/** Faixa por baixo da barra de cima: Widgets/Menu no painel inicial, caminho nas outras páginas, e o domínio. */
/** Seletor de domínio (lado direito da faixa de navegação): botão com o domínio e lista com filtro, como no DA */
/** Nome de domínio com sítios para passar à linha de baixo só depois dos pontos dos subdomínios: o domínio principal
 *  fica sempre inteiro (visualdesignmoz.com, entrecamposblog.co.mz — com .co.mz, .org.mz… são três partes) */
export function dominioComQuebras(nome: string) {
  const partes = nome.split('.');
  const n = partes.length;
  const sld = n >= 3 && partes[n - 1].length === 2 && /^(co|com|org|net|gov|edu|ac|nom|adv)$/.test(partes[n - 2]);
  const principal = sld ? 3 : 2;
  return partes.map((p, i) => (
    <Fragment key={i}>
      {i > 0 && '.'}
      {i > 0 && n - i >= principal && <wbr />}
      {p}
    </Fragment>
  ));
}

function DomSelector({ soSites, url }: { soSites?: boolean; url?: Screen['dominioUrl'] }) {
  const { s, a, t, setDominio, nav } = useVH();
  // só os domínios com que a página trabalha: o seletor mostra sempre o mesmo domínio que a página
  const daPagina = a.domains.filter((d) => !soSites || (!d.soEmail && !d.soDominio)).map((d) => d.name); // o principal vem à cabeça (vhost-dados.ts)
  const doms = [...daPagina].sort((x, y) => x.localeCompare(y));
  // domínio do endereço; senão o escolhido; sem escolha (ou fora desta página): o principal da conta
  const atual = url?.d || (s.dominio && daPagina.includes(s.dominio) ? s.dominio : daPagina[0] || '');
  const [aberto, setAberto] = useState(false);
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => !caixa.current?.contains(e.target as Node) && setAberto(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAberto(false);
    document.addEventListener('mousedown', fora);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fora);
      document.removeEventListener('keydown', esc);
    };
  }, [aberto]);
  if (!doms.length) return null;
  const lista = doms.filter((d) => d.includes(q.trim().toLowerCase()));
  const escolher = (d?: string) => {
    if (!d) return;
    setAberto(false);
    if (d === atual) return;
    if (url) {
      setDominio(d, false);
      nav(url.ir(d));
    } else setDominio(d);
  };
  const teclas = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') (e.preventDefault(), setI((x) => Math.min(x + 1, lista.length - 1)));
    else if (e.key === 'ArrowUp') (e.preventDefault(), setI((x) => Math.max(x - 1, 0)));
    else if (e.key === 'Enter') (e.preventDefault(), escolher(lista[i]));
  };
  return (
    <div className="da-domain-selector dom-sel" ref={caixa}>
      <button
        className={'dom-btn' + (aberto ? ' on' : '')}
        onClick={() => {
          setAberto(!aberto);
          setQ('');
          setI(Math.max(0, doms.indexOf(atual)));
        }}
        aria-haspopup="listbox"
        aria-expanded={aberto}
        title={t('Escolher domínio')}
      >
        <i className="fa-solid fa-globe" />
        {/* um domínio comprido: a letra diminui até caber numa linha (titulo-ajustado.ts); só no limite passa à linha de
            baixo, encostado à direita e partido em qualquer letra (Silva, 14/10/2026) — nunca "…" */}
        <span>{atual}</span>
        <span className="chevs" aria-hidden>
          <i className="fa-solid fa-chevron-up" />
          <i className="fa-solid fa-chevron-down" />
        </span>
      </button>
      {aberto && (
        <div className="dom-menu">
          <div className="dom-filtro">
            <i className="fa-solid fa-filter" />
            <input
              autoFocus
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setI(0);
              }}
              onKeyDown={teclas}
              placeholder={t('Filtrar domínios')}
              aria-label={t('Filtrar domínios')}
            />
            <button onClick={() => (q ? setQ('') : setAberto(false))} title={t(q ? 'Limpar' : 'Fechar')}>
              <i className="fa-solid fa-xmark" />
            </button>
          </div>
          <div className="dom-lista" role="listbox">
            {lista.map((d, k) => (
              <button key={d} role="option" aria-selected={d === atual} className={(d === atual ? 'on' : '') + (k === i ? ' foco' : '')} onMouseEnter={() => setI(k)} onClick={() => escolher(d)}>
                {d === atual && <i className="fa-solid fa-check" />}
                <span>{d}</span>
              </button>
            ))}
            {!lista.length && <div className="dom-vazio">{t('Nenhum domínio com esse nome')}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

export function SwitcherBar({ title, crumbs, dominios, dominioUrl }: { title: string; crumbs?: { t: string; path?: string }[]; dominios?: Screen['dominios']; dominioUrl?: Screen['dominioUrl'] }) {
  const { s, a, t, go, nav, toast, setDashTab } = useVH();
  const trail = crumbs && crumbs.length ? crumbs : [{ t: title || s.page }];
  const doms = a && a.domains && a.domains.length ? a.domains : [{ name: '—' }];
  const isHome = s.page === 'inicio' || !s.page;
  return (
    <div className="da-switcher-bar">
      {isHome ? (
        <div className="da-switcher-tabs">
          <button className={'da-sw-tab' + (s.dashTab === 'widgets' ? ' on' : '')} onClick={() => setDashTab('widgets')} title="Widgets">
            <i className="fa-solid fa-bars-staggered" /> Widgets
          </button>
          <button className={'da-sw-tab' + (s.dashTab === 'menu' ? ' on' : '')} onClick={() => setDashTab('menu')} title={t('Menu')}>
            <i className="fa-solid fa-border-all" /> {t('Menu')}
          </button>
        </div>
      ) : (
        <div className="da-breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>
          {/* no telemóvel só a casa (volta ao Início): o nome da página já está na barra de cima e o domínio fica com o
              resto da faixa (Silva, 14/10/2026) */}
          <a className="da-bc-casa" onClick={() => go('inicio')} title={t('Início')} aria-label={t('Início')}>
            <i className="fa-solid fa-house" />
          </a>
          <i className="fa-solid fa-folder-tree" style={{ color: 'var(--red)', fontSize: 13, marginRight: 2 }} />
          <a onClick={() => go('inicio')} style={{ cursor: 'pointer', color: 'var(--muted)', textDecoration: 'none' }}>
            {t(s.level ? nomeNivel(s.level) : 'Início')}
          </a>
          {trail.map((c, i) => (
            <Fragment key={i}>
              <i className="fa-solid fa-chevron-right" style={{ fontSize: 10, color: 'var(--muted)' }} />
              {c.path && i < trail.length - 1 ? (
                <a onClick={() => nav(c.path!)} style={{ cursor: 'pointer', color: 'var(--muted)', textDecoration: 'none' }}>
                  {t(c.t)}
                </a>
              ) : (
                <span style={{ color: i === trail.length - 1 ? 'var(--red)' : 'var(--ink)', fontWeight: i === trail.length - 1 ? 800 : 700 }}>
                  {t(c.t)}
                </span>
              )}
            </Fragment>
          ))}
        </div>
      )}
      <DomSelector soSites={dominios === 'sites'} url={dominioUrl} />
    </div>
  );
}

/** Faixa amarela de "Entrar como" */
export function ImpBanner() {
  const { s, a, me, t, backToMine } = useVH();
  if (!s.stack.length) return null;
  const o = s.acc[s.login];
  return (
    <div className="imp">
      <i className="fa-solid fa-user-secret" />
      <div>
        Está a ver o painel de{' '}
        <b>
          {a.name} ({me})
        </b>{' '}
        · {ROLES[a.role]}. A sua sessão é de <b>{o.name}</b> ({ROLES[o.role]}).
      </div>
      <button className="btn g sm" onClick={backToMine}>
        <i className="fa-solid fa-arrow-left" />
        {t('Voltar ao meu painel')}
      </button>
    </div>
  );
}

/** Notas técnicas no fim da página (endereço, equivalente DirectAdmin e situação no Hestia) */
export function RouteFoot() {
  const { s } = useVH();
  const g = GLOBAL[s.page];
  if (!s.notes || (g && g.demo)) return null;
  const it = g ? gItem(s) : findItem(s.level, s.page);
  if (!it) return null;
  return (
    <div className="rfoot">
      <span>
        Endereço no VisualHost <code>{route(s.level, s.page) + (g && g.sub ? '/' + s.gsub : '')}</code>
      </span>
      <span>
        Equivalente no DirectAdmin <code>{it.da}</code>
      </span>
      <span>
        No servidor <HxTag s={it.hx.s} />
      </span>
    </div>
  );
}

/** Estado do servidor (dados reais: Hestia + recursos do sistema), no painel inicial do administrador */
export function ServerInfoCard() {
  const { s, me, go } = useVH();
  const v = s.srv;
  if (!v) return null;
  const label = { fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.4px' } as const;
  const metric = { display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'var(--muted)', fontSize: 10.5 } as const;
  const parados = v.servicos.filter((x) => !x.ativo);
  const bd = v.servicos.find((x) => /mariadb|mysql/i.test(x.nome));
  const cpu = v.cpuPct != null && v.cpuPct >= 0 ? v.cpuPct : Math.min(100, Math.round((v.carga[0] / Math.max(1, v.cpus)) * 1000) / 10);
  const gbT = (n: number) => String(n).replace('.', ',') + ' GB';
  const discoPct = v.discoTotalGb ? Math.min(100, Math.round((v.discoUsadoGb / v.discoTotalGb) * 1000) / 10) : 0;
  // o disco foi aumentado mas a partição do sistema ainda não foi alargada (o espaço novo ainda não se pode usar)
  const porAlargar = !!v.discoFisicoGb && v.discoFisicoGb > v.discoTotalGb * 1.05;
  const cor = (p: number) => (p >= 85 ? 'var(--red)' : p >= 65 ? '#f59e0b' : '#10b981');
  const maior = Object.entries(s.acc).sort((x, y) => (y[1].discoMb || 0) - (x[1].discoMb || 0))[0];
  const pct = (n: number) => String(n).replace('.', ',') + '%';
  return (
    <div className="card server-card" style={{ marginBottom: 16, padding: 16, borderRadius: 'var(--r)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, paddingBottom: 10, borderBottom: '1px solid var(--line)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, fontWeight: 700, letterSpacing: '.5px', color: 'var(--muted)' }}>
          <span style={{ color: parados.length ? '#f59e0b' : '#10b981', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <i className="fa-solid fa-circle" style={{ fontSize: 7 }} />
            <span style={{ color: 'var(--muted)' }}>SERVIDOR</span>
          </span>
          <span style={{ width: 1, height: 12, background: 'var(--line)', display: 'inline-block' }} />
          <span style={{ color: parados.length ? '#f59e0b' : '#10b981' }} title={parados.map((x) => x.nome).join(', ')}>
            {parados.length ? parados.length + (parados.length === 1 ? ' serviço parado' : ' serviços parados') : 'activo'}
          </span>
        </div>
        {/* a chave abre o Monitor de processos: ver e parar o que mais gasta CPU (Silva, 16/10/2026) */}
        <button type="button" className="srv-chave" onClick={() => go('processos')} title="Monitor de processos — parar o que mais gasta CPU" aria-label="Monitor de processos">
          <i className="fa-solid fa-wrench" />
        </button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <small style={label}>Utilizador</small>
        <strong style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--ink)' }}>{me}</strong>
      </div>

      {/* o nome da marca no lugar do endereço do servidor (pedido do Silva, 14/10/2026: o endereço longo encostava ao
          título); o endereço, o sistema e há quanto tempo está ligado ficam no texto que aparece ao passar o rato */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <small style={label}>Servidor</small>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', textAlign: 'right' }} title={v.hostname + ' · ' + v.so + ' · Hestia ' + v.hestia + ' · ligado há ' + v.ligadoHa}>
          VisualDesign
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <small style={label}>IP do Servidor</small>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{v.ips[0] || '—'}</span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid var(--line)', fontSize: 12 }}>
        <div>
          <b style={{ fontWeight: 800, color: 'var(--ink)' }}>{v.nSites}</b> <span style={{ color: 'var(--muted)', fontWeight: 700, fontSize: 10.5 }}>WEBSITES</span>
        </div>
        <div style={{ textAlign: 'right' }}>
          <b style={{ fontWeight: 800, color: 'var(--ink)' }}>{v.nContas}</b> <span style={{ color: 'var(--muted)', fontWeight: 700, fontSize: 10.5 }}>UTILIZADORES</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
        {bd && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11.5 }}>
            <span style={metric}>
              <i className="fa-solid fa-database" style={{ color: bd.ativo ? '#10b981' : 'var(--red)' }} /> BASE DE DADOS ({bd.nome.toUpperCase()})
            </span>
            <span style={{ color: bd.ativo ? '#10b981' : 'var(--red)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {bd.ativo ? 'Ativo' : 'Parado'} <i className="fa-solid fa-circle" style={{ fontSize: 7 }} />
            </span>
          </div>
        )}

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
            <span style={metric} title={'Carga ' + v.carga.join(' / ') + ' em ' + v.cpus + ' processadores'}>
              <i className="fa-solid fa-gear" style={{ color: 'var(--red)' }} /> CONSUMO CPU
            </span>
            <b style={{ color: 'var(--ink)' }}>
              {pct(cpu)} <span style={{ color: 'var(--muted)', fontWeight: 600 }}>de {v.cpus} núcleos</span>
            </b>
          </div>
          <div className="bar" style={{ height: 6 }}>
            <span style={{ width: cpu + '%', background: cor(cpu) }} />
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
            <span style={metric} title={'de ' + String(v.memTotalGb).replace('.', ',') + ' GB'}>
              <i className="fa-solid fa-memory" style={{ color: '#0284c7' }} /> USO DE RAM
            </span>
            <b style={{ color: 'var(--ink)' }}>
              {pct(v.memPct)} <span style={{ color: 'var(--muted)', fontWeight: 600 }}>de {gbT(v.memTotalGb)}</span>
            </b>
          </div>
          <div className="bar" style={{ height: 6 }}>
            <span style={{ width: v.memPct + '%', background: v.memPct >= 85 ? 'var(--red)' : '#0284c7' }} />
          </div>
        </div>

        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
            <span style={metric}>
              <i className="fa-solid fa-hard-drive" style={{ color: '#7c3aed' }} /> DISCO USADO
            </span>
            <b style={{ color: 'var(--ink)' }}>
              {gbT(v.discoUsadoGb)} <span style={{ color: 'var(--muted)', fontWeight: 600 }}>de {gbT(v.discoTotalGb)} · {pct(discoPct)}</span>
            </b>
          </div>
          <div className="bar" style={{ height: 6 }}>
            <span style={{ width: discoPct + '%', background: cor(discoPct) }} />
          </div>
          {porAlargar && (
            <div style={{ marginTop: 6, fontSize: 11, lineHeight: 1.4, color: '#b45309' }}>
              O disco tem {gbT(v.discoFisicoGb!)}, mas a partição do sistema só usa {gbT(v.discoTotalGb)}: falta alargá-la para o espaço novo
              ficar disponível.
            </div>
          )}
        </div>
      </div>

      {maior && (
        <div className="server-card-box">
          <small style={{ display: 'block', fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 3 }}>
            CONTA COM MAIS ESPAÇO:
          </small>
          <div style={{ fontWeight: 800, color: 'var(--ink)', marginBottom: 2 }}>{maior[0]}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
            Disco: <b style={{ color: 'var(--red)' }}>{maior[1].disk}</b> | Domínios: <b style={{ color: 'var(--ink)' }}>{maior[1].domains.length}</b>
          </div>
        </div>
      )}
    </div>
  );
}

/** Separador "Menu" do painel inicial: todas as páginas do painel em cartões, por categoria */
export function DaHomeCards() {
  const { s, t, go, hasFeat } = useVH();
  const categories = MENU[s.level].filter(([g]) => g !== 'Início');
  return (
    <div className="da-home-wrapper">
      <div className="da-home-grid">
        {categories.map(([g, items]) => {
          const vis = items.filter((it) => hasFeat(it.feat, it.id));
          if (!vis.length) return null;
          return (
            <div className="da-cat-section" style={{ marginBottom: 24 }} key={g}>
              <div className="da-cat-header">
                <span className="da-cat-title">{t(g)}</span>
              </div>
              <div className="da-grid">
                {vis.map((it) => (
                  <div className="da-card" onClick={() => go(it.id)} key={it.id}>
                    <div className={'da-card-ic ' + it.c}>
                      <i className={ico(it.fa)} />
                    </div>
                    <span className="da-card-title">{t(it.t)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Contas (admin: todas / por tipo; revenda: só as que criou)
export function UsersTable({ rows, showCreator = true }: { rows: [string, Account][]; showCreator?: boolean }) {
  const vh = useVH();
  const { s, me, t, openM, enterAs } = vh;
  const toggleState = (u: string) => {
    const suspender = s.acc[u].state === 'ok';
    noServidor(vh, { acao: suspender ? 'suspender' : 'reativar', contas: [u] }, () => u + ': ' + (suspender ? 'suspenso' : 'reativado'));
  };
  return (
    <div className="tbl dt-empilhar">
      <table>
        <thead>
          <tr>
            <th>{t('Utilizador')}</th>
            <th>{t('Tipo')}</th>
            {showCreator && <th>{t('Criado por')}</th>}
            <th>{t('Pacote')}</th>
            <th>{t('Domínios')}</th>
            <th>{t('Disco')}</th>
            <th>{t('Estado')}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map(([u, a]) => {
              const ok = a.state === 'ok';
              return (
                <tr key={u}>
                  <td>
                    <div className="cell">
                      <div className={'ic ' + RC[a.role]}>
                        <i className={'fa-solid ' + RI[a.role]} />
                      </div>
                      <div>
                        <b>{u}</b>
                      </div>
                    </div>
                  </td>
                  <td data-t={t('Tipo')}>
                    <span className="tag off">{t(ROLES[a.role])}</span>
                  </td>
                  {showCreator && <td data-t={t('Criado por')}>{a.creator}</td>}
                  <td data-t={t('Pacote')}>{a.pkg}</td>
                  <td data-t={t('Domínios')}>{a.domains.length}</td>
                  <td data-t={t('Disco')}>{a.disk}</td>
                  <td data-t={t('Estado')}>{ok ? <span className="tag ok">{t('Ativo')}</span> : <span className="tag off">{t('Suspenso')}</span>}</td>
                  <td className="dt-acoes-linha" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {u === me ? (
                      <span className="tag off">{t('A sua conta')}</span>
                    ) : (
                      <>
                        {s.level === 'admin' && (
                          <>
                            <button className="btn g sm" onClick={() => openM(<ChangeRoleModal u={u} />)} title={t('Mudar tipo de conta')}>
                              <i className="fa-solid fa-user-tag" />
                              <span className="btn-txt-tel">{t('Mudar tipo de conta')}</span>
                            </button>{' '}
                          </>
                        )}
                        <button className="btn g sm" onClick={() => toggleState(u)} title={t(ok ? 'Suspender' : 'Reativar')}>
                          <i className={'fa-solid ' + (ok ? 'fa-pause' : 'fa-play')} />
                          <span className="btn-txt-tel">{t(ok ? 'Suspender' : 'Reativar')}</span>
                        </button>{' '}
                        <button className="btn g sm" title={t('Entrar no painel desta conta')} onClick={() => enterAs(u)}>
                          <i className="fa-solid fa-right-to-bracket" />
                          {t('Entrar')}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            })
          ) : (
            <tr>
              <td colSpan={8} className="empty">
                Ainda não há contas aqui
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function DomTable({ filter = '' }: { filter?: string }) {
  const { a, s, t, nav, setDominio } = useVH();
  const rows = a.domains.filter((d) => d.name.includes(filter));
  // o disco de cada linha é só o do site (ficheiros); o total da conta está no cartão "Espaço em disco" — dito às claras
  // para o cliente não comparar os dois (Silva, 16/10/2026: "não é explícito, ele pode reclamar")
  const ajudaDisco = t('Espaço usado pelos ficheiros deste site. O total da conta (com e-mails e bases de dados) está em Espaço em disco, por cima.');
  return (
    <div className="tbl dt-empilhar dominios-widget-list">
      <table>
        <thead>
          <tr>
            <th>{t('Domínio')}</th>
            <th>SSL</th>
            <th>{t('E-mails')}</th>
            <th>PHP</th>
            <th title={ajudaDisco}>{t('Disco do site')}</th>
            <th>{t('Estado')}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((d) => (
              <tr key={d.name}>
                <td>
                  <div className="cell">
                    <div className="ic c1">
                      <i className={d.wp ? 'fa-brands fa-wordpress' : 'fa-solid fa-globe'} />
                    </div>
                    <div>
                      <b
                        style={{ cursor: 'pointer' }}
                        title={d.name}
                        onClick={() => {
                          setDominio(d.name);
                          nav('/' + (s.level || 'utilizador') + '/dominios/' + encodeURIComponent(d.name));
                        }}
                      >
                        {/* o nome fica sempre numa só linha: a coluna alarga conforme o nome mais comprido (Silva, 20/10/2026) */}
                        {d.name}
                      </b>
                    </div>
                  </div>
                </td>
                <td data-t="SSL">{d.ssl === 'ok' ? <span className="tag ok">{t('Válido')}</span> : <span className="tag w">{t('Sem SSL')}</span>}</td>
                <td data-t={t('E-mails')}>{a.mails.filter((m) => m.dom === d.name).length}</td>
                <td data-t="PHP">{d.php}</td>
                <td data-t={t('Disco do site')} title={ajudaDisco}>{d.disk}</td>
                <td data-t={t('Estado')}>{d.status === 'ok' ? <span className="tag ok">{t('Ativo')}</span> : <span className="tag w">{t('Atenção')}</span>}</td>
                <td className="dt-acoes-linha" style={{ textAlign: 'right' }}>
                  <button
                    className="btn g sm btn-gerir-widget"
                    onClick={() => {
                      setDominio(d.name);
                      nav('/' + (s.level || 'utilizador') + '/dominios/' + encodeURIComponent(d.name));
                    }}
                  >
                    {t('Gerir')}
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={7} className="empty">
                Nenhum domínio encontrado
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** "Domínio: x · muda-se no seletor em cima, à direita": o mesmo domínio que o seletor mostra nesta página */
export function IndicacaoDominio({ dominios, dominioUrl }: { dominios?: Screen['dominios']; dominioUrl?: Screen['dominioUrl'] }) {
  const { s, a, t } = useVH();
  const soSites = dominios === 'sites';
  const daPagina = a.domains.filter((d) => !soSites || (!d.soEmail && !d.soDominio)).map((d) => d.name);
  // as páginas do Admin e da revenda não dependem de um domínio: sem indicação (Silva, 20/10/2026), só o botão da página à direita
  if (s.level !== 'utilizador' || !daPagina.length) return <span className="dom-ctx" />;
  const atual = dominioUrl?.d || (s.dominio && daPagina.includes(s.dominio) ? s.dominio : daPagina[0] || '');
  return (
    <p className="dom-ctx">
      <i className="fa-solid fa-globe" /> <b>{atual}</b> <span>· {t('muda-se no seletor em cima, à direita')}</span>
    </p>
  );
}

/** Põe `children` (o botão da página, ou o "Ações") na linha de cima do cartão principal, com a indicação do domínio à
 *  esquerda. Sem lugar no cartão (páginas sem cartão), não desenha nada. */
export function NoTopoCartao({ children, daPagina = false }: { children: ReactNode; daPagina?: boolean }) {
  const topo = useContext(TopoCartao);
  const setOcupado = topo?.setOcupado;
  // um botão posto pela própria página (corpo): as tabelas já não levam o "Ações" para esta linha
  useEffect(() => {
    if (!daPagina || !setOcupado) return;
    setOcupado(true);
    return () => setOcupado(false);
  }, [daPagina, setOcupado]);
  const botoes = useRef<HTMLDivElement>(null);
  const temLugar = !!topo?.el;
  // telemóvel: cada botão ocupa metade da largura, mas um texto que não cabe nessa metade fica na largura toda (Silva,
  // 20/10/2026: "não forçar metade")
  useLayoutEffect(() => {
    const el = botoes.current;
    if (!el) return;
    const medir = () => {
      for (const b of Array.from(el.children) as HTMLElement[]) {
        delete b.dataset.larga;
        // largura do que está dentro do botão (ícone + texto) mais o espaço dos lados; se não cabe na metade, largura toda
        const r = document.createRange();
        r.selectNodeContents(b);
        const cs = getComputedStyle(b);
        const precisa = r.getBoundingClientRect().width + (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
        if (precisa > b.clientWidth - 1 || b.scrollWidth > b.clientWidth + 1) b.dataset.larga = '1';
      }
    };
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  });
  if (!topo?.el || !temLugar) return null;
  return createPortal(
    <div className="card-topo">
      <IndicacaoDominio dominios={topo.dominios} dominioUrl={topo.dominioUrl} />
      <div className="card-topo-btns" ref={botoes}>
        {children}
      </div>
    </div>,
    topo.el,
  );
}
