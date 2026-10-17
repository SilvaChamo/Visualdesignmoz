'use client';

// Gestão › Compras e encomendas › Facturação (Silva, 17/10/2026): as compras feitas no site (domínios, alojamento,
// e-mail) com o estado do pagamento, o recibo e o aviso de renovação — vinham da "Facturação" e das "Minhas compras" do
// painel antigo (/cliente). A mesma rota (/api/client/minhas-compras). Os dados de facturação (empresa, NUIT, morada…)
// já estão em Perfil › Dados pessoais. Por agora só a sessão de administrador vê esta página (soAdminPorAgora).
import { formatMt } from '@/lib/pricing-catalog';
import { checkoutItemSummary, type CheckoutItemLike } from '@/lib/checkout-item-labels';
import { openDocumentWindow } from '@/components/documents/VisualDesignDocument';
import { useVH, type VH } from '../context';
import type { ScreenFn } from '../screens';
import { DESC, EN, MENU } from '../generated/data';
import { soAdminPorAgora } from '../state';
import { esquecerMemoria, useGet } from '../carga';
import { DataTable, Tabs } from './componentes';
import { Carregando } from './avancado';

// ---------- Menu: "Facturação" no grupo "Compras e encomendas" da Gestão, a seguir a "Encomendas" ----------
{
  const grupos = MENU.utilizador;
  let grupo = grupos.find(([g]) => g === 'Compras e encomendas');
  if (!grupo) {
    const i = grupos.findIndex(([g]) => g === 'Suporte e ajuda');
    grupo = ['Compras e encomendas', []];
    grupos.splice(i < 0 ? grupos.length : i, 0, grupo);
  }
  if (!grupo[1].some((it) => it.id === 'facturacao')) {
    grupo[1].push({
      id: 'facturacao',
      fa: 'fa-file-invoice-dollar',
      t: 'Facturação',
      c: 'c4',
      da: '—',
      f: ['Compras de domínios, alojamento e e-mail', 'Estado do pagamento e recibos', 'Serviços a renovar'],
      hx: { s: 'app', cmd: '', n: 'Compras do site da VisualDesign' },
    });
  }
  DESC['utilizador/facturacao'] = ['As suas compras no site: pagamentos, recibos e renovações', 'Your purchases on the site: payments, receipts and renewals'];
  soAdminPorAgora.add('utilizador/facturacao');
  // inglês do painel: só as frases que ainda não estão no dicionário (não muda a tradução de outras páginas)
  const novas: Record<string, string> = {
    'Compras e encomendas': 'Purchases and orders',
    Facturação: 'Billing',
    Todas: 'All',
    'Por pagar': 'To pay',
    Pagas: 'Paid',
    'Sem efeito': 'Void',
    Descrição: 'Description',
    Valor: 'Amount',
    Método: 'Method',
    Data: 'Date',
    Estado: 'Status',
    Pendente: 'Pending',
    Confirmado: 'Confirmed',
    Rejeitado: 'Rejected',
    Expirado: 'Expired',
    'Exige renovação': 'Needs renewal',
    Renovar: 'Renew',
    'Ver recibo': 'View receipt',
    'Comprar serviços': 'Buy services',
    compra: 'purchase',
    compras: 'purchases',
    pendente: 'pending',
    pendentes: 'pending',
    'pago este ano': 'paid this year',
    'Ainda não fez nenhuma compra': 'You have not made any purchase yet',
    'Não há compras neste separador': 'There are no purchases in this tab',
    Motivo: 'Reason',
    'Transferência': 'Transfer',
    'Cartão': 'Card',
    'As compras mostradas no painel são as da sua sessão no site.': 'The purchases shown in the panel are those of your site session.',
  };
  for (const [pt, en] of Object.entries(novas)) if (!(pt in EN)) EN[pt] = en;
}

type Compra = {
  id: string;
  items: CheckoutItemLike[];
  total_mt: number;
  metodo_pagamento: string;
  status: string;
  created_at: string;
  rejection_reason?: string | null;
  /** algum serviço desta compra já passou da data sem ser renovado */
  renovacao_url: string | null;
};

const URL_COMPRAS = '/api/client/minhas-compras';
const BASE = '/utilizador/facturacao';

const FILTROS: [string, string, string, (c: Compra) => boolean][] = [
  ['todas', 'Todas', 'fa-list', () => true],
  ['por-pagar', 'Por pagar', 'fa-hourglass-half', (c) => c.status === 'pending'],
  ['pagas', 'Pagas', 'fa-circle-check', (c) => c.status === 'paid'],
  ['sem-efeito', 'Sem efeito', 'fa-ban', (c) => c.status === 'failed' || c.status === 'expired'],
];

// os mesmos rótulos das "Minhas compras" do painel antigo (e da Contabilidade)
const ESTADO: Record<string, [string, string]> = { pending: ['Pendente', 'w'], paid: ['Confirmado', 'ok'], failed: ['Rejeitado', 'bad'], expired: ['Expirado', 'off'] };
const METODO: Record<string, string> = { mpesa: 'M-Pesa', emola: 'e-Mola', transferencia: 'Transferência', stripe: 'Cartão' };

const dataPt = (iso: string) => {
  const t = Date.parse(iso);
  return isNaN(t) ? '—' : new Date(t).toLocaleDateString('pt-PT');
};
const valor = (c: Compra) => Number(c.total_mt) || 0;

function Compras({ filtro }: { filtro: string }) {
  const vh = useVH();
  const { t } = vh;
  const { dados, erro, ler } = useGet<{ compras: Compra[] }>(URL_COMPRAS);
  if (!dados) return <Carregando erro={erro} ler={ler} />;
  const compras = dados.compras || [];
  const [, , , passa] = FILTROS.find(([k]) => k === filtro) || FILTROS[0];
  return (
    <>
      <Tabs
        tabs={FILTROS.map(([k, l, fa]) => [k, l, fa] as [string, string, string])}
        on={filtro}
        onChange={(k) => vh.nav(k === 'todas' ? BASE : BASE + '/' + k)}
      />
      <DataTable
        id={'facturacao-' + filtro}
        umaLinha
        barraFora
        empilhar="tablet"
        rows={compras.filter(passa)}
        rowKey={(c) => c.id}
        search={(c) => c.items.map((i) => checkoutItemSummary(i)).join(' ') + ' ' + (METODO[c.metodo_pagamento] || c.metodo_pagamento || '')}
        onRecarregar={() => {
          esquecerMemoria(URL_COMPRAS);
          void ler(true);
        }}
        empty={compras.length ? 'Não há compras neste separador' : 'Ainda não fez nenhuma compra'}
        cols={[
          {
            k: 'd',
            t: 'Descrição',
            cell: (c) => {
              const [primeiro, ...outros] = c.items || [];
              return (
                <div className="enc-linha">
                  <b>{primeiro ? checkoutItemSummary(primeiro) : '—'}</b>
                  {outros.map((i, n) => (
                    <span key={n}>{checkoutItemSummary(i)}</span>
                  ))}
                  {c.status === 'failed' && c.rejection_reason && (
                    <span>
                      {t('Motivo')}: {c.rejection_reason}
                    </span>
                  )}
                </div>
              );
            },
          },
          { k: 'v', t: 'Valor', right: true, sort: valor, cell: (c) => formatMt(valor(c)) + ' MT' },
          { k: 'm', t: 'Método', ate: 1300, sort: (c) => c.metodo_pagamento || '', cell: (c) => t(METODO[c.metodo_pagamento] || c.metodo_pagamento || '—') },
          { k: 'dt', t: 'Data', ate: 1600, sort: (c) => c.created_at, cell: (c) => dataPt(c.created_at) },
          {
            k: 'e',
            t: 'Estado',
            sort: (c) => (c.renovacao_url ? 'a' : c.status),
            cell: (c) => {
              const [rotulo, cor] = c.renovacao_url ? ['Exige renovação', 'bad'] : ESTADO[c.status] || [c.status, ''];
              return <span className={'tag ' + cor}>{t(rotulo)}</span>;
            },
          },
        ]}
        actions={(c) => (
          <>
            {c.renovacao_url && (
              <a className="btn r sm" href={c.renovacao_url}>
                <i className="fa-solid fa-rotate" />
                {t('Renovar')}
              </a>
            )}
            {c.status === 'paid' && (
              <button className="btn g sm" onClick={() => openDocumentWindow(`/recibo/${c.id}?embed=1`, `recibo-${c.id}`)}>
                <i className="fa-solid fa-receipt" />
                {t('Ver recibo')}
              </button>
            )}
          </>
        )}
      />
    </>
  );
}

/** Descrição na barra de cima: "N compras | X pendentes (Y MT) | Z MT pago este ano" */
function Resumo() {
  const { t } = useVH();
  const { dados } = useGet<{ compras: Compra[] }>(URL_COMPRAS);
  if (!dados) return <>{t('As suas compras no site: pagamentos, recibos e renovações')}</>;
  const compras = dados.compras || [];
  const pendentes = compras.filter((c) => c.status === 'pending');
  const ano = new Date().getFullYear();
  const pagoAno = compras.filter((c) => c.status === 'paid' && new Date(c.created_at).getFullYear() === ano).reduce((s, c) => s + valor(c), 0);
  return (
    <>
      {compras.length} {t(compras.length === 1 ? 'compra' : 'compras')}
      {pendentes.length ? ` | ${pendentes.length} ${t(pendentes.length === 1 ? 'pendente' : 'pendentes')} (${formatMt(pendentes.reduce((s, c) => s + valor(c), 0))} MT)` : ''}
      {pagoAno ? ` | ${formatMt(pagoAno)} MT ${t('pago este ano')}` : ''}
    </>
  );
}

export const facturacaoPagina: ScreenFn = (vh: VH) => {
  if (vh.s.stack.length)
    return {
      title: 'Facturação',
      body: <div className="note">{vh.t('As compras mostradas no painel são as da sua sessão no site.')}</div>,
    };
  const [sub] = vh.s.sub;
  const filtro = FILTROS.some(([k]) => k === sub) ? sub : 'todas';
  return {
    title: 'Facturação',
    actions: (
      <a className="btn r" href="/precos">
        <i className="fa-solid fa-cart-shopping" />
        {vh.t('Comprar serviços')}
      </a>
    ),
    descEl: <Resumo />,
    body: <Compras filtro={filtro} />,
  };
};
