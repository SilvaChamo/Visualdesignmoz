'use client';

// Gestão › Compras e encomendas › Encomendas (Silva, 17/10/2026): o painel das encomendas que já existe (/encomendas e
// painel antigo /cliente), enquadrado no painel — as mesmas secções (Encomendas, Mensagens, Pagamentos), os mesmos
// componentes e as mesmas rotas, sem reescrever nada (Silva: "não rescrever de zero… apenas chamar para o painel
// actual"). Só os separadores passam ao modelo do painel; as cores são as do painel (.vh-site). A página /encomendas do
// site continua igual (os clientes só de encomendas ficam lá).
// Aberta a todos os clientes e profissionais com conta no painel (Silva, 21/10/2026: "pode avançar"); quem só tem encomendas
// continua no /encomendas do site, e passa para o painel quando comprar domínio ou hospedagem.
import { useEffect, useState } from 'react';
import { EncomendasListSection } from '@/components/encomendas/EncomendasListSection';
import { CotacaoContent } from '@/components/cotacao/CotacaoContent';
import { CheckoutContent } from '@/components/checkout/CheckoutContent';
import { Suspense } from 'react';
import { EncomendasMensagensSection } from '@/components/encomendas/EncomendasMensagensSection';
import { EncomendasPagamentosSection } from '@/components/encomendas/EncomendasPagamentosSection';
import { marcarVoltaAoPainel } from '@/lib/voltar-ao-painel';
import { useVH, type VH } from '../context';
import { meOf } from '../state';
import type { ScreenFn } from '../screens';
import { DESC, EN, MENU } from '../generated/data';
import { useGet } from '../carga';
import { Tabs } from './componentes';
import { gestaoEncomendasPagina } from './encomendas-admin';
import { ProdutosEmFalta } from '../comuns/ProdutosEmFalta';

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
          t: 'Compras',
          c: 'c2',
          da: '—',
          f: ['Encomendas de produção gráfica, brindes e webdesign', 'Mensagens com a equipa, layouts e anexos', 'Pagamentos e facturas'],
          hx: { s: 'app', cmd: '', n: 'Encomendas do site da VisualDesign' },
        },
      ],
    ]);
  }
  DESC['utilizador/encomendas'] = ['As suas compras e encomendas à VisualDesign: estado, mensagens e pagamento, e os produtos que lhe faltam', 'Your purchases and orders with VisualDesign: status, messages and payment, and the products you are missing'];
  // inglês do painel: só as frases que ainda não estão no dicionário (não muda a tradução de outras páginas)
  const novas: Record<string, string> = {
    'Compras e encomendas': 'Purchases and orders',
    Encomendas: 'Orders',
    'Adicionar produtos em falta': 'Add missing products',
    'Estes são os serviços que ainda não tem na conta — escolha o que quer acrescentar': 'These are the services you do not have on your account yet — choose what to add',
    'Registar domínio': 'Register domain',
    'Registar agora': 'Register now',
    'Hospedagem web': 'Web hosting',
    'Ver planos': 'See plans',
    'Pesquise e registe o seu domínio (.co.mz, .com, .org) para a sua marca.': 'Search and register your domain (.co.mz, .com, .org) for your brand.',
    'Alojamento rápido e seguro para o seu site WordPress, com e-mail incluído.': 'Fast, secure hosting for your WordPress site, with e-mail included.',
    'Contas de e-mail com o seu próprio domínio, webmail e anti-spam.': 'E-mail accounts on your own domain, with webmail and anti-spam.',
    'Design gráfico, web design, brindes e produção audiovisual — peça a sua cotação.': 'Graphic design, web design, gifts and audiovisual production — ask for a quote.',
    'Serviços VisualDesign': 'VisualDesign services',
    'O seu plano de e-mail ainda não tem domínio associado. Registe um domínio novo ou associe um que já tenha, para o e-mail começar a funcionar.': 'Your e-mail plan does not have a domain yet. Register a new domain or link one you already own, so the e-mail can start working.',
    Encomenda: 'Order',
    'Nova encomenda': 'New order',
    'Finalizar encomenda': 'Finish order',
    'Confirme os dados, escolha o pagamento e submeta': 'Confirm the details, choose the payment and submit',
    'Adicionar serviços': 'Add services',
    'Esta conta ainda não tem login no site.': 'This account does not have a login on the site yet.',
    'Não foi possível abrir as encomendas desta conta.': 'Could not open the orders of this account.',
    'Escolha o serviço e veja o resumo da encomenda': 'Choose the service and see the order summary',
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
    Serviços: 'Services',
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
    'Voltar às compras': 'Back to purchases',
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
  ['encomendas', 'Serviços', 'fa-file-lines'],
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
        {aba === 'encomendas' && !vh.s.stack.length && <ProdutosEmFalta onNovaEncomenda={() => vh.nav(BASE + '/nova')} aoComprar={() => marcarVoltaAoPainel(BASE)} />}
        {aba === 'encomendas' && <EncomendasListSection onNova={() => vh.nav(BASE + '/nova')} textoNova={vh.t('Adicionar serviços')} />}
        {aba === 'mensagens' && <EncomendasMensagensSection initialQuotationId={encomenda || null} />}
        {aba === 'pagamentos' && <EncomendasPagamentosSection />}
      </div>
    </>
  );
}

const encomendasPaginaBase: ScreenFn = (vh: VH) => {
  // o administrador não faz encomendas, recebe-as: em Gestão › Encomendas vê as encomendas recebidas (Silva, 23/10/2026)
  if (vh.s.acc[vh.s.login]?.role === 'admin' && !vh.s.stack.length) return gestaoEncomendasPagina(vh);
  const [sub, encomenda] = vh.s.sub;
  // "Nova Encomenda": página própria que substitui toda a página das encomendas (lista, detalhe e resumo), com o botão de voltar (Silva, 23/10/2026)
  // "Finalizar": o checkout da encomenda dentro do painel, sem sair do sítio; ao submeter volta-se à página das encomendas (Silva, 23/10/2026)
  if (sub === 'checkout')
    return {
      title: 'Finalizar encomenda',
      desc: 'Confirme os dados, escolha o pagamento e submeta',
      crumbs: [{ t: 'Compras', path: BASE }, { t: 'Finalizar encomenda' }],
      body: (
        <div className="tw-livre vh-nova-encomenda vh-checkout-painel-wrap">
          <Suspense fallback={null}>
            <CheckoutContent painel={{ voltar: () => vh.nav(BASE), editar: () => vh.nav(BASE + '/nova') }} />
          </Suspense>
        </div>
      ),
    };
  if (sub === 'nova')
    return {
      title: 'Nova encomenda',
      desc: 'Escolha o serviço e veja o resumo da encomenda',
      crumbs: [{ t: 'Compras', path: BASE }, { t: 'Nova encomenda' }],
      body: (
        // a mesma vista que estava na moldura (iframe), com a mesma barra de cima: o título à esquerda e, onde estava o "fechar", o texto simples de voltar
        <div className="tw-livre vh-nova-encomenda">
          <div className="flex items-center justify-between py-2.5 border-b nova-encomenda-barra shrink-0">
            <p className="text-sm font-bold text-gray-900 dark:text-white">Nova Encomenda</p>
            <button
              type="button"
              onClick={() => vh.nav(BASE)}
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 dark:hover:text-zinc-200"
              title={vh.t('Voltar às compras')}
            >
              <i className="fa-solid fa-arrow-left" />
              {vh.t('Voltar às compras')}
            </button>
          </div>
          <Suspense fallback={null}>
            <CotacaoContent painel aoContinuar={() => vh.nav(BASE + '/checkout')} />
          </Suspense>
        </div>
      ),
    };
  const aba = ABAS.some(([k]) => k === sub) ? sub : 'encomendas';
  return { title: 'Compras', body: <Encomendas aba={aba} encomenda={encomenda} /> };
};

/** "Entrar como" uma conta › Encomendas (Silva, 23/10/2026): a mesma página do cliente (lista e nova encomenda), com as encomendas da conta que se está a ver.
 *  Antes de a mostrar, o servidor passa a tratar o administrador como essa conta nas encomendas (/api/vhost/encomendas-como); se a conta ainda não tem
 *  login no site, diz-se aqui. */
function ComoConta({ conta, children }: { conta: string; children: React.ReactNode }) {
  const { t } = useVH();
  const [estado, setEstado] = useState<string>('');
  useEffect(() => {
    let cancelado = false;
    setEstado('');
    fetch('/api/vhost/encomendas-como', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conta }) })
      .then(async (r) => {
        const j = (await r.json().catch(() => ({}))) as { success?: boolean; error?: string };
        if (!cancelado) setEstado(r.ok && j.success ? 'ok' : j.error || 'Não foi possível abrir as encomendas desta conta.');
      })
      .catch(() => !cancelado && setEstado('Não foi possível abrir as encomendas desta conta.'));
    return () => {
      cancelado = true;
    };
  }, [conta]);
  if (estado === 'ok') return <>{children}</>;
  if (!estado) return null;
  return <div className="note">{t(estado)}</div>;
}

export const encomendasPagina: ScreenFn = (vh: VH) => {
  const pagina = encomendasPaginaBase(vh);
  if (!vh.s.stack.length) return pagina;
  return { ...pagina, body: <ComoConta conta={meOf(vh.s)}>{pagina.body}</ComoConta> };
};
