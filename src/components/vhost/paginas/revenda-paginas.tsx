'use client';

// Páginas do menu Admin do revendedor (Silva, 26/10/2026: «o menu Admin do revendedor está vazio… copie as páginas do Admin»).
// O painel só dá ao revendedor as suas contas e as dos clientes que criou (`vhost-dados.ts`, `visiveis`), por isso estas páginas
// partem da mesma lista do painel (`s.acc`) e nunca leem o servidor inteiro. O que precisa do servidor está em /api/vhost/revenda.
import { useState, type ReactNode } from 'react';
import { useVH } from '../context';
import type { ScreenFn } from '../screens';
import { useGet } from '../carga';
import { Stat } from '../ui';
import { mbTexto } from '../servidor';
import { Carregando } from './avancado';
import { DataTable, Frm, Row, Senha } from './componentes';
import { Sec } from './avancado';
import { ROTA_REVENDA, Uso, num, usoContasPagina } from './admin-paginas';

/** Contas dos clientes da revenda (a própria conta do revendedor fica de fora) */
function useClientes() {
  const vh = useVH();
  return Object.entries(vh.s.acc)
    .filter(([u]) => u !== vh.me)
    .map(([u, a]) => ({ u, a }));
}

// ---------- Uso por cliente: a mesma lista do «Uso por conta» do Admin, só com os clientes da revenda ----------
export const usoClientesPagina: ScreenFn = (vh) => ({ ...usoContasPagina(vh), title: 'Uso por cliente' });

// ---------- Estatísticas da revenda: o uso total dos clientes e por pacote ----------
function EstatisticasRevenda() {
  const { t } = useVH();
  const clientes = useClientes();
  const soma = (f: (a: (typeof clientes)[number]['a']) => number) => clientes.reduce((n, { a }) => n + f(a), 0);
  const suspensos = clientes.filter(({ a }) => a.state === 'off').length;
  const porPacote = Object.values(
    clientes.reduce<Record<string, { pacote: string; clientes: number; discoMb: number; bwMb: number }>>((m, { a }) => {
      const pacote = a.hpkg || a.pkg || '—';
      const x = (m[pacote] ||= { pacote, clientes: 0, discoMb: 0, bwMb: 0 });
      x.clientes++;
      x.discoMb += a.discoMb || 0;
      x.bwMb += a.bwMb || 0;
      return m;
    }, {}),
  );
  return (
    <>
      <div className="stats">
        <Stat title="Clientes" v={clientes.length} m={suspensos ? num(suspensos) + ' suspensos' : 'todos ativos'} p={0} />
        <Stat title="Disco usado" v={mbTexto(soma((a) => a.discoMb || 0))} m="em todos os clientes" p={0} />
        <Stat title="Tráfego este mês" v={mbTexto(soma((a) => a.bwMb || 0))} m="em todos os clientes" p={0} />
        <Stat title="Domínios" v={soma((a) => a.domains.length)} m={num(soma((a) => a.mails.length)) + ' e-mails'} p={0} />
      </div>
      <DataTable
        id="rev-estatisticas"
        umaLinha
        barraFora
        empilhar="tablet"
        rows={porPacote}
        rowKey={(r) => r.pacote}
        empty="Ainda não tem clientes"
        cols={[
          { k: 'p', t: 'Pacote', sort: (r) => r.pacote, cell: (r) => <b>{r.pacote}</b> },
          { k: 'c', t: 'Clientes', right: true, sort: (r) => r.clientes, cell: (r) => r.clientes },
          { k: 'd', t: 'Disco', sort: (r) => r.discoMb, cell: (r) => <Uso v={r.discoMb} texto={mbTexto(r.discoMb)} /> },
          { k: 'b', t: 'Tráfego este mês', sort: (r) => r.bwMb, cell: (r) => <Uso v={r.bwMb} texto={mbTexto(r.bwMb)} /> },
        ]}
      />
      <p className="em-nota">{t('Os valores são a soma dos clientes que criou. O histórico por mês ainda não é guardado.')}</p>
    </>
  );
}
export const estatisticasRevendaPagina: ScreenFn = () => ({
  title: 'Estatísticas da revenda',
  desc: 'Uso total dos seus clientes',
  body: <EstatisticasRevenda />,
});

// ---------- Backups dos clientes: cada cliente com o botão que abre as cópias de segurança dele ----------
function BackupsClientes() {
  const vh = useVH();
  const { t, enterAs, nav } = vh;
  const clientes = useClientes();
  return (
    <DataTable
      id="rev-backups"
      umaLinha
      barraFora
      empilhar="tablet"
      rows={clientes}
      rowKey={(r) => r.u}
      search={(r) => r.u + ' ' + r.a.email}
      empty="Ainda não tem clientes"
      cols={[
        {
          k: 'u',
          t: 'Cliente',
          sort: (r) => r.u,
          cell: (r) => (
            <span className="pm-proc">
              <b>{r.u}</b>
              {r.a.state === 'off' && <span className="tag bad">{t('Suspensa')}</span>}
              <small>{r.a.email}</small>
            </span>
          ),
        },
        { k: 'p', t: 'Pacote', ate: 1300, sort: (r) => r.a.hpkg || r.a.pkg, cell: (r) => r.a.hpkg || r.a.pkg },
        { k: 'd', t: 'Disco', sort: (r) => r.a.discoMb || 0, cell: (r) => mbTexto(r.a.discoMb || 0) },
      ]}
      actions={(r) => (
        <button
          className="btn g sm"
          title={t('Abrir as cópias de segurança deste cliente')}
          onClick={() => {
            enterAs(r.u);
            nav('/utilizador/backups');
          }}
        >
          <i className="fa-solid fa-box-archive" />
          {t('Cópias de segurança')}
        </button>
      )}
    />
  );
}
export const backupsClientesPagina: ScreenFn = () => ({
  title: 'Backups dos clientes',
  desc: 'Criar e restaurar as cópias de segurança de cada cliente',
  body: <BackupsClientes />,
});

// ---------- IPs: os partilhados e os que o servidor atribuiu à revenda (só para ver; quem os atribui é o administrador) ----------
type Ip = { ip: string; dono: string; estado: string; nome: string; nat: string; interface: string; mascara: string; contas: number; dominios: number };
function IpsRevenda() {
  const { t } = useVH();
  const { dados, erro, ler } = useGet<{ ips: Ip[] }>(ROTA_REVENDA + '?ver=ips');
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  return (
    <DataTable
      id="rev-ips"
      umaLinha
      barraFora
      empilhar="tablet"
      rows={dados.ips}
      rowKey={(r) => r.ip}
      search={(r) => r.ip + ' ' + r.nome + ' ' + r.interface}
      empty="Ainda não tem IPs atribuídos"
      cols={[
        {
          k: 'ip',
          t: 'Endereço IP',
          sort: (r) => r.ip,
          cell: (r) => (
            <span className="pm-proc">
              <code>{r.ip}</code>
              {r.nat && <small>NAT {r.nat}</small>}
            </span>
          ),
        },
        { k: 'e', t: 'Estado', sort: (r) => r.estado, cell: (r) => <span className={'tag ' + (r.estado === 'shared' ? 'ok' : 'w')}>{t(r.estado === 'shared' ? 'Partilhado' : 'Dedicado')}</span> },
        { k: 'd', t: 'Atribuído a', ate: 1050, sort: (r) => r.dono, cell: (r) => (r.dono ? t('A sua revenda') : '—') },
        { k: 'n', t: 'Nome', ate: 1300, cell: (r) => r.nome || '—' },
        { k: 'i', t: 'Interface', ate: 1600, cell: (r) => (r.interface || '—') + (r.mascara ? ' / ' + r.mascara : '') },
        { k: 'c', t: 'Contas', right: true, sort: (r) => r.contas, cell: (r) => (r.dono ? r.contas : '—') },
        { k: 'w', t: 'Sites', right: true, sort: (r) => r.dominios, cell: (r) => (r.dono ? r.dominios : '—') },
      ]}
    />
  );
}
export const ipsRevendaPagina: ScreenFn = () => ({ title: 'IPs', desc: 'Os IPs partilhados e os atribuídos à sua revenda', body: <IpsRevenda /> });

// ---------- Security.txt: o relatório dos domínios dos clientes ----------
type Stxt = { conta: string; dominio: string; texto: string };
const campoStxt = (txt: string, k: string) => (txt.match(new RegExp('^' + k + ':\\s*(.+)$', 'mi')) || [])[1]?.trim() || '';
function estadoStxt(r: Stxt): ['ok' | 'w' | 'bad' | 'off', string] {
  if (!r.texto.trim()) return ['off', 'Em falta'];
  const exp = campoStxt(r.texto, 'Expires');
  if (!campoStxt(r.texto, 'Contact') || !exp) return ['w', 'Incompleto'];
  return Date.parse(exp) < Date.now() ? ['bad', 'Expirado'] : ['ok', 'Válido'];
}
function SecurityTxtRevenda() {
  const { t } = useVH();
  const { dados, erro, ler } = useGet<{ dominios: Stxt[] }>(ROTA_REVENDA + '?ver=security-txt');
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  return (
    <DataTable
      id="rev-security-txt"
      umaLinha
      barraFora
      empilhar="tablet"
      rows={dados.dominios}
      rowKey={(r) => r.conta + '/' + r.dominio}
      search={(r) => r.dominio + ' ' + r.conta}
      empty="Os seus clientes ainda não têm domínios com site"
      cols={[
        {
          k: 'd',
          t: 'Domínio',
          sort: (r) => r.dominio,
          cell: (r) => (
            <span className="pm-proc">
              <b>{r.dominio}</b>
              <small>{r.conta}</small>
            </span>
          ),
        },
        { k: 'e', t: 'Estado', sort: (r) => estadoStxt(r)[1], cell: (r) => <span className={'tag ' + estadoStxt(r)[0]}>{t(estadoStxt(r)[1])}</span> },
        { k: 'c', t: 'Contacto', ate: 1300, cell: (r) => campoStxt(r.texto, 'Contact') || '—' },
        { k: 'x', t: 'Expira em', ate: 1050, sort: (r) => campoStxt(r.texto, 'Expires'), cell: (r) => campoStxt(r.texto, 'Expires').slice(0, 10) || '—' },
      ]}
    />
  );
}
export const securityTxtRevendaPagina: ScreenFn = () => ({ title: 'Security.txt', desc: 'O security.txt dos domínios dos seus clientes', body: <SecurityTxtRevenda /> });

// ---------- Importar do cPanel: as contas que o revendedor tem num servidor cPanel, trazidas para esta revenda ----------
// (no DirectAdmin: «Importar do cPanel» — lista das importações, «Nova importação» e, no início, as credenciais do servidor remoto.)
// A ligação a um servidor remoto ainda não está ativa neste servidor: por isso a página diz-o e o botão não envia nada — as credenciais
// nunca saem do navegador.
/** Linha de passo (texto à esquerda, etiqueta à direita), como as opções das preferências */
function Opcao({ titulo, sub, children }: { titulo: string; sub?: string; children: ReactNode }) {
  const { t } = useVH();
  return (
    <div>
      <span>
        {t(titulo)}
        {sub && <small>{t(sub)}</small>}
      </span>
      {children}
    </div>
  );
}

function ImportarCpanel() {
  const { t } = useVH();
  return (
    <>
      <Sec titulo="Importações" desc="As contas que traz de um servidor cPanel para esta revenda. Cada importação cria as contas, com os sites, os e-mails e as bases de dados, e deixa-as ligadas a si.">
        <DataTable
          id="rev-cpanel"
          umaLinha
          barraFora
          empilhar="tablet"
          rows={[] as { id: string; conta: string; estagio: string; servidor: string; inicio: string; fim: string }[]}
          rowKey={(r) => r.id}
          empty="Ainda não fez nenhuma importação. Carregue em «Nova importação» para começar."
          cols={[
            { k: 'c', t: 'Conta', cell: (r) => <b>{r.conta}</b> },
            { k: 'e', t: 'Estágio', cell: (r) => r.estagio },
            { k: 's', t: 'Servidor remoto', ate: 1300, cell: (r) => r.servidor },
            { k: 'i', t: 'Início', ate: 1050, cell: (r) => r.inicio },
            { k: 'f', t: 'Fim', ate: 1050, cell: (r) => r.fim || '—' },
          ]}
        />
      </Sec>
      <Sec titulo="Como funciona" desc="Três passos, sem mexer nos ficheiros do servidor cPanel.">
        <div className="em-opcoes">
          <Opcao titulo="1. Ligue-se ao seu servidor cPanel" sub="Indique o endereço, a porta, o utilizador e a palavra-passe do servidor onde tem as contas.">
            <span className="tag off">{t('Servidor remoto')}</span>
          </Opcao>
          <Opcao titulo="2. Escolha as contas" sub="O painel lista as contas desse servidor; marque as que quer trazer.">
            <span className="tag off">{t('Contas')}</span>
          </Opcao>
          <Opcao titulo="3. Acompanhe a importação" sub="Cada conta passa por estágios até ficar pronta na sua revenda; vê aqui o estado e a data.">
            <span className="tag off">{t('Estágio')}</span>
          </Opcao>
        </div>
      </Sec>
    </>
  );
}

function NovaImportacaoCpanel() {
  const vh = useVH();
  const { t, nav } = vh;
  const [f, setF] = useState({ host: '', porta: '22', utilizador: 'root', senha: '' });
  return (
    <>
      <p className="note">
        <i className="fa-solid fa-circle-info" style={{ color: 'var(--red)' }} /> {t('A ligação a servidores cPanel remotos ainda não está ativa neste servidor. Quando estiver, os dados abaixo servem só para esta importação e não ficam guardados.')}
      </p>
      <Frm
        title="Credenciais do servidor cPanel remoto"
        desc="O servidor onde estão as contas que quer trazer para a sua revenda"
        foot={
          <>
            <button className="btn g" onClick={() => nav('/revenda/importar-contas')}>
              {t('Cancelar')}
            </button>
            <button className="btn r" disabled title={t('Ainda não está ativo neste servidor')}>
              <i className="fa-solid fa-cloud-arrow-down" />
              {t('Carregar contas')}
            </button>
          </>
        }
      >
        <Row label="Servidor" hint="Endereço (ex.: cpanel.empresa.com ou o IP)">
          <input value={f.host} onChange={(e) => setF({ ...f, host: e.target.value.trim() })} placeholder="cpanel.empresa.com" autoComplete="off" />
        </Row>
        <Row label="Porta" hint="A do SSH, normalmente 22">
          <input value={f.porta} onChange={(e) => setF({ ...f, porta: e.target.value.replace(/\D/g, '').slice(0, 5) })} inputMode="numeric" autoComplete="off" />
        </Row>
        <Row label="Utilizador" hint="Normalmente root">
          <input value={f.utilizador} onChange={(e) => setF({ ...f, utilizador: e.target.value.trim() })} autoComplete="off" />
        </Row>
        <Row label="Palavra-passe">
          <Senha value={f.senha} onChange={(v) => setF({ ...f, senha: v })} semGerar />
        </Row>
      </Frm>
    </>
  );
}

export const importarCpanelPagina: ScreenFn = (vh) => {
  const base = { t: 'Importar do cPanel', path: '/revenda/importar-contas' };
  if (vh.s.sub[0] === 'nova') return { title: 'Nova importação', crumbs: [base, { t: 'Nova importação' }], desc: 'Ligue-se ao servidor cPanel onde estão as contas', body: <NovaImportacaoCpanel /> };
  return {
    title: 'Importar do cPanel',
    desc: 'Traga as contas que tem num servidor cPanel',
    actions: (
      <button className="btn r" onClick={() => vh.nav('/revenda/importar-contas/nova')}>
        <i className="fa-solid fa-plus" />
        {vh.t('Nova importação')}
      </button>
    ),
    body: <ImportarCpanel />,
  };
};
