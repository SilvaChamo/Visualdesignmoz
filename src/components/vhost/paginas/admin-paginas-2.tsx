'use client';

// Páginas do menu Admin que faltavam — 2.ª parte (Silva, 16/10/2026): software, atualizações, certificado do painel,
// definições, multi-servidor, backups, modelos web, open_basedir, security.txt, ModSecurity, importar contas,
// manutenção e os módulos opcionais. Mesmas regras de layout da 1.ª parte (admin-paginas.tsx): título com descrição
// pequena, separadores a abrir o cartão, "Ações" só onde há caixas de seleção, o "+ …" principal na barra de cima.
// Os trabalhos longos (instalar, atualizar, reconstruir) correm no servidor em segundo plano e a página mostra o registo.
import { useEffect, useState, type ReactNode } from 'react';
import { useVH, type VH } from '../context';
import type { ScreenFn } from '../screens';
import { useGet, useNaMemoria } from '../carga';
import { Stat } from '../ui';
import { DataTable, Switch, Tabs } from './componentes';
import { Confirmar } from './pacotes';
import { Carregando, Sec } from './avancado';
import { mbTexto } from '../servidor';
import { ROTA, Resumo, pedir } from './admin-paginas';

// ---------- comum ----------
type Trab = { aCorrer: boolean; registo: string[] };
type DomWeb = { conta: string; dominio: string; web: string; proxy: string; backend: string; suspenso: boolean };

// Um botão da barra de cima avisa a página quando mudou alguma coisa, para ela ler de novo
const EVT = 'vh-admin-mudou';
const avisar = () => window.dispatchEvent(new Event(EVT));
function useAoMudar(ler: (fundo?: unknown) => unknown) {
  useEffect(() => {
    const f = () => void ler(true);
    window.addEventListener(EVT, f);
    return () => window.removeEventListener(EVT, f);
  }, [ler]);
}

/** Pede ao servidor e, se correu bem, avisa a página (lê de novo, e o registo do trabalho começa a aparecer) */
async function fazer(vh: VH, corpo: Record<string, unknown>, ok: string) {
  const r = await pedir(vh, corpo, ok);
  if (r) avisar();
  return r;
}

/** Confirmação e pedido, para as opções do "Ações" e os botões da barra de cima */
function confirmar(vh: VH, titulo: string, texto: string, ok: string, corpo: Record<string, unknown>, msg: string) {
  vh.openM(<Confirmar titulo={titulo} texto={texto} ok={ok} onOk={() => void fazer(vh, corpo, msg)} />);
}

/** Registo do trabalho longo da página (instalar, atualizar…): lê de novo de 3 em 3 s enquanto corre */
function Trabalho({ tr, ler, titulo }: { tr?: Trab; ler: (fundo?: unknown) => unknown; titulo: string }) {
  const { t } = useVH();
  const aCorrer = !!tr?.aCorrer;
  useEffect(() => {
    if (!aCorrer) return;
    const id = setInterval(() => void ler(true), 3000);
    return () => clearInterval(id);
  }, [aCorrer, ler]);
  if (!tr || (!tr.aCorrer && !tr.registo.length)) return null;
  const fim = [...tr.registo].reverse().find((l) => l.startsWith('== fim'));
  const codigo = fim ? Number((fim.match(/código (\d+)/) || [])[1] || 0) : null;
  return (
    <Sec
      titulo={aCorrer ? titulo : 'Último trabalho'}
      desc={aCorrer ? 'A correr no servidor; pode sair da página, o trabalho continua.' : fim?.replace(/^== fim \(código \d+\) /, t('Terminou a') + ' ')}
      extra={<span className={'tag ' + (aCorrer ? 'w' : codigo ? 'bad' : 'ok')}>{t(aCorrer ? 'A correr' : codigo ? 'Terminou com erros' : 'Terminou')}</span>}
    >
      <pre className="log-txt ad-log-curto">{tr.registo.join('\n')}</pre>
    </Sec>
  );
}

/** Linha de opção (texto à esquerda, controlo à direita), como nas preferências */
function Opcao({ titulo, sub, children }: { titulo: string; sub?: ReactNode; children: ReactNode }) {
  const { t } = useVH();
  return (
    <div>
      <span>
        {t(titulo)}
        {sub && <small>{typeof sub === 'string' ? t(sub) : sub}</small>}
      </span>
      {children}
    </div>
  );
}

/** Janela com uma só escolha (modelo, versão…) */
function Escolher({ titulo, label, opcoes, atual, ok = 'Guardar', onOk }: { titulo: string; label: string; opcoes: string[]; atual?: string; ok?: string; onOk: (v: string) => void }) {
  const { t, closeM } = useVH();
  const [v, setV] = useState(atual && opcoes.includes(atual) ? atual : opcoes[0] || '');
  return (
    <div className="da-janela">
      <div className="da-janela-cab">
        <h3>{t(titulo)}</h3>
        <button type="button" className="da-janela-x" onClick={closeM} aria-label={t('Fechar')}>
          <i className="fa-solid fa-xmark" />
        </button>
      </div>
      <div className="frm">
        <div className="frm-row">
          <div className="frm-lb">{t(label)}</div>
          <div className="frm-ctl">
            <select value={v} onChange={(e) => setV(e.target.value)}>
              {opcoes.map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="frm-foot">
          <button
            className="btn r"
            disabled={!v}
            onClick={() => {
              closeM();
              onOk(v);
            }}
          >
            {t(ok)}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Botão da barra de cima que lança um pedido com confirmação */
function BotaoTopo({ fa, texto, titulo, aviso, ok, corpo, msg, mostrar = true }: { fa: string; texto: string; titulo: string; aviso: string; ok: string; corpo: Record<string, unknown>; msg: string; mostrar?: boolean }) {
  const vh = useVH();
  if (!mostrar) return null;
  return (
    <button className="btn r" onClick={() => confirmar(vh, titulo, vh.t(aviso), ok, corpo, msg)}>
      <i className={'fa-solid ' + fa} />
      {vh.t(texto)}
    </button>
  );
}

const DomCel = ({ r }: { r: { dominio: string; conta: string } }) => (
  <span className="pm-proc">
    <b>{r.dominio}</b>
    <small>{r.conta}</small>
  </span>
);

// ======================= Versões PHP e software =======================
const PHP_URL = ROTA + '?ver=php';
type Php = { instaladas: string[]; predefinida: string; disponiveis: string[]; uso: Record<string, number>; trabalho: Trab };
function VersoesPhp() {
  const vh = useVH();
  const { t } = vh;
  const { dados, erro, ler } = useGet<Php>(PHP_URL);
  useAoMudar(ler);
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  const versoes = [...new Set([...dados.disponiveis, ...dados.instaladas])].sort((a, b) => Number(b) - Number(a));
  const linhas = versoes.map((v) => ({ v, inst: dados.instaladas.includes(v), pred: v === dados.predefinida, uso: dados.uso[v] || 0 }));
  const ocupado = dados.trabalho.aCorrer;
  const instalar = (k: string[]) => {
    const vs = k.filter((v) => !dados.instaladas.includes(v));
    if (!vs.length) return vh.toast('As versões escolhidas já estão instaladas');
    confirmar(vh, 'Instalar as versões PHP?', vs.map((v) => 'PHP ' + v).join(', ') + ' — ' + t('demora alguns minutos.'), 'Instalar', { acao: 'php-instalar', versoes: vs }, 'A instalar…');
  };
  const remover = (k: string[]) => {
    const vs = k.filter((v) => dados.instaladas.includes(v));
    const presas = vs.filter((v) => v === dados.predefinida || dados.uso[v]);
    if (presas.length) return vh.toast(t('Não se pode remover:') + ' PHP ' + presas.join(', ') + ' — ' + t('é a predefinida ou há domínios a usar.'));
    if (!vs.length) return vh.toast('As versões escolhidas não estão instaladas');
    confirmar(vh, 'Remover as versões PHP?', vs.map((v) => 'PHP ' + v).join(', '), 'Remover', { acao: 'php-remover', versoes: vs }, 'A remover…');
  };
  const predefinir = (k: string[]) => {
    if (k.length !== 1) return vh.toast('Escolha só uma versão');
    if (!dados.instaladas.includes(k[0])) return vh.toast('Instale primeiro esta versão');
    confirmar(vh, 'Mudar o PHP predefinido?', 'PHP ' + k[0] + ' — ' + t('passa a ser o PHP da linha de comandos e dos domínios novos.'), 'Mudar', { acao: 'php-predefinida', versao: k[0] }, 'PHP predefinido mudado');
  };
  return (
    <>
      <DataTable
        id="ad-php"
        umaLinha
        barraFora
        empilhar="tablet"        rows={linhas}
        rowKey={(r) => r.v}
        empty="Nenhuma versão"
        cols={[
          { k: 'v', t: 'Versão', sort: (r) => Number(r.v), cell: (r) => (
            <span className="pm-proc">
              <b>PHP {r.v}</b>
              {r.pred && <span className="tag ok">{t('Predefinida')}</span>}
            </span>
          ) },
          { k: 'e', t: 'Estado', sort: (r) => (r.inst ? 1 : 0), cell: (r) => <span className={'tag ' + (r.inst ? 'ok' : 'off')}>{t(r.inst ? 'Instalada' : 'Não instalada')}</span> },
          { k: 'u', t: 'Domínios a usar', right: true, sort: (r) => r.uso, cell: (r) => r.uso },
        ]}
        acoesNaColuna
        bulk={[
          { t: 'Instalar', fa: 'fa-download', inativo: ocupado, run: instalar },
          { t: 'Tornar predefinida', fa: 'fa-star', inativo: ocupado, run: predefinir },
          { t: 'Remover', fa: 'fa-trash-can', inativo: ocupado, run: remover },
        ]}
      />
      <Trabalho tr={dados.trabalho} ler={ler} titulo="A instalar ou remover" />
    </>
  );
}
export const softwarePagina: ScreenFn = () => ({
  title: 'Versões PHP',
  desc: 'Versões PHP instaladas no servidor',
  descEl: <Resumo<Php> url={PHP_URL} base="Versões PHP instaladas no servidor" partes={(d) => [d.instaladas.length + ' instaladas', d.predefinida ? 'predefinida ' + d.predefinida : null]} />,
  body: <VersoesPhp />,
});

// ======================= Atualizações (Hestia e VisualHost) =======================
const ATU_URL = ROTA + '?ver=atualizacoes';
type Atu = { versao: string; pacotes: { nome: string; versao: string; atual: boolean; descricao: string; data: string }[]; trabalho: Trab };
function Atualizacoes() {
  const { t } = useVH();
  const { dados, erro, ler } = useGet<Atu>(ATU_URL);
  const site = useGet<{ versao: string }>('/api/versao');
  useAoMudar(ler);
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  return (
    <>
      <DataTable
        id="ad-atu"
        empilhar="tablet"        rows={dados.pacotes}
        rowKey={(r) => r.nome}
        empty="Nenhum pacote do Hestia"
        cols={[
          { k: 'n', t: 'Pacote', sort: (r) => r.nome, cell: (r) => (
            <span className="pm-proc">
              <b>{r.nome}</b>
              {r.descricao && <small>{r.descricao}</small>}
            </span>
          ) },
          { k: 'v', t: 'Versão', sort: (r) => r.versao, cell: (r) => <code>{r.versao}</code> },
          { k: 'e', t: 'Estado', sort: (r) => (r.atual ? 1 : 0), cell: (r) => <span className={'tag ' + (r.atual ? 'ok' : 'w')}>{t(r.atual ? 'Atualizado' : 'Há atualização')}</span> },
          { k: 'd', t: 'Data', ate: 1050, sort: (r) => r.data, cell: (r) => r.data || '—' },
        ]}
      />
      <Sec titulo="VisualHost" desc="O painel atualiza-se sozinho a cada publicação; quem estiver a usar passa para a versão nova ao voltar ao separador.">
        <div className="em-opcoes">
          <Opcao titulo="Versão em uso">
            <code>{site.dados?.versao || '—'}</code>
          </Opcao>
        </div>
      </Sec>
      <Trabalho tr={dados.trabalho} ler={ler} titulo="A atualizar o Hestia" />
    </>
  );
}
function BotaoAtualizarHestia() {
  const d = useNaMemoria<Atu>(ATU_URL);
  return (
    <BotaoTopo
      mostrar={!d?.trabalho.aCorrer}
      fa="fa-arrows-rotate"
      texto="Atualizar o Hestia"
      titulo="Atualizar o Hestia?"
      aviso="Instala as versões novas dos pacotes do Hestia. Os sites continuam no ar; o painel do Hestia pode reiniciar."
      ok="Atualizar"
      corpo={{ acao: 'hestia-atualizar' }}
      msg="A atualizar o Hestia…"
    />
  );
}
export const atualizacoesPagina: ScreenFn = () => ({
  title: 'Atualizações',
  desc: 'Hestia e VisualHost',
  descEl: <Resumo<Atu> url={ATU_URL} base="Hestia e VisualHost" partes={(d) => [d.versao ? 'Hestia ' + d.versao : null, d.pacotes.filter((p) => !p.atual).length ? d.pacotes.filter((p) => !p.atual).length + ' por atualizar' : 'tudo atualizado']} />,
  actions: <BotaoAtualizarHestia />,
  body: <Atualizacoes />,
});

// ======================= Atualizações do sistema (pacotes) =======================
const PAC_URL = ROTA + '?ver=pacotes';
type Pacote = { nome: string; origem: string; nova: string; atual: string; seguranca: boolean };
type Pac = { pacotes: Pacote[]; historico: { data: string; comando: string; pacotes: number; tipo: string }[]; listaDe: string; trabalho: Trab };
type AbaP = 'atualizar' | 'historico';
function PacotesSistema() {
  const vh = useVH();
  const { t } = vh;
  const [aba, setAba] = useState<AbaP>('atualizar');
  const { dados, erro, ler } = useGet<Pac>(PAC_URL);
  useAoMudar(ler);
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  const ocupado = dados.trabalho.aCorrer;
  return (
    <>
      <Tabs<AbaP>
        on={aba}
        onChange={setAba}
        tabs={[
          ['atualizar', 'Por atualizar', 'fa-box-open'],
          ['historico', 'Histórico', 'fa-clock-rotate-left'],
        ]}
      />
      {aba === 'atualizar' ? (
        <DataTable
          id="ad-pac"
          umaLinha
          barraFora
          empilhar="tablet"
          rows={dados.pacotes}
          rowKey={(r) => r.nome}
          search={(r) => r.nome + ' ' + r.origem}
          empty="O sistema está atualizado"
          cols={[
            { k: 'n', t: 'Pacote', sort: (r) => r.nome, cell: (r) => (
              <span className="pm-proc">
                <b>{r.nome}</b>
                {r.seguranca && <span className="tag bad">{t('Segurança')}</span>}
              </span>
            ) },
            { k: 'a', t: 'Versão atual', cell: (r) => <span className="pm-proc"><small className="ad-cmd">{r.atual}</small></span> },
            { k: 'v', t: 'Versão nova', cell: (r) => <span className="pm-proc"><small className="ad-cmd">{r.nova}</small></span> },
            { k: 'o', t: 'Origem', ate: 1300, sort: (r) => r.origem, cell: (r) => r.origem },
          ]}
          acoesNaColuna
          bulk={[
            { t: 'Procurar atualizações', fa: 'fa-magnifying-glass', sempre: true, inativo: ocupado, run: () => void fazer(vh, { acao: 'apt-procurar' }, 'A procurar atualizações…') },
            { t: 'Atualizar tudo', fa: 'fa-arrows-rotate', sempre: true, inativo: ocupado || !dados.pacotes.length, run: () => confirmar(vh, 'Atualizar todos os pacotes?', dados.pacotes.length + ' ' + t('pacotes. Os serviços atualizados reiniciam sozinhos.'), 'Atualizar', { acao: 'apt-tudo' }, 'A atualizar…') },
            { t: 'Atualizar os escolhidos', fa: 'fa-box-open', inativo: ocupado, run: (k) => confirmar(vh, 'Atualizar os pacotes?', k.join(', '), 'Atualizar', { acao: 'apt-pacotes', nomes: k }, 'A atualizar…') },
          ]}
        />
      ) : (
        <DataTable
          id="ad-pac-hist"
          empilhar="tablet"          rows={dados.historico.map((h, i) => ({ ...h, k: String(i) }))}
          rowKey={(r) => r.k}
          empty="Sem histórico"
          cols={[
            { k: 'd', t: 'Data', sort: (r) => r.data, cell: (r) => r.data },
            { k: 't', t: 'Tipo', cell: (r) => (r.tipo ? t(r.tipo) : '—') },
            { k: 'p', t: 'Pacotes', right: true, sort: (r) => r.pacotes, cell: (r) => r.pacotes },
            { k: 'c', t: 'Comando', cell: (r) => <span className="pm-proc"><small className="ad-cmd">{r.comando}</small></span> },
          ]}
        />
      )}
      <Trabalho tr={dados.trabalho} ler={ler} titulo="A atualizar o sistema" />
    </>
  );
}
export const pacotesSistemaPagina: ScreenFn = () => ({
  title: 'Atualizações do sistema',
  desc: 'Pacotes do sistema operativo',
  descEl: <Resumo<Pac> url={PAC_URL} base="Pacotes do sistema operativo" partes={(d) => [d.pacotes.length + ' por atualizar', d.pacotes.filter((p) => p.seguranca).length ? d.pacotes.filter((p) => p.seguranca).length + ' de segurança' : null, d.listaDe ? 'lista de ' + d.listaDe : null]} />,
  body: <PacotesSistema />,
});

// ======================= Certificado do painel =======================
const TLS_URL = ROTA + '?ver=tls';
type Tls = { hostname: string; porta: string; cert: Record<string, string> };
const diasAte = (d: string) => {
  const n = Date.parse(d);
  return Number.isFinite(n) ? Math.floor((n - Date.now()) / 86400000) : null;
};
function CertificadoPainel() {
  const { t } = useVH();
  const { dados, erro, ler } = useGet<Tls>(TLS_URL);
  useAoMudar(ler);
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  const c = dados.cert;
  const dias = c.NOT_AFTER ? diasAte(c.NOT_AFTER) : null;
  const proprio = !!c.ISSUER && !!c.SUBJECT && c.ISSUER.replace(/\s/g, '') === c.SUBJECT.replace(/\s/g, '');
  return (
    <Sec
      titulo="Certificado do painel"
      desc={'https://' + dados.hostname + (dados.porta ? ':' + dados.porta : '')}
      extra={<span className={'tag ' + (dias === null ? 'off' : dias < 0 ? 'bad' : dias < 15 || proprio ? 'w' : 'ok')}>{t(dias === null ? 'Sem certificado' : dias < 0 ? 'Expirado' : proprio ? 'Autoassinado' : 'Válido')}</span>}
    >
      <div className="em-opcoes">
        <Opcao titulo="Emitido para">
          <code className="ad-cmd">{c.SUBJECT || '—'}</code>
        </Opcao>
        {c.ALIASES && (
          <Opcao titulo="Outros nomes">
            <code className="ad-cmd">{c.ALIASES}</code>
          </Opcao>
        )}
        <Opcao titulo="Emitido por">
          <code className="ad-cmd">{c.ISSUER || '—'}</code>
        </Opcao>
        <Opcao titulo="Válido desde">{c.NOT_BEFORE || '—'}</Opcao>
        <Opcao titulo="Válido até" sub={dias !== null ? (dias < 0 ? 'Já expirou' : t('Faltam {0} dias').replace('{0}', String(dias))) : undefined}>
          {c.NOT_AFTER || '—'}
        </Opcao>
        {c.SIGNATURE && <Opcao titulo="Assinatura">{c.SIGNATURE}</Opcao>}
        {c.PUB_KEY && <Opcao titulo="Chave">{c.PUB_KEY}</Opcao>}
      </div>
    </Sec>
  );
}
function BotaoTls() {
  const d = useNaMemoria<Tls>(TLS_URL);
  return (
    <BotaoTopo
      fa="fa-award"
      texto="Pedir Let's Encrypt"
      titulo="Pedir um certificado Let's Encrypt?"
      aviso={'O nome do servidor tem de apontar para este servidor. ' + (d?.hostname ? '(' + d.hostname + ')' : '')}
      ok="Pedir"
      corpo={{ acao: 'tls-letsencrypt' }}
      msg="Certificado pedido"
    />
  );
}
export const tlsServidorPagina: ScreenFn = () => ({
  title: 'Certificado do painel',
  desc: 'Certificado SSL do nome do servidor',
  descEl: <Resumo<Tls> url={TLS_URL} base="Certificado SSL do nome do servidor" partes={(d) => [d.hostname, d.cert.NOT_AFTER ? 'até ' + d.cert.NOT_AFTER : null]} />,
  actions: <BotaoTls />,
  body: <CertificadoPainel />,
});

// ======================= Definições do servidor =======================
const DEF_URL = ROTA + '?ver=definicoes';
type Def = { hostname: string; fuso: string; fusos: string[]; config: Record<string, string>; editaveis: string[] };
type AbaD = 'servidor' | 'opcoes' | 'config';
const OPCOES: [string, string, string, string, string][] = [
  // chave, título, explicação, valor ligado, valor desligado
  ['UPGRADE_SEND_EMAIL', 'Avisar por e-mail das atualizações', 'Manda um e-mail ao administrador quando o Hestia se atualiza.', 'true', 'false'],
  ['UPGRADE_SEND_EMAIL_LOG', 'Juntar o registo da atualização ao e-mail', '', 'true', 'false'],
  ['POLICY_USER_VIEW_LOGS', 'Os clientes podem ver os registos da conta', '', 'yes', 'no'],
  ['POLICY_USER_DELETE_BACKUPS', 'Os clientes podem apagar os seus backups', '', 'yes', 'no'],
];
function DefinicoesServidor() {
  const vh = useVH();
  const { t } = vh;
  const [aba, setAba] = useState<AbaD>('servidor');
  const { dados, erro, ler } = useGet<Def>(DEF_URL);
  const [host, setHost] = useState<string | null>(null);
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  const valor = async (chave: string, v: string) => (await pedir(vh, { acao: 'def-valor', chave, valor: v }, 'Guardado')) && ler(true);
  const nomeServidor = host ?? dados.hostname;
  return (
    <>
      <Tabs<AbaD>
        on={aba}
        onChange={setAba}
        tabs={[
          ['servidor', 'Servidor', 'fa-server'],
          ['opcoes', 'Opções', 'fa-sliders'],
          ['config', 'Configuração', 'fa-list'],
        ]}
      />
      {aba === 'servidor' && (
        <div className="em-opcoes">
          <Opcao titulo="Nome do servidor (hostname)" sub="Tem de apontar para este servidor; é o nome do painel e do e-mail do sistema.">
            <form
              className="ad-campo-btn"
              onSubmit={(e) => {
                e.preventDefault();
                const h = nomeServidor.trim().toLowerCase();
                if (h === dados.hostname) return;
                vh.openM(<Confirmar titulo="Mudar o nome do servidor?" texto={dados.hostname + ' → ' + h} ok="Mudar" onOk={async () => (await pedir(vh, { acao: 'def-hostname', host: h }, 'Nome do servidor mudado')) && (setHost(null), ler(true))} />);
              }}
            >
              <input value={nomeServidor} onChange={(e) => setHost(e.target.value)} aria-label={t('Nome do servidor')} />
              <button className="btn r" type="submit" disabled={nomeServidor.trim().toLowerCase() === dados.hostname}>
                {t('Guardar')}
              </button>
            </form>
          </Opcao>
          <Opcao titulo="Fuso horário" sub="Horas das tarefas agendadas, dos registos e dos backups.">
            <select className="em-sel" value={dados.fuso} onChange={async (e) => (await pedir(vh, { acao: 'def-fuso', fuso: e.target.value }, 'Fuso horário mudado')) && ler(true)} aria-label={t('Fuso horário')}>
              {(dados.fusos.includes(dados.fuso) ? dados.fusos : [dados.fuso, ...dados.fusos]).map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </Opcao>
          <Opcao titulo="Cópias guardadas por conta" sub="Quantos backups de cada conta ficam no servidor.">
            <select className="em-sel" value={dados.config.BACKUPS || '1'} onChange={(e) => void valor('BACKUPS', e.target.value)} aria-label={t('Cópias guardadas por conta')}>
              {['1', '2', '3', '4', '5', '7', '10', '14'].map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </Opcao>
        </div>
      )}
      {aba === 'opcoes' && (
        <div className="em-opcoes">
          {OPCOES.filter(([k]) => dados.editaveis.includes(k)).map(([k, titulo, sub, sim, nao]) => (
            <Opcao key={k} titulo={titulo} sub={sub || undefined}>
              <Switch checked={dados.config[k] === sim} onChange={(v) => void valor(k, v ? sim : nao)} label={t(titulo)} />
            </Opcao>
          ))}
        </div>
      )}
      {aba === 'config' && (
        <DataTable
          id="ad-def-cfg"
          rows={Object.entries(dados.config).map(([k, v]) => ({ k, v }))}
          rowKey={(r) => r.k}
          search={(r) => r.k + ' ' + r.v}
          empty="Sem configuração"
          cols={[
            { k: 'k', t: 'Chave', sort: (r) => r.k, cell: (r) => <code>{r.k}</code> },
            { k: 'v', t: 'Valor', cell: (r) => <span className="pm-proc"><small className="ad-cmd">{r.v || '—'}</small></span> },
          ]}
        />
      )}
    </>
  );
}
export const definicoesPagina: ScreenFn = () => ({
  title: 'Definições do servidor',
  desc: 'Nome, fuso horário e opções do servidor',
  descEl: <Resumo<Def> url={DEF_URL} base="Nome, fuso horário e opções do servidor" partes={(d) => [d.hostname, d.fuso]} />,
  body: <DefinicoesServidor />,
});

// ======================= Multi-servidor (DNS secundários) =======================
const MULTI_URL = ROTA + '?ver=multi';
type Host = { host: string; porta: string; tipo: string; user: string; dnsUser: string; suspenso: boolean; data: string };
function NovoServidor() {
  const vh = useVH();
  const { t, closeM } = vh;
  const [f, setF] = useState({ host: '', porta: '8083', user: 'admin', senha: '', dnsUser: 'dns-cluster' });
  const linha = (label: string, ctl: ReactNode) => (
    <div className="frm-row">
      <div className="frm-lb">{t(label)}</div>
      <div className="frm-ctl">{ctl}</div>
    </div>
  );
  return (
    <div className="da-janela">
      <div className="da-janela-cab">
        <h3>{t('Adicionar servidor')}</h3>
        <button type="button" className="da-janela-x" onClick={closeM} aria-label={t('Fechar')}>
          <i className="fa-solid fa-xmark" />
        </button>
      </div>
      <div className="frm">
        {linha('Servidor', <input value={f.host} onChange={(e) => setF({ ...f, host: e.target.value.trim() })} placeholder="ns2.exemplo.com" />)}
        {linha('Porta', <input value={f.porta} inputMode="numeric" onChange={(e) => setF({ ...f, porta: e.target.value.replace(/\D/g, '') })} />)}
        {linha('Utilizador', <input value={f.user} onChange={(e) => setF({ ...f, user: e.target.value.trim() })} />)}
        {linha('Senha', <input type="password" value={f.senha} autoComplete="new-password" onChange={(e) => setF({ ...f, senha: e.target.value })} />)}
        {linha('Utilizador DNS', <input value={f.dnsUser} onChange={(e) => setF({ ...f, dnsUser: e.target.value.trim() })} />)}
        <div className="frm-foot">
          <button
            className="btn r"
            disabled={!f.host || !f.senha || !f.user}
            onClick={async () => {
              if (await fazer(vh, { acao: 'multi-adicionar', ...f }, 'Servidor adicionado')) closeM();
            }}
          >
            {t('Guardar')}
          </button>
        </div>
      </div>
    </div>
  );
}
function MultiServidor() {
  const vh = useVH();
  const { t } = vh;
  const { dados, erro, ler } = useGet<{ hosts: Host[] }>(MULTI_URL);
  useAoMudar(ler);
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  return (
    <DataTable
      id="ad-multi"
      umaLinha
      barraFora
      empilhar="tablet"      rows={dados.hosts}
      rowKey={(r) => r.host}
      empty="Nenhum servidor ligado"
      cols={[
        { k: 'h', t: 'Servidor', sort: (r) => r.host, cell: (r) => <b>{r.host}</b> },
        { k: 'p', t: 'Porta', cell: (r) => r.porta },
        { k: 'u', t: 'Utilizador', cell: (r) => r.user + (r.dnsUser ? ' / ' + r.dnsUser : '') },
        { k: 'e', t: 'Estado', sort: (r) => (r.suspenso ? 0 : 1), cell: (r) => <span className={'tag ' + (r.suspenso ? 'off' : 'ok')}>{t(r.suspenso ? 'Suspenso' : 'Ligado')}</span> },
        { k: 'd', t: 'Desde', ate: 1050, sort: (r) => r.data, cell: (r) => r.data },
      ]}
      acoesNaColuna
      bulk={[{ t: 'Apagar', fa: 'fa-trash-can', run: (k) => confirmar(vh, 'Desligar os servidores?', k.join(', ') + ' — ' + t('deixam de receber as zonas DNS deste servidor.'), 'Apagar', { acao: 'multi-apagar', hosts: k }, 'Servidores desligados') }]}
    />
  );
}
function BotaoNovoServidor() {
  const vh = useVH();
  return (
    <button className="btn r" onClick={() => vh.openM(<NovoServidor />)}>
      <i className="fa-solid fa-plus" />
      {vh.t('Adicionar servidor')}
    </button>
  );
}
export const multiServidorPagina: ScreenFn = () => ({
  title: 'Multi-servidor',
  desc: 'Servidores DNS secundários',
  descEl: <Resumo<{ hosts: Host[] }> url={MULTI_URL} base="Servidores DNS secundários" partes={(d) => [d.hosts.length + ' ligados']} />,
  actions: <BotaoNovoServidor />,
  body: <MultiServidor />,
});

// ======================= Backups (todas as contas) =======================
const BK_URL = ROTA + '?ver=backups';
type Copia = { conta: string; nome: string; mb: number; data: string; hora: string; tipo: string; demorou: string };
type Bk = { backups: Copia[]; config: Record<string, string>; contas: string[] };
type AbaK = 'copias' | 'contas';
function BackupsAdmin() {
  const vh = useVH();
  const { t } = vh;
  const [aba, setAba] = useState<AbaK>('copias');
  const { dados, erro, ler } = useGet<Bk>(BK_URL);
  useAoMudar(ler);
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  const chave = (c: Copia) => c.conta + '/' + c.nome;
  const escolhidas = (k: string[]) => dados.backups.filter((c) => k.includes(chave(c)));
  const contas = dados.contas.map((u) => {
    const cs = dados.backups.filter((c) => c.conta === u);
    const ultima = cs.map((c) => c.data + ' ' + c.hora).sort().pop() || '';
    return { u, n: cs.length, mb: cs.reduce((s, c) => s + c.mb, 0), ultima };
  });
  const criar = (k: string[]) => confirmar(vh, 'Fazer backup agora?', k.join(', ') + ' — ' + t('fica na fila do servidor e chega por e-mail o aviso quando acabar.'), 'Fazer backup', { acao: 'bk-criar', contas: k }, 'Backup na fila');
  return (
    <>
      <Tabs<AbaK>
        on={aba}
        onChange={setAba}
        tabs={[
          ['copias', 'Cópias', 'fa-box-archive'],
          ['contas', 'Contas', 'fa-users'],
        ]}
      />
      {aba === 'copias' ? (
        <DataTable
          id="ad-bk"
          umaLinha
          barraFora
          empilhar="tablet"
          rows={dados.backups}
          rowKey={chave}
          search={(r) => r.conta + ' ' + r.nome}
          empty="Nenhum backup"
          cols={[
            { k: 'c', t: 'Conta', sort: (r) => r.conta, cell: (r) => <b>{r.conta}</b> },
            { k: 'n', t: 'Cópia', cell: (r) => <span className="pm-proc"><small className="ad-cmd">{r.nome}</small></span> },
            { k: 'd', t: 'Data', sort: (r) => r.data + r.hora, cell: (r) => r.data + ' ' + r.hora.slice(0, 5) },
            { k: 'm', t: 'Tamanho', right: true, sort: (r) => r.mb, cell: (r) => mbTexto(r.mb) },
            { k: 't', t: 'Demorou', ate: 1300, cell: (r) => (r.demorou ? r.demorou + ' min' : '—') },
          ]}
          acoesNaColuna
          bulk={[
            {
              t: 'Restaurar',
              fa: 'fa-clock-rotate-left',
              run: (k) => {
                const [c, ...mais] = escolhidas(k);
                if (!c || mais.length) return vh.toast('Escolha só uma cópia');
                confirmar(vh, 'Restaurar a conta?', c.conta + ' ← ' + c.nome + ' — ' + t('os sites, e-mails, bases de dados e tarefas da conta voltam ao estado desta cópia.'), 'Restaurar', { acao: 'bk-restaurar', conta: c.conta, nome: c.nome }, 'Restauro na fila');
              },
            },
            { t: 'Apagar', fa: 'fa-trash-can', run: (k) => confirmar(vh, 'Apagar as cópias?', escolhidas(k).map((c) => c.nome).join(', '), 'Apagar', { acao: 'bk-apagar', itens: escolhidas(k).map((c) => ({ conta: c.conta, nome: c.nome })) }, 'Cópias apagadas') },
          ]}
        />
      ) : (
        <DataTable
          id="ad-bk-contas"
          umaLinha
          barraFora
          empilhar="tablet"          rows={contas}
          rowKey={(r) => r.u}
          search={(r) => r.u}
          empty="Nenhuma conta"
          cols={[
            { k: 'u', t: 'Conta', sort: (r) => r.u, cell: (r) => <b>{r.u}</b> },
            { k: 'n', t: 'Cópias', right: true, sort: (r) => r.n, cell: (r) => r.n },
            { k: 'm', t: 'Espaço', right: true, sort: (r) => r.mb, cell: (r) => mbTexto(r.mb) },
            { k: 'l', t: 'Última cópia', sort: (r) => r.ultima, cell: (r) => r.ultima.slice(0, 16) || <span className="tag w">{t('Nenhuma')}</span> },
          ]}
          acoesNaColuna
          bulk={[{ t: 'Fazer backup agora', fa: 'fa-box-archive', run: criar }]}
        />
      )}
    </>
  );
}
function BotaoBackupTodas() {
  const d = useNaMemoria<Bk>(BK_URL);
  return (
    <BotaoTopo
      mostrar={!!d?.contas.length}
      fa="fa-box-archive"
      texto="Backup de todas as contas"
      titulo="Fazer backup de todas as contas?"
      aviso="Cada conta entra na fila do servidor; pode demorar, conforme o tamanho."
      ok="Fazer backup"
      corpo={{ acao: 'bk-criar', contas: d?.contas || [] }}
      msg="Backups na fila"
    />
  );
}
export const backupsAdminPagina: ScreenFn = () => ({
  title: 'Backups',
  desc: 'Backups de todas as contas',
  descEl: <Resumo<Bk> url={BK_URL} base="Backups de todas as contas" partes={(d) => [d.backups.length + ' cópias', d.config.BACKUP ? 'em ' + d.config.BACKUP : null, d.config.BACKUPS ? 'guarda ' + d.config.BACKUPS + ' por conta' : null]} />,
  actions: <BotaoBackupTodas />,
  body: <BackupsAdmin />,
});

// ======================= Backup do sistema =======================
const BS_URL = ROTA + '?ver=backup-sistema';
type Bs = { pasta: string; copias: { nome: string; mb: number; data: string }[]; trabalho: Trab };
function BackupSistema() {
  const vh = useVH();
  const { t } = vh;
  const { dados, erro, ler } = useGet<Bs>(BS_URL);
  useAoMudar(ler);
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  return (
    <>
      <DataTable
        id="ad-bs"
        umaLinha
        barraFora
        empilhar="tablet"        rows={dados.copias}
        rowKey={(r) => r.nome}
        empty="Ainda não há cópias do sistema"
        cols={[
          { k: 'n', t: 'Cópia', sort: (r) => r.nome, cell: (r) => <span className="pm-proc"><small className="ad-cmd">{r.nome}</small></span> },
          { k: 'd', t: 'Data', sort: (r) => r.data, cell: (r) => r.data },
          { k: 'm', t: 'Tamanho', right: true, sort: (r) => r.mb, cell: (r) => mbTexto(r.mb) },
        ]}
        acoesNaColuna
        bulk={[{ t: 'Apagar', fa: 'fa-trash-can', run: (k) => confirmar(vh, 'Apagar as cópias do sistema?', k.join(', '), 'Apagar', { acao: 'bs-apagar', nomes: k }, 'Cópias apagadas') }]}
      />
      <Sec titulo="O que entra na cópia" desc={t('Guardam-se as 5 mais recentes em') + ' ' + dados.pasta + '.'}>
        <div className="em-opcoes">
          <Opcao titulo="Configurações do sistema" sub="/etc (Nginx, Apache, PHP, Exim, Dovecot, firewall…)">
            <span className="tag ok">{t('Sim')}</span>
          </Opcao>
          <Opcao titulo="Hestia" sub="Contas, pacotes, domínios e definições do painel">
            <span className="tag ok">{t('Sim')}</span>
          </Opcao>
          <Opcao titulo="Tarefas agendadas e processos do site" sub="cron de todas as contas e a lista do PM2">
            <span className="tag ok">{t('Sim')}</span>
          </Opcao>
        </div>
      </Sec>
      <Trabalho tr={dados.trabalho} ler={ler} titulo="A fazer a cópia do sistema" />
    </>
  );
}
function BotaoBackupSistema() {
  const d = useNaMemoria<Bs>(BS_URL);
  return (
    <BotaoTopo
      mostrar={!d?.trabalho.aCorrer}
      fa="fa-hard-drive"
      texto="Fazer cópia agora"
      titulo="Fazer a cópia do sistema?"
      aviso="Copia as configurações do servidor e do Hestia para a pasta dos backups."
      ok="Fazer cópia"
      corpo={{ acao: 'bs-criar' }}
      msg="A fazer a cópia…"
    />
  );
}
export const backupSistemaPagina: ScreenFn = () => ({
  title: 'Backup do sistema',
  desc: 'Configurações do servidor',
  descEl: <Resumo<Bs> url={BS_URL} base="Configurações do servidor" partes={(d) => [d.copias.length + ' cópias', d.copias[0] ? 'última ' + d.copias[0].data : null]} />,
  actions: <BotaoBackupSistema />,
  body: <BackupSistema />,
});

// ======================= Modelos do servidor web =======================
const HTTPD_URL = ROTA + '?ver=httpd';
type Httpd = { dominios: DomWeb[]; modelos: Record<'web' | 'proxy' | 'backend', string[]>; trabalho: Trab };
const TIPO_MODELO: Record<'web' | 'proxy' | 'backend', string> = { web: 'Modelo web', proxy: 'Modelo do proxy (Nginx)', backend: 'Modelo PHP-FPM' };
function ModelosWeb() {
  const vh = useVH();
  const { t } = vh;
  const { dados, erro, ler } = useGet<Httpd>(HTTPD_URL);
  useAoMudar(ler);
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  const comProxy = dados.dominios.some((d) => d.proxy);
  const itens = (k: string[]) => dados.dominios.filter((d) => k.includes(d.dominio)).map((d) => ({ conta: d.conta, dominio: d.dominio }));
  const mudar = (tipo: 'web' | 'proxy' | 'backend') => (k: string[]) => {
    const atual = dados.dominios.find((d) => d.dominio === k[0])?.[tipo];
    vh.openM(<Escolher titulo={TIPO_MODELO[tipo]} label="Modelo" opcoes={dados.modelos[tipo]} atual={atual} onOk={(modelo) => void fazer(vh, { acao: 'httpd-mudar', tipo, modelo, itens: itens(k) }, 'Modelo mudado')} />);
  };
  return (
    <>
      <DataTable
        id="ad-httpd"
        umaLinha
        barraFora
        empilhar="tablet"
        rows={dados.dominios}
        rowKey={(r) => r.dominio}
        search={(r) => r.dominio + ' ' + r.conta + ' ' + r.web + ' ' + r.proxy + ' ' + r.backend}
        empty="Nenhum domínio"
        cols={[
          { k: 'd', t: 'Domínio', sort: (r) => r.dominio, cell: (r) => <DomCel r={r} /> },
          { k: 'w', t: 'Modelo web', sort: (r) => r.web, cell: (r) => <code>{r.web || '—'}</code> },
          ...(comProxy ? [{ k: 'p', t: 'Proxy (Nginx)', sort: (r: DomWeb) => r.proxy, cell: (r: DomWeb) => <code>{r.proxy || '—'}</code> }] : []),
          { k: 'b', t: 'PHP-FPM', sort: (r) => r.backend, cell: (r) => <code>{r.backend || '—'}</code> },
          { k: 'e', t: 'Estado', ate: 1300, cell: (r) => <span className={'tag ' + (r.suspenso ? 'off' : 'ok')}>{t(r.suspenso ? 'Suspenso' : 'Ativo')}</span> },
        ]}
        acoesNaColuna
        bulk={[
          { t: 'Mudar o modelo web', fa: 'fa-file-code', run: mudar('web') },
          ...(comProxy ? [{ t: 'Mudar o modelo do proxy', fa: 'fa-diagram-project', run: mudar('proxy') }] : []),
          { t: 'Mudar o modelo PHP-FPM', fa: 'fa-brands fa-php', run: mudar('backend') },
          {
            t: 'Reconstruir as configurações',
            fa: 'fa-hammer',
            inativo: dados.trabalho.aCorrer,
            run: (k) => {
              const contas = [...new Set(itens(k).map((i) => i.conta))];
              confirmar(vh, 'Reconstruir as configurações?', t('Contas:') + ' ' + contas.join(', ') + ' — ' + t('o servidor web recarrega no fim.'), 'Reconstruir', { acao: 'httpd-reconstruir', contas }, 'A reconstruir…');
            },
          },
        ]}
      />
      <Trabalho tr={dados.trabalho} ler={ler} titulo="A reconstruir as configurações" />
    </>
  );
}
export const httpdPagina: ScreenFn = () => ({
  title: 'Modelos do servidor web',
  desc: 'Modelo web, proxy e PHP de cada domínio',
  descEl: <Resumo<Httpd> url={HTTPD_URL} base="Modelo web, proxy e PHP de cada domínio" partes={(d) => [d.dominios.length + ' domínios', d.modelos.web.length + ' modelos web']} />,
  body: <ModelosWeb />,
});

// ======================= PHP open_basedir =======================
const BASEDIR_URL = ROTA + '?ver=basedir';
type Basedir = DomWeb & { basedir: boolean };
type AbaO = 'todos' | 'ligado' | 'desligado';
function OpenBasedir() {
  const vh = useVH();
  const { t } = vh;
  const [aba, setAba] = useState<AbaO>('todos');
  const { dados, erro, ler } = useGet<{ dominios: Basedir[] }>(BASEDIR_URL);
  useAoMudar(ler);
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  const linhas = dados.dominios.filter((d) => (aba === 'todos' ? true : aba === 'ligado' ? d.basedir : !d.basedir));
  const itens = (k: string[]) => dados.dominios.filter((d) => k.includes(d.dominio)).map((d) => ({ conta: d.conta, dominio: d.dominio }));
  return (
    <>
      <Tabs<AbaO>
        on={aba}
        onChange={setAba}
        tabs={[
          ['todos', 'Todos', 'fa-globe'],
          ['ligado', 'Ligado', 'fa-lock'],
          ['desligado', 'Desligado', 'fa-lock-open'],
        ]}
      />
      <DataTable
        id="ad-basedir"
        umaLinha
        barraFora
        empilhar="tablet"        rows={linhas}
        rowKey={(r) => r.dominio}
        search={(r) => r.dominio + ' ' + r.conta}
        empty="Nenhum domínio"
        cols={[
          { k: 'd', t: 'Domínio', sort: (r) => r.dominio, cell: (r) => <DomCel r={r} /> },
          { k: 'b', t: 'Modelo PHP-FPM', ate: 1050, sort: (r) => r.backend, cell: (r) => <code>{r.backend || '—'}</code> },
          { k: 'o', t: 'open_basedir', sort: (r) => (r.basedir ? 1 : 0), cell: (r) => <span className={'tag ' + (r.basedir ? 'ok' : 'w')}>{t(r.basedir ? 'Ligado' : 'Desligado')}</span> },
        ]}
        acoesNaColuna
        bulk={[
          { t: 'Ligar', fa: 'fa-lock', run: (k) => confirmar(vh, 'Ligar o open_basedir?', k.join(', ') + ' — ' + t('o PHP só abre ficheiros da pasta do domínio.'), 'Ligar', { acao: 'basedir-ligar', itens: itens(k) }, 'open_basedir ligado') },
          { t: 'Desligar', fa: 'fa-lock-open', run: (k) => confirmar(vh, 'Desligar o open_basedir?', k.join(', ') + ' — ' + t('o PHP destes domínios passa a poder abrir ficheiros fora da pasta do site.'), 'Desligar', { acao: 'basedir-desligar', itens: itens(k) }, 'open_basedir desligado') },
        ]}
      />
    </>
  );
}
export const basedirPagina: ScreenFn = () => ({
  title: 'PHP (open_basedir)',
  desc: 'Limitar o PHP à pasta de cada domínio',
  descEl: <Resumo<{ dominios: Basedir[] }> url={BASEDIR_URL} base="Limitar o PHP à pasta de cada domínio" partes={(d) => [d.dominios.filter((x) => x.basedir).length + ' ligados', d.dominios.filter((x) => !x.basedir).length + ' desligados']} />,
  body: <OpenBasedir />,
});

// ======================= Security.txt =======================
const STXT_URL = ROTA + '?ver=security-txt';
type Stxt = { conta: string; dominio: string; texto: string };
const campoStxt = (txt: string, k: string) => (txt.match(new RegExp('^' + k + ':\\s*(.+)$', 'mi')) || [])[1]?.trim() || '';
function estadoStxt(r: Stxt): ['ok' | 'w' | 'bad' | 'off', string] {
  if (!r.texto.trim()) return ['off', 'Em falta'];
  const exp = campoStxt(r.texto, 'Expires');
  if (!campoStxt(r.texto, 'Contact') || !exp) return ['w', 'Incompleto'];
  return Date.parse(exp) < Date.now() ? ['bad', 'Expirado'] : ['ok', 'Válido'];
}
function modeloStxt(d: string) {
  const fim = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
  return `Contact: mailto:security@${d}\nExpires: ${fim}T00:00:00.000Z\nPreferred-Languages: pt, en\nCanonical: https://${d}/.well-known/security.txt\n`;
}
function EditarStxt({ r }: { r: Stxt }) {
  const vh = useVH();
  const { t, closeM } = vh;
  const [txt, setTxt] = useState(r.texto || modeloStxt(r.dominio));
  return (
    <div className="da-janela">
      <div className="da-janela-cab">
        <h3>security.txt — {r.dominio}</h3>
        <button type="button" className="da-janela-x" onClick={closeM} aria-label={t('Fechar')}>
          <i className="fa-solid fa-xmark" />
        </button>
      </div>
      <div className="frm">
        <p className="pm-desc" style={{ margin: '0 0 10px' }}>
          https://{r.dominio}/.well-known/security.txt — {t('uma linha por campo; Contact e Expires são obrigatórios.')}
        </p>
        <textarea className="ad-stxt" value={txt} onChange={(e) => setTxt(e.target.value)} rows={9} spellCheck={false} aria-label="security.txt" />
        <div className="frm-foot">
          <button
            className="btn r"
            disabled={!txt.trim()}
            onClick={async () => {
              if (await fazer(vh, { acao: 'stxt-gravar', conta: r.conta, dominio: r.dominio, texto: txt }, 'security.txt gravado')) closeM();
            }}
          >
            {t('Guardar')}
          </button>
        </div>
      </div>
    </div>
  );
}
type AbaS = 'todos' | 'com' | 'sem';
function SecurityTxt() {
  const vh = useVH();
  const { t } = vh;
  const [aba, setAba] = useState<AbaS>('todos');
  const { dados, erro, ler } = useGet<{ dominios: Stxt[] }>(STXT_URL);
  useAoMudar(ler);
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  const linhas = dados.dominios.filter((d) => (aba === 'todos' ? true : aba === 'com' ? !!d.texto.trim() : !d.texto.trim()));
  const um = (k: string[]) => (k.length === 1 ? dados.dominios.find((d) => d.dominio === k[0]) : undefined);
  return (
    <>
      <Tabs<AbaS>
        on={aba}
        onChange={setAba}
        tabs={[
          ['todos', 'Todos', 'fa-globe'],
          ['com', 'Com security.txt', 'fa-file-shield'],
          ['sem', 'Sem security.txt', 'fa-file-circle-xmark'],
        ]}
      />
      <DataTable
        id="ad-stxt"
        umaLinha
        barraFora
        empilhar="tablet"
        rows={linhas}
        rowKey={(r) => r.dominio}
        search={(r) => r.dominio + ' ' + r.conta}
        empty="Nenhum domínio"
        cols={[
          { k: 'd', t: 'Domínio', sort: (r) => r.dominio, cell: (r) => <DomCel r={r} /> },
          { k: 'e', t: 'Estado', sort: (r) => estadoStxt(r)[1], cell: (r) => <span className={'tag ' + estadoStxt(r)[0]}>{t(estadoStxt(r)[1])}</span> },
          { k: 'c', t: 'Contacto', cell: (r) => <span className="pm-proc"><small className="ad-cmd">{campoStxt(r.texto, 'Contact') || '—'}</small></span> },
          { k: 'x', t: 'Expira', ate: 1050, sort: (r) => campoStxt(r.texto, 'Expires'), cell: (r) => campoStxt(r.texto, 'Expires').slice(0, 10) || '—' },
        ]}
        acoesNaColuna
        bulk={[
          {
            t: 'Criar ou editar',
            fa: 'fa-pen',
            run: (k) => {
              const r = um(k);
              if (!r) return vh.toast('Escolha só um domínio');
              vh.openM(<EditarStxt r={r} />);
            },
          },
          {
            t: 'Apagar',
            fa: 'fa-trash-can',
            run: (k) => {
              const r = um(k);
              if (!r) return vh.toast('Escolha só um domínio');
              if (!r.texto.trim()) return vh.toast('Este domínio não tem security.txt');
              confirmar(vh, 'Apagar o security.txt?', r.dominio, 'Apagar', { acao: 'stxt-apagar', conta: r.conta, dominio: r.dominio }, 'security.txt apagado');
            },
          },
        ]}
      />
    </>
  );
}
export const securityTxtPagina: ScreenFn = () => ({
  title: 'Security.txt',
  desc: 'Contacto de segurança de cada domínio',
  descEl: <Resumo<{ dominios: Stxt[] }> url={STXT_URL} base="Contacto de segurança de cada domínio" partes={(d) => [d.dominios.filter((x) => estadoStxt(x)[0] === 'ok').length + ' válidos', d.dominios.filter((x) => !x.texto.trim()).length + ' em falta']} />,
  body: <SecurityTxt />,
});

// ======================= ModSecurity (servidor) =======================
const MODSEC_URL = ROTA + '?ver=modsec';
type Modsec = { instalado: boolean; crs: boolean; modo: string; eventos: { data: string; ip: string; pedido: string; regra: string }[]; trabalho: Trab };
const MODOS: [string, string, string][] = [
  ['On', 'Bloquear', 'Trava os pedidos que as regras apanham.'],
  ['DetectionOnly', 'Só registar', 'Regista sem travar (bom para testar as regras).'],
  ['Off', 'Desligado', 'Não verifica os pedidos.'],
];
function ModsecAdmin() {
  const vh = useVH();
  const { t } = vh;
  const { dados, erro, ler } = useGet<Modsec>(MODSEC_URL);
  useAoMudar(ler);
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  if (!dados.instalado)
    return (
      <>
        <div className="card empty">
          <p>{t('O ModSecurity ainda não está instalado. Instala-o com as regras OWASP (CRS) no Apache, em modo "Só registar" para começar.')}</p>
        </div>
        <Trabalho tr={dados.trabalho} ler={ler} titulo="A instalar o ModSecurity" />
      </>
    );
  return (
    <>
      <div className="em-opcoes ad-stats-dentro">
        <Opcao titulo="Modo" sub={MODOS.find((m) => m[0] === dados.modo)?.[2]}>
          <select className="em-sel" value={dados.modo} onChange={async (e) => (await pedir(vh, { acao: 'modsec-modo', modo: e.target.value }, 'Modo mudado')) && ler(true)} aria-label={t('Modo')}>
            {MODOS.map(([v, l]) => (
              <option key={v} value={v}>
                {t(l)}
              </option>
            ))}
          </select>
        </Opcao>
        <Opcao titulo="Regras OWASP (CRS)">
          <span className={'tag ' + (dados.crs ? 'ok' : 'w')}>{t(dados.crs ? 'Instaladas' : 'Não instaladas')}</span>
        </Opcao>
      </div>
      <DataTable
        id="ad-modsec"
        empilhar="tablet"
        rows={dados.eventos.map((e, i) => ({ ...e, k: String(i) }))}
        rowKey={(r) => r.k}
        search={(r) => r.ip + ' ' + r.pedido + ' ' + r.regra}
        empty="Nenhum pedido travado nos registos recentes"
        cols={[
          { k: 'i', t: 'Endereço IP', cell: (r) => (
            <span className="pm-proc">
              <code>{r.ip}</code>
              <small>{r.data}</small>
            </span>
          ) },
          { k: 'p', t: 'Pedido', cell: (r) => <span className="pm-proc"><small className="ad-cmd">{r.pedido}</small></span> },
          { k: 'r', t: 'Regra', cell: (r) => <span className="pm-proc"><small className="ad-cmd">{r.regra}</small></span> },
        ]}
      />
      <Trabalho tr={dados.trabalho} ler={ler} titulo="A instalar o ModSecurity" />
    </>
  );
}
function BotaoInstalarModsec() {
  const d = useNaMemoria<Modsec>(MODSEC_URL);
  return (
    <BotaoTopo
      mostrar={!!d && !d.instalado && !d.trabalho.aCorrer}
      fa="fa-download"
      texto="Instalar o ModSecurity"
      titulo="Instalar o ModSecurity?"
      aviso="Instala o ModSecurity e as regras OWASP no Apache e recarrega o servidor web."
      ok="Instalar"
      corpo={{ acao: 'modsec-instalar' }}
      msg="A instalar…"
    />
  );
}
export const modsecAdminPagina: ScreenFn = () => ({
  title: 'ModSecurity (WAF)',
  desc: 'Firewall de aplicação do servidor web',
  descEl: <Resumo<Modsec> url={MODSEC_URL} base="Firewall de aplicação do servidor web" partes={(d) => [d.instalado ? (MODOS.find((m) => m[0] === d.modo)?.[1] || d.modo) : 'não instalado', d.instalado ? d.eventos.length + ' pedidos travados' : null]} />,
  actions: <BotaoInstalarModsec />,
  body: <ModsecAdmin />,
});

// ======================= Importar contas =======================
const IMP_URL = ROTA + '?ver=importar';
type Imp = { pasta: string; ficheiros: { nome: string; mb: number; data: string; tipo: 'cpanel' | 'directadmin' }[]; scripts: Record<'cpanel' | 'directadmin', boolean>; trabalho: Trab };
const ORIGEM: Record<string, string> = { cpanel: 'cPanel', directadmin: 'DirectAdmin' };
function ImportarContas() {
  const vh = useVH();
  const { t } = vh;
  const { dados, erro, ler } = useGet<Imp>(IMP_URL);
  useAoMudar(ler);
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  return (
    <>
      <DataTable
        id="ad-imp"
        umaLinha
        barraFora
        empilhar="tablet"
        rows={dados.ficheiros}
        rowKey={(r) => r.nome}
        empty="Nenhuma cópia do cPanel ou do DirectAdmin na pasta dos backups"
        cols={[
          { k: 'n', t: 'Ficheiro', sort: (r) => r.nome, cell: (r) => <span className="pm-proc"><small className="ad-cmd">{r.nome}</small></span> },
          { k: 'o', t: 'Origem', sort: (r) => r.tipo, cell: (r) => <span className={'tag ' + (dados.scripts[r.tipo] ? 'ok' : 'w')}>{ORIGEM[r.tipo]}</span> },
          { k: 'm', t: 'Tamanho', right: true, sort: (r) => r.mb, cell: (r) => mbTexto(r.mb) },
          { k: 'd', t: 'Data', sort: (r) => r.data, cell: (r) => r.data },
        ]}
        acoesNaColuna
        bulk={[
          {
            t: 'Importar',
            fa: 'fa-file-import',
            inativo: dados.trabalho.aCorrer,
            run: (k) => {
              const f = k.length === 1 ? dados.ficheiros.find((x) => x.nome === k[0]) : undefined;
              if (!f) return vh.toast('Escolha só um ficheiro');
              if (!dados.scripts[f.tipo]) return vh.toast(t('Este Hestia não tem o importador do') + ' ' + ORIGEM[f.tipo]);
              confirmar(vh, 'Importar a conta?', f.nome + ' (' + ORIGEM[f.tipo] + ') — ' + t('cria a conta com os sites, e-mails e bases de dados da cópia.'), 'Importar', { acao: 'importar', ficheiro: f.nome, tipo: f.tipo }, 'A importar…');
            },
          },
        ]}
      />
      <Sec titulo="Como importar" desc={t('Envie a cópia da conta (cpmove-… do cPanel ou user.….tar do DirectAdmin) por SFTP para') + ' ' + dados.pasta + ' ' + t('e escolha-a na lista.')}>
        <div className="em-opcoes">
          {(['cpanel', 'directadmin'] as const).map((k) => (
            <Opcao key={k} titulo={'Importador do ' + ORIGEM[k]}>
              <span className={'tag ' + (dados.scripts[k] ? 'ok' : 'w')}>{t(dados.scripts[k] ? 'Disponível' : 'Não disponível')}</span>
            </Opcao>
          ))}
        </div>
      </Sec>
      <Trabalho tr={dados.trabalho} ler={ler} titulo="A importar" />
    </>
  );
}
export const importarContasPagina: ScreenFn = () => ({
  title: 'Importar contas',
  desc: 'Contas do cPanel ou do DirectAdmin',
  descEl: <Resumo<Imp> url={IMP_URL} base="Contas do cPanel ou do DirectAdmin" partes={(d) => [d.ficheiros.length + ' cópias em ' + d.pasta]} />,
  body: <ImportarContas />,
});

// ======================= Manutenção =======================
const MNT_URL = ROTA + '?ver=manutencao';
type Mnt = { discoLivreMb: number; discoTotalMb: number; registosMb: number; aptMb: number; tmpMb: number; reparar: boolean; trabalho: Trab };
function Manutencao() {
  const vh = useVH();
  const { t } = vh;
  const { dados, erro, ler } = useGet<Mnt>(MNT_URL);
  useAoMudar(ler);
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  const usado = dados.discoTotalMb - dados.discoLivreMb;
  const ocupado = dados.trabalho.aCorrer;
  const tarefa = (titulo: string, sub: string, botao: string, fa: string, aviso: string, acao: string) => (
    <Opcao titulo={titulo} sub={sub}>
      <button className="btn g" disabled={ocupado} onClick={() => confirmar(vh, titulo + '?', t(aviso), botao, { acao }, 'A trabalhar…')}>
        <i className={'fa-solid ' + fa} />
        {t(botao)}
      </button>
    </Opcao>
  );
  return (
    <>
      <div className="stats ad-stats-dentro">
        <Stat title="Disco usado" uso v={mbTexto(usado)} m={'/ ' + mbTexto(dados.discoTotalMb)} p={dados.discoTotalMb ? (usado / dados.discoTotalMb) * 100 : 0} />
        <Stat title="Registos (/var/log)" v={mbTexto(dados.registosMb)} m="" p={0} />
        <Stat title="Cache de pacotes" v={mbTexto(dados.aptMb)} m="" p={0} />
        <Stat title="Temporários (/tmp)" v={mbTexto(dados.tmpMb)} m="" p={0} />
      </div>
      <Sec titulo="Tarefas">
        <div className="em-opcoes">
          {tarefa('Limpar o disco', 'Cache de pacotes, registos do sistema com mais de 14 dias e temporários com mais de 7.', 'Limpar', 'fa-broom', 'Apaga só ficheiros temporários e registos antigos; os sites e os e-mails não mudam.', 'mnt-limpar')}
          {tarefa('Reconstruir todas as contas', 'Volta a escrever as configurações web, DNS, e-mail e cron de todas as contas.', 'Reconstruir', 'fa-hammer', 'Pode demorar alguns minutos; os serviços recarregam no fim.', 'mnt-reconstruir')}
          {dados.reparar && tarefa('Verificar e reparar a configuração', 'Corrige as definições do Hestia que estiverem em falta ou erradas.', 'Reparar', 'fa-screwdriver-wrench', 'Repara a configuração do Hestia (v-repair-sys-config).', 'mnt-reparar')}
        </div>
      </Sec>
      <Trabalho tr={dados.trabalho} ler={ler} titulo="Manutenção a correr" />
    </>
  );
}
export const manutencaoPagina: ScreenFn = () => ({
  title: 'Manutenção',
  desc: 'Verificação e reparação geral',
  descEl: <Resumo<Mnt> url={MNT_URL} base="Verificação e reparação geral" partes={(d) => [mbTexto(d.discoLivreMb) + ' livres']} />,
  body: <Manutencao />,
});

// ======================= Módulos opcionais: Redis, Nginx Unit, Netdata =======================
const EXT_URL = ROTA + '?ver=extras';
type Extra = { instalado: boolean; ativo: boolean; versao: string; info: Record<string, string> };
type Extras = Record<'redis' | 'unit' | 'netdata', Extra> & { trabalho: Trab };
const MODULO: Record<'redis' | 'unit' | 'netdata', { nome: string; texto: string; instalar: string }> = {
  redis: { nome: 'Redis', texto: 'Cache em memória para WordPress, Laravel e outras aplicações.', instalar: '' },
  unit: { nome: 'Nginx Unit', texto: 'Servidor de aplicações Node.js, Python, Go e PHP.', instalar: 'Instala-se no servidor por SSH (pacote "unit" do repositório do Nginx).' },
  netdata: { nome: 'Netdata', texto: 'Métricas do servidor em tempo real (porta 19999).', instalar: 'Instala-se no servidor por SSH (script oficial do Netdata).' },
};
const INFO_REDIS: [string, string][] = [
  ['used_memory_human', 'Memória usada'],
  ['maxmemory_human', 'Memória máxima'],
  ['connected_clients', 'Ligações'],
  ['uptime_in_days', 'Ligado há (dias)'],
  ['keyspace_hits', 'Acertos na cache'],
  ['keyspace_misses', 'Falhas na cache'],
];
function Modulo({ k }: { k: 'redis' | 'unit' | 'netdata' }) {
  const vh = useVH();
  const { t } = vh;
  const { dados, erro, ler } = useGet<Extras>(EXT_URL);
  useAoMudar(ler);
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  const m = dados[k];
  const info = MODULO[k];
  const servico = (op: 'start' | 'stop' | 'restart', titulo: string, ok: string) => confirmar(vh, titulo, info.nome, ok, { acao: 'extra-servico', nome: k, op }, 'Feito');
  return (
    <>
      <Sec titulo={info.nome} desc={info.texto} extra={<span className={'tag ' + (!m.instalado ? 'off' : m.ativo ? 'ok' : 'bad')}>{t(!m.instalado ? 'Não instalado' : m.ativo ? 'A correr' : 'Parado')}</span>}>
        <div className="em-opcoes">
          {m.instalado ? (
            <>
              <Opcao titulo="Versão">
                <code>{m.versao || '—'}</code>
              </Opcao>
              {k === 'redis' &&
                INFO_REDIS.filter(([c]) => m.info[c] !== undefined).map(([c, l]) => (
                  <Opcao key={c} titulo={l}>
                    <b>{m.info[c]}</b>
                  </Opcao>
                ))}
              <Opcao titulo="Serviço" sub={m.ativo ? 'Reiniciar aplica as mudanças da configuração.' : 'O serviço está parado.'}>
                <span className="ad-botoes">
                  {m.ativo ? (
                    <>
                      <button className="btn g" onClick={() => servico('restart', 'Reiniciar o serviço?', 'Reiniciar')}>
                        <i className="fa-solid fa-rotate" />
                        {t('Reiniciar')}
                      </button>
                      <button className="btn g" onClick={() => servico('stop', 'Parar o serviço?', 'Parar')}>
                        <i className="fa-solid fa-stop" />
                        {t('Parar')}
                      </button>
                    </>
                  ) : (
                    <button className="btn r" onClick={() => servico('start', 'Ligar o serviço?', 'Ligar')}>
                      <i className="fa-solid fa-play" />
                      {t('Ligar')}
                    </button>
                  )}
                </span>
              </Opcao>
            </>
          ) : (
            <Opcao titulo="Instalação" sub={info.instalar || 'Instala o pacote e liga o serviço.'}>
              {k === 'redis' ? (
                <button className="btn r" disabled={dados.trabalho.aCorrer} onClick={() => confirmar(vh, 'Instalar o Redis?', t('Instala o redis-server e liga-o no arranque.'), 'Instalar', { acao: 'extra-instalar', nome: 'redis' }, 'A instalar…')}>
                  <i className="fa-solid fa-download" />
                  {t('Instalar')}
                </button>
              ) : (
                <span className="tag off">{t('Não instalado')}</span>
              )}
            </Opcao>
          )}
        </div>
      </Sec>
      {k === 'redis' && <Trabalho tr={dados.trabalho} ler={ler} titulo="A instalar o Redis" />}
    </>
  );
}
const modulo = (k: 'redis' | 'unit' | 'netdata', titulo: string): ScreenFn => () => ({
  title: titulo,
  desc: MODULO[k].texto,
  descEl: <Resumo<Extras> url={EXT_URL} base={MODULO[k].texto} partes={(d) => [d[k].instalado ? (d[k].ativo ? 'a correr' : 'parado') : 'não instalado', d[k].versao ? d[k].versao.split('-')[0].replace(/^\d+:/, '') : null]} />,
  body: <Modulo k={k} />,
});
export const redisPagina = modulo('redis', 'Redis');
export const unitPagina = modulo('unit', 'Nginx Unit');
export const netdataPagina = modulo('netdata', 'Métricas Netdata');
