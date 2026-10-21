'use client';

// Ferramentas de admin do servidor — "Monitor de processos" e "Serviços", no modelo do Process Monitor e do Service
// Monitor do DirectAdmin (Silva, 16/10/2026: "parar o processo que consome mais CPU"; o Monitor abre-se pelo menu Admin; a chave do cartão do servidor, no
// painel inicial, abre o Monitor de processos). Só o administrador; dados de /api/vhost/admin-servidor.
import { useEffect, useState } from 'react';
import { useVH, type VH } from '../context';
import type { ScreenFn } from '../screens';
import { esquecerMemoria, useGet, useNaMemoria } from '../carga';
import { DataTable, Tabs } from './componentes';
import { Confirmar } from './pacotes';
import { Carregando } from './avancado';

const ROTA = '/api/vhost/admin-servidor';
type Processo = { pid: number; ppid: number; user: string; nome: string; cpu: number; tempo: number; memMb: number; cmd: string; protegido: boolean };
type Processos = { processos: Processo[]; total: number; cpu: number; nucleos: number; memTotalMb: number; memLivreMb: number; carga: [number, number, number] };
type Servico = { nome: string; sistema: string; ativo: boolean; cpu: number; memMb: number; ha: number };
type Servicos = { servicos: Servico[] };

const num = (n: number, casas = 1) => n.toFixed(casas).replace('.', ',');
const mem = (mb: number) => (mb >= 1024 ? num(mb / 1024) + ' GB' : Math.round(mb) + ' MB');
/** tempo de CPU acumulado: "2 h 31 min", "45 s" */
function tempoCpu(s: number): string {
  if (s >= 3600) return Math.floor(s / 3600) + ' h ' + Math.floor((s % 3600) / 60) + ' min';
  if (s >= 60) return Math.floor(s / 60) + ' min';
  return s + ' s';
}
/** há quanto tempo um serviço está ligado (minutos do Hestia) */
function ligadoHa(min: number): string {
  if (min >= 1440) return Math.floor(min / 1440) + ' d ' + Math.floor((min % 1440) / 60) + ' h';
  if (min >= 60) return Math.floor(min / 60) + ' h ' + (min % 60) + ' min';
  return min + ' min';
}

async function pedir(vh: VH, corpo: Record<string, unknown>, ok: string): Promise<Record<string, unknown> | null> {
  vh.toast('A alterar no servidor…');
  try {
    const r = await fetch(ROTA, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corpo) });
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

// ---------- Monitor de processos ----------
type AbaP = 'todos' | 'contas' | 'sistema';
const SISTEMA = new Set(['root', 'www-data', 'nginx', 'mysql', 'redis', 'clamav', 'Debian-exim', 'dovenull', 'dovecot', 'bind', 'systemd-resolve', 'systemd+', 'messagebus', 'syslog', 'hestiaweb', 'hestiamail', 'admin', 'ubuntu', 'dhcpcd', 'Debian-+', 'hestiam+', 'nobody']);
const doSistema = (p: Processo) => SISTEMA.has(p.user);

function BarraCpu({ v, max }: { v: number; max: number }) {
  const p = Math.min(100, (v / max) * 100);
  return (
    <span className="pm-cpu">
      <b>{num(v)}%</b>
      <span className="bar">
        <span style={{ width: p + '%', background: v >= 80 ? 'var(--red)' : v >= 40 ? '#f59e0b' : '#10b981' }} />
      </span>
    </span>
  );
}

function MonitorProcessos() {
  const vh = useVH();
  const { t } = vh;
  const [aba, setAba] = useState<AbaP>('todos');
  const { dados, erro, ler } = useGet<Processos>(ROTA + '?ver=processos');
  // como o "top": atualiza sozinho de 5 em 5 segundos (por trás, sem a linha do topo)
  useEffect(() => {
    const i = setInterval(() => ler(true), 5000);
    return () => clearInterval(i);
  }, [ler]);
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  const lista = dados.processos.filter((p) => (aba === 'todos' ? true : aba === 'sistema' ? doSistema(p) : !doSistema(p)));
  const parar = (pids: number[], forcar = false) => {
    const escolhidos = dados.processos.filter((p) => pids.includes(p.pid));
    const protegidos = escolhidos.filter((p) => p.protegido);
    const livres = escolhidos.filter((p) => !p.protegido);
    if (!livres.length) return vh.toast(t('Estes processos são do sistema ou do próprio site: reinicie o serviço nos Serviços.'));
    vh.openM(
      <Confirmar
        titulo={forcar ? 'Forçar a paragem?' : livres.length === 1 ? 'Parar o processo?' : 'Parar os processos?'}
        texto={
          livres.map((p) => p.nome + ' (' + p.user + ', ' + num(p.cpu) + '% CPU)').join(', ') +
          (protegidos.length ? ' — ' + t('ficam de fora os protegidos:') + ' ' + protegidos.map((p) => p.nome).join(', ') : '') +
          (forcar ? ' — ' + t('sem esperar que terminem o que estão a fazer.') : '')
        }
        ok={forcar ? 'Forçar' : 'Parar'}
        onOk={async () => {
          const j = await pedir(vh, { acao: 'processo-parar', pids: livres.map((p) => p.pid), forcar }, livres.length === 1 ? 'Processo parado' : 'Processos parados');
          if (j && ((j.ainda as number[]) || []).length) vh.toast(t('Ainda a terminar — se não parar, use "Forçar a paragem".'));
          ler(true);
        }}
      />,
    );
  };
  return (
    <>
      <Tabs<AbaP>
        on={aba}
        onChange={setAba}
        tabs={[
          ['todos', 'Todos', 'fa-list'],
          ['contas', 'Das contas', 'fa-users'],
          ['sistema', 'Do sistema', 'fa-server'],
        ]}
      />
      <DataTable
        id="processos"
        umaLinha
        barraFora
        empilhar="tablet"
        rows={lista}
        rowKey={(r) => String(r.pid)}
        search={(r) => r.nome + ' ' + r.user + ' ' + r.cmd + ' ' + r.pid}
        empty="Nenhum processo"
        porPagina={25}
        rowClass={(r) => (r.cpu >= 50 ? 'pm-pesado' : '')}
        cols={[
          {
            k: 'p',
            t: 'Processo',
            sort: (r) => r.nome,
            cell: (r) => (
              <span className="pm-proc pm-largo">
                <b>{r.nome}</b>
                {r.protegido && <span className="tag off">{t('Protegido')}</span>}
                <small title={r.cmd}>{r.cmd}</small>
              </span>
            ),
          },
          { k: 'u', t: 'Conta', sort: (r) => r.user, cell: (r) => r.user },
          { k: 'c', t: 'CPU', sort: (r) => r.cpu, cell: (r) => <BarraCpu v={r.cpu} max={100} /> },
          { k: 'm', t: 'Memória', right: true, sort: (r) => r.memMb, cell: (r) => mem(r.memMb) },
          { k: 't', t: 'Tempo de CPU', right: true, ate: 1300, sort: (r) => r.tempo, cell: (r) => tempoCpu(r.tempo) },
          { k: 'pid', t: 'PID', right: true, ate: 1300, sort: (r) => r.pid, cell: (r) => <code>{r.pid}</code> },
        ]}
        actions={(r) =>
          r.protegido ? null : (
            <button className="btn sm g fb-btn" title={t('Parar')} onClick={() => parar([r.pid])}>
              <i className="fa-solid fa-stop" />
              <span>{t('Parar')}</span>
            </button>
          )
        }
        acoesNaColuna
        bulk={[
          { t: 'Parar', fa: 'fa-stop', run: (k) => parar(k.map(Number)) },
          { t: 'Forçar a paragem', fa: 'fa-skull-crossbones', run: (k) => parar(k.map(Number), true) },
        ]}
      />
      <p className="fb-nota">
        {t('O CPU de cada processo é medido agora (durante 1 segundo) e atualiza-se de 5 em 5 segundos; 100% é um núcleo inteiro. Os processos do sistema e do próprio site estão protegidos: esses reiniciam-se nos Serviços.')}
      </p>
    </>
  );
}

/** "Processos do servidor | CPU 27% de 6 núcleos | Memória 3,7 de 11,7 GB | O que mais gasta: php-fpm8.3 (mltmark) 86%" */
function ResumoProcessos() {
  const { t } = useVH();
  const d = useNaMemoria<Processos>(ROTA + '?ver=processos');
  const topo = d?.processos[0];
  return (
    <>
      {t('Processos do servidor')}
      {d && (
        <>
          <span className="pdesc-sep">|</span>
          CPU {num(d.cpu)}% {t('de')} {d.nucleos} {t('núcleos')}
          <span className="pdesc-sep">|</span>
          {t('Memória')} {mem(d.memTotalMb - d.memLivreMb)} {t('de')} {mem(d.memTotalMb)}
          {topo && topo.cpu >= 5 && (
            <>
              <span className="pdesc-sep">|</span>
              {t('O que mais gasta:')} {topo.nome} ({topo.user}) {num(topo.cpu)}%
            </>
          )}
        </>
      )}
    </>
  );
}

export const processosPagina: ScreenFn = () => ({ title: 'Monitor de processos', desc: 'Processos do servidor', descEl: <ResumoProcessos />, body: <MonitorProcessos /> });

// ---------- Serviços ----------
type AbaS = 'todos' | 'ativos' | 'parados';
const NAO_PARAR = /^(nginx|hestia|ssh|sshd|mariadb|mysql)$/;

function MonitorServicos() {
  const vh = useVH();
  const { t } = vh;
  const [aba, setAba] = useState<AbaS>('todos');
  const { dados, erro, ler } = useGet<Servicos>(ROTA + '?ver=servicos');
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  const lista = dados.servicos.filter((s) => (aba === 'todos' ? true : aba === 'ativos' ? s.ativo : !s.ativo));
  const OP: Record<string, [string, string, string]> = {
    reiniciar: ['Reiniciar', 'Reiniciar o serviço?', 'Serviço reiniciado'],
    parar: ['Parar', 'Parar o serviço?', 'Serviço parado'],
    iniciar: ['Iniciar', 'Iniciar o serviço?', 'Serviço iniciado'],
  };
  const fazer = (nomes: string[], op: 'reiniciar' | 'parar' | 'iniciar') => {
    const validos = op === 'parar' ? nomes.filter((n) => !NAO_PARAR.test(n)) : nomes;
    if (!validos.length) return vh.toast(t('Este serviço não se pára daqui (o site ou o painel ficavam em baixo). Pode reiniciá-lo.'));
    vh.openM(
      <Confirmar
        titulo={OP[op][1]}
        texto={validos.join(', ') + (op === 'parar' && validos.length < nomes.length ? ' — ' + t('os essenciais ficam de fora') : '')}
        ok={OP[op][0]}
        onOk={async () => {
          for (const nome of validos) await pedir(vh, { acao: 'servico', nome, op }, OP[op][2] + ': ' + nome);
          ler(true);
        }}
      />,
    );
  };
  return (
    <>
      <Tabs<AbaS>
        on={aba}
        onChange={setAba}
        tabs={[
          ['todos', 'Todos', 'fa-list'],
          ['ativos', 'Ativos', 'fa-circle-check'],
          ['parados', 'Parados', 'fa-circle-stop'],
        ]}
      />
      <DataTable
        id="servicos"
        umaLinha
        barraFora
        empilhar="tablet"
        rows={lista}
        rowKey={(r) => r.nome}
        search={(r) => r.nome + ' ' + r.sistema}
        empty="Nenhum serviço"
        cols={[
          { k: 'n', t: 'Serviço', sort: (r) => r.nome, cell: (r) => <b>{r.nome}</b> },
          { k: 's', t: 'Descrição', ate: 1300, cell: (r) => <span className="pm-desc">{r.sistema}</span> },
          { k: 'e', t: 'Estado', sort: (r) => (r.ativo ? 1 : 0), cell: (r) => <span className={'tag ' + (r.ativo ? 'ok' : 'bad')}>{t(r.ativo ? 'Ativo' : 'Parado')}</span> },
          { k: 'c', t: 'CPU', right: true, sort: (r) => r.cpu, cell: (r) => num(r.cpu) + '%' },
          { k: 'm', t: 'Memória', right: true, sort: (r) => r.memMb, cell: (r) => mem(r.memMb) },
          { k: 'h', t: 'Ligado há', right: true, ate: 1300, sort: (r) => r.ha, cell: (r) => (r.ativo ? ligadoHa(r.ha) : '—') },
        ]}
        actions={(r) => (
          <button className="btn sm g fb-btn" title={t(r.ativo ? 'Reiniciar' : 'Iniciar')} onClick={() => fazer([r.nome], r.ativo ? 'reiniciar' : 'iniciar')}>
            <i className={'fa-solid ' + (r.ativo ? 'fa-rotate' : 'fa-play')} />
            <span>{t(r.ativo ? 'Reiniciar' : 'Iniciar')}</span>
          </button>
        )}
        acoesNaColuna
        bulk={[
          { t: 'Reiniciar', fa: 'fa-rotate', run: (k) => fazer(k, 'reiniciar') },
          { t: 'Parar', fa: 'fa-stop', run: (k) => fazer(k, 'parar') },
          { t: 'Iniciar', fa: 'fa-play', run: (k) => fazer(k, 'iniciar') },
        ]}
      />
    </>
  );
}

function ResumoServicos() {
  const { t } = useVH();
  const d = useNaMemoria<Servicos>(ROTA + '?ver=servicos');
  const parados = d?.servicos.filter((s) => !s.ativo).length || 0;
  return (
    <>
      {t('Estado e reinício dos serviços do servidor')}
      {d && (
        <>
          <span className="pdesc-sep">|</span>
          {d.servicos.length - parados} {t('ativos')}
          {parados > 0 && (
            <>
              <span className="pdesc-sep">|</span>
              {parados} {t(parados === 1 ? 'parado' : 'parados')}
            </>
          )}
        </>
      )}
    </>
  );
}

export const servicosPagina: ScreenFn = () => ({ title: 'Serviços', desc: 'Estado e reinício dos serviços do servidor', descEl: <ResumoServicos />, body: <MonitorServicos /> });
