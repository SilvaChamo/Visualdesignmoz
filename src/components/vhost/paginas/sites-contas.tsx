'use client';

// Admin › Gestão de contas › Sites das contas (Silva, 17/10/2026): para cada site do servidor, se está mesmo no ar a
// partir daqui (qualquer linguagem, também atrás da Cloudflare), a linguagem, e se é só a página de espera — lida com o
// plano da conta: num plano de e-mail ou só domínio, "Brevemente" quer dizer que a conta não tem site; nos outros, que o
// site está em preparação. A verificação corre no servidor (/api/vhost/sites) e demora alguns segundos.
import { useState } from 'react';
import { useVH, type VH } from '../context';
import type { ScreenFn } from '../screens';
import { DESC, EN, MENU } from '../generated/data';
import { useGet } from '../carga';
import { DataTable, Tabs } from './componentes';
import { Carregando } from './avancado';

// ---------- Menu: "Sites das contas" em Gestão de contas, a seguir a "Todos os utilizadores" ----------
{
  const grupo = MENU.admin.find(([g]) => g === 'Gestão de contas');
  if (grupo && !grupo[1].some((it) => it.id === 'sites-contas')) {
    const i = grupo[1].findIndex((it) => it.id === 'utilizadores');
    grupo[1].splice(i + 1, 0, {
      id: 'sites-contas',
      fa: 'fa-earth-africa',
      t: 'Sites das contas',
      c: 'c6',
      da: '—',
      f: ['Se cada site está no ar a partir deste servidor', 'Linguagem do site e página de espera', 'O plano de cada conta'],
      hx: { s: 'app', cmd: 'v-list-web-domains', n: 'Pedido com marca única procurado nos registos do servidor' },
    });
  }
  DESC['admin/sites-contas'] = ['Se cada site está no ar a partir deste servidor, a linguagem e o plano da conta', 'Whether each site is live from this server, its language and the account plan'];
  const novas: Record<string, string> = {
    'Sites das contas': 'Account sites',
    'No ar aqui': 'Live here',
    'Página de espera': 'Holding page',
    'Noutro servidor': 'On another server',
    'Sem site': 'No site',
    'Site no ar': 'Site live',
    'Site em preparação': 'Site being prepared',
    'Sem DNS': 'No DNS',
    Linguagem: 'Language',
    Plano: 'Plan',
    Estado: 'Status',
    'Título da página': 'Page title',
    'Nenhum site neste separador': 'No site in this tab',
    'Sem página': 'No page',
    Redireccionamento: 'Redirect',
    'plano de e-mail: a página de espera não é um site': 'e-mail plan: the holding page is not a site',
    'só domínio: a página de espera não é um site': 'domain only: the holding page is not a site',
  };
  for (const [pt, en] of Object.entries(novas)) if (!(pt in EN)) EN[pt] = en;
}

type Site = { conta: string; plano: string; dominio: string; linguagem: string; titulo: string; onde: 'aqui' | 'fora' | 'sem-dns'; espera: boolean };
type Aba = 'todos' | 'aqui' | 'espera' | 'fora';

const semSite = (s: Site) => /^vd-(email-|dominio$)/i.test(s.plano);
/** O que o site é, lido com o plano da conta */
function estado(s: Site): [string, 'ok' | 'w' | 'off'] {
  if (s.espera) return semSite(s) ? ['Sem site', 'off'] : ['Site em preparação', 'w'];
  if (s.onde === 'aqui') return ['Site no ar', 'ok'];
  if (s.onde === 'fora') return ['Noutro servidor', 'w'];
  return ['Sem DNS', 'off'];
}

function Sites() {
  const vh = useVH();
  const { t } = vh;
  const { dados, erro, ler } = useGet<{ sites: Site[] }>('/api/vhost/sites');
  const [aba, setAba] = useState<Aba>('todos');
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  const filtro: Record<Aba, (s: Site) => boolean> = {
    todos: () => true,
    aqui: (s) => s.onde === 'aqui' && !s.espera,
    espera: (s) => s.espera,
    fora: (s) => s.onde !== 'aqui',
  };
  return (
    <>
      <Tabs<Aba>
        tabs={[
          ['todos', 'Todos'],
          ['aqui', 'No ar aqui'],
          ['espera', 'Página de espera'],
          ['fora', 'Noutro servidor'],
        ]}
        on={aba}
        onChange={setAba}
      />
      <div className="sites-contas-lista">
        <DataTable
          id="sites-contas"
          umaLinha
          barraFora
          rows={dados.sites.filter(filtro[aba])}
          rowKey={(r) => r.conta + '/' + r.dominio}
          search={(r) => [r.dominio, r.conta, r.plano, r.linguagem, r.titulo].join(' ')}
          empty="Nenhum site neste separador"
          cols={[
            {
              k: 'd',
              t: 'Domínio',
              sort: (r) => r.dominio,
              cell: (r) => (
                <div className="cell">
                  <div>
                    <a className="site-contas-link" href={'https://' + r.dominio} target="_blank" rel="noreferrer">
                      {r.dominio}
                    </a>
                  </div>
                </div>
              ),
            },
            { k: 'p', t: 'Plano', sort: (r) => r.plano, cell: (r) => r.plano || '—' },
            { k: 'l', t: 'Linguagem', sort: (r) => r.linguagem, cell: (r) => t(r.linguagem) },
            {
              k: 'e',
              t: 'Estado',
              sort: (r) => estado(r)[0],
              cell: (r) => {
                const [rot, cor] = estado(r);
                return (
                  <div>
                    <span className={'tag ' + cor}>{t(rot)}</span>
                    {r.espera && semSite(r) && (
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                        {t(/dominio/i.test(r.plano) ? 'só domínio: a página de espera não é um site' : 'plano de e-mail: a página de espera não é um site')}
                      </div>
                    )}
                  </div>
                );
              },
            },
            { k: 't', t: 'Título da página', ate: 1300, sort: (r) => r.titulo, cell: (r) => r.titulo || '—' },
          ]}
        />
      </div>
    </>
  );
}

export const sitesContasPagina: ScreenFn = (_vh: VH) => ({ title: 'Sites das contas', body: <Sites /> });
