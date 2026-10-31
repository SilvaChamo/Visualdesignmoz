'use client';

// Admin › Lixeira (Silva, 31/10/2026): os sites e as contas apagados, guardados no servidor (/backup/lixeira) antes de o Hestia os
// apagar. Dá para repor (volta tudo ao que era, com os dados do painel) ou apagar de vez. Só o administrador. Dados de /api/vhost/lixeira.
import type { ScreenFn } from '../screens';
import { useVH, type VH } from '../context';
import { esquecerMemoria, useGet, useNaMemoria } from '../carga';
import { DESC, EN, MENU } from '../generated/data';
import { DataTable } from './componentes';
import { Carregando } from './avancado';
import { ConfirmarUmaLinha } from './quarentena';
import { dataPt } from '../datas';

const ROTA = '/api/vhost/lixeira';
type Item = { id: string; tipo: 'site' | 'conta'; conta: string; dominio: string; data: string; origem: string; tam: number; bases: string[] };
type Dados = { itens: Item[]; total: number };

// ---------- Menu: "Lixeira" no grupo da gestão do servidor, a seguir à Quarentena ----------
{
  const grupo = MENU.admin.find(([, itens]) => itens.some((it) => it.id === 'servicos'));
  if (grupo && !grupo[1].some((it) => it.id === 'lixeira')) {
    const i = grupo[1].findIndex((it) => it.id === 'quarentena');
    const pos = i >= 0 ? i + 1 : grupo[1].findIndex((it) => it.id === 'servicos') + 1;
    grupo[1].splice(pos, 0, {
      id: 'lixeira',
      fa: 'fa-trash-can-arrow-up',
      t: 'Lixeira',
      c: 'c8',
      da: '—',
      f: ['Sites e contas apagados, guardados no servidor', 'Repor ou apagar de vez'],
      hx: { s: 'app', cmd: '', n: 'Pasta /backup/lixeira do servidor' },
    });
  }
  DESC['admin/lixeira'] = ['Sites e contas apagados: repor ou apagar de vez', 'Deleted sites and accounts: restore or delete for good'];
  const novas: Record<string, string> = {
    'Lixeira': 'Trash',
    'Sites e contas apagados, guardados no servidor': 'Deleted sites and accounts, kept on the server',
    'Repor ou apagar de vez': 'Restore or delete for good',
    Conta: 'Account',
    Apagado: 'Deleted',
    Repor: 'Restore',
    'Repor tudo o que foi apagado?': 'Restore everything that was deleted?',
    'Apagar de vez': 'Delete for good',
    'Nada na lixeira': 'Nothing in the trash',
    'Reposto no servidor': 'Restored on the server',
    'Apagado da lixeira': 'Deleted from the trash',
    'Os sites e as contas apagados ficam aqui, guardados no servidor, para se poderem repor.': 'Deleted sites and accounts are kept here, on the server, so they can be restored.',
    'Não se pode desfazer.': 'This cannot be undone.',
    'Sites e contas apagados': 'Deleted sites and accounts',
    'Site': 'Site',
    'Repor?': 'Restore?',
    item: 'item',
    itens: 'items',
    Apagar: 'Delete',
    Origem: 'Origin',
    Tamanho: 'Size',
    'com erro': 'with error',
    Cancelar: 'Cancel',
    'Volta ao servidor com os ficheiros e os dados do painel.': 'Comes back to the server with its files and panel data.',
  };
  for (const [pt, en] of Object.entries(novas)) if (!(pt in EN)) EN[pt] = en;
}

const mem = (b: number) => (b >= 1073741824 ? (b / 1073741824).toFixed(1).replace('.', ',') + ' GB' : b >= 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : b >= 1024 ? Math.round(b / 1024) + ' kB' : b + ' B');

async function pedir(vh: VH, acao: 'apagar' | 'repor', ids: string[], ok: string): Promise<boolean> {
  vh.toast('A alterar no servidor…');
  try {
    const r = await fetch(ROTA, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao, ids }) });
    const j = (await r.json().catch(() => ({}))) as { feitos?: string[]; falhas?: { id: string; erro: string }[]; avisos?: string[]; erro?: string };
    if (!r.ok) {
      vh.toast(String(j.erro || 'A alteração falhou'));
      return false;
    }
    esquecerMemoria(ROTA);
    const falhas = j.falhas || [];
    const aviso = j.avisos?.length ? ' · ' + j.avisos[0] : '';
    vh.toast(falhas.length ? (j.feitos?.length ? vh.t(ok) + ' · ' : '') + falhas.length + ' ' + vh.t('com erro') + ': ' + falhas[0].erro : vh.t(ok) + aviso);
    return !!j.feitos?.length;
  } catch {
    vh.toast('Sem ligação ao site. Nada foi alterado.');
    return false;
  }
}

function Lixeira() {
  const vh = useVH();
  const { t } = vh;
  const { dados, erro, ler } = useGet<Dados>(ROTA);
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  const porId = new Map(dados.itens.map((x) => [x.id, x]));
  const nome = (id: string) => {
    const i = porId.get(id);
    return i ? (i.tipo === 'site' ? i.dominio : t('Conta') + ' ' + i.conta) : id;
  };
  const apagar = (ids: string[]) => {
    if (!ids.length) return;
    vh.openM(
      <ConfirmarUmaLinha
        titulo="Apagar de vez?"
        texto={(ids.length === 1 ? nome(ids[0]) : ids.length + ' ' + t('itens')) + ' — ' + t('Não se pode desfazer.')}
        ok="Apagar"
        perigo
        onOk={async () => {
          await pedir(vh, 'apagar', ids, 'Apagado da lixeira');
          ler(true);
        }}
      />,
    );
  };
  const repor = (ids: string[]) => {
    if (!ids.length) return;
    vh.openM(
      <ConfirmarUmaLinha
        titulo="Repor?"
        texto={(ids.length === 1 ? nome(ids[0]) : ids.length + ' ' + t('itens')) + ' — ' + t('Volta ao servidor com os ficheiros e os dados do painel.')}
        ok="Repor"
        onOk={async () => {
          await pedir(vh, 'repor', ids, 'Reposto no servidor');
          ler(true);
        }}
      />,
    );
  };
  return (
    <>
      <DataTable<Item>
        id="lixeira"
        umaLinha
        barraFora
        empilhar="tablet"
        rows={dados.itens}
        rowKey={(r) => r.id}
        search={(r) => r.dominio + ' ' + r.conta + ' ' + r.origem}
        empty="Nada na lixeira"
        porPagina={25}
        cols={[
          { k: 'n', t: 'Site', sort: (r) => r.dominio || r.conta, cell: (r) => <b>{r.tipo === 'site' ? r.dominio : t('Conta') + ' ' + r.conta}</b> },
          { k: 'c', t: 'Conta', ate: 1300, sort: (r) => r.conta, cell: (r) => r.conta },
          { k: 'o', t: 'Origem', ate: 1600, sort: (r) => r.origem, cell: (r) => <span className="pm-desc">{r.origem}</span> },
          { k: 't', t: 'Tamanho', right: true, sort: (r) => r.tam, cell: (r) => mem(r.tam) },
          { k: 'd', t: 'Apagado', right: true, sort: (r) => r.data, cell: (r) => dataPt(r.data) },
        ]}
        actions={(r) => (
          <>
            <button className="btn sm g fb-btn" title={t('Repor')} onClick={() => repor([r.id])}>
              <i className="fa-solid fa-rotate-left" />
              <span>{t('Repor')}</span>
            </button>
            <button className="btn sm g fb-btn" title={t('Apagar de vez')} onClick={() => apagar([r.id])}>
              <i className="fa-solid fa-trash-can" />
              <span>{t('Apagar')}</span>
            </button>
          </>
        )}
        acoesNaColuna
        bulk={[
          { t: 'Repor', fa: 'fa-rotate-left', run: (k) => repor(k) },
          { t: 'Apagar de vez', fa: 'fa-trash-can', run: (k) => apagar(k) },
        ]}
      />
      <p className="fb-nota">{t('Os sites e as contas apagados ficam aqui, guardados no servidor, para se poderem repor.')}</p>
    </>
  );
}

function Resumo() {
  const { t } = useVH();
  const d = useNaMemoria<Dados>(ROTA);
  return (
    <>
      {t('Sites e contas apagados')}
      {d && (
        <>
          <span className="pdesc-sep">|</span>
          {d.total} {t(d.total === 1 ? 'item' : 'itens')}
        </>
      )}
    </>
  );
}

export const lixeiraPagina: ScreenFn = () => ({ title: 'Lixeira', desc: 'Sites e contas apagados', descEl: <Resumo />, body: <Lixeira /> });
