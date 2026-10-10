'use client';

// Gestão de contas: listas, ver/modificar conta, criar contas, mudar senhas, mover clientes e modelos de mensagem.
// Campos e colunas copiados do DirectAdmin (ver VisualHost/04-da-gestao-de-contas.md).
import { useRef, useState } from 'react';
import { useVH, type VH } from '../context';
import type { ScreenFn } from '../screens';
import { ChangeRoleModal } from '../modals';
import { ROLES } from '../generated/data';
import { noServidor } from './acoes';
import { isUser, pacoteDe, type St } from '../state';
import { RC, RI } from '../ui';
import type { Account, Role } from '../types';
import { Check, DataTable, Frm, Row, Senha, Tabs, type Bulk, type Col } from './componentes';
import { ComoFuncionaRevenda, Confirmar, FormPacoteRevenda, FormPacoteUtilizador } from './pacotes';
import {
  FUNC_REVENDA,
  FUNC_UTILIZADOR,
  LIMITES_REVENDA,
  LIMITES_UTILIZADOR,
  MODELOS_PREDEFINIDOS,
  RECURSOS,
  featsEfetivas,
  hoje,
  limTxt,
  pacoteRevendaVazio,
  pacoteVazio,
  type Lim,
  type PacoteRevenda,
  type PacoteUtilizador,
} from './dados';

type Kind = 'todos' | 'meus' | 'revenda' | 'admin';
type R = [string, Account];

const base = (s: St) => '/' + s.level + '/' + s.page;
const enc = encodeURIComponent;

/** Onde se vê uma conta */
function verPath(s: St, u: string) {
  const a = s.acc[u];
  if (s.level === 'revenda') return '/revenda/clientes/' + enc(u);
  return (a?.role === 'revenda' ? '/admin/revendedores/' : a?.role === 'admin' ? '/admin/administradores/' : '/admin/utilizadores/') + enc(u);
}
const pacoteRevendaDe = (s: St, u: string): PacoteRevenda => s.db.rcustom[u] || s.db.rpkgs[s.acc[u]?.pkg] || s.db.rpkgs['Completo'] || pacoteRevendaVazio();
/** Limites da conta (administrador: sem limites) */
function limConta(s: St, u: string): Record<string, Lim> | null {
  const a = s.acc[u];
  if (!a || a.role === 'admin') return null;
  if (a.role === 'revenda') return pacoteRevendaDe(s, u).lim;
  return pacoteDe(s, u)?.lim || null;
}
const comLimite = (v: string | number, l?: Lim) => `${v} / ${l ? limTxt(l) : '∞'}`;
const info = (s: St, u: string) => s.db.info[u] || { bw: '0 MB', ip: '', dbs: 0, criada: '—' };
/** IPs do servidor (administrador) ou os das contas que se vêem */
const ipsDe = (s: St) => (s.srv?.ips.length ? s.srv.ips : [...new Set(Object.values(s.db.info).map((i) => i.ip).filter(Boolean))]);
const nUtil = (s: St, u: string) => Object.values(s.acc).filter((a) => a.creator === u).length;
/** Contas de cliente do revendedor e o máximo do seu pacote de revenda (null = sem limite; administradores não têm limite).
 *  No site é o mesmo controlo: assertResellerHostingQuota (contas com parent_username = revendedor). */
function vagas(s: St, u: string): { usadas: number; limite: number | null; plano: string } {
  const a = s.acc[u];
  const usadas = Object.values(s.acc).filter((x) => x.creator === u && isUser(x.role)).length;
  if (a?.role !== 'revenda') return { usadas, limite: null, plano: '' };
  const l = pacoteRevendaDe(s, u).lim.users;
  return { usadas, limite: !l || l.unl ? null : Number(l.v) || 0, plano: s.db.rcustom[u] ? 'personalizado' : a.pkg };
}
const semVagas = (v: { usadas: number; limite: number | null }, mais = 1) => v.limite !== null && v.usadas + mais > v.limite;
const enviados = (a: Account) => a.mails.reduce((n, m) => n + m.sent, 0);
const personalizado = (s: St, u: string) => !!(s.db.custom[u] || s.db.rcustom[u]);

function CellConta({ u, a }: { u: string; a: Account }) {
  const { s, nav } = useVH();
  return (
    <div className="cell">
      <div className={'ic ' + RC[a.role]}>
        <i className={'fa-solid ' + RI[a.role]} />
      </div>
      <div>
        <a className="lk" style={{ display: 'block' }} onClick={() => nav(verPath(s, u))}>
          {u}
        </a>
        <span>{a.name}</span>
      </div>
    </div>
  );
}

function Doms({ a }: { a: Account }) {
  if (!a.domains.length) return <span style={{ color: 'var(--muted)' }}>—</span>;
  return (
    <div className="doms">
      {a.domains.slice(0, 3).map((d) => (
        <a key={d.name} href={'http://' + d.name} target="_blank" rel="noreferrer">
          {d.name}
        </a>
      ))}
      {a.domains.length > 3 && <span style={{ color: 'var(--muted)', fontSize: 12 }}>+{a.domains.length - 3} mais</span>}
    </div>
  );
}

const Estado = ({ a }: { a: Account }) => {
  const { t } = useVH();
  return a.state === 'ok' ? <span className="tag ok">{t('Ativo')}</span> : <span className="tag off">{t('Suspenso')}</span>;
};

// ---------- Janelas das ações em massa ----------
function MensagemModal({ users }: { users: string[] }) {
  const { t, toast, closeM } = useVH();
  const [assunto, setAssunto] = useState('');
  const [msg, setMsg] = useState('');
  const [prio, setPrio] = useState('Normal');
  const [soEmail, setSoEmail] = useState(false);
  return (
    <>
      <h3>{t('Enviar mensagem')}</h3>
      <p style={{ color: 'var(--muted)', marginBottom: 12 }}>Para: {users.join(', ')}</p>
      <div className="f">
        <label>{t('Assunto')}</label>
        <input value={assunto} onChange={(e) => setAssunto(e.target.value)} />
      </div>
      <div className="f">
        <label>{t('Prioridade')}</label>
        <select value={prio} onChange={(e) => setPrio(e.target.value)}>
          <option>Normal</option>
          <option>Alta</option>
          <option>Baixa</option>
        </select>
      </div>
      <div className="f">
        <label>{t('Mensagem')}</label>
        <textarea className="inp" rows={6} style={{ width: '100%' }} value={msg} onChange={(e) => setMsg(e.target.value)} />
      </div>
      <Check checked={soEmail} onChange={setSoEmail} label="Enviar só por e-mail (sem aviso no painel)" />
      <div className="mfoot">
        <button className="btn g" onClick={closeM}>
          {t('Cancelar')}
        </button>
        <button
          className="btn r"
          onClick={() => {
            if (!assunto.trim() || !msg.trim()) return toast('Escreva o assunto e a mensagem');
            closeM();
            toast('Enviar mensagens às contas ainda não está ligado: nada foi enviado');
          }}
        >
          <i className="fa-solid fa-paper-plane" />
          {t('Enviar')}
        </button>
      </div>
    </>
  );
}

function MudarPacoteModal({ users }: { users: string[] }) {
  const vh = useVH();
  const { s, t, closeM } = vh;
  const nomes = Object.keys(s.db.pkgs);
  const [p, setP] = useState(nomes[0]);
  return (
    <>
      <h3>{t('Mudar pacote')}</h3>
      <p style={{ color: 'var(--muted)', marginBottom: 12 }}>Contas: {users.join(', ')}</p>
      <div className="f">
        <label>{t('Novo pacote')}</label>
        <select value={p} onChange={(e) => setP(e.target.value)}>
          {nomes.map((n) => (
            <option key={n}>{n}</option>
          ))}
        </select>
      </div>
      <div className="mfoot">
        <button className="btn g" onClick={closeM}>
          {t('Cancelar')}
        </button>
        <button
          className="btn r"
          onClick={() => {
            closeM();
            noServidor(vh, { acao: 'pacote', contas: users, pacote: p }, (n) => n + ' conta(s) passaram ao pacote ' + p);
          }}
        >
          {t('Guardar')}
        </button>
      </div>
    </>
  );
}

function MudarIpModal({ users }: { users: string[] }) {
  const { s, t, toast, closeM, updateDb } = useVH();
  const IPS = ipsDe(s);
  const [ip, setIp] = useState(IPS[0] || '');
  return (
    <>
      <h3>{t('Mudar IP')}</h3>
      <p style={{ color: 'var(--muted)', marginBottom: 12 }}>Contas: {users.join(', ')}</p>
      <div className="f">
        <label>IP</label>
        <select value={ip} onChange={(e) => setIp(e.target.value)}>
          {IPS.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </div>
      <div className="mfoot">
        <button className="btn g" onClick={closeM}>
          {t('Cancelar')}
        </button>
        <button
          className="btn r"
          onClick={() => {
            closeM();
            toast('Mudar o IP ainda não está ligado ao servidor: nada foi alterado (' + ip + ')');
          }}
        >
          {t('Guardar')}
        </button>
      </div>
    </>
  );
}

// ---------- Listas ----------
function ListaContas({ kind }: { kind: Kind }) {
  const vh = useVH();
  const { s, me, t, toast, openM, enterAs } = vh;
  const rows: R[] = Object.entries(s.acc).filter(([, a]) => kind === 'todos' || (kind === 'meus' ? a.creator === me && isUser(a.role) : a.role === kind));
  const L = (u: string) => limConta(s, u);

  const cols: Col<R>[] = [{ k: 'user', t: kind === 'revenda' ? 'Nome' : 'Utilizador', sort: (r) => r[0], cell: ([u, a]) => <CellConta u={u} a={a} /> }];
  if (kind === 'todos') {
    cols.push({ k: 'tipo', t: 'Tipo', sort: (r) => ROLES[r[1].role], cell: ([, a]) => <span className="tag off">{t(ROLES[a.role])}</span> });
    cols.push({ k: 'criador', t: 'Criado por', sort: (r) => r[1].creator, cell: ([, a]) => a.creator });
  }
  cols.push({ k: 'bw', t: 'Tráfego', cell: ([u]) => comLimite(info(s, u).bw, L(u)?.bw) });
  cols.push({ k: 'disk', t: 'Espaço usado', cell: ([u, a]) => comLimite(a.disk, L(u)?.disk) });
  if (kind === 'revenda' || kind === 'admin') cols.push({ k: 'nusers', t: 'Nº de utilizadores', sort: (r) => nUtil(s, r[0]), cell: ([u]) => comLimite(nUtil(s, u), L(u)?.users) });
  cols.push({ k: 'ndom', t: 'Nº de domínios', sort: (r) => r[1].domains.length, cell: ([u, a]) => comLimite(a.domains.length, L(u)?.domains) });
  if (kind === 'todos' || kind === 'meus') {
    cols.push({ k: 'doms', t: 'Domínios', cell: ([, a]) => <Doms a={a} /> });
    cols.push({ k: 'ip', t: 'IPs', cell: ([u]) => info(s, u).ip.split(' - ')[0] });
  }
  if (kind === 'todos') {
    cols.push({ k: 'sent', t: 'E-mails enviados', sort: (r) => enviados(r[1]), cell: ([, a]) => enviados(a) });
    cols.push({ k: 'dbs', t: 'Bases de dados', cell: ([u]) => comLimite(info(s, u).dbs, L(u)?.mysql) });
    cols.push({ k: 'criada', t: 'Criada em', cell: ([u]) => info(s, u).criada });
  }
  cols.push({
    k: 'pkg',
    t: 'Pacote',
    hidden: !(kind === 'meus' || kind === 'revenda'),
    sort: (r) => r[1].pkg,
    cell: ([u, a]) => (
      <>
        {a.pkg}
        {personalizado(s, u) && <span className="frm-tag">{t('personalizado')}</span>}
      </>
    ),
  });
  cols.push({ k: 'estado', t: 'Estado', sort: (r) => r[1].state, cell: ([, a]) => <Estado a={a} /> });

  // a sua conta e as contas de administrador do servidor não se suspendem nem se apagam
  const protegida = (k: string) => k === me || s.acc[k]?.role === 'admin';
  const estado = (keys: string[], st: 'ok' | 'off') => {
    const ks = keys.filter((k) => !protegida(k));
    if (!ks.length) return toast('A sua conta e as de administrador não podem ser suspensas');
    noServidor(vh, { acao: st === 'off' ? 'suspender' : 'reativar', contas: ks }, (n) => n + ' conta(s) ' + (st === 'off' ? 'suspensa(s)' : 'reativada(s)'));
  };
  const apagar = (keys: string[]) => {
    const prot = keys.filter(protegida);
    const comClientes = keys.filter((k) => !protegida(k) && nUtil(s, k) > 0);
    const ks = keys.filter((k) => !protegida(k) && !comClientes.includes(k));
    if (!ks.length)
      return toast(comClientes.length ? 'Mova primeiro os clientes de ' + comClientes.join(', ') : 'Estas contas não podem ser apagadas (a sua e as de administrador)');
    openM(
      <Confirmar
        titulo="Apagar contas?"
        texto={'Vai apagar do servidor ' + ks.join(', ') + ', com os domínios, e-mails, bases de dados e ficheiros. Não se pode desfazer.' + (prot.length + comClientes.length ? ' Ficam de fora: ' + [...prot, ...comClientes].join(', ') + '.' : '')}
        ok="Apagar"
        onOk={() => noServidor(vh, { acao: 'apagar', contas: ks }, (n) => n + ' conta(s) apagada(s) do servidor')}
      />,
    );
  };
  const bulk: Bulk[] = [
    { t: 'Enviar mensagem', fa: 'fa-paper-plane', run: (k) => openM(<MensagemModal users={k} />) },
    { t: 'Suspender', fa: 'fa-pause', run: (k) => estado(k, 'off') },
    { t: 'Reativar', fa: 'fa-play', run: (k) => estado(k, 'ok') },
  ];
  if (kind === 'meus') {
    bulk.push({ t: 'Mudar pacote', fa: 'fa-box', run: (k) => openM(<MudarPacoteModal users={k} />) });
    bulk.push({ t: 'Mudar IP', fa: 'fa-ethernet', run: (k) => openM(<MudarIpModal users={k} />) });
  }
  bulk.push({ t: 'Apagar', fa: 'fa-trash', run: apagar });

  return (
    <DataTable
      id={'contas-' + kind}
      rows={rows}
      cols={cols}
      rowKey={(r) => r[0]}
      search={([u, a]) => u + ' ' + a.name + ' ' + a.email + ' ' + a.domains.map((d) => d.name).join(' ')}
      bulk={bulk}
      empty="Ainda não há contas aqui"
      actions={([u, a]) =>
        u === me ? (
          <span className="tag off">{t('A sua conta')}</span>
        ) : (
          <>
            {s.level === 'admin' && (
              <>
                <button className="btn g sm" title={t('Mudar tipo de conta')} onClick={() => openM(<ChangeRoleModal u={u} />)}>
                  <i className="fa-solid fa-user-tag" />
                </button>{' '}
              </>
            )}
            <button className="btn g sm" title={t(a.state === 'ok' ? 'Suspender' : 'Reativar')} onClick={() => estado([u], a.state === 'ok' ? 'off' : 'ok')}>
              <i className={'fa-solid ' + (a.state === 'ok' ? 'fa-pause' : 'fa-play')} />
            </button>{' '}
            <button className="btn g sm" onClick={() => enterAs(u)}>
              <i className="fa-solid fa-right-to-bracket" />
              {t('Entrar como')}
            </button>
          </>
        )
      }
    />
  );
}

// ---------- Ver conta ----------
const toMB = (l: Lim) => Number(String(l.v).replace(',', '.')) * (l.unit === 'TB' ? 1048576 : l.unit === 'GB' ? 1024 : 1) || 0;
const mbTxt = (mb: number) => (mb >= 1024 ? (mb / 1024).toFixed(1).replace('.0', '').replace('.', ',') + ' GB' : mb + ' MB');

function TabUtilizadores({ u }: { u: string }) {
  const { s } = useVH();
  const rows: R[] = Object.entries(s.acc).filter(([, a]) => a.creator === u);
  const L = (x: string) => limConta(s, x);
  return (
    <DataTable
      id="conta-utilizadores"
      rows={rows}
      rowKey={(r) => r[0]}
      cols={[
        { k: 'user', t: 'Utilizador', sort: (r) => r[0], cell: ([x, a]) => <CellConta u={x} a={a} /> },
        { k: 'bw', t: 'Tráfego', cell: ([x]) => comLimite(info(s, x).bw, L(x)?.bw) },
        { k: 'disk', t: 'Espaço usado', cell: ([x, a]) => comLimite(a.disk, L(x)?.disk) },
        { k: 'ndom', t: 'Nº de domínios', cell: ([x, a]) => comLimite(a.domains.length, L(x)?.domains) },
      ]}
      empty="Esta conta ainda não tem clientes"
    />
  );
}

function TabDominios({ a }: { a: Account }) {
  const { t } = useVH();
  return (
    <DataTable
      id="conta-dominios"
      rows={a.domains}
      rowKey={(d) => d.name}
      cols={[
        { k: 'dom', t: 'Domínio', sort: (d) => d.name, cell: (d) => <a className="lk" href={'http://' + d.name} target="_blank" rel="noreferrer">{d.name}</a> },
        { k: 'ssl', t: 'SSL', cell: (d) => (d.ssl === 'ok' ? <span className="tag ok">{t('Válido')}</span> : <span className="tag w">{t('Expira em 12 dias')}</span>) },
        { k: 'php', t: 'PHP', cell: (d) => d.php },
        { k: 'disk', t: 'Disco', cell: (d) => d.disk },
        { k: 'mails', t: 'Contas de e-mail', cell: (d) => a.mails.filter((m) => m.dom === d.name).length },
        { k: 'estado', t: 'Estado', cell: (d) => (d.status === 'ok' ? <span className="tag ok">{t('Ativo')}</span> : <span className="tag w">{t('Atenção')}</span>) },
      ]}
      empty="Esta conta não tem domínios"
    />
  );
}

function TabUso({ u, gestor }: { u: string; gestor: boolean }) {
  const { s, t } = useVH();
  const a = s.acc[u];
  const L = limConta(s, u);
  const i = info(s, u);
  const uso: Record<string, string | number> = {
    bw: i.bw,
    disk: a.disk,
    inode: '—',
    domains: a.domains.length,
    subdomains: 0,
    emails: a.mails.length,
    forwarders: 0,
    lists: 0,
    autoresponders: 0,
    mysql: i.dbs,
    pointers: 0,
    ftp: a.domains.length ? 1 : 0,
    daily: enviados(a),
    users: nUtil(s, u),
  };
  const clientes = Object.keys(s.acc).filter((x) => s.acc[x].creator === u);
  const atribuido = (k: string, unit?: boolean) => {
    if (k === 'users') return '—';
    let total = 0;
    for (const c of clientes) {
      const l = limConta(s, c)?.[k];
      if (!l) continue;
      if (l.unl) return '∞';
      total += unit ? toMB(l) : Number(l.v) || 0;
    }
    return unit ? mbTxt(total) : total;
  };
  const campos = gestor ? LIMITES_REVENDA : LIMITES_UTILIZADOR;
  return (
    <div className="tbl">
      <table>
        <thead>
          <tr>
            <th>{t('Definição')}</th>
            <th>{t('Uso')}</th>
            {gestor && <th>{t('Atribuído')}</th>}
            <th>{t('Limite')}</th>
          </tr>
        </thead>
        <tbody>
          {campos.map((c) => (
            <tr key={c.k}>
              <td>{t(c.t)}</td>
              <td>{uso[c.k] ?? 0}</td>
              {gestor && <td>{atribuido(c.k, c.unit)}</td>}
              <td>{L ? limTxt(L[c.k]) : '∞'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TabInfo({ u }: { u: string }) {
  const { s, t } = useVH();
  const a = s.acc[u];
  const rp = a.role === 'revenda' ? pacoteRevendaDe(s, u) : null;
  const up = pacoteDe(s, u) || pacoteVazio();
  const feats = rp ? rp.feats : featsEfetivas(up);
  const campos = rp ? FUNC_REVENDA : FUNC_UTILIZADOR;
  const rec = rp ? rp.rec : up.rec;
  const sim = (v: boolean) => (v ? <span className="yes"><i className="fa-solid fa-check" /> {t('Sim')}</span> : <span className="no">{t('Não')}</span>);
  return (
    <>
      <Frm>
        <Row label="Nº de IPs">
          <input disabled value={rp ? rp.ips : '1'} />
        </Row>
        <Row label="Servidor de nomes 1">
          <input disabled value={a.ns?.[0] || '—'} />
        </Row>
        <Row label="Servidor de nomes 2">
          <input disabled value={a.ns?.[1] || '—'} />
        </Row>
        <Row label="Pacote">
          <input disabled value={a.pkg + (personalizado(s, u) ? ' (personalizado)' : '')} />
        </Row>
      </Frm>
      <div className="bloco-h">
        <h3>{t('Funcionalidades')}</h3>
      </div>
      <div className="tbl" style={{ marginBottom: 24 }}>
        <table>
          <tbody>
            {campos.map((c) => (
              <tr key={c.k}>
                <td>{t(c.t)}</td>
                <td style={{ textAlign: 'right' }}>{sim(!!feats[c.k])}</td>
              </tr>
            ))}
            {rp && (
              <tr>
                <td>{t('Pode usar o IP do servidor')}</td>
                <td style={{ textAlign: 'right' }}>{sim(rp.ipServidor)}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="bloco-h">
        <h3>{t('Limites de recursos')}</h3>
      </div>
      <div className="tbl">
        <table>
          <tbody>
            {RECURSOS.map((c) => (
              <tr key={c.k}>
                <td>{t(c.t)}</td>
                <td style={{ textAlign: 'right' }}>{limTxt(rec[c.k])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function TabComentarios({ u }: { u: string }) {
  const { s, t, toast, updateDb } = useVH();
  const [v, setV] = useState(s.db.comentarios[u] || '');
  return (
    <>
      <p style={{ color: 'var(--muted)', marginBottom: 10 }}>Notas internas sobre esta conta. Só a equipa as vê.</p>
      <textarea className="inp" rows={8} style={{ width: '100%' }} value={v} onChange={(e) => setV(e.target.value)} />
      <div className="acoes-topo" style={{ marginTop: 12, marginBottom: 0 }}>
        <button
          className="btn r"
          onClick={() => {
            updateDb((db) => (db.comentarios[u] = v));
            toast('Comentários gravados');
          }}
        >
          <i className="fa-solid fa-floppy-disk" />
          {t('Guardar comentários')}
        </button>
      </div>
    </>
  );
}

function VerModificar({ u, on }: { u: string; on: 'ver' | 'modificar' }) {
  const { s, nav } = useVH();
  const ver = base(s) + '/' + enc(u);
  return (
    <Tabs
      tabs={[
        ['ver', 'Ver', 'fa-eye'],
        ['modificar', 'Modificar', 'fa-pen-to-square'],
      ]}
      on={on}
      onChange={(k) => nav(k === 'ver' ? ver : ver + '/modificar')}
    />
  );
}

type TabConta = 'contas' | 'dominios' | 'uso' | 'info' | 'coment';
/** separadores da ficha ↔ endereço (/<conta>/uso, /informacao…), para o caminho no topo seguir o clique */
export const TABS_CONTA: Record<string, [TabConta, string]> = { utilizadores: ['contas', 'Utilizadores'], dominios: ['dominios', 'Domínios'], uso: ['uso', 'Estatísticas de uso'], informacao: ['info', 'Informação'], comentarios: ['coment', 'Comentários'] };
function ContaVer({ u, aba }: { u: string; aba?: TabConta }) {
  const { s, nav } = useVH();
  const a = s.acc[u];
  const gestor = s.page === 'revendedores' || s.page === 'administradores';
  const inicial: TabConta = gestor ? 'contas' : 'dominios';
  const tab = aba || inicial;
  const setTab = (k: TabConta) => {
    const nome = Object.entries(TABS_CONTA).find(([, v]) => v[0] === k)?.[0] || '';
    nav(base(s) + '/' + enc(u) + (k === inicial ? '' : '/' + nome));
  };
  return (
    <>
      <VerModificar u={u} on="ver" />
      <div className="acoes-topo">
        <ContaAcoes u={u} />
      </div>
      <div className="tabcard">
        <Tabs<TabConta>
          tabs={[gestor ? ['contas', 'Utilizadores', 'fa-users'] : ['dominios', 'Domínios', 'fa-globe'], ['uso', 'Estatísticas de uso', 'fa-chart-simple'], ['info', 'Informação', 'fa-circle-info'], ['coment', 'Comentários', 'fa-comment']]}
          on={tab}
          onChange={setTab}
        />
        <div className="tc">
          {tab === 'contas' && <TabUtilizadores u={u} />}
          {tab === 'dominios' && <TabDominios a={a} />}
          {tab === 'uso' && <TabUso u={u} gestor={gestor} />}
          {tab === 'info' && <TabInfo u={u} />}
          {tab === 'coment' && <TabComentarios u={u} />}
        </div>
      </div>
    </>
  );
}

function ContaAcoes({ u }: { u: string }) {
  const { s, me, t, nav, enterAs } = useVH();
  const a = s.acc[u];
  return (
    <>
      {s.level === 'admin' && (a.role === 'revenda' || a.role === 'admin') && s.page !== 'utilizadores' && (
        <button className="btn g" onClick={() => nav('/admin/utilizadores/' + enc(u))}>
          <i className="fa-solid fa-id-card" />
          {t('Ver dados do utilizador')}
        </button>
      )}
      <button className="btn g" onClick={() => nav('/' + s.level + '/senhas/' + enc(u))}>
        <i className="fa-solid fa-key" />
        {t('Mudar palavra-passe')}
      </button>
      {u !== me && (
        <button className="btn r" onClick={() => enterAs(u)}>
          <i className="fa-solid fa-right-to-bracket" />
          {t('Entrar como')}
        </button>
      )}
    </>
  );
}

function ContaModificar({ u }: { u: string }) {
  const { s, t, nav, toast, updateDb } = useVH();
  const a = s.acc[u];
  const revenda = a.role === 'revenda';
  const nomes = Object.keys(revenda ? s.db.rpkgs : s.db.pkgs);
  const [pk, setPk] = useState(nomes.includes(a.pkg) ? a.pkg : nomes[0]);
  const [p, setP] = useState<PacoteUtilizador | PacoteRevenda>(() => structuredClone(revenda ? pacoteRevendaDe(s, u) : pacoteDe(s, u) || pacoteVazio()));
  const ver = base(s) + '/' + enc(u);
  const aplicar = () => {
    updateDb((db, acc) => {
      acc[u].pkg = pk;
      delete db.custom[u];
      delete db.rcustom[u];
    });
    setP(structuredClone(revenda ? s.db.rpkgs[pk] : s.db.pkgs[pk]));
    toast('Pacote ' + pk + ' aplicado a ' + u);
  };
  const gravar = () => {
    updateDb((db) => {
      if (revenda) db.rcustom[u] = p as PacoteRevenda;
      else db.custom[u] = p as PacoteUtilizador;
    });
    toast('Limites de ' + u + ' gravados');
    nav(ver);
  };
  return (
    <>
      <VerModificar u={u} on="modificar" />
      <Frm title="Pacote" desc={personalizado(s, u) ? 'Esta conta tem limites próprios. Escolher um pacote substitui-os.' : 'Os limites abaixo vêm do pacote da conta'}>
        <Row label="Definir o pacote">
          <select value={pk} onChange={(e) => setPk(e.target.value)}>
            {nomes.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
          <button className="btn g" disabled={pk === a.pkg && !personalizado(s, u)} onClick={aplicar}>
            {t('Aplicar pacote')}
          </button>
        </Row>
      </Frm>
      {revenda ? <FormPacoteRevenda value={p as PacoteRevenda} onChange={setP} conta /> : <FormPacoteUtilizador value={p as PacoteUtilizador} onChange={setP} conta />}
      <div className="acoes-topo">
        <button className="btn g" onClick={() => nav(ver)}>
          {t('Cancelar')}
        </button>
        <button className="btn r" onClick={gravar}>
          <i className="fa-solid fa-floppy-disk" />
          {t('Guardar')}
        </button>
      </div>
    </>
  );
}

// ---------- Criar conta ----------
type TipoNova = 'cliente' | 'revenda' | 'admin';
function NovaConta({ tipo }: { tipo: TipoNova }) {
  const vh = useVH();
  const { s, me, t, toast, nav } = vh;
  const [role, setRole] = useState<Role>(tipo === 'cliente' ? 'profissional' : tipo);
  const [user, setUser] = useState('');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [dom, setDom] = useState('');
  const nomes = Object.keys(tipo === 'revenda' ? s.db.rpkgs : s.db.pkgs);
  const sugerido = (r: Role) => nomes.find((n) => (r === 'cliente' ? /mail/i : /basic|basico|starter/i).test(n)) || nomes[0];
  const [pk, setPk] = useState(nomes.includes(sugerido(role)) ? sugerido(role) : nomes[0]);
  const [custom, setCustom] = useState<PacoteUtilizador | PacoteRevenda | null>(null);
  const IPS = ipsDe(s);
  const [ip, setIp] = useState(IPS[0] || '');
  const [notif, setNotif] = useState(tipo !== 'admin');
  // cliente criado por um revendedor: conta no limite do seu pacote de revenda
  const v = tipo === 'cliente' ? vagas(s, me) : null;
  const cheio = !!v && semVagas(v);

  const destino = tipo === 'revenda' ? '/admin/revendedores' : tipo === 'admin' ? '/admin/administradores' : s.level === 'revenda' ? '/revenda/clientes' : '/admin/meus-clientes';
  const personalizar = () => setCustom(structuredClone(tipo === 'revenda' ? s.db.rpkgs[pk] : s.db.pkgs[pk]) || (tipo === 'revenda' ? pacoteRevendaVazio() : pacoteVazio()));
  const criar = () => {
    const u = user.trim().toLowerCase();
    if (!/^[a-z][a-z0-9]{2,15}$/.test(u)) return toast('Utilizador: 3 a 16 letras ou números, a começar por letra');
    if (s.acc[u]) return toast('Esse utilizador já existe');
    if (cheio) return toast('Chegou ao limite de contas de cliente do seu pacote de revenda');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return toast('Escreva um e-mail válido');
    if (pass.length < 8) return toast('A palavra-passe precisa de pelo menos 8 caracteres');
    const d = dom.trim().toLowerCase();
    if (tipo !== 'admin' && !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d)) return toast('Escreva um domínio válido');
    // Revendedores e administradores precisam também de um login no site (papel e pacote de revenda): ainda não
    if (tipo !== 'cliente') return toast('Criar ' + (tipo === 'revenda' ? 'revendedores' : 'administradores') + ' ainda não está ligado ao servidor');
    if (custom) return toast('Os limites próprios ainda não chegam ao servidor: escolha um pacote');
    noServidor(vh, { acao: 'criar', criar: { user: u, nome: nome.trim(), email: email.trim(), senha: pass, dominio: d, pacote: pk } }, () => ROLES[role] + ' ' + u + ' criado no servidor').then(
      (feitas) => feitas.length && nav(destino),
    );
  };

  return (
    <>
      {tipo === 'revenda' && <ComoFuncionaRevenda />}
      {cheio && v && (
        <div className="imp">
          <i className="fa-solid fa-triangle-exclamation" />
          <div>
            {t('Chegou ao limite de')} <b>{v.limite}</b> {t('contas de cliente do pacote')} <b>{v.plano}</b>. {t('Peça ao administrador para mudar para um pacote de revenda maior.')}
          </div>
        </div>
      )}
      <Frm>
        {v && v.limite !== null && (
          <Row label="Contas de cliente" hint={'Pacote de revenda: ' + v.plano} tag="VisualHost">
            <span style={{ color: cheio ? 'var(--red)' : 'var(--ink)', fontWeight: 600 }}>
              {v.usadas} {t('de')} {v.limite} {t('usadas')}
            </span>
          </Row>
        )}
        {tipo === 'cliente' && (
          <Row label="Tipo de conta" tag="VisualHost">
            <select
              value={role}
              onChange={(e) => {
                const r = e.target.value as Role;
                setRole(r);
                if (!custom && nomes.includes(sugerido(r))) setPk(sugerido(r));
              }}
            >
              <option value="profissional">{t('Profissional')} (com site)</option>
              <option value="cliente">{t('Cliente')} (só e-mail e domínio)</option>
            </select>
          </Row>
        )}
        <Row label="Utilizador" hint="3 a 16 letras ou números">
          <input value={user} onChange={(e) => setUser(e.target.value)} autoComplete="off" />
        </Row>
        <Row label="Nome" hint="Pessoa ou empresa (aparece no painel)" tag="VisualHost">
          <input value={nome} onChange={(e) => setNome(e.target.value)} />
        </Row>
        <Row label="E-mail">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </Row>
        <Row label="Palavra-passe">
          <Senha value={pass} onChange={setPass} />
        </Row>
        {tipo !== 'admin' && (
          <Row label="Domínio">
            <input value={dom} onChange={(e) => setDom(e.target.value)} placeholder="ex.: empresa.co.mz" />
          </Row>
        )}
        {tipo !== 'admin' && (
          <Row
            label={tipo === 'revenda' ? 'Pacote de revenda' : 'Pacote'}
            hint={
              custom
                ? 'Limites próprios desta conta (em baixo)'
                : tipo === 'revenda' && s.db.rpkgs[pk]
                  ? limTxt(s.db.rpkgs[pk].lim.users) + ' contas de cliente · ' + limTxt(s.db.rpkgs[pk].lim.disk)
                  : undefined
            }
          >
            <select value={pk} disabled={!!custom} onChange={(e) => setPk(e.target.value)}>
              {nomes.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
            {custom ? (
              <button className="btn g" onClick={() => setCustom(null)}>
                <i className="fa-solid fa-box" />
                {t('Usar o pacote')}
              </button>
            ) : (
              <button className="btn g" onClick={personalizar}>
                <i className="fa-solid fa-sliders" />
                {t('Personalizar')}
              </button>
            )}
          </Row>
        )}
        {tipo !== 'admin' && (
          <Row label="IP">
            <select value={ip} onChange={(e) => setIp(e.target.value)}>
              {IPS.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </Row>
        )}
        <Row label="Notificação">
          <Check checked={notif} onChange={setNotif} label="Enviar e-mail com os dados de acesso" />
        </Row>
      </Frm>
      {custom &&
        (tipo === 'revenda' ? (
          <FormPacoteRevenda value={custom as PacoteRevenda} onChange={setCustom} conta />
        ) : (
          <FormPacoteUtilizador value={custom as PacoteUtilizador} onChange={setCustom} conta />
        ))}
      <div className="acoes-topo">
        <button className="btn g" onClick={() => nav(destino)}>
          {t('Cancelar')}
        </button>
        <button className="btn r" onClick={criar} disabled={cheio}>
          <i className="fa-solid fa-user-plus" />
          {t('Criar conta')}
        </button>
      </div>
    </>
  );
}

const editarMensagem = (vh: VH) => (
  <button className="btn g" onClick={() => vh.nav('/' + vh.s.level + '/modelos-mensagem/boas-vindas')}>
    <i className="fa-solid fa-envelope-open-text" />
    {vh.t('Editar mensagem')}
  </button>
);

export const novaConta: ScreenFn = (vh) => ({
  title: 'Adicionar cliente',
  desc: 'Criar uma conta de Profissional (com site) ou de Cliente (só e-mail), com domínio e pacote',
  actions: editarMensagem(vh),
  body: <NovaConta tipo="cliente" />,
});

// ---------- Ecrãs das listas (com /novo, /<conta> e /<conta>/modificar) ----------
export function contas(kind: Kind): ScreenFn {
  return (vh) => {
    const { s, me, t, nav } = vh;
    const b = base(s);
    const listaT = { todos: 'Todos os utilizadores', meus: 'Os meus clientes', revenda: 'Revendedores', admin: 'Administradores' }[kind];
    const [sub, sub2] = s.sub;
    if (sub === 'novo' && (kind === 'revenda' || kind === 'admin'))
      return {
        title: kind === 'revenda' ? 'Novo revendedor' : 'Novo administrador',
        desc: kind === 'revenda' ? 'Criar uma conta de revenda com pacote e limites' : 'Criar uma conta com acesso total ao servidor',
        crumbs: [{ t: listaT, path: b }, { t: kind === 'revenda' ? 'Novo revendedor' : 'Novo administrador' }],
        actions: editarMensagem(vh),
        body: <NovaConta tipo={kind} />,
      };
    if (sub) {
      const a = s.acc[sub];
      const pode = !!a && (s.level === 'admin' || sub === me || a.creator === me);
      if (!pode)
        return { title: 'Conta não encontrada', crumbs: [{ t: listaT, path: b }, { t: sub }], body: <div className="card empty">{t('Esta conta não existe ou não é sua')}</div> };
      const ver = b + '/' + enc(sub);
      if (sub2 === 'modificar')
        return {
          title: 'Modificar ' + sub,
          desc: 'Mudar o pacote, os limites e as funcionalidades da conta',
          crumbs: [{ t: listaT, path: b }, { t: sub, path: ver }, { t: 'Modificar' }],
          body: <ContaModificar u={sub} />,
        };
      const aba = sub2 ? TABS_CONTA[sub2] : undefined;
      return {
        title: a.name + ' (' + sub + ')',
        desc: t(ROLES[a.role]) + ' · ' + a.email,
        crumbs: aba ? [{ t: listaT, path: b }, { t: sub, path: ver }, { t: aba[1] }] : [{ t: listaT, path: b }, { t: sub }],
        body: <ContaVer key={sub} u={sub} aba={aba?.[0]} />,
      };
    }
    const novoCliente = (cls: string) => (
      <button className={'btn ' + cls} onClick={() => nav('/' + s.level + '/novo-cliente')}>
        <i className="fa-solid fa-user-plus" />
        {t('Adicionar cliente')}
      </button>
    );
    const botao = (cls: string, path: string, label: string, fa: string) => (
      <button className={'btn ' + cls} onClick={() => nav(path)}>
        <i className={'fa-solid ' + fa} />
        {t(label)}
      </button>
    );
    const actions =
      kind === 'todos' ? (
        novoCliente('r')
      ) : kind === 'meus' ? (
        <>
          {botao('g sec-m', b + '/' + enc(me) + '/modificar', 'Modificar os meus dados', 'fa-user-pen')}
          {novoCliente('r')}
        </>
      ) : kind === 'revenda' ? (
        <>
          {novoCliente('g sec-m')}
          {botao('g sec-m', '/admin/administradores/novo', 'Novo administrador', 'fa-user-gear')}
          {botao('r', b + '/novo', 'Novo revendedor', 'fa-user-tie')}
        </>
      ) : (
        <>
          {novoCliente('g sec-m')}
          {botao('g sec-m', '/admin/revendedores/novo', 'Novo revendedor', 'fa-user-tie')}
          {botao('r', b + '/novo', 'Novo administrador', 'fa-user-gear')}
        </>
      );
    const v = kind === 'meus' ? vagas(s, me) : null;
    const desc = v && v.limite !== null ? t('Contas de cliente') + ': ' + v.usadas + ' ' + t('de') + ' ' + v.limite + ' · ' + t('pacote') + ' ' + v.plano : undefined;
    return { title: listaT, desc, actions, body: <ListaContas kind={kind} /> };
  };
}

// ---------- Mudar senhas ----------
function MudarSenhas() {
  const vh = useVH();
  const { s, me, t, toast } = vh;
  const contasPermitidas = Object.keys(s.acc).filter((u) => s.level === 'admin' || u === me || s.acc[u].creator === me);
  const [u, setU] = useState(s.sub[0] && contasPermitidas.includes(s.sub[0]) ? s.sub[0] : contasPermitidas[0]);
  const [p, setP] = useState('');
  return (
    <Frm
      foot={
        <button
          className="btn r"
          onClick={() => {
            if (p.length < 8) return toast('A palavra-passe precisa de pelo menos 8 caracteres');
            noServidor(vh, { acao: 'senha', contas: [u], senha: p }, () => 'Palavra-passe de ' + u + ' alterada no servidor').then((f) => f.length && setP(''));
          }}
        >
          <i className="fa-solid fa-key" />
          {t('Mudar palavra-passe')}
        </button>
      }
    >
      <Row label="Utilizador">
        <select value={u} onChange={(e) => setU(e.target.value)}>
          {contasPermitidas.map((x) => (
            <option key={x} value={x}>
              {x} — {s.acc[x].name}
            </option>
          ))}
        </select>
      </Row>
      <Row label="Nova palavra-passe">
        <Senha value={p} onChange={setP} />
      </Row>
    </Frm>
  );
}
export const senhas: ScreenFn = () => ({ title: 'Mudar senhas', body: <MudarSenhas /> });

// ---------- Mover clientes ----------
function Mover() {
  const { s, t, toast, updateAcc } = useVH();
  const destinos = Object.entries(s.acc).filter(([, a]) => a.role === 'revenda' || a.role === 'admin');
  const [dest, setDest] = useState('');
  const rows: R[] = dest ? Object.entries(s.acc).filter(([, a]) => isUser(a.role) && a.creator !== dest) : [];
  return (
    <>
      <div className="passo">
        <h3>1. {t('Escolher o destino')}</h3>
        <p>Revendedor que vai ficar com os clientes.</p>
        <select className="inp" style={{ maxWidth: 520, width: '100%' }} value={dest} onChange={(e) => setDest(e.target.value)}>
          <option value="">— escolher —</option>
          {destinos.map(([u, a]) => (
            <option key={u} value={u}>
              {u} — {a.name} ({t(ROLES[a.role])})
            </option>
          ))}
        </select>
      </div>
      <div className={'passo' + (dest ? '' : ' off')}>
        <h3>2. {t('Escolher os clientes')}</h3>
        <p>Só aparecem os clientes que ainda não são deste revendedor.</p>
        <DataTable
          id="mover"
          rows={rows}
          rowKey={(r) => r[0]}
          search={([u, a]) => u + ' ' + a.name}
          cols={[
            { k: 'user', t: 'Utilizador', sort: (r) => r[0], cell: ([u, a]) => <CellConta u={u} a={a} /> },
            { k: 'dono', t: 'Revendedor atual', sort: (r) => r[1].creator, cell: ([, a]) => a.creator },
            { k: 'pkg', t: 'Pacote', cell: ([, a]) => a.pkg },
            { k: 'doms', t: 'Domínios', cell: ([, a]) => <Doms a={a} /> },
          ]}
          bulk={[
            {
              t: 'Mover clientes',
              fa: 'fa-people-arrows',
              run: (keys) => {
                const v = vagas(s, dest);
                if (semVagas(v, keys.length)) return toast('Sem espaço: ' + dest + ' já tem ' + v.usadas + ' de ' + v.limite + ' contas de cliente');
                updateAcc((acc) => keys.forEach((k) => (acc[k].creator = dest)));
                toast(keys.length + ' cliente(s) movido(s) para ' + dest);
              },
            },
          ]}
          empty={dest ? 'Não há clientes para mover' : 'Escolha primeiro o destino'}
        />
      </div>
    </>
  );
}
export const mover: ScreenFn = () => ({ title: 'Mover clientes', body: <Mover /> });

// ---------- Modelos de mensagem ----------
const VARS: Record<'boas-vindas' | 'suspensao', string[]> = {
  'boas-vindas': ['|username|', '|password|', '|domain|', '|ip|', '|PORT|', '|bandwidth|', '|quota|', '|vdomains|', '|nsubdomains|', '|nemails|', '|nemailf|', '|nemailr|', '|nemailml|', '|ftp|', '|ns1|', '|ns2|', '|mysql|', '|domainptr|', '|ssh|', '|ssl|', '|php|', '|dnscontrol|'],
  suspensao: ['|USERNAME|', '|REASON|', '|MSG_FOOTER|'],
};

function Modelos({ k }: { k: 'boas-vindas' | 'suspensao' }) {
  const { s, t, nav, toast, openM, updateDb } = useVH();
  const [m, setM] = useState(() => ({ ...s.db.modelos[k] }));
  const ta = useRef<HTMLTextAreaElement>(null);
  const inserir = (v: string) => {
    const el = ta.current;
    const i = el ? el.selectionStart : m.msg.length;
    const j = el ? el.selectionEnd : i;
    setM({ ...m, msg: m.msg.slice(0, i) + v + m.msg.slice(j) });
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(i + v.length, i + v.length);
    });
  };
  return (
    <>
      <Tabs
        tabs={[
          ['boas-vindas', 'Mensagem de boas-vindas', 'fa-hand'],
          ['suspensao', 'Mensagem de suspensão', 'fa-ban'],
        ]}
        on={k}
        onChange={(x) => nav(base(s) + '/' + x)}
      />
      <div className="acoes-topo">
        <button
          className="btn g"
          onClick={() =>
            openM(
              <Confirmar
                titulo="Repor a mensagem predefinida?"
                texto="O assunto e o texto voltam ao original. As alterações feitas perdem-se."
                ok="Repor"
                onOk={() => {
                  const def = structuredClone(MODELOS_PREDEFINIDOS[k]);
                  updateDb((db) => (db.modelos[k] = def));
                  setM(def);
                  toast('Mensagem reposta');
                }}
              />,
            )
          }
        >
          <i className="fa-solid fa-rotate-left" />
          {t('Repor predefinição')}
        </button>
      </div>
      <Frm
        foot={
          <button
            className="btn r"
            onClick={() => {
              updateDb((db) => (db.modelos[k] = m));
              toast('Mensagem gravada');
            }}
          >
            <i className="fa-solid fa-floppy-disk" />
            {t('Guardar')}
          </button>
        }
      >
        <Row label="Assunto">
          <input value={m.assunto} onChange={(e) => setM({ ...m, assunto: e.target.value })} />
        </Row>
        <Row label="Mensagem" hint="Clique numa variável (em baixo) para a pôr onde está o cursor">
          <textarea ref={ta} rows={18} value={m.msg} onChange={(e) => setM({ ...m, msg: e.target.value })} />
        </Row>
        <div className="vars">
          <span>{t('Variáveis')}:</span>
          {VARS[k].map((v) => (
            <code key={v} onClick={() => inserir(v)}>
              {v}
            </code>
          ))}
        </div>
      </Frm>
    </>
  );
}
export const modelos: ScreenFn = (vh) => {
  const k = vh.s.sub[0] === 'suspensao' ? 'suspensao' : 'boas-vindas';
  return {
    title: 'Modelos de mensagem',
    crumbs: [{ t: 'Modelos de mensagem', path: base(vh.s) }, { t: k === 'suspensao' ? 'Mensagem de suspensão' : 'Mensagem de boas-vindas' }],
    body: <Modelos k={k} />,
  };
};
