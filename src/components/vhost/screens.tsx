'use client';

// Ecrãs do painel (na maquete: o objeto P). Cada ecrã dá o título e os botões da barra de cima,
// e o conteúdo da página.
import { Fragment, useState, type ReactNode } from 'react';
import { useVH, type VH } from './context';
import { DelMailModal, NewDomainModal, newMail } from './modals';
import { contas, modelos, mover, novaConta, senhas } from './paginas/contas';
import { pacotes } from './paginas/pacotes';
import { estatisticasPagina, ficheirosPagina, infoSistemaPagina, logsPagina, perlPagina, recursosPagina, terminalPagina } from './paginas/sistema';
import { backupsPagina, chavesPagina, clamavPagina, cronPagina, gitPagina, handlersPagina, modsecPagina, protegidasPagina, sshPagina, wordpressPagina } from './paginas/avancado';
import { catchAllPagina, emailPagina, feriasPagina, listasPagina, mailmarketingPagina, migracaoPagina, mxPagina, rastreioPagina, reencaminhamentosPagina, respostasPagina, spamPagina, webmailPagina } from './paginas/email';
import { apontadores, bdPagina, dnsPagina, dominios, ftpPagina, hotlink, phpPagina, phpmyadminPagina, redirecionamentos, sslPagina, subdominios } from './paginas/dominios';
import { ThemeCustomizerView, temaBase } from './paginas/tema';
import { FEATS, GLOBAL, HX, HX_INFO, LEVELS, LOGIN_AS, MENU, PKGS, REMOVED, ROLE_INFO, ROLE_LEVELS, ROLES } from './generated/data';
import { findItem, gItem, pacoteDe, route } from './state';
import { mbTexto } from './servidor';
import type { Lim } from './paginas/dados';
import type { HxState, Level, MenuItem, Role } from './types';
import { DaHomeCards, DomTable, HxCard, HxTag, MyAccountTool, RC, RI, ServerInfoCard, Stat, Tool, UsersTable } from './ui';

export interface Crumb {
  t: string;
  path?: string;
}
export interface Screen {
  title: string;
  actions?: ReactNode;
  body: ReactNode;
  /** caminho na faixa por baixo da barra de cima (por defeito: só o título) */
  crumbs?: Crumb[];
  /** descrição na barra de cima (por defeito: a da página, em DESC) */
  desc?: string;
}
export type ScreenFn = (vh: VH) => Screen;

function SeeAll({ id }: { id: string }) {
  const { go } = useVH();
  return (
    <div style={{ marginTop: 14, textAlign: 'right' }}>
      <a onClick={() => go(id)} style={{ color: 'var(--red)', fontWeight: 700, fontSize: 13.5, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        Ver todas as contas <i className="fa-solid fa-chevron-right" style={{ fontSize: 11 }} />
      </a>
    </div>
  );
}

const newClientBtn = (vh: VH) => (
  <button className="btn r" onClick={() => vh.nav('/' + vh.s.level + '/novo-cliente')}>
    <i className="fa-solid fa-user-plus" />
    {vh.t('Novo cliente')}
  </button>
);

// ---------- Painéis iniciais (dados reais do servidor) ----------
/** limite em MB (null = sem limite) */
const limMb = (l?: Lim): number | null => (!l || l.unl ? null : (Number(l.v) || 0) * (l.unit === 'TB' ? 1024 * 1024 : l.unit === 'GB' ? 1024 : 1));
const limN = (l?: Lim): number | null => (!l || l.unl ? null : Number(l.v) || 0);
const pctDe = (v: number, max: number | null | undefined) => (max ? Math.min(100, Math.round((v / max) * 100)) : 0);
const gbTxt = (n: number) => String(n).replace('.', ',') + ' GB';

function AdminWidgets() {
  const { s, go } = useVH();
  const all = Object.entries(s.acc);
  const v = s.srv;
  return (
    <div className="cols">
      <div className="da-main-card cols-main">
        <div className="stats">
          <Stat title="Contas" v={all.length} m="/ ∞" p={Math.min(100, all.length * 5)} />
          <Stat title="Revendedores" v={all.filter(([, a]) => a.role === 'revenda').length} m="/ ∞" p={Math.min(100, all.filter(([, a]) => a.role === 'revenda').length * 10)} />
          <Stat title="Disco usado" v={v ? gbTxt(v.discoUsadoGb) : '—'} m={v ? '/ ' + gbTxt(v.discoTotalGb) : ''} p={v ? pctDe(v.discoUsadoGb, v.discoTotalGb) : 0} />
          <Stat title="Carga do servidor" v={v ? String(v.carga[1]).replace('.', ',') : '—'} m="média 5 min" p={v ? pctDe(v.carga[1], v.cpus) : 0} />
        </div>
        <div className="stats-line" />
        <UsersTable rows={all} showCreator={false} />
        <SeeAll id="utilizadores" />
      </div>
      <div className="cols-side">
        <ServerInfoCard />
        <MyAccountTool />
        <Tool fa="fa-network-wired" c="c6" title="Zonas DNS" sub={s.dns.length + ' zonas no servidor'} onClick={() => go('dns')} />
        <Tool fa="fa-gears" c="c4" title="Serviços" sub={v ? v.servicos.filter((x) => x.ativo).length + ' de ' + v.servicos.length + ' ativos' : 'Estado e reinício'} onClick={() => go('servicos')} />
        <Tool fa="fa-user-lock" c="c1" title="Força bruta" sub="IPs bloqueados" onClick={() => go('forca-bruta')} />
      </div>
    </div>
  );
}

function RevendaWidgets() {
  const { s, me, a, go } = useVH();
  const mine = Object.entries(s.acc).filter(([u, x]) => x.creator === me && u !== me);
  const plano = s.db.rcustom[me] || s.db.rpkgs[a.pkg];
  const doms = mine.reduce((t, [, x]) => t + x.domains.length, 0);
  const disco = mine.reduce((t, [, x]) => t + (x.discoMb || 0), 0);
  const bw = mine.reduce((t, [, x]) => t + (x.bwMb || 0), 0);
  const maxU = limN(plano?.lim.users);
  const maxD = limN(plano?.lim.domains);
  const maxDisco = limMb(plano?.lim.disk);
  const maxBw = limMb(plano?.lim.bw);
  return (
    <div className="cols">
      <div className="da-main-card cols-main">
        <div className="stats">
          <Stat title="Clientes" v={mine.length} m={'/ ' + (maxU ?? '∞')} p={pctDe(mine.length, maxU)} />
          <Stat title="Domínios dos clientes" v={doms} m={'/ ' + (maxD ?? '∞')} p={pctDe(doms, maxD)} />
          <Stat title="Disco usado" v={mbTexto(disco)} m={'/ ' + (maxDisco ? mbTexto(maxDisco) : '∞')} p={pctDe(disco, maxDisco)} />
          <Stat title="Tráfego este mês" v={mbTexto(bw)} m={'/ ' + (maxBw ? mbTexto(maxBw) : '∞')} p={pctDe(bw, maxBw)} />
        </div>
        <div className="stats-line" />
        <UsersTable rows={mine} showCreator={false} />
        <SeeAll id="clientes" />
      </div>
      <div className="cols-side">
        <MyAccountTool />
        <Tool fa="fa-boxes-stacked" c="c4" title="Pacotes de cliente" sub="Limites e funcionalidades" onClick={() => go('pacotes')} />
        <Tool fa="fa-network-wired" c="c6" title="Zonas DNS" sub="Domínios dos clientes" onClick={() => go('dns')} />
        <Tool fa="fa-life-ring" c="c1" title="Tickets" sub="Pedidos dos clientes" onClick={() => go('tickets')} />
      </div>
    </div>
  );
}

function UserWidgets() {
  const vh = useVH();
  const { s, me, a, go, hasFeat } = vh;
  const p = pacoteDe(s, me);
  const maxDom = limN(p?.lim.domains);
  const maxMail = limN(p?.lim.emails);
  return (
    <div className="cols">
      <div className="da-main-card cols-main">
        <div className="stats">
          <Stat title="Espaço em disco" v={a.disk} m={'/ ' + (a.discoLimMb ? mbTexto(a.discoLimMb) : '∞')} p={pctDe(a.discoMb || 0, a.discoLimMb)} />
          <Stat title="Tráfego este mês" v={mbTexto(a.bwMb || 0)} m={'/ ' + (a.bwLimMb ? mbTexto(a.bwLimMb) : '∞')} p={pctDe(a.bwMb || 0, a.bwLimMb)} />
          <Stat title="Domínios" v={a.domains.length} m={'/ ' + (maxDom ?? '∞')} p={pctDe(a.domains.length, maxDom)} />
          <Stat title="Contas de e-mail" v={a.mails.length} m={'/ ' + (maxMail ?? '∞')} p={pctDe(a.mails.length, maxMail)} />
        </div>
        <div className="stats-line" />
        <DomTable />
      </div>
      <div className="cols-side">
        <Tool fa="fa-envelope" c="c2" title="Criar conta de e-mail" sub="Novo endereço no seu domínio" onClick={() => newMail(vh)} />
        <Tool fa="fa-box-archive" c="c8" title="Cópias de segurança" sub="Ver e criar cópias da conta" onClick={() => go('backups')} />
        <Tool fa="fa-key" c="c4" title="Mudar palavra-passe" sub="Conta e e-mails" onClick={() => go('perfil')} />
        {hasFeat('wordpress') && <Tool fa="fa-brands fa-wordpress" c="c2" title="Instalar WordPress" sub="Pronto em 1 minuto" onClick={() => go('wordpress')} />}
        <Tool fa="fa-life-ring" c="c1" title="Abrir pedido de suporte" sub="Resposta em até 2h" onClick={() => go('tickets')} />
      </div>
    </div>
  );
}

const home =
  (title: string, Widgets: () => ReactNode, actions: (vh: VH) => ReactNode): ScreenFn =>
  (vh) => ({ title, actions: actions(vh), body: vh.s.dashTab === 'menu' ? <DaHomeCards /> : <Widgets /> });

// ---------- Domínios e e-mail ----------
function EmailBody() {
  const vh = useVH();
  const { a, t, toast, openM } = vh;
  const doms = a.domains.map((d) => d.name).sort((x, y) => x.localeCompare(y));
  const dom = vh.s.dominio && doms.includes(vh.s.dominio) ? vh.s.dominio : a.domains[0]?.name || '';
  const list = a.mails.map((m, i) => ({ ...m, i })).filter((m) => !dom || m.dom === dom);
  const used = a.mails.reduce((n, m) => n + m.used, 0);
  const full = a.mails.filter((m) => m.quota > 0 && m.used / m.quota > 0.8).length;
  const comLimite = a.mails.filter((m) => m.quota > 0);
  const quota = comLimite.reduce((n, m) => n + m.quota, 0);
  const usadoLim = comLimite.reduce((n, m) => n + m.used, 0);
  const maxMail = limN(pacoteDe(vh.s, vh.me)?.lim.emails);
  const nDoms = new Set(a.mails.map((m) => m.dom)).size;
  return (
    <>
      <div className="stats">
        <Stat title="Contas" v={a.mails.length} m={'/ ' + (maxMail ?? '∞')} p={pctDe(a.mails.length, maxMail)} />
        <Stat title="Espaço usado" v={mbTexto(used)} m="em todas as caixas" p={pctDe(usadoLim, quota)} />
        <Stat title="Domínios de e-mail" v={nDoms} m={'/ ' + a.domains.length} p={pctDe(nDoms, a.domains.length)} />
        <Stat title="Caixas quase cheias" v={full} m="acima de 80%" p={full * 20} />
      </div>
      <div className="toolbar">
        <div className="f" style={{ margin: 0, fontWeight: 700 }}>
          <i className="fa-solid fa-globe" /> {dom || t('Todos os domínios')}
        </div>
        <span style={{ color: 'var(--muted)', fontSize: 13, marginLeft: 'auto' }}>{t(`${list.length} de ${a.mails.length} contas`)}</span>
      </div>
      <div className="tbl">
        <table>
          <colgroup>
            <col />
            <col style={{ width: 210 }} />
            <col style={{ width: 260 }} />
            <col style={{ width: 120 }} />
            <col style={{ width: 190 }} />
          </colgroup>
          <thead>
            <tr>
              <th>{t('Conta')}</th>
              <th>{t('Domínio')}</th>
              <th>{t('Uso da caixa')}</th>
              <th>{t('Criada')}</th>
              <th style={{ textAlign: 'right' }}>{t('Ações')}</th>
            </tr>
          </thead>
          <tbody>
            {list.length ? (
              list.map((m) => {
                const p = m.quota > 0 ? Math.min(100, Math.round((m.used / m.quota) * 100)) : 0;
                return (
                  <tr key={m.user + '@' + m.dom}>
                    <td>
                      <div className="cell">
                        <div className="ic c2">
                          <i className="fa-solid fa-envelope" />
                        </div>
                        <div>
                          <b>
                            {m.user}@{m.dom}
                          </b>
                          <span>{m.quota > 0 ? t('Quota') + ' ' + mbTexto(m.quota) : t('Sem limite de espaço')}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="tag off">{m.dom}</span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--muted)', marginBottom: 5 }}>
                        <span>
                          {m.quota > 0 ? m.used + ' MB de ' + m.quota + ' MB' : m.used + ' MB · ' + t('sem limite')}
                        </span>
                        <b style={{ color: p > 80 ? 'var(--red)' : 'var(--ink)' }}>{p}%</b>
                      </div>
                      <div className="bar">
                        <span style={{ width: p + '%' }} />
                      </div>
                    </td>
                    <td>{m.criada || '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn g sm" onClick={() => toast('Abrir webmail de ' + m.user + ' (próxima fase)')} title="Webmail">
                        <i className="fa-solid fa-inbox" />
                      </button>{' '}
                      <button className="btn g sm" onClick={() => toast('Mudar a senha de e-mail ainda não está ligado ao servidor')}>
                        <i className="fa-solid fa-key" />
                        {t('Senha')}
                      </button>{' '}
                      <button className="btn g sm" onClick={() => openM(<DelMailModal i={m.i} />)} title="Apagar">
                        <i className="fa-solid fa-trash" />
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={5} className="empty">
                  Nenhuma conta encontrada
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ---------- Ecrãs previstos e sem acesso ----------
export const placeholder: ScreenFn = (vh) => {
  const { s, t } = vh;
  const it = (GLOBAL[s.page] ? gItem(s) : findItem(s.level, s.page)) as MenuItem;
  return {
    title: it.t,
    body: (
      <>
        {s.notes && it.note && (
          <div className="note">
            <i className="fa-solid fa-circle-info" style={{ color: 'var(--red)' }} /> {it.note}
          </div>
        )}
        {s.notes && (
          <div className="rinfo">
            <HxCard hx={it.hx} />
          </div>
        )}
        <div className="card" style={{ marginBottom: 14, background: 'var(--soft)' }}>
          <b>{t('Funcionalidades previstas')}</b>
        </div>
        <div className="feat">
          {it.f.map((x) => (
            <div key={x}>
              <i className="fa-solid fa-circle-check" />
              <span>{x}</span>
            </div>
          ))}
        </div>
      </>
    ),
  };
};

export const denyScreen: ScreenFn = (vh) => {
  const { s, a, me, t, allowed, setLevel } = vh;
  const d = s.deny!;
  if (d.type === 'nivel')
    return {
      title: 'Sem acesso',
      body: (
        <div className="deny">
          <div className="ic c1">
            <i className="fa-solid fa-lock" />
          </div>
          <h1>{t('Sem acesso a esta área')}</h1>
          <p>
            A conta <b>{me}</b> é <b>{ROLES[a.role]}</b> e não pode abrir o nível <b>{LEVELS[d.lv]}</b>.<br />
            Profissionais e clientes só veem o nível Utilizador; revendedores veem Revenda e Utilizador; administradores veem Admin e Utilizador.
          </p>
          <button className="btn r" onClick={() => setLevel(allowed[0])}>
            {t('Ir para o meu painel')}
          </button>
        </div>
      ),
    };
  if (d.type === 'pacote')
    return {
      title: 'Não incluído no pacote',
      body: (
        <div className="deny">
          <div className="ic c4">
            <i className="fa-solid fa-box" />
          </div>
          <h1>{t('Não incluído no seu pacote')}</h1>
          <p>
            O pacote <b>{a.pkg}</b> não inclui <b>{FEATS[d.it.feat!]}</b>.<br />
            No VisualHost este item nem aparece no menu desta conta.
          </p>
          <button className="btn r" onClick={() => setLevel('utilizador')}>
            {t('Voltar ao painel')}
          </button>
        </div>
      ),
    };
  return {
    title: 'Página não encontrada',
    body: (
      <div className="deny">
        <div className="ic c8">
          <i className="fa-solid fa-circle-question" />
        </div>
        <h1>{t('Página não encontrada')}</h1>
        <p>Este endereço não existe no VisualHost.</p>
        <button className="btn r" onClick={() => setLevel(allowed[0])}>
          {t('Ir para o meu painel')}
        </button>
      </div>
    ),
  };
};

// ---------- Ecrãs só da maquete: níveis e mapa de rotas ----------
const LEVEL_KEYS = Object.keys(LEVELS) as Level[];
const HX_KEYS = Object.keys(HX) as HxState[];
const ALL_ITEMS = LEVEL_KEYS.flatMap((l) => MENU[l].flatMap(([, i]) => i));

function Tick({ on }: { on: boolean }) {
  return on ? (
    <span className="yes">
      <i className="fa-solid fa-check" /> Sim
    </span>
  ) : (
    <span className="no">—</span>
  );
}

function NiveisBody() {
  const { nav } = useVH();
  const count = (lv: Level) => MENU[lv].reduce((t, [, i]) => t + i.length, 0);
  const hxCount = (s: HxState) => ALL_ITEMS.filter((it) => it.hx.s === s).length;
  const pkgs = Object.keys(PKGS).filter((p) => p !== 'Completo');
  return (
    <>
      <div className="note">
        Há <b>quatro tipos de conta</b> e <b>três níveis</b> (painéis): Admin, Revenda e Utilizador (as funcionalidades da própria conta: domínios, e-mail, DNS, ficheiros…).
        <br />
        Só <b>Administrador</b> e <b>Revendedor</b> têm parte de gestão; <b>Profissional</b> e <b>Cliente</b> só têm funcionalidades — a diferença entre eles é o pacote (o Profissional tem site, o
        Cliente só e-mail/domínio), como no site atual.
        <br />
        Como no DirectAdmin, o nível Admin já inclui tudo o que um revendedor faz, e o administrador cria contas de qualquer tipo e muda o tipo de uma conta (“Mudar tipo”) em Todos os
        utilizadores.
        <br />
        <b>Entrar como</b> é outra coisa: é abrir o painel de <i>outra</i> pessoa (aparece uma faixa amarela com “Voltar ao meu painel”).
      </div>
      <div className="tbl" style={{ marginBottom: 26 }}>
        <table>
          <thead>
            <tr>
              <th>Tipo de conta</th>
              <th>Painel Admin</th>
              <th>Painel Revenda</th>
              <th>Painel Utilizador (a sua conta)</th>
              <th>Entrar como…</th>
            </tr>
          </thead>
          <tbody>
            {(Object.keys(ROLES) as Role[]).map((r) => (
              <tr key={r}>
                <td>
                  <div className="cell">
                    <div className={'ic ' + RC[r]}>
                      <i className={'fa-solid ' + RI[r]} />
                    </div>
                    <div>
                      <b>{ROLES[r]}</b>
                      <span style={{ whiteSpace: 'normal', display: 'block', maxWidth: 300 }}>{ROLE_INFO[r]}</span>
                    </div>
                  </div>
                </td>
                {LEVEL_KEYS.map((l) => (
                  <td key={l}>
                    {r === 'admin' && l === 'revenda' ? (
                      <span className="yes">
                        <i className="fa-solid fa-check" /> Incluído no Admin
                      </span>
                    ) : (
                      <Tick on={ROLE_LEVELS[r].includes(l)} />
                    )}
                  </td>
                ))}
                <td>{LOGIN_AS[r]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="stats">
        {LEVEL_KEYS.map((l) => (
          <Stat key={l} title={'Ecrãs no nível ' + LEVELS[l]} v={count(l)} m="no menu" p={count(l) * 2} />
        ))}
      </div>
      <div className="sec">
        <h3>O que o servidor Contabo (Hestia) já faz</h3>
        <a onClick={() => nav('/mapa')}>Ver ecrã a ecrã</a>
      </div>
      <p style={{ color: 'var(--muted)', margin: '-6px 0 12px' }}>
        O VisualHost fala com o Hestia pela API. Onde o Hestia não chega, o VisualHost completa (base de dados própria ou agente no servidor).
      </p>
      <div className="stats">
        {HX_KEYS.map((s) => (
          <div className="card stat" key={s}>
            <small>
              <HxTag s={s} />
            </small>
            <strong>
              {hxCount(s)} <span>de {ALL_ITEMS.length} ecrãs</span>
            </strong>
            <div className="bar">
              <span style={{ width: Math.round((hxCount(s) / ALL_ITEMS.length) * 100) + '%' }} />
            </div>
            <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 10, lineHeight: 1.45 }}>{HX_INFO[s]}</p>
          </div>
        ))}
      </div>
      <div className="sec">
        <h3>O que o pacote do cliente liga e desliga</h3>
      </div>
      <p style={{ color: 'var(--muted)', margin: '-6px 0 12px' }}>
        No nível Utilizador, o menu esconde o que o pacote não inclui (como no DirectAdmin). Experimente entrar como <b>Cliente B</b> (pacote Só e-mail).
      </p>
      <div className="tbl">
        <table>
          <thead>
            <tr>
              <th>Funcionalidade</th>
              {pkgs.map((p) => (
                <th key={p}>{p}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(FEATS).map(([k, label]) => (
              <tr key={k}>
                <td className="wrap" style={{ color: 'var(--ink)', fontSize: 14 }}>
                  {label}
                </td>
                {pkgs.map((p) => (
                  <td key={p}>
                    <Tick on={PKGS[p].includes(k)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function HxCell({ h }: { h: MenuItem['hx'] }) {
  return (
    <td className="wrap">
      <HxTag s={h.s} />
      {h.n && <div style={{ marginTop: 6 }}>{h.n}</div>}
      {h.cmd && (
        <div style={{ marginTop: 6 }}>
          <code>{h.cmd}</code>
        </div>
      )}
    </td>
  );
}

type MapRow = { k: string; cells: ReactNode };
type MapGroup = { title: string; rows: MapRow[] };

function MapTable({ groups, filter }: { groups: MapGroup[]; filter: string }) {
  return (
    <div className="tbl" style={{ marginBottom: 24 }}>
      <table className="map">
        <colgroup>
          <col style={{ width: '24%' }} />
          <col style={{ width: '20%' }} />
          <col style={{ width: '18%' }} />
          <col />
        </colgroup>
        <thead>
          <tr>
            <th>Ecrã</th>
            <th>Endereço VisualHost</th>
            <th>Equivalente DirectAdmin</th>
            <th>No servidor (Hestia)</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => {
            const vis = g.rows.filter((r) => !filter || r.k.includes(filter));
            // esconde o título do grupo quando nenhum ecrã do grupo ficou visível
            if (!vis.length) return null;
            return [
              <tr className="grp" key={g.title}>
                <td colSpan={4}>{g.title}</td>
              </tr>,
              ...vis.map((r) => <tr key={r.k}>{r.cells}</tr>),
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}

function MapaBody() {
  const { nav } = useVH();
  const [filter, setFilter] = useState('');
  const row = (lv: Level, g: string, it: MenuItem): MapRow => {
    const r = route(lv, it.id);
    const notes = [it.opt ? 'Opcional' : '', it.feat ? 'Depende do pacote: ' + FEATS[it.feat] : '', it.note || ''].filter(Boolean).join(' · ');
    return {
      k: (g + ' ' + it.t + ' ' + r + ' ' + it.da + ' ' + HX[it.hx.s] + ' ' + it.hx.cmd).toLowerCase(),
      cells: (
        <>
          <td>
            <b>{it.t}</b>
            {notes && <div style={{ color: 'var(--muted)', fontSize: 12, whiteSpace: 'normal', maxWidth: 220 }}>{notes}</div>}
          </td>
          <td>
            <a className="rt" onClick={() => nav(r)}>
              <code>{r}</code>
            </a>
          </td>
          <td className="wrap">
            <code>{it.da}</code>
          </td>
          <HxCell h={it.hx} />
        </>
      ),
    };
  };
  const globals = Object.entries(GLOBAL).filter(([, g]) => g.sub);
  const removed = REMOVED.filter((r) => !filter || (r.t + ' ' + r.da).toLowerCase().includes(filter));
  return (
    <>
      <div className="toolbar">
        <span style={{ color: 'var(--muted)', fontSize: 13 }}>Clique num endereço para abrir o ecrã. Se a conta atual não tiver acesso, aparece “Sem acesso”.</span>
      </div>
      <div className="toolbar">
        {HX_KEYS.map((s) => (
          <span key={s} className={'tag hx-' + s} style={{ cursor: 'pointer' }} onClick={() => setFilter(HX[s].toLowerCase())}>
            {HX[s]}
          </span>
        ))}
        <a className="rt" style={{ fontSize: 13, fontWeight: 700 }} onClick={() => setFilter('')}>
          Mostrar tudo
        </a>
      </div>
      {LEVEL_KEYS.map((lv) => (
        <Fragment key={lv}>
          <div className="sec">
            <h3>Nível {LEVELS[lv]}</h3>
            <span style={{ color: 'var(--muted)', fontSize: 13 }}>
              endereços começam por <code>/{lv}</code>
            </span>
          </div>
          <MapTable filter={filter} groups={MENU[lv].map(([g, items]) => ({ title: g, rows: items.map((it) => row(lv, g, it)) }))} />
        </Fragment>
      ))}
      <div className="sec">
        <h3>Barra de ícones (comuns a todos os níveis)</h3>
      </div>
      <MapTable
        filter={filter}
        groups={globals.map(([id, g]) => ({
          title: g.t,
          rows: g.sub!.map((x) => ({
            k: (g.t + ' ' + x.t + ' ' + x.da + ' ' + HX[x.hx.s]).toLowerCase(),
            cells: (
              <>
                <td>
                  <b>{x.t}</b>
                </td>
                <td>
                  <a className="rt" onClick={() => nav('/' + id + '/' + x.id)}>
                    <code>
                      /{id}/{x.id}
                    </code>
                  </a>
                </td>
                <td className="wrap">
                  <code>{x.da}</code>
                </td>
                <HxCell h={x.hx} />
              </>
            ),
          })),
        }))}
      />
      <div className="sec">
        <h3>Não passam para o VisualDA</h3>
      </div>
      <div className="tbl">
        <table>
          <thead>
            <tr>
              <th>Ecrã DirectAdmin</th>
              <th>Rotas</th>
              <th>Motivo</th>
            </tr>
          </thead>
          <tbody>
            {removed.map((r) => (
              <tr key={r.t}>
                <td>
                  <b>{r.t}</b>
                </td>
                <td className="wrap">
                  <code>{r.da}</code>
                </td>
                <td className="wrap">{r.why}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// Personalizar painel (paginas/tema.tsx) — caminho por subpágina; em Preferências → Aparência fica dentro de /preferencias/aparencia
function temaScreen(vh: VH): Screen {
  const { s } = vh;
  const basePath = temaBase(s);
  const sub0 = s.sub[0];
  const sub1 = s.sub[1];

  const crumbs: Crumb[] = [];
  if (sub0 === 'cores') {
    crumbs.push({ t: 'Personalizar painel', path: basePath });
    crumbs.push({ t: 'Cores dos Componentes (V-Host Colors)', path: basePath + '/cores' });
    if (sub1 === 'editor') crumbs.push({ t: 'Editor de Componentes' });
    else if (sub1 === 'presets') crumbs.push({ t: 'Temas das Marcas' });
    else if (sub1 === 'custom_hex') crumbs.push({ t: 'Hex Personalizado' });
  } else if (sub0 === 'layout') {
    crumbs.push({ t: 'Personalizar painel', path: basePath });
    crumbs.push({ t: 'Layout e Cantos' });
  } else if (sub0 === 'aparencia') {
    crumbs.push({ t: 'Personalizar painel', path: basePath });
    crumbs.push({ t: 'Modo de Exibição' });
  } else if (sub0 === 'marca') {
    crumbs.push({ t: 'Personalizar painel', path: basePath });
    crumbs.push({ t: 'Marca e Logótipo' });
  } else {
    crumbs.push({ t: 'Personalizar painel' });
  }

  return {
    title: 'Personalizar painel',
    crumbs,
    body: <ThemeCustomizerView />,
  };
}

// ---------- Registo dos ecrãs (chave: "nivel/ecra" ou id da barra de ícones) ----------
export const SCREENS: Record<string, ScreenFn> = {
  'admin/inicio': home('Painel do servidor', AdminWidgets, newClientBtn),
  'revenda/inicio': home('Painel de revenda', RevendaWidgets, newClientBtn),
  'utilizador/inicio': home('Painel', UserWidgets, (vh) => (
    <button className="btn g sm" onClick={() => vh.nav('/utilizador/dominios/novo')}>
      <i className="fa-solid fa-plus" />
      {vh.t('Adicionar domínio')}
    </button>
  )),
  // Gestão de domínios (páginas copiadas do DirectAdmin — ver paginas/dominios.tsx e VisualHost/05-da-gestao-de-dominios.md)
  'utilizador/dominios': dominios,
  'utilizador/subdominios': subdominios,
  'utilizador/dns': dnsPagina,
  'utilizador/ssl': sslPagina,
  'utilizador/ftp': ftpPagina,
  'utilizador/bd': bdPagina,
  'utilizador/apontadores': apontadores,
  'utilizador/redirecionamentos': redirecionamentos,
  'utilizador/hotlink': hotlink,
  'utilizador/php': phpPagina,
  'utilizador/phpmyadmin': phpmyadminPagina,
  // E-mail e Extras (páginas copiadas do DirectAdmin — ver paginas/email.tsx)
  'utilizador/email': emailPagina,
  'utilizador/reencaminhamentos': reencaminhamentosPagina,
  'utilizador/respostas': respostasPagina,
  'utilizador/ferias': feriasPagina,
  'utilizador/spam': spamPagina,
  'utilizador/listas': listasPagina,
  'utilizador/mx': mxPagina,
  'utilizador/rastreio': rastreioPagina,
  'utilizador/imapsync': migracaoPagina,
  'utilizador/webmail': webmailPagina,
  'utilizador/mailmarketing': mailmarketingPagina,
  // Avançado (páginas copiadas do DirectAdmin — ver paginas/avancado.tsx; o Catch-all está em paginas/email.tsx)
  'utilizador/handlers': handlersPagina,
  'utilizador/catch-all': catchAllPagina,
  'utilizador/backups': backupsPagina,
  'utilizador/cron': cronPagina,
  'utilizador/chaves-login': chavesPagina,
  'utilizador/pastas-protegidas': protegidasPagina,
  'utilizador/ssh': sshPagina,
  'utilizador/modsecurity': modsecPagina,
  'utilizador/git': gitPagina,
  'utilizador/wordpress': wordpressPagina,
  'utilizador/clamav': clamavPagina,
  // Sistema e ficheiros (ver paginas/sistema.tsx)
  'utilizador/ficheiros': ficheirosPagina,
  'utilizador/terminal': terminalPagina,
  'utilizador/perl': perlPagina,
  'utilizador/info-sistema': infoSistemaPagina,
  'utilizador/estatisticas': estatisticasPagina,
  'utilizador/logs-site': logsPagina,
  'utilizador/recursos': recursosPagina,
  // Gestão de contas (páginas copiadas do DirectAdmin — ver paginas/ e VisualHost/04-da-gestao-de-contas.md)
  'admin/novo-cliente': novaConta,
  'admin/utilizadores': contas('todos'),
  'admin/meus-clientes': contas('meus'),
  'admin/pacotes': pacotes('cliente'),
  'admin/mover': mover,
  'admin/modelos-mensagem': modelos,
  'admin/senhas': senhas,
  'admin/revendedores': contas('revenda'),
  'admin/pacotes-revenda': pacotes('revenda'),
  'admin/administradores': contas('admin'),
  'revenda/novo-cliente': novaConta,
  'revenda/clientes': contas('meus'),
  'revenda/pacotes': pacotes('cliente'),
  'revenda/senhas': senhas,
  'revenda/modelos-mensagem': modelos,
  'admin/tema': temaScreen,
  'revenda/tema': temaScreen,
  'preferencias/aparencia': temaScreen,
  niveis: () => ({ title: 'Níveis e acessos', body: <NiveisBody /> }),
  mapa: () => ({ title: 'Mapa de rotas', body: <MapaBody /> }),
};
