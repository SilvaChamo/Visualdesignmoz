'use client';

// Gestão › Compras e encomendas › Encomendas (Silva, 17/10/2026): o painel das encomendas que já existe (/encomendas e
// painel antigo /cliente), enquadrado no painel — as mesmas secções (Encomendas, Mensagens, Pagamentos), os mesmos
// componentes e as mesmas rotas, sem reescrever nada (Silva: "não rescrever de zero… apenas chamar para o painel
// actual"). Só os separadores passam ao modelo do painel; as cores são as do painel (.vh-site). A página /encomendas do
// site continua igual (os clientes só de encomendas ficam lá).
// Por agora só a sessão de administrador vê esta página (soAdminPorAgora): o Silva experimenta antes de abrir aos clientes.
import { useEffect } from 'react';
import { EncomendasListSection } from '@/components/encomendas/EncomendasListSection';
import { EncomendasMensagensSection } from '@/components/encomendas/EncomendasMensagensSection';
import { EncomendasPagamentosSection } from '@/components/encomendas/EncomendasPagamentosSection';
import { marcarVoltaAoPainel } from '@/lib/voltar-ao-painel';
import { useVH, type VH } from '../context';
import type { ScreenFn } from '../screens';
import { DESC, EN, MENU } from '../generated/data';
import { soAdminPorAgora } from '../state';
import { useGet } from '../carga';
import { Tabs } from './componentes';

// ---------- Menu: grupo "Compras e encomendas" na Gestão, antes de "Suporte e ajuda" ----------
{
  const grupos = MENU.utilizador;
  if (!grupos.some(([g]) => g === 'Compras e encomendas')) {
    const i = grupos.findIndex(([g]) => g === 'Suporte e ajuda');
    grupos.splice(i < 0 ? grupos.length : i, 0, [
      'Compras e encomendas',
      [
        {
          id: 'encomendas',
          fa: 'fa-box-open',
          t: 'Encomendas',
          c: 'c2',
          da: '—',
          f: ['Encomendas de produção gráfica, brindes e webdesign', 'Mensagens com a equipa, layouts e anexos', 'Pagamentos e facturas'],
          hx: { s: 'app', cmd: '', n: 'Encomendas do site da VisualDesign' },
        },
      ],
    ]);
  }
  DESC['utilizador/encomendas'] = ['As suas encomendas à VisualDesign: estado, mensagens e pagamento', 'Your orders with VisualDesign: status, messages and payment'];
  soAdminPorAgora.add('utilizador/encomendas');
  // inglês do painel: só as frases que ainda não estão no dicionário (não muda a tradução de outras páginas)
  const novas: Record<string, string> = {
    'Compras e encomendas': 'Purchases and orders',
    Encomendas: 'Orders',
    Encomenda: 'Order',
    'Nova encomenda': 'New order',
    Todas: 'All',
    'Por pagar': 'To pay',
    'Em curso': 'In progress',
    Entregues: 'Delivered',
    Canceladas: 'Cancelled',
    Data: 'Date',
    Total: 'Total',
    Estado: 'Status',
    Mensagens: 'Messages',
    Pagamentos: 'Payments',
    Detalhes: 'Details',
    Pagamento: 'Payment',
    Histórico: 'History',
    Cotação: 'Quote',
    Facturas: 'Invoices',
    Serviço: 'Service',
    Quantidade: 'Quantity',
    Abrir: 'Open',
    Editar: 'Edit',
    'Sob consulta': 'On request',
    'por ler': 'unread',
    'Cancelar encomenda': 'Cancel order',
    'Cancelar encomendas': 'Cancel orders',
    'Apagar encomendas': 'Delete orders',
    'Ainda não tem encomendas': 'You have no orders yet',
    'Não há encomendas neste separador': 'There are no orders in this tab',
    'Continuar para pagamento': 'Continue to payment',
    'Pagar remanescente': 'Pay the remainder',
    'Escolher método de pagamento': 'Choose a payment method',
    'Ver factura': 'View invoice',
    'Voltar às encomendas': 'Back to orders',
    'Encomenda não encontrada': 'Order not found',
    'Total com IVA': 'Total with VAT',
    'Adiantamento (70%)': 'Deposit (70%)',
    'Remanescente (30%)': 'Remainder (30%)',
    'Método escolhido': 'Chosen method',
    'Factura do adiantamento': 'Deposit invoice',
    'Factura do remanescente': 'Remainder invoice',
    'Encomenda cancelada': 'Order cancelled',
    'Encomendas apagadas': 'Orders deleted',
    'Editar o serviço': 'Edit the service',
    'Entrega até': 'Delivery by',
    encomenda: 'order',
    encomendas: 'orders',
    'por pagar': 'to pay',
    Voltar: 'Back',
    'Apagar encomendas?': 'Delete orders?',
    'Vai apagar': 'You are about to delete',
    'Não se pode desfazer.': 'This cannot be undone.',
    'Motivo do cancelamento (opcional)': 'Reason for cancelling (optional)',
    'Motivo do cancelamento': 'Reason for cancelling',
    'Motivo da rejeição': 'Reason for rejection',
    'Todos os serviços desta encomenda estão concluídos. Para a levantar, falta pagar o remanescente.':
      'Every service in this order is finished. To collect it, the remainder still has to be paid.',
    'Envie o valor para': 'Send the amount to',
    Conta: 'Account',
    'Esta encomenda é sob consulta: a equipa contacta-o com o preço antes de haver alguma coisa a pagar.':
      'This order is on request: the team will contact you with the price before there is anything to pay.',
    'A equipa confirma o pagamento à mão assim que o valor for recebido.': 'The team confirms the payment by hand as soon as the amount is received.',
    'Fica disponível aqui assim que a equipa confirmar o pagamento do adiantamento.': 'It becomes available here as soon as the team confirms the deposit payment.',
    'As encomendas mostradas no painel são as da sua sessão no site. Para ver as de um cliente, use a gestão de encomendas do administrador.':
      "The orders shown in the panel are those of your site session. To see a client's orders, use the administrator's order management.",
    'Aguarda pagamento': 'Awaiting payment',
    'Pagamento em confirmação': 'Payment being confirmed',
    'Em produção': 'In production',
    'Concluída': 'Finished',
    'Não aprovada': 'Not approved',
    Entregue: 'Delivered',
    Cancelada: 'Cancelled',
    'Aguarda contacto': 'Awaiting contact',
    'Transferência Bancária': 'Bank transfer',
    'Cartão': 'Card',
  };
  for (const [pt, en] of Object.entries(novas)) if (!(pt in EN)) EN[pt] = en;
}

const BASE = '/utilizador/encomendas';
/** As secções do painel das encomendas (EncomendasSidebar), como separadores */
const ABAS: [string, string, string][] = [
  ['encomendas', 'Encomendas', 'fa-file-lines'],
  ['mensagens', 'Mensagens', 'fa-comments'],
  ['pagamentos', 'Pagamentos', 'fa-wallet'],
];

function Encomendas({ aba, encomenda }: { aba: string; encomenda?: string }) {
  const vh = useVH();
  // a mesma leitura que os componentes fazem: a página só aparece quando ela chega (nunca vazia) e dá as mensagens
  // por ler no separador, como a barra lateral do painel das encomendas
  const { dados } = useGet<{ unreadTotal?: number }>('/api/cotacoes');
  // depois de pagar (checkout, /cotacao/…/pagamento), volta-se a este painel e não à /encomendas do site
  useEffect(() => marcarVoltaAoPainel(BASE), []);
  const porLer = dados?.unreadTotal || 0;
  return (
    <>
      <Tabs
        tabs={ABAS.map(([k, l, fa]) => [k, k === 'mensagens' && porLer ? `${vh.t(l)} (${porLer})` : l, fa] as [string, string, string])}
        on={aba}
        onChange={(k) => vh.nav(k === 'encomendas' ? BASE : BASE + '/' + k)}
      />
      <div className="vh-site vh-encomendas">
        {aba === 'encomendas' && <EncomendasListSection />}
        {aba === 'mensagens' && <EncomendasMensagensSection initialQuotationId={encomenda || null} />}
        {aba === 'pagamentos' && <EncomendasPagamentosSection />}
      </div>
    </>
  );
}

export const encomendasPagina: ScreenFn = (vh: VH) => {
  if (vh.s.stack.length)
    return {
      title: 'Encomendas',
      body: (
        <div className="note">
          {vh.t('As encomendas mostradas no painel são as da sua sessão no site. Para ver as de um cliente, use a gestão de encomendas do administrador.')}
        </div>
      ),
    };
  const [sub, encomenda] = vh.s.sub;
  const aba = ABAS.some(([k]) => k === sub) ? sub : 'encomendas';
  return { title: 'Encomendas', body: <Encomendas aba={aba} encomenda={encomenda} /> };
};
