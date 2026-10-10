'use client';

// Peças repetidas dos ecrãs. Geram o mesmo HTML (e as mesmas classes) que a maquete,
// para que o CSS de generated/maquete.css se aplique tal e qual.
import { Fragment, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react';
import { useVH } from './context';
import { ChangeRoleModal } from './modals';
import { HX, LEVELS, MENU, ROLES } from './generated/data';
import { findItem, gItem, ico, initials, route } from './state';
import type { Account, HxState, MenuItem, Role } from './types';
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

export function Avatar({ a }: { a: Account }) {
  const email = (a.email || '').trim().toLowerCase();
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
      {src && <img alt="" hidden={!shown} src={src} onLoad={() => setShown(true)} onError={() => setSrc(null)} />}
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
function DomSelector() {
  const { s, a, t, setDominio } = useVH();
  const doms = a.domains.map((d) => d.name).sort((x, y) => x.localeCompare(y));
  const atual = s.dominio && doms.includes(s.dominio) ? s.dominio : doms[0] || '';
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
    if (d !== atual) setDominio(d);
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

export function SwitcherBar({ title, crumbs }: { title: string; crumbs?: { t: string; path?: string }[] }) {
  const { s, a, t, go, nav, toast, setDashTab } = useVH();
  const trail = crumbs && crumbs.length ? crumbs : [{ t: title || s.page }];
  const doms = a && a.domains && a.domains.length ? a.domains : [{ name: '—' }];
  const isHome = s.page === 'inicio' || !s.page;
  return (
    <div className="da-switcher-bar">
      {isHome ? (
        <div className="da-switcher-tabs">
          <button className={'da-sw-tab' + (s.dashTab === 'widgets' ? ' on' : '')} onClick={() => setDashTab('widgets')}>
            <i className="fa-solid fa-bars-staggered" /> Widgets
          </button>
          <button className={'da-sw-tab' + (s.dashTab === 'menu' ? ' on' : '')} onClick={() => setDashTab('menu')}>
            <i className="fa-solid fa-border-all" /> {t('Menu')}
          </button>
        </div>
      ) : (
        <div className="da-breadcrumb" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: 'var(--muted)' }}>
          <i className="fa-solid fa-folder-tree" style={{ color: 'var(--red)', fontSize: 13, marginRight: 2 }} />
          <a onClick={() => go('inicio')} style={{ cursor: 'pointer', color: 'var(--muted)', textDecoration: 'none' }}>
            {t(LEVELS[s.level] || 'Início')}
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
      <DomSelector />
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
  const cpu = Math.min(100, Math.round((v.carga[0] / Math.max(1, v.cpus)) * 1000) / 10);
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
        <i className="fa-solid fa-wrench" style={{ color: 'var(--muted)', fontSize: 13, cursor: 'pointer' }} onClick={() => go('servicos')} title="Gerir servidor" />
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <small style={label}>Utilizador</small>
        <strong style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--ink)' }}>{me}</strong>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <small style={label}>Servidor</small>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }} title={v.so + ' · Hestia ' + v.hestia + ' · ligado há ' + v.ligadoHa}>
          {v.hostname}
        </span>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
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
            <b style={{ color: 'var(--ink)' }}>{pct(cpu)}</b>
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
            <b style={{ color: 'var(--ink)' }}>{pct(v.memPct)}</b>
          </div>
          <div className="bar" style={{ height: 6 }}>
            <span style={{ width: v.memPct + '%', background: v.memPct >= 85 ? 'var(--red)' : '#0284c7' }} />
          </div>
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
          const vis = items.filter((it) => hasFeat(it.feat));
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
  const { s, me, t, toast, openM, enterAs, updateAcc } = useVH();
  const toggleState = (u: string) => {
    const next = s.acc[u].state === 'ok' ? 'off' : 'ok';
    updateAcc((acc) => {
      acc[u].state = next;
    });
    toast(u + ': ' + (next === 'ok' ? 'reativado' : 'suspenso'));
  };
  return (
    <div className="tbl">
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
                        <span>{a.name}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="tag off">{t(ROLES[a.role])}</span>
                  </td>
                  {showCreator && <td>{a.creator}</td>}
                  <td>{a.pkg}</td>
                  <td>{a.domains.length}</td>
                  <td>{a.disk}</td>
                  <td>{ok ? <span className="tag ok">{t('Ativo')}</span> : <span className="tag off">{t('Suspenso')}</span>}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {u === me ? (
                      <span className="tag off">{t('A sua conta')}</span>
                    ) : (
                      <>
                        {s.level === 'admin' && (
                          <>
                            <button className="btn g sm" onClick={() => openM(<ChangeRoleModal u={u} />)} title={t('Mudar tipo de conta')}>
                              <i className="fa-solid fa-user-tag" />
                            </button>{' '}
                          </>
                        )}
                        <button className="btn g sm" onClick={() => toggleState(u)} title={t(ok ? 'Suspender' : 'Reativar')}>
                          <i className={'fa-solid ' + (ok ? 'fa-pause' : 'fa-play')} />
                        </button>{' '}
                        <button className="btn g sm" onClick={() => enterAs(u)}>
                          <i className="fa-solid fa-right-to-bracket" />
                          {t('Entrar como')}
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
  const { a, t, toast } = useVH();
  const rows = a.domains.filter((d) => d.name.includes(filter));
  return (
    <div className="tbl">
      <table>
        <thead>
          <tr>
            <th>{t('Domínio')}</th>
            <th>SSL</th>
            <th>{t('E-mails')}</th>
            <th>PHP</th>
            <th>{t('Disco')}</th>
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
                      <b>{d.name}</b>
                      <span>{d.wp ? 'WordPress' : 'Site'}</span>
                    </div>
                  </div>
                </td>
                <td>{d.ssl === 'ok' ? <span className="tag ok">{t('Válido')}</span> : <span className="tag w">{t('Expira em 12 dias')}</span>}</td>
                <td>{a.mails.filter((m) => m.dom === d.name).length}</td>
                <td>{d.php}</td>
                <td>{d.disk}</td>
                <td>{d.status === 'ok' ? <span className="tag ok">{t('Ativo')}</span> : <span className="tag w">{t('Atenção')}</span>}</td>
                <td style={{ textAlign: 'right' }}>
                  <button className="btn g sm" onClick={() => toast('Detalhe de ' + d.name + ' (próxima fase)')}>
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
