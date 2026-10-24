'use client';

// Gestão › Compras e encomendas › Facturação (Silva, 17/10/2026): as "Minhas compras" que já existem (painel antigo
// /cliente) enquadradas no painel — o mesmo componente e a mesma rota (/api/client/minhas-compras), sem reescrever nada,
// só com as cores do painel (.vh-site). Os dados de facturação (empresa, NUIT, morada…) já estão em Perfil › Dados
// pessoais. Aberta a todos os clientes e profissionais (Silva, 21/10/2026).
import { MinhasComprasSection } from '@/components/vhost/comuns/MinhasComprasSection';
import type { VH } from '../context';
import type { ScreenFn } from '../screens';
import { DESC, EN, MENU } from '../generated/data';

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

export const facturacaoPagina: ScreenFn = (vh: VH) => {
  if (vh.s.stack.length)
    return {
      title: 'Facturação',
      body: <div className="note">{vh.t('As compras mostradas no painel são as da sua sessão no site.')}</div>,
    };
  return {
    title: 'Facturação',
    actions: (
      <a className="btn r" href="/precos">
        <i className="fa-solid fa-cart-shopping" />
        {vh.t('Comprar serviços')}
      </a>
    ),
    body: (
      <div className="vh-site vh-facturacao">
        <MinhasComprasSection />
      </div>
    ),
  };
};
