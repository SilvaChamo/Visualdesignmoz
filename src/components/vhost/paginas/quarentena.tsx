'use client';

// Admin › Quarentena (Silva, 21/10/2026): os ficheiros que a guarda dos sites (deploy/seguranca/vd-guarda-sites) e as limpezas
// manuais puseram de lado em /root/quarentena-*, no servidor. Só o administrador. Dá para ver de onde saiu cada um e porquê, repor
// (volta ao sítio de origem, nunca por cima de outro ficheiro) e apagar de vez. Dados de /api/vhost/quarentena.
// Os popups desta página levam o texto numa só linha: a letra diminui até caber (Silva: "não gosto de duas linhas nos popups").
import { useLayoutEffect, useRef } from 'react';
import type { ScreenFn } from '../screens';
import { useVH, type VH } from '../context';
import { esquecerMemoria, useGet, useNaMemoria } from '../carga';
import { DESC, EN, MENU } from '../generated/data';
import { DataTable } from './componentes';
import { Carregando } from './avancado';

const ROTA = '/api/vhost/quarentena';
type Item = { id: string; nome: string; original: string; site: string; motivo: string; tam: number; data: string; lote: string };
type Dados = { itens: Item[]; total: number };

// ---------- Menu: "Quarentena" no grupo da gestão do servidor, a seguir aos Serviços ----------
{
  const grupo = MENU.admin.find(([, itens]) => itens.some((it) => it.id === 'servicos'));
  if (grupo && !grupo[1].some((it) => it.id === 'quarentena')) {
    const i = grupo[1].findIndex((it) => it.id === 'servicos');
    grupo[1].splice(i + 1, 0, {
      id: 'quarentena',
      fa: 'fa-biohazard',
      t: 'Quarentena',
      c: 'c8',
      da: '—',
      f: ['Ficheiros postos de lado pela guarda dos sites', 'Repor no sítio de origem ou apagar de vez'],
      hx: { s: 'app', cmd: '', n: 'Pasta /root/quarentena-* do servidor' },
    });
  }
  DESC['admin/quarentena'] = ['Ficheiros postos de lado pela guarda dos sites: repor ou apagar', 'Files set aside by the sites guard: restore or delete'];
  const novas: Record<string, string> = {
    Quarentena: 'Quarantine',
    Origem: 'Origin',
    Motivo: 'Reason',
    Repor: 'Restore',
    'Repor no sítio': 'Restore in place',
    'Apagar de vez': 'Delete for good',
    'Os ficheiros em quarentena foram postos de lado pela guarda dos sites; nada aqui corre no servidor.': 'The files in quarantine were set aside by the sites guard; nothing here runs on the server.',
    'Nada em quarentena': 'Nothing in quarantine',
    'Ficheiros apagados da quarentena': 'Files deleted from quarantine',
    'Ficheiros repostos': 'Files restored',
    'Não se pode desfazer.': 'This cannot be undone.',
    'Pode ser malicioso.': 'It may be malicious.',
  };
  for (const [pt, en] of Object.entries(novas)) if (!(pt in EN)) EN[pt] = en;
}

const mem = (b: number) => (b >= 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : b >= 1024 ? Math.round(b / 1024) + ' kB' : b + ' B');

/** Confirmação com o título e o texto numa só linha: a letra diminui até caber na janela (sem partir em duas linhas nem cortar com "…") */
function ConfirmarUmaLinha({ titulo, texto, ok, perigo = false, onOk }: { titulo: string; texto: string; ok: string; perigo?: boolean; onOk: () => void }) {
  const { t, closeM } = useVH();
  const caixa = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const ajustar = () => {
      const modal = el.closest('.modal') as HTMLElement | null;
      const folga = modal ? modal.clientWidth - 44 : el.clientWidth; // o modal tem 22 px de espaço de cada lado
      for (const alvo of Array.from(el.querySelectorAll<HTMLElement>('[data-uma-linha]'))) {
        let px = Number(alvo.dataset.umaLinha) || 13;
        alvo.style.fontSize = px + 'px';
        while (alvo.scrollWidth > folga && px > 8) {
          px -= 0.5;
          alvo.style.fontSize = px + 'px';
        }
      }
    };
    ajustar();
    window.addEventListener('resize', ajustar);
    return () => window.removeEventListener('resize', ajustar);
  }, [titulo, texto]);
  return (
    <div ref={caixa} className="mq-uma-linha">
      <h3 data-uma-linha="17">{t(titulo)}</h3>
      <p data-uma-linha="13">{texto}</p>
      <div className="mfoot">
        <button className="btn g" onClick={closeM}>
          {t('Cancelar')}
        </button>
        <button
          className={'btn ' + (perigo ? 'r' : 'g')}
          onClick={() => {
            closeM();
            onOk();
          }}
        >
          {t(ok)}
        </button>
      </div>
    </div>
  );
}

async function pedir(vh: VH, acao: 'apagar' | 'repor', ids: string[], ok: string): Promise<boolean> {
  vh.toast('A alterar no servidor…');
  try {
    const r = await fetch(ROTA, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ acao, ids }) });
    const j = (await r.json().catch(() => ({}))) as { feitos?: string[]; falhas?: { id: string; erro: string }[]; erro?: string };
    if (!r.ok) {
      vh.toast(String(j.erro || 'A alteração falhou'));
      return false;
    }
    esquecerMemoria(ROTA);
    const falhas = j.falhas || [];
    vh.toast(falhas.length ? (j.feitos?.length ? vh.t(ok) + ' · ' : '') + falhas.length + ' ' + vh.t('com erro') + ': ' + falhas[0].erro : vh.t(ok));
    return !!j.feitos?.length;
  } catch {
    vh.toast('Sem ligação ao site. Nada foi alterado.');
    return false;
  }
}

function Quarentena() {
  const vh = useVH();
  const { t } = vh;
  const { dados, erro, ler } = useGet<Dados>(ROTA);
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  const porId = new Map(dados.itens.map((x) => [x.id, x]));
  const apagar = (ids: string[]) => {
    if (!ids.length) return;
    vh.openM(
      <ConfirmarUmaLinha
        titulo="Apagar de vez?"
        texto={(ids.length === 1 ? porId.get(ids[0])?.nome || '1 ficheiro' : ids.length + ' ' + t('ficheiros')) + ' — ' + t('Não se pode desfazer.')}
        ok="Apagar"
        perigo
        onOk={async () => {
          await pedir(vh, 'apagar', ids, 'Ficheiros apagados da quarentena');
          ler(true);
        }}
      />,
    );
  };
  const repor = (ids: string[]) => {
    if (!ids.length) return;
    vh.openM(
      <ConfirmarUmaLinha
        titulo="Repor no sítio?"
        texto={(ids.length === 1 ? porId.get(ids[0])?.nome || '1 ficheiro' : ids.length + ' ' + t('ficheiros')) + ' — ' + t('Pode ser malicioso.')}
        ok="Repor"
        onOk={async () => {
          await pedir(vh, 'repor', ids, 'Ficheiros repostos');
          ler(true);
        }}
      />,
    );
  };
  return (
    <>
      <DataTable<Item>
        id="quarentena"
        umaLinha
        barraFora
        empilhar="tablet"
        rows={dados.itens}
        rowKey={(r) => r.id}
        search={(r) => r.nome + ' ' + r.original + ' ' + r.site + ' ' + r.motivo}
        empty="Nada em quarentena"
        porPagina={25}
        cols={[
          { k: 'n', t: 'Ficheiro', sort: (r) => r.nome, cell: (r) => <b>{r.nome}</b> },
          { k: 's', t: 'Site', sort: (r) => r.site, cell: (r) => r.site || '—' },
          { k: 'o', t: 'Origem', ate: 1300, sort: (r) => r.original, cell: (r) => <code title={r.original}>{r.original.replace(/^\/home\/[^/]+\/web\/[^/]+\/public_html\//, '')}</code> },
          { k: 'm', t: 'Motivo', ate: 1600, sort: (r) => r.motivo, cell: (r) => <span className="pm-desc">{r.motivo}</span> },
          { k: 't', t: 'Tamanho', right: true, sort: (r) => r.tam, cell: (r) => mem(r.tam) },
          { k: 'd', t: 'Data', right: true, ate: 1300, sort: (r) => r.data, cell: (r) => r.data },
        ]}
        actions={(r) => (
          <>
            <button className="btn sm g fb-btn" title={t('Repor no sítio')} onClick={() => repor([r.id])}>
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
      <p className="fb-nota">{t('Os ficheiros em quarentena foram postos de lado pela guarda dos sites; nada aqui corre no servidor.')}</p>
    </>
  );
}

function Resumo() {
  const { t } = useVH();
  const d = useNaMemoria<Dados>(ROTA);
  return (
    <>
      {t('Ficheiros postos de lado pela guarda dos sites')}
      {d && (
        <>
          <span className="pdesc-sep">|</span>
          {d.total} {t(d.total === 1 ? 'ficheiro' : 'ficheiros')}
        </>
      )}
    </>
  );
}

export const quarentenaPagina: ScreenFn = () => ({ title: 'Quarentena', desc: 'Ficheiros postos de lado pela guarda dos sites', descEl: <Resumo />, body: <Quarentena /> });
