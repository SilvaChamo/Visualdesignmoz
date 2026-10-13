'use client';

// Força bruta — no modelo do Brute Force Monitor do DirectAdmin (pedido do Silva, 13/10/2026). Só o administrador.
// No Contabo quem bloqueia é o fail2ban do Hestia: IPs bloqueados (desbloquear / bloquear), tentativas falhadas das
// últimas 24 h e o registo das últimas 48 h, por /api/vhost/forca-bruta. Barra numa linha só (regra do Silva).
import { useEffect, useState } from 'react';
import { useVH, type VH } from '../context';
import type { ScreenFn } from '../screens';
import { esquecerMemoria, useGet, useNaMemoria } from '../carga';
import { DataTable, Tabs } from './componentes';
import { Confirmar } from './pacotes';
import { Carregando } from './avancado';

type Bloqueado = { ip: string; cadeia: string; desde: string; ate: string | null; mz: boolean };
type Tentativa = { ip: string; cadeias: string[]; n: number; ultima: string; bloqueado: boolean; mz: boolean };
type Evento = { data: string; cadeia: string; acao: string; ip: string; mz: boolean };
type Dados = { bloqueados: Bloqueado[]; tentativas: Tentativa[]; registo: Evento[]; duracoes: Record<string, number> };
type Aba = 'bloqueados' | 'tentativas' | 'registo';

const ROTA = '/api/vhost/forca-bruta';
/** cadeia do fail2ban/Hestia → serviço que fecha */
const SERVICO: Record<string, string> = {
  SSH: 'SSH',
  MAIL: 'E-mail',
  HESTIA: 'Painel Hestia',
  FTP: 'FTP',
  WEB: 'Site / phpMyAdmin',
  DB: 'Base de dados',
  DNS: 'DNS',
  RECIDIVE: 'Todos os serviços',
};
const servico = (c: string) => SERVICO[c] || c;
const ACAO: Record<string, [string, string]> = { Found: ['Tentativa falhada', 'w'], Ban: ['Bloqueado', 'bad'], Unban: ['Desbloqueado', 'ok'], 'Restore Ban': ['Bloqueio reposto', 'bad'] };

/** "2026-10-13 07:31:47" → "13/10/2026 07:31" */
const quando = (s: string | null) => {
  const m = s && /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/.exec(s);
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}` : '—';
};
const duracao = (s: number) => (s >= 86400 ? Math.round(s / 86400) + ' dias' : s >= 3600 ? Math.round(s / 3600) + ' h' : Math.round(s / 60) + ' min');

function Ip({ ip, mz }: { ip: string; mz: boolean }) {
  const { t } = useVH();
  return (
    <span className="fb-ip">
      <code>{ip}</code>
      {mz && <span className="tag ok">{t('Moçambique')}</span>}
    </span>
  );
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

function BloquearIp({ ips: inicial, onFeito }: { ips?: string[]; onFeito: () => void }) {
  const vh = useVH();
  const { t, closeM } = vh;
  const [ips, setIps] = useState((inicial || []).join(', '));
  const [cadeia, setCadeia] = useState('RECIDIVE');
  const lista = ips.split(/[\s,;]+/).filter(Boolean);
  return (
    <>
      <h3>{t('Bloquear IP')}</h3>
      <p style={{ lineHeight: 1.5 }}>{t('O IP fica bloqueado até alguém o desbloquear nesta página. Pode escrever vários, separados por vírgulas.')}</p>
      <div className="f">
        <label>{t('Endereço IP')}</label>
        <input value={ips} onChange={(e) => setIps(e.target.value)} placeholder="203.0.113.10" autoFocus />
      </div>
      <div className="f">
        <label>{t('Serviço')}</label>
        <select value={cadeia} onChange={(e) => setCadeia(e.target.value)}>
          {Object.entries(SERVICO).map(([k, v]) => (
            <option key={k} value={k}>
              {t(v)}
            </option>
          ))}
        </select>
      </div>
      <div className="mfoot">
        <button className="btn g" onClick={closeM}>
          {t('Cancelar')}
        </button>
        <button
          className="btn r"
          disabled={!lista.length}
          onClick={async () => {
            const j = await pedir(vh, { acao: 'bloquear', ips: lista, cadeia }, lista.length === 1 ? 'IP bloqueado' : 'IPs bloqueados');
            if (!j) return;
            const recusados = (j.recusados as string[] | undefined) || [];
            if (recusados.length) vh.toast(t('Não bloqueado (endereço interno ou do próprio servidor):') + ' ' + recusados.join(', '));
            closeM();
            onFeito();
          }}
        >
          <i className="fa-solid fa-ban" />
          {t('Bloquear')}
        </button>
      </div>
    </>
  );
}

function ForcaBruta() {
  const vh = useVH();
  const { t } = vh;
  const [aba, setAba] = useState<Aba>('bloqueados');
  const { dados, erro, ler } = useGet<Dados>(ROTA);
  // o "+ Bloquear IP" da barra de cima avisa quando bloqueou, para a lista se atualizar
  useEffect(() => {
    const atualizar = () => void ler();
    window.addEventListener(EVT_BLOQUEOU, atualizar);
    return () => window.removeEventListener(EVT_BLOQUEOU, atualizar);
  }, [ler]);
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  const chaveB = (b: Bloqueado) => b.ip + '|' + b.cadeia;
  const desbloquear = (itens: { ip: string; cadeia: string }[]) =>
    vh.openM(
      <Confirmar
        titulo={itens.length === 1 ? 'Desbloquear o IP?' : 'Desbloquear os IPs?'}
        texto={itens.map((i) => i.ip + ' (' + t(servico(i.cadeia)) + ')').join(', ')}
        ok="Desbloquear"
        onOk={async () => (await pedir(vh, { acao: 'desbloquear', itens }, itens.length === 1 ? 'IP desbloqueado' : 'IPs desbloqueados')) && ler()}
      />,
    );
  const bloquear = (ips?: string[]) => vh.openM(<BloquearIp ips={ips} onFeito={() => void ler()} />);
  const abas = (
    <Tabs<Aba>
      on={aba}
      onChange={setAba}
      tabs={[
        ['bloqueados', 'IPs bloqueados', 'fa-ban'],
        ['tentativas', 'Tentativas (24 h)', 'fa-user-lock'],
        ['registo', 'Registo', 'fa-list'],
      ]}
    />
  );
  const servicosBloq = [...new Set(dados.bloqueados.map((b) => b.cadeia))];
  const mais = (c: string) => (dados.duracoes[c] ? ' · ' + duracao(dados.duracoes[c]) : '');

  return (
    <>
      {/* os separadores abrem o cartão (faixa cinzenta, como em Domínios); a pesquisa e os botões ficam por cima do cartão */}
      {abas}
      {aba === 'bloqueados' && (
        <DataTable
          id="fb-bloqueados"
          umaLinha
          barraFora
          empilhar
          rows={dados.bloqueados}
          rowKey={chaveB}
          search={(r) => r.ip + ' ' + servico(r.cadeia) + (r.mz ? ' moçambique' : '')}
          empty="Não há IPs bloqueados"
          cols={[
            { k: 'ip', t: 'Endereço IP', sort: (r) => r.ip, cell: (r) => <Ip ip={r.ip} mz={r.mz} /> },
            { k: 's', t: 'Serviço', sort: (r) => servico(r.cadeia), cell: (r) => <span className={'tag ' + (r.cadeia === 'RECIDIVE' ? 'bad' : 'w')}>{t(servico(r.cadeia))}</span> },
            { k: 'd', t: 'Bloqueado em', sort: (r) => r.desde, cell: (r) => quando(r.desde) },
            { k: 'a', t: 'Desbloqueia', sort: (r) => r.ate || '9999', cell: (r) => (r.ate ? quando(r.ate) : <span className="fb-manual">{t('Só à mão')}</span>) },
          ]}
          actions={(r) => (
            <button className="btn sm g" onClick={() => desbloquear([{ ip: r.ip, cadeia: r.cadeia }])}>
              <i className="fa-solid fa-unlock" />
              {t('Desbloquear')}
            </button>
          )}
          acoesNaColuna
          bulk={[
            {
              t: 'Desbloquear',
              fa: 'fa-unlock',
              run: (k) => desbloquear(dados.bloqueados.filter((b) => k.includes(chaveB(b))).map((b) => ({ ip: b.ip, cadeia: b.cadeia }))),
            },
          ]}
        />
      )}
      {aba === 'tentativas' && (
        <DataTable
          id="fb-tentativas"
          umaLinha
          barraFora
          empilhar
          rows={dados.tentativas}
          rowKey={(r) => r.ip}
          search={(r) => r.ip + ' ' + r.cadeias.map(servico).join(' ') + (r.mz ? ' moçambique' : '')}
          empty="Nenhuma tentativa falhada nas últimas 24 horas"
          cols={[
            { k: 'ip', t: 'Endereço IP', sort: (r) => r.ip, cell: (r) => <Ip ip={r.ip} mz={r.mz} /> },
            { k: 's', t: 'Serviços', cell: (r) => r.cadeias.map((c) => t(servico(c))).join(', ') },
            { k: 'n', t: 'Tentativas', right: true, sort: (r) => r.n, cell: (r) => <b>{r.n}</b> },
            { k: 'u', t: 'Última', sort: (r) => r.ultima, cell: (r) => quando(r.ultima) },
            { k: 'e', t: 'Estado', sort: (r) => (r.bloqueado ? 1 : 0), cell: (r) => <span className={'tag ' + (r.bloqueado ? 'bad' : 'off')}>{t(r.bloqueado ? 'Bloqueado' : 'Livre')}</span> },
          ]}
          actions={(r) =>
            r.bloqueado ? null : (
              <button className="btn sm g" onClick={() => bloquear([r.ip])}>
                <i className="fa-solid fa-ban" />
                {t('Bloquear')}
              </button>
            )
          }
          acoesNaColuna
          bulk={[{ t: 'Bloquear', fa: 'fa-ban', run: (k) => bloquear(k) }]}
        />
      )}
      {aba === 'registo' && (
        <DataTable
          id="fb-registo"
          umaLinha
          barraFora
          empilhar
          rows={dados.registo.map((e, i) => ({ ...e, k: String(i) }))}
          rowKey={(r) => r.k}
          search={(r) => r.ip + ' ' + servico(r.cadeia) + ' ' + (ACAO[r.acao]?.[0] || r.acao)}
          empty="Sem registos nas últimas 48 horas"
          cols={[
            { k: 'd', t: 'Data', sort: (r) => r.data, cell: (r) => quando(r.data) },
            { k: 'a', t: 'Acontecimento', cell: (r) => <span className={'tag ' + (ACAO[r.acao]?.[1] || 'off')}>{t(ACAO[r.acao]?.[0] || r.acao)}</span> },
            { k: 's', t: 'Serviço', cell: (r) => t(servico(r.cadeia)) + (r.acao === 'Ban' ? mais(r.cadeia) : '') },
            { k: 'ip', t: 'Endereço IP', cell: (r) => <Ip ip={r.ip} mz={r.mz} /> },
          ]}
        />
      )}
      {aba === 'bloqueados' && servicosBloq.length > 0 && (
        <p className="fb-nota">
          {t('Cada bloqueio fecha só o serviço indicado; quem reincide fica bloqueado em todos. Os IPs de Moçambique nunca perdem o acesso ao site, ao painel e ao login.')}{' '}
          {t('Duração dos bloqueios automáticos:')}{' '}
          {Object.entries(dados.duracoes)
            .filter(([c]) => SERVICO[c])
            .map(([c, s]) => t(servico(c)) + ' ' + duracao(s))
            .join(' · ')}
        </p>
      )}
    </>
  );
}

/** Descrição da barra de cima: "Monitor de tentativas falhadas | 6 IPs bloqueados | 86 tentativas em 24 h" (sem segundo
 *  título no cartão — pedido do Silva). Usa a leitura que a página já faz. */
function ResumoForcaBruta() {
  const { t } = useVH();
  const d = useNaMemoria<Dados>(ROTA);
  return (
    <>
      {t('Monitor de tentativas falhadas')}
      {d && (
        <>
          <span className="pdesc-sep">|</span>
          {d.bloqueados.length} {t(d.bloqueados.length === 1 ? 'IP bloqueado' : 'IPs bloqueados')}
          <span className="pdesc-sep">|</span>
          {d.tentativas.reduce((n, x) => n + x.n, 0)} {t('tentativas em 24 h')}
        </>
      )}
    </>
  );
}

/** "+ Bloquear IP" na barra de cima (o "+" principal da página fica na barra do título — modelo do Silva, 13/10/2026) */
const EVT_BLOQUEOU = 'vh-fb-bloqueou';
function BotaoBloquearIp() {
  const vh = useVH();
  return (
    <button className="btn r" onClick={() => vh.openM(<BloquearIp onFeito={() => window.dispatchEvent(new Event(EVT_BLOQUEOU))} />)}>
      <i className="fa-solid fa-plus" />
      {vh.t('Bloquear IP')}
    </button>
  );
}

export const forcaBrutaPagina: ScreenFn = () => ({ title: 'Força bruta', desc: 'Monitor de tentativas falhadas', descEl: <ResumoForcaBruta />, actions: <BotaoBloquearIp />, body: <ForcaBruta /> });
