'use client';

// Admin › Gestão de contas › Contas ligadas (pedido do Silva, 16/10/2026): quem tem o painel aberto agora — pessoa,
// conta e plano (também a conta que está a ver, com "entrar como"), localização pelo IP, aparelho e última atividade.
// Cada painel aberto avisa o servidor a cada minuto (/api/vhost/presenca); a lista atualiza-se sozinha a cada 30 s.
import { useEffect } from 'react';
import { useVH, type VH } from '../context';
import type { ScreenFn } from '../screens';
import { DESC, MENU } from '../generated/data';
import { useGet } from '../carga';
import { DataTable } from './componentes';
import { Carregando } from './avancado';

// ---------- Menu: "Contas ligadas" em Gestão de contas, a seguir a "Todos os utilizadores" ----------
{
  const grupo = MENU.admin.find(([g]) => g === 'Gestão de contas');
  if (grupo && !grupo[1].some((it) => it.id === 'ligados')) {
    const i = grupo[1].findIndex((it) => it.id === 'utilizadores');
    grupo[1].splice(i + 1, 0, {
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
  desde: number;
  ultimo: number;
};

const PAPEL: Record<string, string> = { admin: 'Administrador', reseller: 'Revendedor', manager: 'Profissional', profissional: 'Profissional', client: 'Cliente' };
const ATIVO_MS = 2 * 60_000;

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
  useEffect(() => {
    const id = setInterval(() => void ler(true), 30_000);
    return () => clearInterval(id);
  }, [ler]);
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  const agora = dados.agora;
  return (
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
              <div style={{ fontSize: 12, color: 'var(--muted)' }}>{r.ip || '—'}</div>
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
  );
}

export const ligadosPagina: ScreenFn = (vh: VH) => ({
  title: 'Contas ligadas',
  desc: vh.t('Quem tem o painel aberto agora: conta, plano e localização'),
  body: <Ligados />,
});
