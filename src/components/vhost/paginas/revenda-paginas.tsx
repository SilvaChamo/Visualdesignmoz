'use client';

// Páginas do menu Admin do revendedor (Silva, 26/10/2026: «o menu Admin do revendedor está vazio… copie as páginas do Admin»).
// O painel só dá ao revendedor as suas contas e as dos clientes que criou (`vhost-dados.ts`, `visiveis`), por isso estas páginas
// partem da mesma lista do painel (`s.acc`) e nunca leem o servidor inteiro. O que precisa do servidor está em /api/vhost/revenda.
import { useVH } from '../context';
import type { ScreenFn } from '../screens';
import { Stat } from '../ui';
import { mbTexto } from '../servidor';
import { DataTable } from './componentes';
import { Uso, num, usoContasPagina } from './admin-paginas';

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
