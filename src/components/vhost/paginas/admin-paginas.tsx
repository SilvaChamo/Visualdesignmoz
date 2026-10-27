'use client';

// Páginas do menu Admin que faltavam (Silva, 16/10/2026: "pegue tudo que ainda falta preencher, constrói as páginas"),
// no modelo das páginas do DirectAdmin e com as regras de layout do painel: título com descrição pequena, separadores a
// abrir o cartão, "Ações" só onde há caixas de seleção, blocos no telemóvel. Só o administrador; os dados vêm de
// /api/vhost/admin-servidor (script em src/lib/vhost-admin-py.ts) ou da leitura do painel.
import { useEffect, useState, type ReactNode } from 'react';
import { useVH, type VH } from '../context';
import { corUso } from '../cor-uso';
import type { ScreenFn } from '../screens';
import { esquecerMemoria, useGet, useNaMemoria } from '../carga';
import { Stat } from '../ui';
import { DataTable, Tabs } from './componentes';
import { Confirmar } from './pacotes';
import { Carregando } from './avancado';
import { mbTexto } from '../servidor';
import type { Account } from '../types';
import { ehNsNosso } from '@/lib/visualdesign-dns';

export const ROTA = '/api/vhost/admin-servidor';
export const ROTA_REVENDA = '/api/vhost/revenda';
export const num = (n: number, casas = 0) => n.toLocaleString('pt-PT', { maximumFractionDigits: casas, minimumFractionDigits: casas });
const pct = (v: number, max?: number | null) => (max ? Math.min(100, Math.round((v / max) * 100)) : 0);

export async function pedir(vh: VH, corpo: Record<string, unknown>, ok: string): Promise<Record<string, unknown> | null> {
  vh.toast('A alterar no servidor…');
  try {
    // no menu Admin do revendedor os mesmos ecrãs falam com a rota da revenda, que só deixa mexer nas contas dele
    const r = await fetch(vh.s.level === 'revenda' ? ROTA_REVENDA : ROTA, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
    const j = (await r.json().catch(() => ({}))) as Record<string, unknown>;
    if (!r.ok) {
      vh.toast(String(j.erro || 'A alteração falhou'));
      return null;
    }
    esquecerMemoria(ROTA);
    vh.toast(ok);
    return j;
  } catch {
    vh.toast('Sem ligação ao site. Nada foi alterado.');
    return null;
  }
}

/** Descrição da barra de cima: texto fixo | números da leitura que a página já fez */
export function Resumo<T>({ url, base, partes }: { url: string; base: string; partes: (d: T) => (string | false | null | undefined)[] }) {
  const { t } = useVH();
  const d = useNaMemoria<T>(url);
  // ao passar de uma página com descrição para outra, a mesma peça fica um instante com os dados da anterior: sem números nessa passagem,
  // em vez de rebentar e deixar o painel em branco ("Cannot read properties of undefined" ao abrir Modelos do servidor web)
  let extras: (string | false | null | undefined)[] = [];
  if (d) {
    try {
      extras = partes(d);
    } catch {
      extras = [];
    }
  }
  return (
    <>
      {t(base)}
      {extras.filter(Boolean).map((p, i) => (
        <span key={i}>
          <span className="pdesc-sep">|</span>
          {p}
        </span>
      ))}
    </>
  );
}

/** Barra de uso (valor / limite) numa célula */
export function Uso({ v, max, texto }: { v: number; max?: number | null; texto: string }) {
  const p = pct(v, max);
  return (
    <span className="pm-cpu ad-uso">
      <b>{texto}</b>
      <span className="bar">
        <span style={{ width: (max ? p : 0) + '%', background: corUso(p) }} />
      </span>
    </span>
  );
}

// ======================= Uso por conta (dados do painel) =======================
type AbaU = 'todas' | 'limite' | 'suspensas';
function UsoPorConta() {
  const vh = useVH();
  const { t } = vh;
  const [aba, setAba] = useState<AbaU>('todas');
  const contas = Object.entries(vh.s.acc).map(([u, a]) => ({ u, a }));
  const perto = (a: Account) => pct(a.discoMb || 0, a.discoLimMb) >= 80 || pct(a.bwMb || 0, a.bwLimMb) >= 80;
  const linhas = contas.filter(({ a }) => (aba === 'todas' ? true : aba === 'limite' ? perto(a) : a.state === 'off'));
  return (
    <>
      <Tabs<AbaU>
        on={aba}
        onChange={setAba}
        tabs={[
          ['todas', 'Todas', 'fa-users'],
          ['limite', 'Perto do limite', 'fa-gauge-high'],
          ['suspensas', 'Suspensas', 'fa-user-slash'],
        ]}
      />
      <DataTable
        id="ad-uso"
        umaLinha
        barraFora
        empilhar="tablet"
        rows={linhas}
        rowKey={(r) => r.u}
        search={(r) => r.u + ' ' + r.a.email + ' ' + (r.a.hpkg || r.a.pkg)}
        empty="Nenhuma conta"
        cols={[
          { k: 'u', t: 'Conta', sort: (r) => r.u, cell: (r) => (
            <span className="pm-proc">
              <b>{r.u}</b>
              {r.a.state === 'off' && <span className="tag bad">{t('Suspensa')}</span>}
              <small>{r.a.email}</small>
            </span>
          ) },
          { k: 'p', t: 'Pacote', ate: 1300, sort: (r) => r.a.hpkg || r.a.pkg, cell: (r) => r.a.hpkg || r.a.pkg },
          { k: 'd', t: 'Disco', sort: (r) => r.a.discoMb || 0, cell: (r) => <Uso v={r.a.discoMb || 0} max={r.a.discoLimMb} texto={mbTexto(r.a.discoMb || 0) + ' / ' + (r.a.discoLimMb ? mbTexto(r.a.discoLimMb) : '∞')} /> },
          { k: 'b', t: 'Tráfego este mês', sort: (r) => r.a.bwMb || 0, cell: (r) => <Uso v={r.a.bwMb || 0} max={r.a.bwLimMb} texto={mbTexto(r.a.bwMb || 0) + ' / ' + (r.a.bwLimMb ? mbTexto(r.a.bwLimMb) : '∞')} /> },
          { k: 'n', t: 'Domínios', right: true, ate: 1050, sort: (r) => r.a.domains.length, cell: (r) => r.a.domains.length },
          { k: 'm', t: 'E-mails', right: true, ate: 1300, sort: (r) => r.a.mails.length, cell: (r) => r.a.mails.length },
          { k: 'b2', t: 'Bases de dados', right: true, ate: 1600, sort: (r) => r.a.dbs?.length || 0, cell: (r) => r.a.dbs?.length || 0 },
        ]}
      />
    </>
  );
}
function ResumoUso() {
  const { s, t } = useVH();
  const contas = Object.values(s.acc);
  const disco = contas.reduce((n, a) => n + (a.discoMb || 0), 0);
  const bw = contas.reduce((n, a) => n + (a.bwMb || 0), 0);
  return (
    <>
      {t('Disco e tráfego por conta')}
      <span className="pdesc-sep">|</span>
      {contas.length} {t('contas')}
      <span className="pdesc-sep">|</span>
      {t('Disco')} {mbTexto(disco)}
      <span className="pdesc-sep">|</span>
      {t('Tráfego')} {mbTexto(bw)}
    </>
  );
}
export const usoContasPagina: ScreenFn = () => ({ title: 'Uso por conta', desc: 'Disco e tráfego por conta', descEl: <ResumoUso />, body: <UsoPorConta /> });

// ======================= Nameservers =======================
const NS_SERVIDOR = (process.env.NEXT_PUBLIC_VD_NAMESERVERS || 'ns3.visualdesignmoz.com,ns4.visualdesignmoz.com').split(',').map((x) => x.trim()).filter(Boolean);
function MudarNs({ contas, onFeito }: { contas: string[]; onFeito: () => void }) {
  const vh = useVH();
  const { t, closeM } = vh;
  const [ns, setNs] = useState<string[]>([...NS_SERVIDOR, '', ''].slice(0, 4));
  return (
    <div className="da-janela">
      <div className="da-janela-cab">
        <h3>{t('Mudar os nameservers')}</h3>
        <button type="button" className="da-janela-x" onClick={closeM} aria-label={t('Fechar')}>
          <i className="fa-solid fa-xmark" />
        </button>
      </div>
      <div className="frm">
        <div className="frm-row da-sem-nome">
          <div className="frm-lb" />
          <div className="frm-ctl">
            <span className="pm-desc">{t('Contas:') + ' ' + contas.join(', ')}</span>
          </div>
        </div>
        {ns.map((v, i) => (
          <div className="frm-row" key={i}>
            <div className="frm-lb">NS{i + 1}</div>
            <div className="frm-ctl">
              <input value={v} onChange={(e) => setNs(ns.map((x, j) => (j === i ? e.target.value.trim().toLowerCase() : x)))} placeholder={i < 2 ? '' : t('(opcional)')} />
            </div>
          </div>
        ))}
        <div className="frm-foot">
          <button
            className="btn r"
            disabled={ns.filter(Boolean).length < 2}
            onClick={async () => {
              if (await pedir(vh, { acao: 'ns-conta', contas, ns: ns.filter(Boolean) }, 'Nameservers mudados')) {
                closeM();
                onFeito();
              }
            }}
          >
            {t('Guardar')}
          </button>
        </div>
      </div>
    </div>
  );
}
type AbaN = 'todas' | 'servidor' | 'outros';
function Nameservers() {
  const vh = useVH();
  const { t } = vh;
  const [aba, setAba] = useState<AbaN>('todas');
  const doServidor = (ns?: string[]) => !!ns?.length && ns.every((x) => ehNsNosso(x) || NS_SERVIDOR.includes(x.toLowerCase()));
  const contas = Object.entries(vh.s.acc).map(([u, a]) => ({ u, a }));
  const linhas = contas.filter(({ a }) => (aba === 'todas' ? true : aba === 'servidor' ? doServidor(a.ns) : !doServidor(a.ns)));
  const mudar = (k: string[]) => vh.openM(<MudarNs contas={k} onFeito={() => vh.recarregar(true)} />);
  return (
    <>
      <Tabs<AbaN>
        on={aba}
        onChange={setAba}
        tabs={[
          ['todas', 'Todas as contas', 'fa-users'],
          ['servidor', 'Com os do servidor', 'fa-server'],
          ['outros', 'Com outros', 'fa-globe'],
        ]}
      />
      <DataTable
        id="ad-ns"
        umaLinha
        barraFora
        empilhar="tablet"
        rows={linhas}
        rowKey={(r) => r.u}
        search={(r) => r.u + ' ' + (r.a.ns || []).join(' ')}
        empty="Nenhuma conta"
        cols={[
          { k: 'u', t: 'Conta', sort: (r) => r.u, cell: (r) => <b>{r.u}</b> },
          { k: 'ns', t: 'Nameservers', cell: (r) => (r.a.ns?.length ? <span className="ad-ns">{r.a.ns.map((n) => <code key={n}>{n}</code>)}</span> : <span className="pm-desc">—</span>) },
          { k: 'e', t: 'Estado', sort: (r) => (doServidor(r.a.ns) ? 1 : 0), cell: (r) => <span className={'tag ' + (doServidor(r.a.ns) ? 'ok' : 'w')}>{t(doServidor(r.a.ns) ? 'Os do servidor' : 'Outros')}</span> },
          { k: 'd', t: 'Domínios', right: true, sort: (r) => r.a.domains.length, cell: (r) => r.a.domains.length },
        ]}
        actions={(r) => (
          <button className="btn sm g fb-btn" title={t('Mudar')} onClick={() => mudar([r.u])}>
            <i className="fa-solid fa-pen" />
            <span>{t('Mudar')}</span>
          </button>
        )}
        acoesNaColuna
        bulk={[{ t: 'Mudar os nameservers', fa: 'fa-pen', run: (k) => mudar(k) }]}
      />
      <p className="fb-nota">{t('Os nameservers deste servidor são') + ' ' + NS_SERVIDOR.join(', ') + '. ' + t('Os domínios novos de cada conta ficam com os nameservers dela.')}</p>
    </>
  );
}
export const nameserversPagina: ScreenFn = () => ({ title: 'Nameservers', desc: 'Nameservers do servidor e de cada conta', body: <Nameservers /> });

// ======================= IPs =======================
type Ip = { ip: string; dono: string; estado: string; nome: string; nat: string; interface: string; mascara: string; contas: number; dominios: number };
type Ips = { ips: Ip[]; contas: string[] };
function MudarDono({ ips, contas, onFeito }: { ips: string[]; contas: string[]; onFeito: () => void }) {
  const vh = useVH();
  const { t, closeM } = vh;
  const [dono, setDono] = useState(contas[0] || 'admin');
  return (
    <>
      <h3>{t('Mudar o dono do IP')}</h3>
      <p style={{ lineHeight: 1.5 }}>{ips.join(', ')}</p>
      <div className="f">
        <label>{t('Dono')}</label>
        <select value={dono} onChange={(e) => setDono(e.target.value)}>
          {contas.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <div className="mfoot">
        <button className="btn g" onClick={closeM}>
          {t('Cancelar')}
        </button>
        <button
          className="btn r"
          onClick={async () => {
            for (const ip of ips) await pedir(vh, { acao: 'ip-dono', ip, dono }, 'Dono mudado: ' + ip);
            closeM();
            onFeito();
          }}
        >
          {t('Guardar')}
        </button>
      </div>
    </>
  );
}
type AbaI = 'todos' | 'shared' | 'dedicated';
function Ips() {
  const vh = useVH();
  const { t } = vh;
  const [aba, setAba] = useState<AbaI>('todos');
  const { dados, erro, ler } = useGet<Ips>(ROTA + '?ver=ips');
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  const linhas = dados.ips.filter((i) => aba === 'todos' || i.estado === aba);
  const estado = (ips: string[], e: 'shared' | 'dedicated') =>
    vh.openM(
      <Confirmar
        titulo={e === 'shared' ? 'Partilhar o IP?' : 'Dedicar o IP?'}
        texto={ips.join(', ') + ' — ' + t(e === 'shared' ? 'passa a servir todas as contas.' : 'passa a ser só do dono.')}
        ok={e === 'shared' ? 'Partilhar' : 'Dedicar'}
        onOk={async () => {
          for (const ip of ips) await pedir(vh, { acao: 'ip-estado', ip, estado: e }, 'IP mudado: ' + ip);
          ler(true);
        }}
      />,
    );
  return (
    <>
      <Tabs<AbaI>
        on={aba}
        onChange={setAba}
        tabs={[
          ['todos', 'Todos', 'fa-list'],
          ['shared', 'Partilhados', 'fa-share-nodes'],
          ['dedicated', 'Dedicados', 'fa-user'],
        ]}
      />
      <DataTable
        id="ad-ips"
        umaLinha
        barraFora
        empilhar="tablet"
        rows={linhas}
        rowKey={(r) => r.ip}
        search={(r) => r.ip + ' ' + r.dono + ' ' + r.nome + ' ' + r.interface}
        empty="Nenhum IP"
        cols={[
          { k: 'ip', t: 'Endereço IP', sort: (r) => r.ip, cell: (r) => (
            <span className="pm-proc">
              <code>{r.ip}</code>
              {r.nat && <small>NAT {r.nat}</small>}
            </span>
          ) },
          { k: 'e', t: 'Estado', sort: (r) => r.estado, cell: (r) => <span className={'tag ' + (r.estado === 'shared' ? 'ok' : 'w')}>{t(r.estado === 'shared' ? 'Partilhado' : 'Dedicado')}</span> },
          { k: 'd', t: 'Dono', sort: (r) => r.dono, cell: (r) => r.dono },
          { k: 'n', t: 'Nome', ate: 1300, cell: (r) => r.nome || '—' },
          { k: 'i', t: 'Interface', ate: 1600, cell: (r) => (r.interface || '—') + (r.mascara ? ' / ' + r.mascara : '') },
          { k: 'c', t: 'Contas', right: true, sort: (r) => r.contas, cell: (r) => r.contas },
          { k: 'w', t: 'Sites', right: true, sort: (r) => r.dominios, cell: (r) => r.dominios },
        ]}
        acoesNaColuna
        bulk={[
          { t: 'Partilhar', fa: 'fa-share-nodes', run: (k) => estado(k, 'shared') },
          { t: 'Dedicar', fa: 'fa-user', run: (k) => estado(k, 'dedicated') },
          { t: 'Mudar o dono', fa: 'fa-user-pen', run: (k) => vh.openM(<MudarDono ips={k} contas={dados.contas} onFeito={() => ler(true)} />) },
        ]}
      />
    </>
  );
}
export const ipsPagina: ScreenFn = () => ({
  title: 'IPs',
  desc: 'IPs do servidor',
  descEl: <Resumo<Ips> url={ROTA + '?ver=ips'} base="IPs do servidor" partes={(d) => [d.ips.length + ' IPs', d.ips.filter((i) => i.estado === 'shared').length + ' partilhados']} />,
  body: <Ips />,
});

// ======================= Cron de todas as contas =======================
type Cron = { conta: string; id: string; quando: string; cmd: string; suspenso: boolean; data: string };
const CRON_TXT: Record<string, string> = { '* * * * *': 'A cada minuto', '*/5 * * * *': 'De 5 em 5 minutos', '*/10 * * * *': 'De 10 em 10 minutos', '*/15 * * * *': 'De 15 em 15 minutos', '*/30 * * * *': 'De 30 em 30 minutos', '0 * * * *': 'De hora a hora', '0 0 * * *': 'Todos os dias à meia-noite', '0 0 * * 0': 'Todos os domingos', '0 0 1 * *': 'No dia 1 de cada mês' };
type AbaC = 'todas' | 'ativas' | 'suspensas';
function CronTodas() {
  const vh = useVH();
  const { t } = vh;
  const [aba, setAba] = useState<AbaC>('todas');
  const { dados, erro, ler } = useGet<{ cron: Cron[] }>(ROTA + '?ver=cron');
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  const linhas = dados.cron.filter((c) => (aba === 'todas' ? true : aba === 'ativas' ? !c.suspenso : c.suspenso));
  const chave = (c: Cron) => c.conta + '/' + c.id;
  const fazer = (k: string[], acao: 'cron-apagar' | 'cron-suspender' | 'cron-retomar') => {
    const itens = dados.cron.filter((c) => k.includes(chave(c))).map((c) => ({ conta: c.conta, id: c.id }));
    const [tit, ok, msg] = { 'cron-apagar': ['Apagar as tarefas?', 'Apagar', 'Tarefas apagadas'], 'cron-suspender': ['Suspender as tarefas?', 'Suspender', 'Tarefas suspensas'], 'cron-retomar': ['Retomar as tarefas?', 'Retomar', 'Tarefas retomadas'] }[acao];
    vh.openM(<Confirmar titulo={tit} texto={itens.map((i) => i.conta + ' #' + i.id).join(', ')} ok={ok} onOk={async () => (await pedir(vh, { acao, itens }, msg)) && ler(true)} />);
  };
  return (
    <>
      <Tabs<AbaC>
        on={aba}
        onChange={setAba}
        tabs={[
          ['todas', 'Todas', 'fa-list'],
          ['ativas', 'Ativas', 'fa-circle-play'],
          ['suspensas', 'Suspensas', 'fa-circle-pause'],
        ]}
      />
      <DataTable
        id="ad-cron"
        umaLinha
        barraFora
        empilhar="tablet"
        rows={linhas}
        rowKey={chave}
        search={(r) => r.conta + ' ' + r.cmd + ' ' + r.quando}
        empty="Nenhuma tarefa"
        cols={[
          { k: 'c', t: 'Conta', sort: (r) => r.conta, cell: (r) => <b>{r.conta}</b> },
          { k: 'q', t: 'Quando', sort: (r) => r.quando, cell: (r) => (
            <span className="pm-proc">
              <code>{r.quando}</code>
              {CRON_TXT[r.quando] && <small>{t(CRON_TXT[r.quando])}</small>}
            </span>
          ) },
          { k: 'x', t: 'Comando', cell: (r) => <span className="pm-proc"><small className="ad-cmd">{r.cmd}</small></span> },
          { k: 'e', t: 'Estado', sort: (r) => (r.suspenso ? 0 : 1), cell: (r) => <span className={'tag ' + (r.suspenso ? 'off' : 'ok')}>{t(r.suspenso ? 'Suspensa' : 'Ativa')}</span> },
        ]}
        acoesNaColuna
        bulk={[
          { t: 'Suspender', fa: 'fa-pause', run: (k) => fazer(k, 'cron-suspender') },
          { t: 'Retomar', fa: 'fa-play', run: (k) => fazer(k, 'cron-retomar') },
          { t: 'Apagar', fa: 'fa-trash-can', run: (k) => fazer(k, 'cron-apagar') },
        ]}
      />
    </>
  );
}
export const cronAdminPagina: ScreenFn = () => ({
  title: 'Cron de todas as contas',
  desc: 'Tarefas agendadas de todas as contas',
  descEl: <Resumo<{ cron: Cron[] }> url={ROTA + '?ver=cron'} base="Tarefas agendadas de todas as contas" partes={(d) => [d.cron.length + ' tarefas', d.cron.filter((c) => c.suspenso).length ? d.cron.filter((c) => c.suspenso).length + ' suspensas' : null]} />,
  body: <CronTodas />,
});

// ======================= Monitor da base de dados =======================
type LigacaoBd = { id: string; user: string; host: string; bd: string; comando: string; tempo: number; estado: string; consulta: string };
type Bd = { estado: Record<string, string>; variaveis: Record<string, string>; processos: LigacaoBd[]; bds: { nome: string; mb: number; tabelas: number }[]; ativo: boolean };
const duracao = (s: number) => (s >= 86400 ? Math.floor(s / 86400) + ' d ' + Math.floor((s % 86400) / 3600) + ' h' : s >= 3600 ? Math.floor(s / 3600) + ' h ' + Math.floor((s % 3600) / 60) + ' min' : s >= 60 ? Math.floor(s / 60) + ' min' : s + ' s');
type AbaB = 'ligacoes' | 'bds';
function MonitorBd() {
  const vh = useVH();
  const { t } = vh;
  const [aba, setAba] = useState<AbaB>('ligacoes');
  const { dados, erro, ler } = useGet<Bd>(ROTA + '?ver=bd');
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  if (!dados.ativo) return <div className="card empty">{t('Não foi possível ler o estado da base de dados (MariaDB parado ou sem acesso).')}</div>;
  const e = dados.estado;
  const n = (k: string) => Number(e[k] || 0);
  const maxLig = Number(dados.variaveis.max_connections || 0);
  const terminar = (ids: string[]) =>
    vh.openM(<Confirmar titulo="Terminar as ligações?" texto={ids.join(', ')} ok="Terminar" onOk={async () => (await pedir(vh, { acao: 'bd-terminar', ids }, 'Ligações terminadas')) && ler(true)} />);
  return (
    <>
      <div className="stats">
        <Stat title="Ligadas agora" uso v={n('Threads_connected')} m={'/ ' + (maxLig || '∞')} p={pct(n('Threads_connected'), maxLig)} />
        <Stat title="Consultas por segundo" v={num(n('Questions') / Math.max(1, n('Uptime')), 1)} m={num(n('Questions')) + ' ' + t('no total')} p={0} />
        <Stat title="Consultas lentas" v={num(n('Slow_queries'))} m={t('desde que arrancou')} p={0} />
        <Stat title="Ligada há" v={duracao(n('Uptime'))} m={(dados.variaveis.version || '').split('-')[0]} p={0} />
      </div>
      <Tabs<AbaB>
        on={aba}
        onChange={setAba}
        tabs={[
          ['ligacoes', 'Ligações agora', 'fa-plug'],
          ['bds', 'Bases de dados', 'fa-database'],
        ]}
      />
      {aba === 'ligacoes' ? (
        <DataTable
          id="ad-bd-lig"
          umaLinha
          barraFora
          empilhar="tablet"
          rows={dados.processos}
          rowKey={(r) => r.id}
          search={(r) => r.user + ' ' + r.bd + ' ' + r.consulta}
          empty="Nenhuma ligação"
          cols={[
            { k: 'u', t: 'Utilizador', sort: (r) => r.user, cell: (r) => <b>{r.user}</b> },
            { k: 'b', t: 'Base de dados', sort: (r) => r.bd, cell: (r) => r.bd || '—' },
            { k: 'c', t: 'Estado', cell: (r) => (
              <span className="pm-proc">
                {r.comando}
                {r.consulta && <small className="ad-cmd">{r.consulta}</small>}
              </span>
            ) },
            { k: 't', t: 'Há', right: true, sort: (r) => r.tempo, cell: (r) => duracao(r.tempo) },
          ]}
          acoesNaColuna
          bulk={[{ t: 'Terminar a ligação', fa: 'fa-plug-circle-xmark', run: terminar }]}
        />
      ) : (
        <DataTable
          id="ad-bd-bds"
          umaLinha
          barraFora
          rows={dados.bds}
          rowKey={(r) => r.nome}
          search={(r) => r.nome}
          empty="Nenhuma base de dados"
          cols={[
            { k: 'n', t: 'Base de dados', sort: (r) => r.nome, cell: (r) => <b>{r.nome}</b> },
            { k: 't', t: 'Tabelas', right: true, sort: (r) => r.tabelas, cell: (r) => r.tabelas },
            { k: 'm', t: 'Tamanho', right: true, sort: (r) => r.mb, cell: (r) => mbTexto(r.mb) },
          ]}
        />
      )}
    </>
  );
}
export const monitorBdPagina: ScreenFn = () => ({
  title: 'Monitor da BD',
  desc: 'Estado da base de dados',
  descEl: <Resumo<Bd> url={ROTA + '?ver=bd'} base="Estado da base de dados" partes={(d) => [d.variaveis.version ? 'MariaDB ' + d.variaveis.version.split('-')[0] : null, d.bds.length + ' bases de dados']} />,
  body: <MonitorBd />,
});

// ======================= Fila de e-mail =======================
type MsgFila = { id: string; idade: string; tamanho: string; de: string; para: string[]; congelada: boolean };
type AbaF = 'todas' | 'congeladas';
function FilaEmail() {
  const vh = useVH();
  const { t } = vh;
  const [aba, setAba] = useState<AbaF>('todas');
  const { dados, erro, ler } = useGet<{ fila: MsgFila[]; total: number }>(ROTA + '?ver=fila');
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  const linhas = dados.fila.filter((m) => aba === 'todas' || m.congelada);
  const fazer = (ids: string[], acao: 'fila-tentar' | 'fila-apagar') =>
    vh.openM(
      <Confirmar
        titulo={acao === 'fila-apagar' ? 'Apagar as mensagens?' : 'Tentar entregar de novo?'}
        texto={ids.length + ' ' + t(ids.length === 1 ? 'mensagem' : 'mensagens')}
        ok={acao === 'fila-apagar' ? 'Apagar' : 'Tentar de novo'}
        onOk={async () => (await pedir(vh, { acao, ids }, acao === 'fila-apagar' ? 'Mensagens apagadas' : 'Entrega tentada de novo')) && ler(true)}
      />,
    );
  return (
    <>
      <Tabs<AbaF>
        on={aba}
        onChange={setAba}
        tabs={[
          ['todas', 'Em espera', 'fa-inbox'],
          ['congeladas', 'Congeladas', 'fa-snowflake'],
        ]}
      />
      <DataTable
        id="ad-fila"
        umaLinha
        barraFora
        empilhar="tablet"
        rows={linhas}
        rowKey={(r) => r.id}
        search={(r) => r.id + ' ' + r.de + ' ' + r.para.join(' ')}
        empty="A fila está vazia"
        cols={[
          { k: 'd', t: 'De', sort: (r) => r.de, cell: (r) => (
            <span className="pm-proc">
              <b>{r.de}</b>
              <small>{r.id}</small>
            </span>
          ) },
          { k: 'p', t: 'Para', cell: (r) => <span className="pm-proc"><small className="ad-cmd">{r.para.join(', ')}</small></span> },
          { k: 'i', t: 'Há', sort: (r) => r.idade, cell: (r) => r.idade },
          { k: 't', t: 'Tamanho', right: true, ate: 1300, cell: (r) => r.tamanho },
          { k: 'e', t: 'Estado', cell: (r) => <span className={'tag ' + (r.congelada ? 'bad' : 'w')}>{t(r.congelada ? 'Congelada' : 'Em espera')}</span> },
        ]}
        acoesNaColuna
        bulk={[
          { t: 'Tentar todas de novo', fa: 'fa-rotate', sempre: true, inativo: !dados.fila.length, run: () => vh.openM(<Confirmar titulo="Tentar entregar toda a fila?" texto={dados.total + ' ' + t('mensagens')} ok="Tentar de novo" onOk={async () => (await pedir(vh, { acao: 'fila-tudo' }, 'A entregar a fila…')) && ler(true)} />) },
          { t: 'Tentar de novo', fa: 'fa-paper-plane', run: (k) => fazer(k, 'fila-tentar') },
          { t: 'Apagar', fa: 'fa-trash-can', run: (k) => fazer(k, 'fila-apagar') },
        ]}
      />
    </>
  );
}
export const filaEmailPagina: ScreenFn = () => ({
  title: 'Fila de e-mail',
  desc: 'Mensagens à espera de entrega',
  descEl: <Resumo<{ fila: MsgFila[]; total: number }> url={ROTA + '?ver=fila'} base="Mensagens à espera de entrega" partes={(d) => [d.total + ' ' + (d.total === 1 ? 'mensagem' : 'mensagens'), d.fila.filter((m) => m.congelada).length ? d.fila.filter((m) => m.congelada).length + ' congeladas' : null]} />,
  body: <FilaEmail />,
});

// ======================= Resumo de e-mail =======================
type ResumoMail = { horas: number; total: Record<'recebidas' | 'entregues' | 'adiadas' | 'falhadas', number>; dominios: { dominio: string; recebidas: number; entregues: number; adiadas: number; falhadas: number }[] };
function ResumoEmail() {
  const { t } = useVH();
  const [horas, setHoras] = useState<'24' | '168'>('24');
  const { dados, erro, ler } = useGet<ResumoMail>(ROTA + '?ver=mail-resumo&horas=' + horas);
  return (
    <>
      <Tabs<'24' | '168'>
        on={horas}
        onChange={setHoras}
        tabs={[
          ['24', 'Últimas 24 horas', 'fa-clock'],
          ['168', 'Últimos 7 dias', 'fa-calendar-week'],
        ]}
      />
      {!dados ? (
        <Carregando erro={erro} ler={ler} />
      ) : (
        <>
          <div className="stats ad-stats-dentro">
            <Stat title="Recebidas" v={num(dados.total.recebidas)} m="" p={0} />
            <Stat title="Entregues" v={num(dados.total.entregues)} m="" p={0} />
            <Stat title="Adiadas" v={num(dados.total.adiadas)} m="" p={0} />
            <Stat title="Falhadas" uso v={num(dados.total.falhadas)} m="" p={pct(dados.total.falhadas, dados.total.entregues + dados.total.falhadas)} />
          </div>
          <DataTable
            id="ad-mail-resumo"
            umaLinha
            barraFora
            empilhar="tablet"
            rows={dados.dominios}
            rowKey={(r) => r.dominio}
            search={(r) => r.dominio}
            empty="Sem e-mails no período"
            cols={[
              { k: 'd', t: 'Domínio', sort: (r) => r.dominio, cell: (r) => <b>{r.dominio}</b> },
              { k: 'r', t: 'Recebidas', right: true, sort: (r) => r.recebidas, cell: (r) => num(r.recebidas) },
              { k: 'e', t: 'Entregues', right: true, sort: (r) => r.entregues, cell: (r) => num(r.entregues) },
              { k: 'a', t: 'Adiadas', right: true, sort: (r) => r.adiadas, cell: (r) => (r.adiadas ? <span className="tag w">{num(r.adiadas)}</span> : 0) },
              { k: 'f', t: 'Falhadas', right: true, sort: (r) => r.falhadas, cell: (r) => (r.falhadas ? <span className="tag bad">{num(r.falhadas)}</span> : 0) },
            ]}
          />
          <p className="fb-nota">{t('Contado a partir do registo do servidor de e-mail (Exim): recebidas pelo remetente, as outras pelo destinatário.')}</p>
        </>
      )}
    </>
  );
}
export const resumoEmailPagina: ScreenFn = () => ({ title: 'Resumo de e-mail', desc: 'Entregues, adiadas e falhadas por domínio', body: <ResumoEmail /> });

// ======================= Rastreio de e-mail =======================
type MsgRastreio = { id: string; data: string; de: string; para: string[]; estado: string; linhas: string[] };
function VerMensagem({ m }: { m: MsgRastreio }) {
  const { t, closeM } = useVH();
  return (
    <>
      <h3>{t('Percurso da mensagem')}</h3>
      <p style={{ lineHeight: 1.5 }}>
        <code>{m.id}</code> · {m.data}
      </p>
      <pre className="log-txt ad-log-curto">{m.linhas.join('\n')}</pre>
      <div className="mfoot">
        <button className="btn r" onClick={closeM}>
          {t('Fechar')}
        </button>
      </div>
    </>
  );
}
const ESTADO_MAIL: Record<string, string> = { entregue: 'ok', adiada: 'w', falhou: 'bad', 'na fila': 'off' };
function RastreioEmail() {
  const vh = useVH();
  const { t } = vh;
  const [horas, setHoras] = useState<'24' | '168'>('24');
  const [campo, setCampo] = useState('');
  const [q, setQ] = useState('');
  const { dados, erro, ler } = useGet<{ mensagens: MsgRastreio[]; total: number }>(ROTA + '?ver=mail-rastreio&horas=' + horas + '&q=' + encodeURIComponent(q));
  return (
    <>
      <Tabs<'24' | '168'>
        on={horas}
        onChange={setHoras}
        tabs={[
          ['24', 'Últimas 24 horas', 'fa-clock'],
          ['168', 'Últimos 7 dias', 'fa-calendar-week'],
        ]}
      />
      <form
        className="ad-procura"
        onSubmit={(e) => {
          e.preventDefault();
          setQ(campo.trim());
        }}
      >
        <input value={campo} onChange={(e) => setCampo(e.target.value)} placeholder={t('Endereço de e-mail, domínio ou ID da mensagem')} aria-label={t('Procurar')} />
        <button className="btn r" type="submit">
          <i className="fa-solid fa-magnifying-glass" />
          {t('Procurar')}
        </button>
      </form>
      {!dados ? (
        <Carregando erro={erro} ler={ler} />
      ) : (
        <DataTable
          id="ad-mail-rastreio"
          umaLinha
          barraFora
          empilhar="tablet"
          rows={dados.mensagens}
          rowKey={(r) => r.id}
          empty={q ? 'Nenhuma mensagem encontrada' : 'Sem mensagens no período'}
          cols={[
            { k: 'd', t: 'Data', sort: (r) => r.data, cell: (r) => r.data.slice(0, 16) },
            {
              k: 'f',
              t: 'Mensagem',
              sort: (r) => r.de,
              cell: (r) => (
                <span className="pm-proc">
                  <b className="ad-cmd">{r.de || '—'}</b>
                  <small className="ad-cmd">→ {r.para.join(', ') || '—'}</small>
                </span>
              ),
            },
            { k: 'e', t: 'Estado', sort: (r) => r.estado, cell: (r) => <span className={'tag ' + (ESTADO_MAIL[r.estado] || 'off')}>{t(r.estado.charAt(0).toUpperCase() + r.estado.slice(1))}</span> },
          ]}
          actions={(r) => (
            <button className="btn sm g fb-btn" title={t('Ver o percurso')} onClick={() => vh.openM(<VerMensagem m={r} />)}>
              <i className="fa-solid fa-route" />
              <span>{t('Percurso')}</span>
            </button>
          )}
        />
      )}
    </>
  );
}
export const rastreioEmailPagina: ScreenFn = () => ({ title: 'Rastreio de e-mail', desc: 'Percurso de cada e-mail no servidor', body: <RastreioEmail /> });

// ======================= Logs do sistema =======================
const LOGS: [string, string][] = [
  ['syslog', 'Sistema (syslog)'],
  ['auth', 'Entradas no servidor (auth.log)'],
  ['nginx', 'Erros do Nginx'],
  ['apache', 'Erros do Apache'],
  ['exim', 'E-mail — Exim'],
  ['exim-rejeitados', 'E-mail — rejeitados'],
  ['dovecot', 'E-mail — Dovecot'],
  ['fail2ban', 'Força bruta (fail2ban)'],
  ['mariadb', 'Base de dados (MariaDB)'],
  ['hestia', 'Vhost — sistema'],
  ['hestia-erros', 'Vhost — erros'],
  ['hestia-entradas', 'Vhost — entradas'],
  ['cron-site', 'Tarefas do site (cron)'],
  ['site', 'Site — registo'],
  ['site-erros', 'Site — erros'],
];
function LogsSistema() {
  const { t } = useVH();
  const [ficheiro, setFicheiro] = useState('syslog');
  const [linhas, setLinhas] = useState('200');
  const [campo, setCampo] = useState('');
  const [q, setQ] = useState('');
  const { dados, erro, ler } = useGet<{ linhas: string[]; existentes: string[]; tamanho: number }>(ROTA + '?ver=logs&ficheiro=' + ficheiro + '&linhas=' + linhas + '&q=' + encodeURIComponent(q));
  const existentes = dados?.existentes;
  return (
    <>
      <form
        className="ad-procura ad-logs"
        onSubmit={(e) => {
          e.preventDefault();
          setQ(campo.trim());
        }}
      >
        <select value={ficheiro} onChange={(e) => setFicheiro(e.target.value)} aria-label={t('Ficheiro')}>
          {LOGS.filter(([k]) => !existentes || existentes.includes(k)).map(([k, l]) => (
            <option key={k} value={k}>
              {t(l)}
            </option>
          ))}
        </select>
        <select value={linhas} onChange={(e) => setLinhas(e.target.value)} aria-label={t('Linhas')}>
          {['100', '200', '500', '1000', '2000'].map((n) => (
            <option key={n} value={n}>
              {n} {t('linhas')}
            </option>
          ))}
        </select>
        <input value={campo} onChange={(e) => setCampo(e.target.value)} placeholder={t('Procurar no registo')} aria-label={t('Procurar')} />
        <button className="btn r" type="submit">
          <i className="fa-solid fa-magnifying-glass" />
          {t('Procurar')}
        </button>
      </form>
      {!dados ? <Carregando erro={erro} ler={ler} /> : <pre className="log-txt">{dados.linhas.length ? dados.linhas.join('\n') : t('Sem linhas para mostrar')}</pre>}
    </>
  );
}
export const logsAdminPagina: ScreenFn = () => ({ title: 'Logs', desc: 'Registos do servidor', body: <LogsSistema /> });

// ======================= Firewall =======================
type Regra = { id: string; acao: string; protocolo: string; porta: string; ip: string; comentario: string; suspensa: boolean; data: string };
type Fw = { regras: Regra[]; listas: { nome: string; origem: string; ipv: string; auto: string; data: string }[] };
const EVT_FW = 'vh-fw-mudou';
function NovaRegra({ onFeito }: { onFeito: () => void }) {
  const vh = useVH();
  const { t, closeM } = vh;
  const [f, setF] = useState({ regra: 'ACCEPT', protocolo: 'TCP', porta: '', ip: '0.0.0.0/0', comentario: '' });
  const linha = (label: string, ctl: ReactNode) => (
    <div className="frm-row">
      <div className="frm-lb">{t(label)}</div>
      <div className="frm-ctl">{ctl}</div>
    </div>
  );
  return (
    <div className="da-janela">
      <div className="da-janela-cab">
        <h3>{t('Adicionar regra')}</h3>
        <button type="button" className="da-janela-x" onClick={closeM} aria-label={t('Fechar')}>
          <i className="fa-solid fa-xmark" />
        </button>
      </div>
      <div className="frm">
        {linha(
          'Ação',
          <select value={f.regra} onChange={(e) => setF({ ...f, regra: e.target.value })}>
            <option value="ACCEPT">{t('Permitir')}</option>
            <option value="DROP">{t('Bloquear')}</option>
          </select>,
        )}
        {linha(
          'Protocolo',
          <select value={f.protocolo} onChange={(e) => setF({ ...f, protocolo: e.target.value })}>
            {['TCP', 'UDP', 'ICMP'].map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>,
        )}
        {linha('Porta', <input value={f.porta} onChange={(e) => setF({ ...f, porta: e.target.value.replace(/[^0-9,:-]/g, '') })} placeholder="ex.: 22, 80,443 ou 8000-8100" />)}
        {linha('Endereço IP', <input value={f.ip} onChange={(e) => setF({ ...f, ip: e.target.value.trim() })} placeholder="0.0.0.0/0" />)}
        {linha('Comentário', <input value={f.comentario} maxLength={40} onChange={(e) => setF({ ...f, comentario: e.target.value })} />)}
        <div className="frm-foot">
          <button
            className="btn r"
            disabled={!f.porta || !f.ip}
            onClick={async () => {
              if (await pedir(vh, { acao: 'fw-adicionar', ...f }, 'Regra adicionada')) {
                closeM();
                onFeito();
              }
            }}
          >
            {t('Guardar')}
          </button>
        </div>
      </div>
    </div>
  );
}
type AbaW = 'regras' | 'listas';
function Firewall() {
  const vh = useVH();
  const { t } = vh;
  const [aba, setAba] = useState<AbaW>('regras');
  const { dados, erro, ler } = useGet<Fw>(ROTA + '?ver=firewall');
  // o "+ Adicionar regra" da barra de cima avisa quando adicionou, para a lista se atualizar
  useEffect(() => {
    const f = () => void ler(true);
    window.addEventListener(EVT_FW, f);
    return () => window.removeEventListener(EVT_FW, f);
  }, [ler]);
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  const fazer = (ids: string[], acao: 'fw-apagar' | 'fw-suspender' | 'fw-retomar') => {
    const [tit, ok, msg] = { 'fw-apagar': ['Apagar as regras?', 'Apagar', 'Regras apagadas'], 'fw-suspender': ['Suspender as regras?', 'Suspender', 'Regras suspensas'], 'fw-retomar': ['Retomar as regras?', 'Retomar', 'Regras retomadas'] }[acao];
    vh.openM(<Confirmar titulo={tit} texto={dados.regras.filter((r) => ids.includes(r.id)).map((r) => r.protocolo + ' ' + r.porta + ' ' + r.ip).join(', ')} ok={ok} onOk={async () => (await pedir(vh, { acao, ids }, msg)) && ler(true)} />);
  };
  return (
    <>
      <Tabs<AbaW>
        on={aba}
        onChange={setAba}
        tabs={[
          ['regras', 'Regras', 'fa-shield-halved'],
          ['listas', 'Listas de IPs', 'fa-list'],
        ]}
      />
      {aba === 'regras' ? (
        <DataTable
          id="ad-fw"
          umaLinha
          barraFora
          empilhar="tablet"
          rows={dados.regras}
          rowKey={(r) => r.id}
          search={(r) => r.protocolo + ' ' + r.porta + ' ' + r.ip + ' ' + r.comentario}
          empty="Nenhuma regra"
          cols={[
            { k: 'a', t: 'Ação', sort: (r) => r.acao, cell: (r) => <span className={'tag ' + (r.acao === 'DROP' ? 'bad' : 'ok')}>{t(r.acao === 'DROP' ? 'Bloquear' : 'Permitir')}</span> },
            { k: 'p', t: 'Protocolo', sort: (r) => r.protocolo, cell: (r) => r.protocolo },
            { k: 'o', t: 'Porta', sort: (r) => Number(r.porta.split(/[,:-]/)[0]) || 0, cell: (r) => <code>{r.porta}</code> },
            { k: 'i', t: 'Endereço IP', cell: (r) => <code>{r.ip}</code> },
            { k: 'c', t: 'Comentário', ate: 1300, cell: (r) => r.comentario || '—' },
            { k: 'e', t: 'Estado', sort: (r) => (r.suspensa ? 0 : 1), cell: (r) => <span className={'tag ' + (r.suspensa ? 'off' : 'ok')}>{t(r.suspensa ? 'Suspensa' : 'Ativa')}</span> },
          ]}
          acoesNaColuna
          bulk={[
            { t: 'Suspender', fa: 'fa-pause', run: (k) => fazer(k, 'fw-suspender') },
            { t: 'Retomar', fa: 'fa-play', run: (k) => fazer(k, 'fw-retomar') },
            { t: 'Apagar', fa: 'fa-trash-can', run: (k) => fazer(k, 'fw-apagar') },
          ]}
        />
      ) : (
        <DataTable
          id="ad-fw-listas"
          umaLinha
          barraFora
          rows={dados.listas}
          rowKey={(r) => r.nome}
          search={(r) => r.nome + ' ' + r.origem}
          empty="Nenhuma lista de IPs"
          cols={[
            { k: 'n', t: 'Lista', sort: (r) => r.nome, cell: (r) => <b>{r.nome}</b> },
            { k: 'o', t: 'Origem', cell: (r) => <span className="pm-proc"><small className="ad-cmd">{r.origem}</small></span> },
            { k: 'v', t: 'IP', cell: (r) => r.ipv },
            { k: 'a', t: 'Atualização', cell: (r) => <span className={'tag ' + (r.auto === 'yes' ? 'ok' : 'off')}>{t(r.auto === 'yes' ? 'Automática' : 'À mão')}</span> },
          ]}
        />
      )}
    </>
  );
}
function BotaoNovaRegra() {
  const vh = useVH();
  return (
    <button className="btn r" onClick={() => vh.openM(<NovaRegra onFeito={() => window.dispatchEvent(new Event(EVT_FW))} />)}>
      <i className="fa-solid fa-plus" />
      {vh.t('Adicionar regra')}
    </button>
  );
}
export const firewallPagina: ScreenFn = () => ({
  title: 'Firewall',
  desc: 'Regras de entrada do servidor',
  descEl: <Resumo<Fw> url={ROTA + '?ver=firewall'} base="Regras de entrada do servidor" partes={(d) => [d.regras.length + ' regras', d.listas.length ? d.listas.length + ' listas de IPs' : null]} />,
  actions: <BotaoNovaRegra />,
  body: <Firewall />,
});
