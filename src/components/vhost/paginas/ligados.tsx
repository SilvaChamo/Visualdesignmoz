'use client';

// Admin › Gestão de contas › Contas ligadas: mantém a tabela actual e acrescenta separadores para actividade e histórico.
// Cada painel aberto avisa o servidor a cada minuto; a lista de contas ligadas actualiza-se a cada 5 s.
import { useCallback, useEffect, useState } from 'react';
import { useVH, type VH } from '../context';
import type { ScreenFn } from '../screens';
import { DESC, MENU } from '../generated/data';
import { useGet } from '../carga';
import { DataTable, Tabs } from './componentes';
import { Carregando } from './avancado';
import { Confirmar } from './pacotes';

// ---------- Menu: "Contas ligadas" no fim de Gestão de contas ----------
{
  const grupo = MENU.admin.find(([g]) => g === 'Gestão de contas');
  if (grupo && !grupo[1].some((it) => it.id === 'ligados')) {
    grupo[1].push({
      id: 'ligados',
      fa: 'fa-signal',
      t: 'Contas ligadas',
      c: 'c3',
      da: '—',
      f: ['Quem tem o painel aberto agora', 'Conta, plano, localização e aparelho'],
      hx: { s: 'app', cmd: '', n: 'Avisos do próprio painel, guardados em memória no site' },
    });
  }
  DESC['admin/ligados'] = ['Quem tem o painel aberto agora: conta, plano e localização', 'Who has the panel open now: account, plan and location'];
}

type Ligada = {
  uid: string;
  email: string;
  nome: string;
  papel: string;
  conta: string;
  aVer: string;
  plano: string;
  planoAVer: string;
  ip: string;
  local: string;
  aparelho: string;
  pagina: string;
  secao: string;
  acao: string;
  desde: number;
  ultimo: number;
};

type EventoHistorico = {
  id: string;
  user_id: string;
  user_email: string;
  user_name: string;
  account_name: string;
  viewing_account: string;
  event_type: 'section' | 'click';
  section: string;
  action: string;
  duration_seconds: number | null;
  created_at: string;
};

const PAPEL: Record<string, string> = { admin: 'Administrador', reseller: 'Revendedor', manager: 'Profissional', profissional: 'Profissional', client: 'Cliente' };
const ATIVO_MS = 2 * 60_000;
const TAMANHO_PAGINA_HISTORICO = 100;

function nomeSecao(secao: string): string {
  const [nivel, id] = secao.split('/');
  if (!nivel || !id || !Object.prototype.hasOwnProperty.call(MENU, nivel)) return secao;
  const menu = MENU[nivel as keyof typeof MENU];
  for (const [, itens] of menu) {
    const item = itens.find((entrada) => entrada.id === id);
    if (item) return item.t;
  }
  return secao;
}

function haQuanto(ms: number): string {
  const m = Math.floor(ms / 60_000);
  if (m < 1) return 'agora';
  if (m < 60) return `há ${m} min`;
  return `há ${Math.floor(m / 60)} h ${m % 60} min`;
}

function Ligados() {
  const vh = useVH();
  const { t } = vh;
  const { dados, erro, ler } = useGet<{ ligadas: Ligada[]; agora: number }>('/api/vhost/presenca');
  const [aba, setAba] = useState<'agora' | 'actividades' | 'historico'>('agora');
  const [uidHistorico, setUidHistorico] = useState('');
  const [eventos, setEventos] = useState<EventoHistorico[]>([]);
  const [historicoErro, setHistoricoErro] = useState('');
  const [aCarregarHistorico, setACarregarHistorico] = useState(false);
  const [temMais, setTemMais] = useState(false);

  const carregarHistorico = useCallback(async (inicio: number, acrescentar: boolean) => {
    setACarregarHistorico(true);
    setHistoricoErro('');
    try {
      const params = new URLSearchParams({ inicio: String(inicio), limite: String(TAMANHO_PAGINA_HISTORICO) });
      if (uidHistorico) params.set('uid', uidHistorico);
      const resposta = await fetch('/api/vhost/presenca/historico?' + params, { cache: 'no-store' });
      const dadosHistorico = (await resposta.json().catch(() => ({}))) as { eventos?: EventoHistorico[]; temMais?: boolean; erro?: string };
      if (!resposta.ok) throw new Error(dadosHistorico.erro || 'Não foi possível ler o histórico.');
      const novos = Array.isArray(dadosHistorico.eventos) ? dadosHistorico.eventos : [];
      setEventos((anteriores) => acrescentar ? [...anteriores, ...novos] : novos);
      setTemMais(!!dadosHistorico.temMais);
    } catch (erroHistorico) {
      setHistoricoErro(erroHistorico instanceof Error ? erroHistorico.message : 'Não foi possível ler o histórico.');
    } finally {
      setACarregarHistorico(false);
    }
  }, [uidHistorico]);

  useEffect(() => {
    const id = setInterval(() => void ler(true), 5_000);
    return () => clearInterval(id);
  }, [ler]);
  useEffect(() => {
    if (aba === 'historico') void carregarHistorico(0, false);
  }, [aba, carregarHistorico]);

  if (!dados) return <Carregando erro={erro} ler={ler} />;
  const agora = dados.agora;
  const contasHistorico = new Map<string, { nome: string; conta: string }>();
  for (const ligada of dados.ligadas) contasHistorico.set(ligada.uid, { nome: ligada.nome || ligada.email, conta: ligada.aVer || ligada.conta });
  for (const evento of eventos) contasHistorico.set(evento.user_id, { nome: evento.user_name || evento.user_email, conta: evento.viewing_account || evento.account_name });
  const contaSeleccionada = uidHistorico ? contasHistorico.get(uidHistorico) : undefined;
  const limparHistorico = (uid: string) => {
    const todas = !uid;
    vh.openM(
      <Confirmar
        titulo={todas ? 'Limpar o histórico de todas as contas?' : 'Limpar o histórico desta conta?'}
        texto={t(todas ? 'Esta acção apaga o histórico de todas as contas.' : 'Esta acção apaga o histórico da conta seleccionada.')}
        ok="Limpar histórico"
        onOk={() => {
          void (async () => {
            try {
              const url = '/api/vhost/presenca/historico' + (uid ? '?uid=' + encodeURIComponent(uid) : '');
              const resposta = await fetch(url, { method: 'DELETE' });
              const resultado = (await resposta.json().catch(() => ({}))) as { erro?: string };
              if (!resposta.ok) throw new Error(resultado.erro || t('Não foi possível limpar o histórico.'));
              vh.toast(t('Histórico limpo'));
              await carregarHistorico(0, false);
            } catch (erroLimpeza) {
              vh.toast(erroLimpeza instanceof Error ? erroLimpeza.message : t('Não foi possível limpar o histórico.'));
            }
          })();
        }}
      />,
    );
  };

  return (
    <>
      <Tabs<'agora' | 'actividades' | 'historico'>
        tabs={[
          ['agora', 'Agora', 'fa-signal'],
          ['actividades', 'Actividade', 'fa-eye'],
          ['historico', 'Histórico', 'fa-clock-rotate-left'],
        ]}
        on={aba}
        onChange={setAba}
      />
      {aba === 'agora' ? (
        <DataTable
          id="ligados"
          umaLinha
          barraFora
          rows={dados.ligadas}
          rowKey={(r) => r.uid}
          search={(r) => [r.nome, r.email, r.conta, r.aVer, r.plano, r.local, r.ip, r.aparelho].join(' ')}
          empty="Ninguém tem o painel aberto neste momento"
          cols={[
            {
              k: 'p',
              t: 'Pessoa',
              sort: (r) => r.nome || r.email,
              cell: (r) => (
                <div className="cell">
                  <div>
                    <b>{r.nome || r.email}</b>
                    <span>{r.nome ? r.email : t(PAPEL[r.papel] || r.papel)}</span>
                  </div>
                </div>
              ),
            },
            {
              k: 'c',
              t: 'Conta e plano',
              sort: (r) => r.conta,
              cell: (r) => (
                <div>
                  <b>{r.conta || '—'}</b>
                  {r.plano ? <> · {r.plano}</> : null}
                  {r.aVer && (
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {t('A ver a conta')} <b>{r.aVer}</b>
                      {r.planoAVer ? ' · ' + r.planoAVer : ''}
                    </div>
                  )}
                </div>
              ),
            },
            { k: 'r', t: 'Papel', ate: 1300, sort: (r) => r.papel, cell: (r) => <span className="tag off">{t(PAPEL[r.papel] || r.papel)}</span> },
            {
              k: 'l',
              t: 'Localização',
              sort: (r) => r.local,
              cell: (r) => (
                <div>
                  {r.local || t('A localizar…')}
                  <div style={{ fontSize: 12, color: 'var(--muted)' }}>{t('IP:')} {r.ip || '—'}</div>
                </div>
              ),
            },
            { k: 'a', t: 'Aparelho', ate: 1600, sort: (r) => r.aparelho, cell: (r) => r.aparelho },
            {
              k: 'u',
              t: 'Atividade',
              sort: (r) => -r.ultimo,
              cell: (r) => {
                const ativo = agora - r.ultimo < ATIVO_MS;
                return (
                  <div>
                    <span className={'tag ' + (ativo ? 'ok' : 'off')}>{t(ativo ? 'Ligado' : 'Inativo')}</span>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {t(haQuanto(agora - r.ultimo))} · {t('entrou')} {t(haQuanto(agora - r.desde))}
                    </div>
                  </div>
                );
              },
            },
          ]}
        />
      ) : aba === 'actividades' ? (
        <section>
          <DataTable
            id="actividade-tempo-real-contas-ligadas"
            rows={dados.ligadas}
            rowKey={(r) => r.uid}
            search={(r) => [r.nome, r.email, r.conta, r.aVer, r.secao, r.acao].join(' ')}
            empty="Ninguém está ligado neste momento"
            cols={[
              {
                k: 'pessoa',
                t: 'Pessoa e conta',
                sort: (r) => r.nome || r.email,
                cell: (r) => (
                  <div>
                    <b>{r.nome || r.email}</b>
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                      {r.conta || '—'}{r.aVer ? ' → ' + r.aVer : ''}
                    </div>
                  </div>
                ),
              },
              {
                k: 'secao',
                t: 'A mexer em',
                sort: (r) => r.secao,
                cell: (r) => t(nomeSecao(r.secao)),
              },
              {
                k: 'acao',
                t: 'Última acção',
                sort: (r) => -r.ultimo,
                cell: (r) => (
                  <div>
                    {r.acao ? t(r.acao) : '—'}
                    <div style={{ fontSize: 12, color: 'var(--muted)' }}>{t(haQuanto(agora - r.ultimo))}</div>
                  </div>
                ),
              },
            ]}
          />
        </section>
      ) : (
        <section>
          <div className="vh-historico-acoes">
            <select
              className="inp sm vh-historico-selector"
              aria-label={t('Conta')}
              value={uidHistorico}
              onChange={(e) => setUidHistorico(e.target.value)}
            >
              <option value="">{t('Todas as contas')}</option>
              {[...contasHistorico.entries()].map(([uid, conta]) => (
                <option key={uid} value={uid}>{conta.nome}{conta.conta ? ' · ' + conta.conta : ''}</option>
              ))}
            </select>
            <button className="btn r sm" onClick={() => limparHistorico('')}>
              <i className="fa-solid fa-trash-can" /> {t('Limpar histórico de todas as contas')}
            </button>
          </div>
          {contaSeleccionada && (
            <div className="card vh-historico-conta">
              <div>
                <b>{contaSeleccionada.nome}</b>
                {contaSeleccionada.conta && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{contaSeleccionada.conta}</div>}
              </div>
              <button className="btn g sm" onClick={() => limparHistorico(uidHistorico)}>
                <i className="fa-solid fa-trash-can" /> {t('Limpar conta seleccionada')}
              </button>
            </div>
          )}
          <div className="card vh-historico-tabela">
            <DataTable
              id="historico-contas-ligadas"
              rows={eventos}
              rowKey={(r) => r.id}
              search={(r) => [r.user_name, r.user_email, r.account_name, r.viewing_account, r.section, r.action].join(' ')}
              empty={aCarregarHistorico ? 'A carregar histórico…' : 'Ainda não há acções no histórico'}
              cols={[
                {
                  k: 'quando',
                  t: 'Quando',
                  sort: (r) => r.created_at,
                  cell: (r) => new Date(r.created_at).toLocaleString(),
                },
                {
                  k: 'pessoa',
                  t: 'Pessoa e conta',
                  sort: (r) => r.user_name || r.user_email,
                  cell: (r) => (
                    <div>
                      <b>{r.user_name || r.user_email}</b>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                        {r.account_name || '—'}{r.viewing_account ? ' → ' + r.viewing_account : ''}
                      </div>
                    </div>
                  ),
                },
                {
                  k: 'tipo',
                  t: 'Acção',
                  sort: (r) => r.event_type,
                  cell: (r) => t(r.event_type === 'click' ? 'Clique' : 'Secção'),
                },
                {
                  k: 'secao',
                  t: 'Secção',
                  sort: (r) => r.section,
                  cell: (r) => t(nomeSecao(r.section)),
                },
                {
                  k: 'detalhe',
                  t: 'Detalhe',
                  cell: (r) => (
                    <div>
                      {t(r.action)}
                      {r.duration_seconds != null && <div style={{ fontSize: 12, color: 'var(--muted)' }}>{t('Tempo na secção')}: {r.duration_seconds} {t('segundos')}</div>}
                    </div>
                  ),
                },
              ]}
              rodape={
                temMais ? (
                  <button className="btn g sm" disabled={aCarregarHistorico} onClick={() => void carregarHistorico(eventos.length, true)}>
                    {t(aCarregarHistorico ? 'A carregar…' : 'Carregar mais')}
                  </button>
                ) : undefined
              }
            />
            {historicoErro && <div className="note vh-historico-erro">{historicoErro}</div>}
          </div>
        </section>
      )}
    </>
  );
}

export const ligadosPagina: ScreenFn = (vh: VH) => ({
  title: 'Contas ligadas',
  desc: vh.t('Quem tem o painel aberto agora: conta, plano e localização'),
  body: <Ligados />,
});
