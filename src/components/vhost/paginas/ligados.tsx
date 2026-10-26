'use client';

// Admin › Gestão de contas › Contas ligadas (Agora | Histórico).
// Agora: quem tem o painel aberto (cada aparelho avisa o servidor a cada 30 s) e quem tem sessão aberta no WordPress dos sites ou no
// webmail (lidos dos registos do servidor); actualiza-se a cada 5 s, com o IP de cada um quando o servidor o regista.
// Histórico (Silva, 25/10/2026): uma linha por sessão; ao clicar abre-se aqui mesmo o detalhe — Acção | Hora | Resultado de cada
// passo, com os bloqueios e erros do servidor (ex.: o ModSecurity a recusar o CSS que a Tatiana guardava no WordPress).
import { useCallback, useEffect, useRef, useState } from 'react';
import type { LinhaActividade } from '@/lib/vhost-actividade-servidor';
import type { PessoaHistorico, SessaoHistorico } from '@/lib/vhost-historico-sessoes';
import { useVH, type VH } from '../context';
import type { ScreenFn } from '../screens';
import { DESC, EN, MENU } from '../generated/data';
import { arrumarMenuContas } from '../menu-contas';
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
  arrumarMenuContas();
  DESC['admin/ligados'] = ['Quem tem o painel, o WordPress ou o webmail aberto agora: conta, plano, IP e localização', 'Who has the panel, WordPress or webmail open now: account, plan, IP and location'];
  const novas: Record<string, string> = {
    'Quem tem o painel, o WordPress ou o webmail aberto agora: conta, plano, IP e localização': 'Who has the panel, WordPress or webmail open now: account, plan, IP and location',
    Onde: 'Where',
    Painel: 'Panel',
    'IP indisponível': 'IP unavailable',
    'Rede local': 'Local network',
    Início: 'Start',
    'Acções': 'Actions',
    Resultado: 'Result',
    Hora: 'Time',
    Voltar: 'Back',
    Tudo: 'Everything',
    'Só problemas': 'Problems only',
    até: 'until',
    desde: 'since',
    Quando: 'When',
    Caminho: 'Path',
    Mostrar: 'Show',
    Registado: 'Logged',
    Bloqueado: 'Blocked',
    Falhou: 'Failed',
    Erro: 'Error',
    'Sem problemas': 'No problems',
    bloqueio: 'block',
    bloqueios: 'blocks',
    erro: 'error',
    erros: 'errors',
    'Todas as contas': 'All accounts',
    'Sessão de': 'Session of',
    Sessão: 'Session',
    'Duração': 'Duration',
    Pessoa: 'Person',
    Aparelho: 'Device',
    'IP e aparelho': 'IP and device',
    'A ler os registos do servidor…': 'Reading the server logs…',
    'Ainda não há sessões no histórico': 'There are no sessions in the history yet',
    'Esta sessão não tem acções para mostrar': 'This session has nothing to show',
    'Esta sessão não tem problemas': 'This session has no problems',
    'O servidor não respondeu: só se vê o histórico do painel.': 'The server did not answer: only the panel history is shown.',
    'Não foi possível ler o histórico.': 'Could not read the history.',
    'Não foi possível abrir a sessão.': 'Could not open the session.',
    'Limpar histórico': 'Clear history',
    'Histórico limpo': 'History cleared',
    'Ninguém tem o painel, o WordPress ou o webmail aberto neste momento': 'Nobody has the panel, WordPress or webmail open right now',
    'A ver a conta': 'Viewing account',
    'A localizar…': 'Locating…',
    'IP:': 'IP:',
    entrou: 'joined',
    Ligado: 'Online',
    Inativo: 'Idle',
    agora: 'now',
  };
  for (const [pt, en] of Object.entries(novas)) if (!(pt in EN)) EN[pt] = en;
}

type Ligada = {
  uid: string;
  deviceId: string;
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

/** Sessão aberta no WordPress de um site ou no webmail, lida dos registos do servidor */
type Externa = {
  chave: string;
  origem: 'wordpress' | 'webmail';
  onde: string;
  conta: string;
  plano: string;
  pessoa: string;
  email: string;
  ip: string;
  local: string;
  aparelho: string;
  desde: number;
  ultimo: number;
};

/** Uma linha da tabela "Agora": o painel, o WordPress ou o webmail */
type LinhaAgora = {
  chave: string;
  origem: 'painel' | 'wordpress' | 'webmail';
  pessoa: string;
  email: string;
  papel: string;
  conta: string;
  plano: string;
  aVer: string;
  planoAVer: string;
  onde: string;
  ip: string;
  local: string;
  aparelho: string;
  desde: number;
  ultimo: number;
};

type Lista = { sessoes: SessaoHistorico[]; pessoas: PessoaHistorico[]; semServidor: boolean };
type Detalhe = { sessao: SessaoHistorico; linhas: LinhaActividade[]; semServidor: boolean };
type LinhaDetalhe = LinhaActividade & { _k: string };

const PAPEL: Record<string, string> = { admin: 'Administrador', reseller: 'Revendedor', manager: 'Profissional', profissional: 'Profissional', client: 'Cliente' };
const ATIVO_MS = 2 * 60_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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

const horaCompleta = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const hm = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function duracao(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
}

/** "IP: 41.x" — ou o aviso de que o servidor não o regista (é o IP do próprio servidor que o Apache vê nos sites sem a configuração do IP real) */
function ipTexto(ip: string, t: (k: string) => string): string {
  if (!ip) return t('IP indisponível');
  if (ip === '::1' || ip === '127.0.0.1') return `${t('IP:')} ${t('Rede local')}`;
  return `${t('IP:')} ${ip}`;
}

const CLASSE_ESTADO: Record<LinhaActividade['estado'], string> = { ok: 'ok', bloqueado: 'bad', erro: 'w', aviso: 'w', info: 'off' };
const ROTULO_ESTADO: Record<LinhaActividade['estado'], string> = { ok: 'OK', bloqueado: 'Bloqueado', erro: 'Erro', aviso: 'Falhou', info: 'Registado' };
const ehProblema = (l: LinhaActividade) => l.estado === 'bloqueado' || l.estado === 'erro' || l.estado === 'aviso';

function Ligados() {
  const vh = useVH();
  const { t } = vh;
  const { dados, erro, ler } = useGet<{ ligadas: Ligada[]; externas?: Externa[]; agora: number }>('/api/vhost/presenca');
  // o separador e a sessão aberta vêm do endereço (/admin/ligados/historico/<sessão>): o caminho da página, na barra do selector de
  // domínios, e o "voltar" do navegador funcionam sem estado à parte
  const base = baseLigados(vh.s);
  const aba: 'agora' | 'historico' = vh.s.sub[0] === 'historico' ? 'historico' : 'agora';
  const idSessao = aba === 'historico' ? vh.s.sub[1] || '' : '';
  const [filtro, setFiltro] = useState('');
  const [lista, setLista] = useState<Lista | null>(null);
  const [aCarregar, setACarregar] = useState(false);
  const [historicoErro, setHistoricoErro] = useState('');
  const [detalhe, setDetalhe] = useState<Detalhe | null>(null);
  const [soProblemas, setSoProblemas] = useState(false);
  // só a última resposta conta (o filtro ou a sessão podem mudar enquanto o servidor ainda responde)
  const pedido = useRef(0);

  const carregarLista = useCallback(async () => {
    const meu = ++pedido.current;
    setACarregar(true);
    setHistoricoErro('');
    try {
      const resposta = await fetch('/api/vhost/presenca/historico' + (filtro ? '?filtro=' + encodeURIComponent(filtro) : ''), { cache: 'no-store' });
      const corpo = (await resposta.json().catch(() => ({}))) as Partial<Lista> & { erro?: string };
      if (!resposta.ok) throw new Error(corpo.erro || 'Não foi possível ler o histórico.');
      if (meu === pedido.current) setLista({ sessoes: corpo.sessoes || [], pessoas: corpo.pessoas || [], semServidor: !!corpo.semServidor });
    } catch (e) {
      if (meu === pedido.current) setHistoricoErro(e instanceof Error ? e.message : 'Não foi possível ler o histórico.');
    } finally {
      if (meu === pedido.current) setACarregar(false);
    }
  }, [filtro]);

  const carregarDetalhe = useCallback(async (id: string) => {
    const meu = ++pedido.current;
    setDetalhe(null);
    setSoProblemas(false);
    setHistoricoErro('');
    setACarregar(true);
    try {
      const resposta = await fetch('/api/vhost/presenca/historico?sessao=' + encodeURIComponent(id), { cache: 'no-store' });
      const corpo = (await resposta.json().catch(() => ({}))) as Partial<Detalhe> & { erro?: string };
      if (!resposta.ok || !corpo.sessao) throw new Error(corpo.erro || 'Não foi possível abrir a sessão.');
      if (meu === pedido.current) setDetalhe({ sessao: corpo.sessao, linhas: corpo.linhas || [], semServidor: !!corpo.semServidor });
    } catch (e) {
      if (meu === pedido.current) setHistoricoErro(e instanceof Error ? e.message : 'Não foi possível abrir a sessão.');
    } finally {
      if (meu === pedido.current) setACarregar(false);
    }
  }, []);

  const abrir = (sessao: SessaoHistorico) => vh.nav(`${base}/historico/${encodeURIComponent(sessao.id)}`);
  const fechar = () => vh.nav(`${base}/historico`);

  useEffect(() => {
    const id = setInterval(() => void ler(true), 5_000);
    return () => clearInterval(id);
  }, [ler]);
  useEffect(() => {
    if (aba !== 'historico') return;
    if (idSessao) void carregarDetalhe(idSessao);
    else void carregarLista();
  }, [aba, idSessao, carregarLista, carregarDetalhe]);

  if (!dados) return <Carregando erro={erro} ler={ler} />;
  const agora = dados.agora;

  const limparHistorico = (chave: string) => {
    const todas = !chave;
    vh.openM(
      <Confirmar
        titulo={todas ? 'Limpar o histórico de todas as contas?' : 'Limpar o histórico desta conta?'}
        texto={t(todas ? 'Esta acção apaga o histórico de todas as contas.' : 'Esta acção apaga o histórico da conta seleccionada.')}
        ok="Limpar histórico"
        onOk={() => {
          void (async () => {
            try {
              const param = !chave ? '' : UUID.test(chave) ? '?uid=' + encodeURIComponent(chave) : chave.startsWith('conta:') ? '?conta=' + encodeURIComponent(chave.slice(6)) : '';
              const resposta = await fetch('/api/vhost/presenca/historico' + param, { method: 'DELETE' });
              const resultado = (await resposta.json().catch(() => ({}))) as { erro?: string };
              if (!resposta.ok) throw new Error(resultado.erro || t('Não foi possível limpar o histórico.'));
              vh.toast(t('Histórico limpo'));
              await carregarLista();
            } catch (erroLimpeza) {
              vh.toast(erroLimpeza instanceof Error ? erroLimpeza.message : t('Não foi possível limpar o histórico.'));
            }
          })();
        }}
      />,
    );
  };

  // ---------- Agora: o painel, o WordPress e o webmail numa só tabela ----------
  const linhasAgora: LinhaAgora[] = [
    ...dados.ligadas.map((r): LinhaAgora => ({
      chave: `${r.uid}:${r.deviceId}`,
      origem: 'painel',
      pessoa: r.nome || r.email,
      email: r.email,
      papel: r.papel,
      conta: r.conta,
      plano: r.plano,
      aVer: r.aVer,
      planoAVer: r.planoAVer,
      onde: 'Painel',
      ip: r.ip,
      local: r.local,
      aparelho: r.aparelho,
      desde: r.desde,
      ultimo: r.ultimo,
    })),
    ...(dados.externas || []).map((r): LinhaAgora => ({
      chave: r.chave,
      origem: r.origem,
      pessoa: r.pessoa,
      email: r.email,
      papel: '',
      conta: r.conta,
      plano: r.plano,
      aVer: '',
      planoAVer: '',
      onde: r.onde,
      ip: r.ip,
      local: r.local,
      aparelho: r.aparelho,
      desde: r.desde,
      ultimo: r.ultimo,
    })),
  ].sort((a, b) => b.ultimo - a.ultimo);

  const agoraTabela = (
    <DataTable
      id="ligados"
      umaLinha
      barraFora
      rows={linhasAgora}
      rowKey={(r) => r.chave}
      search={(r) => [r.pessoa, r.email, r.conta, r.aVer, r.plano, r.local, r.ip, r.aparelho, r.onde].join(' ')}
      empty="Ninguém tem o painel, o WordPress ou o webmail aberto neste momento"
      cols={[
        {
          k: 'p',
          t: 'Pessoa',
          sort: (r) => r.pessoa,
          cell: (r) => (
            <div className="cell">
              <div>
                <b>{r.pessoa}</b>
                <span>{r.pessoa !== r.email && r.email ? r.email : r.papel ? t(PAPEL[r.papel] || r.papel) : ''}</span>
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
                <div className="vh-lig-sub">
                  {t('A ver a conta')} <b>{r.aVer}</b>
                  {r.planoAVer ? ' · ' + r.planoAVer : ''}
                </div>
              )}
            </div>
          ),
        },
        { k: 'o', t: 'Onde', sort: (r) => r.onde, cell: (r) => <span className={'tag ' + (r.origem === 'painel' ? 'off' : 'ok')}>{r.origem === 'painel' ? t('Painel') : r.onde}</span> },
        { k: 'r', t: 'Papel', ate: 1300, sort: (r) => r.papel, cell: (r) => (r.papel ? <span className="tag off">{t(PAPEL[r.papel] || r.papel)}</span> : '—') },
        {
          k: 'l',
          t: 'Localização',
          sort: (r) => r.local,
          cell: (r) => (
            <div>
              {r.local || (r.ip ? t('A localizar…') : '—')}
              <div className="vh-lig-sub">{ipTexto(r.ip, t)}</div>
            </div>
          ),
        },
        { k: 'a', t: 'Aparelho', ate: 1600, sort: (r) => r.aparelho, cell: (r) => r.aparelho || '—' },
        {
          k: 'u',
          t: 'Atividade',
          sort: (r) => -r.ultimo,
          cell: (r) => {
            const ativo = agora - r.ultimo < ATIVO_MS;
            return (
              <div>
                <span className={'tag ' + (ativo ? 'ok' : 'off')}>{t(ativo ? 'Ligado' : 'Inativo')}</span>
                <div className="vh-lig-sub">
                  {t(haQuanto(agora - r.ultimo))} · {t('entrou')} {t(haQuanto(agora - r.desde))}
                </div>
              </div>
            );
          },
        },
      ]}
    />
  );

  // ---------- Histórico: a lista de sessões ----------
  const selecionada = lista?.pessoas.find((p) => p.chave === filtro);
  const historicoLista = (
    <section>
      <div className="vh-historico-acoes">
        <select className="inp sm vh-historico-selector" aria-label={t('Conta')} value={filtro} onChange={(e) => setFiltro(e.target.value)}>
          <option value="">{t('Todas as contas')}</option>
          {(lista?.pessoas || []).map((p) => (
            <option key={p.chave} value={p.chave}>
              {p.nome}
              {p.conta ? ' · ' + p.conta : ''}
            </option>
          ))}
        </select>
        <button className="btn r sm" onClick={() => limparHistorico('')}>
          <i className="fa-solid fa-trash-can" /> {t('Limpar histórico de todas as contas')}
        </button>
      </div>
      {selecionada && (
        <div className="card vh-historico-conta">
          <div>
            <b>{selecionada.nome}</b>
            {selecionada.conta && <div className="vh-lig-sub">{selecionada.conta}</div>}
          </div>
          <button className="btn g sm" onClick={() => limparHistorico(filtro)}>
            <i className="fa-solid fa-trash-can" /> {t('Limpar conta seleccionada')}
          </button>
        </div>
      )}
      {lista?.semServidor && <div className="note vh-historico-erro">{t('O servidor não respondeu: só se vê o histórico do painel.')}</div>}
      <div className="vh-historico-tabela">
        <DataTable<SessaoHistorico>
          id="historico-sessoes"
          rows={lista?.sessoes || []}
          rowKey={(r) => r.id}
          aoAbrirLinha={(r) => abrir(r)}
          search={(r) => [r.pessoa, r.email, r.conta, r.aVer, r.onde, r.ip, r.aparelho].join(' ')}
          empty={aCarregar ? 'A ler os registos do servidor…' : 'Ainda não há sessões no histórico'}
          cols={[
            {
              k: 'quando',
              t: 'Quando',
              sort: (r) => r.fim,
              cell: (r) => (
                <div>
                  {new Date(r.fim).toLocaleString()}
                  <div className="vh-lig-sub">
                    {t('desde')} {hm(r.inicio)} · {duracao(r.fim - r.inicio)}
                  </div>
                </div>
              ),
            },
            {
              k: 'pessoa',
              t: 'Pessoa e conta',
              sort: (r) => r.pessoa,
              cell: (r) => (
                <div>
                  <b>{r.pessoa || '—'}</b>
                  <div className="vh-lig-sub">
                    {r.conta || '—'}
                    {r.aVer ? ' → ' + r.aVer : ''}
                  </div>
                </div>
              ),
            },
            { k: 'onde', t: 'Onde', sort: (r) => r.onde, cell: (r) => <span className={'tag ' + (r.origem === 'painel' ? 'off' : 'ok')}>{r.origem === 'painel' ? t('Painel') : r.onde}</span> },
            { k: 'acoes', t: 'Acções', sort: (r) => r.acoes, cell: (r) => r.acoes },
            {
              k: 'res',
              t: 'Resultado',
              sort: (r) => r.bloqueios * 1000 + r.erros,
              cell: (r) =>
                r.bloqueios || r.erros ? (
                  <span className="vh-hist-etiquetas">
                    {r.bloqueios > 0 && <span className="tag bad">{r.bloqueios} {t(r.bloqueios === 1 ? 'bloqueio' : 'bloqueios')}</span>}
                    {r.erros > 0 && <span className="tag w">{r.erros} {t(r.erros === 1 ? 'erro' : 'erros')}</span>}
                  </span>
                ) : (
                  <span className="tag ok">{t('Sem problemas')}</span>
                ),
            },
            {
              k: 'ip',
              t: 'IP e aparelho',
              ate: 1300,
              sort: (r) => r.ip,
              cell: (r) => (
                <div>
                  {ipTexto(r.ip, t)}
                  <div className="vh-lig-sub">{r.aparelho || '—'}</div>
                </div>
              ),
            },
          ]}
        />
        {historicoErro && <div className="note vh-historico-erro">{historicoErro}</div>}
      </div>
    </section>
  );

  // ---------- Histórico: uma sessão por dentro (Acção | Hora | Resultado) ----------
  const s = detalhe?.sessao;
  // o mais recente em cima (Silva, 25/10/2026)
  const todasLinhas: LinhaDetalhe[] = [...(detalhe?.linhas || [])].sort((a, b) => b.t - a.t).map((l, i) => ({ ...l, _k: `${l.t}|${l.origem}|${i}` }));
  const linhasVistas = soProblemas ? todasLinhas.filter(ehProblema) : todasLinhas;
  // o caminho desta página está na barra do selector de domínios (crumbs de ligadosPagina); aqui só o "Voltar", discreto
  const historicoDetalhe = (
    <section>
      <button className="vh-hist-voltar" onClick={fechar} title={t('Voltar')}>
        <i className="fa-solid fa-arrow-left" /> {t('Voltar')}
      </button>
      {s && (
      <div className="card vh-hist-resumo">
        <div>
          <span>{t('Pessoa')}</span>
          <b>{s.pessoa || '—'}</b>
          <em>{s.email || s.conta}</em>
        </div>
        <div>
          <span>{t('Onde')}</span>
          <b>{s.origem === 'painel' ? t('Painel') : s.onde}</b>
          <em>{s.aVer ? t('A ver a conta') + ' ' + s.aVer : s.conta}</em>
        </div>
        <div>
          <span>{t('Duração')}</span>
          <b>{duracao(s.fim - s.inicio)}</b>
          <em>
            {hm(s.inicio)} → {hm(s.fim)}
          </em>
        </div>
        <div>
          <span>{t('IP e aparelho')}</span>
          <b>{ipTexto(s.ip, t)}</b>
          <em>{s.aparelho || '—'}</em>
        </div>
        <div>
          <span>{t('Resultado')}</span>
          <b className="vh-hist-etiquetas">
            {s.bloqueios > 0 && <span className="tag bad">{s.bloqueios} {t(s.bloqueios === 1 ? 'bloqueio' : 'bloqueios')}</span>}
            {s.erros > 0 && <span className="tag w">{s.erros} {t(s.erros === 1 ? 'erro' : 'erros')}</span>}
            {!s.bloqueios && !s.erros && <span className="tag ok">{t('Sem problemas')}</span>}
          </b>
        </div>
      </div>
      )}
      {detalhe?.semServidor && <div className="note vh-historico-erro">{t('O servidor não respondeu: só se vê o histórico do painel.')}</div>}
      <div className="vh-hist-filtro" role="group" aria-label={t('Mostrar')}>
        <button className={'btn sm ' + (!soProblemas ? 'r' : 'g')} onClick={() => setSoProblemas(false)}>
          {t('Tudo')} ({todasLinhas.length})
        </button>
        <button className={'btn sm ' + (soProblemas ? 'r' : 'g')} onClick={() => setSoProblemas(true)}>
          {t('Só problemas')} ({todasLinhas.filter(ehProblema).length})
        </button>
      </div>
      <div className="vh-historico-tabela">
        <DataTable<LinhaDetalhe>
          id="historico-detalhe"
          rows={linhasVistas}
          rowKey={(r) => r._k}
          rowClass={(r) => (ehProblema(r) ? 'vh-hist-mau' : '')}
          search={(r) => [r.acao, r.onde, r.resultado, r.detalhe || '', r.ip].join(' ')}
          empty={aCarregar ? 'A ler os registos do servidor…' : soProblemas ? 'Esta sessão não tem problemas' : 'Esta sessão não tem acções para mostrar'}
          linhaExtra={(r) =>
            r.detalhe && r.estado !== 'info' ? (
              <div className="vh-hist-detalhe">
                <i className="fa-solid fa-circle-info" /> {r.detalhe}
              </div>
            ) : null
          }
          cols={[
            {
              k: 'acao',
              t: 'Acção',
              cell: (r) => (
                <div>
                  <b>{t(r.acao)}</b>
                  <div className="vh-lig-sub">
                    {r.origem === 'painel' ? `${t('Painel')}${r.secao ? ' · ' + t(nomeSecao(r.secao)) : ''}` : r.onde}
                    {r.origem === 'wordpress' && r.ip ? ` · ${ipTexto(r.ip, t)}` : ''}
                    {r.estado === 'info' && r.detalhe ? ` · ${r.detalhe}` : ''}
                  </div>
                </div>
              ),
            },
            {
              k: 'hora',
              t: 'Hora',
              sort: (r) => r.t,
              cell: (r) => (
                <div>
                  {horaCompleta(r.t)}
                  {r.n > 1 && r.ate ? <div className="vh-lig-sub">{t('até')} {horaCompleta(r.ate)} · {r.n}×</div> : null}
                </div>
              ),
            },
            {
              k: 'res',
              t: 'Resultado',
              sort: (r) => r.estado,
              cell: (r) => (
                <div>
                  <span className={'tag ' + CLASSE_ESTADO[r.estado]}>{t(ROTULO_ESTADO[r.estado])}</span>
                  {r.resultado && r.resultado !== 'OK' && r.resultado !== 'Registado' && <div className="vh-lig-sub">{r.resultado}</div>}
                </div>
              ),
            },
          ]}
        />
        {historicoErro && <div className="note vh-historico-erro">{historicoErro}</div>}
      </div>
    </section>
  );

  return (
    <>
      <Tabs<'agora' | 'historico'>
        tabs={[
          ['agora', 'Agora', 'fa-signal'],
          ['historico', 'Histórico', 'fa-clock-rotate-left'],
        ]}
        on={aba}
        onChange={(k) => vh.nav(k === 'historico' ? `${base}/historico` : base)}
      />
      {aba === 'agora' ? agoraTabela : idSessao ? historicoDetalhe : historicoLista}
    </>
  );
}

/** Endereço da página: /admin/ligados */
const baseLigados = (s: VH['s']) => '/' + s.level + '/' + s.page;

/** "Sessão de 25/10/2026, 15:17" — a data vem da própria chave da sessão (o último pedaço é o início em ms) */
function rotuloSessao(id: string): string {
  const inicio = Number(id.split('|').pop());
  return Number.isFinite(inicio) ? 'Sessão de ' + new Date(inicio).toLocaleString() : 'Sessão';
}

export const ligadosPagina: ScreenFn = (vh: VH) => {
  const b = baseLigados(vh.s);
  const [aba, id] = vh.s.sub;
  return {
    title: 'Contas ligadas',
    desc: vh.t('Quem tem o painel, o WordPress ou o webmail aberto agora: conta, plano, IP e localização'),
    // a sessão aberta entra no caminho da faixa do selector de domínios: Contas ligadas › Histórico › Sessão de …
    crumbs: aba === 'historico' && id ? [{ t: 'Contas ligadas', path: b }, { t: 'Histórico', path: b + '/historico' }, { t: rotuloSessao(id) }] : undefined,
    body: <Ligados />,
  };
};
