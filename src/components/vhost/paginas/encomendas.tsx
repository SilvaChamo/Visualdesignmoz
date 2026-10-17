'use client';

// Gestão › Compras e encomendas › Encomendas (Silva, 17/10/2026: "nós precisamos isso tudo aqui"): as encomendas à
// VisualDesign (produção gráfica, brindes, webdesign…) que estavam no painel antigo (/cliente) e na página /encomendas
// do site, agora dentro do painel. Os mesmos dados e as mesmas rotas (/api/cotacoes); a lista e o detalhe são do painel,
// a conversa com a equipa, o histórico e o formulário de edição são os componentes do site com as cores do painel
// (.vh-site). A página /encomendas do site continua igual (os clientes só de encomendas ficam lá).
// Por agora só a sessão de administrador vê esta página (soAdminPorAgora): o Silva experimenta antes de abrir aos clientes.
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase-client';
import { formatMt } from '@/lib/pricing-catalog';
import { statusMeta } from '@/lib/quotation-status-labels';
import { groupIntoBatches, batchNumero, type BatchItem, type QuotationBatch } from '@/lib/quotation-batch';
import { encomendaPaymentSplit } from '@/lib/encomenda-checkout';
import { MPESA_NUMBER, EMOLA_NUMBER, BANK_NAME, BANK_ACCOUNT, BANK_NIB, metodoPagamentoLabel } from '@/lib/quotation-payment-info';
import { QuotationMessagesThread } from '@/components/quotations/QuotationMessagesThread';
import { QuotationHistoryTimeline } from '@/components/quotations/QuotationHistoryTimeline';
import { EncomendaEditForm } from '@/components/quotations/EncomendaEditForm';
import { useVH, type VH } from '../context';
import type { ScreenFn } from '../screens';
import { DESC, EN, MENU } from '../generated/data';
import { soAdminPorAgora } from '../state';
import { EsperaPagina, esquecerMemoria, useGet } from '../carga';
import { DataTable, Tabs } from './componentes';
import { Carregando } from './avancado';
import { Confirmar } from './pacotes';

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
          f: ['Encomendas de produção gráfica, brindes e webdesign', 'Mensagens com a equipa, layouts e facturas', 'Pagamento e levantamento'],
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

type Encomenda = BatchItem & {
  categoria_label: string;
  produto: string;
  quantidade: number;
  metodo_pagamento?: string | null;
  remanescente_metodo_pagamento?: string | null;
};
type Lote = QuotationBatch<Encomenda>;
type Lista = { quotations: Encomenda[]; unreadByBatch?: Record<string, number> };
/** Linha completa de quotation_requests (o detalhe precisa de mais campos do que a lista) */
type Linha = Encomenda & {
  preco_unitario_mt: number;
  notas: string | null;
  data_limite_entrega: string;
  cancellation_reason: string | null;
  rejection_reason: string | null;
};

const URL_LISTA = '/api/cotacoes';
const URL_NUMEROS = '/api/cotacoes/numeros';
const BASE = '/utilizador/encomendas';

const FILTROS: [string, string, string, (b: Lote) => boolean][] = [
  ['todas', 'Todas', 'fa-list', () => true],
  ['por-pagar', 'Por pagar', 'fa-credit-card', (b) => (b.status === 'pending' && !b.sobConsulta) || b.status === 'delivered'],
  ['em-curso', 'Em curso', 'fa-gears', (b) => b.status === 'payment_selected' || b.status === 'approved' || (b.status === 'pending' && b.sobConsulta)],
  ['entregues', 'Entregues', 'fa-circle-check', (b) => b.status === 'done'],
  ['canceladas', 'Canceladas', 'fa-ban', (b) => b.status === 'cancelled' || b.status === 'rejected'],
];

/** Etiqueta do painel para cada estado: amarelo quando falta o cliente fazer alguma coisa (pagar) */
const TAG: Record<string, string> = { pending: 'w', delivered: 'w', payment_selected: '', approved: '', done: 'ok', rejected: 'bad', cancelled: 'off' };
const etiqueta = (status: string, sobConsulta = false) => 'tag ' + (status === 'pending' && sobConsulta ? '' : TAG[status] ?? '');

const dataPt = (iso: string) => {
  const t = Date.parse(iso);
  return isNaN(t) ? '—' : new Date(t).toLocaleDateString('pt-PT');
};
const numeroDe = (numeros: Record<string, string> | null, batchId: string) => numeros?.[batchId] || (numeros ? batchNumero(batchId) : '···');
const resumoDe = (b: Lote) => (b.items.length === 1 ? `${b.primaryItem.categoria_label} — ${b.primaryItem.produto}` : `${b.items.length} serviços`);
const podeCancelar = (b: Lote) => b.status === 'pending' || b.status === 'payment_selected';
const podeApagar = (b: Lote) => b.status === 'done' || b.status === 'cancelled' || b.status === 'rejected';

/** A lista e os números das encomendas, lidos juntos (a página só aparece quando os dois chegaram) */
function useEncomendas() {
  const lista = useGet<Lista>(URL_LISTA);
  const numeros = useGet<{ numeros: Record<string, string> }>(URL_NUMEROS);
  const lotes = useMemo(() => (lista.dados ? groupIntoBatches(lista.dados.quotations || []) : null), [lista.dados]);
  const recarregar = useCallback(() => {
    esquecerMemoria(URL_LISTA);
    void lista.ler(true);
  }, [lista]);
  return { lista, numeros: numeros.dados?.numeros ?? null, lotes, recarregar };
}

/** Quando o administrador está dentro da conta de outra pessoa: as encomendas são as da sessão do site, não as dela */
function NaContaDeOutro() {
  const { t } = useVH();
  return (
    <div className="note">
      {t('As encomendas mostradas no painel são as da sua sessão no site. Para ver as de um cliente, use a gestão de encomendas do administrador.')}
    </div>
  );
}

// ---------- Lista ----------
function ListaEncomendas({ filtro }: { filtro: string }) {
  const vh = useVH();
  const { t } = vh;
  const { lista, numeros, lotes, recarregar } = useEncomendas();
  if (!lista.dados || !lotes) return <Carregando erro={lista.erro} ler={lista.ler} />;
  const [, , , passa] = FILTROS.find(([k]) => k === filtro) || FILTROS[0];
  const linhas = lotes.filter(passa);
  const porLer = lista.dados.unreadByBatch || {};
  const escolhidos = (k: string[]) => lotes.filter((b) => k.includes(b.batchId));

  const cancelar = (bs: Lote[]) => vh.openM(<CancelarModal lotes={bs} numeros={numeros} onFeito={recarregar} />);
  const apagar = (bs: Lote[]) =>
    vh.openM(
      <Confirmar
        titulo="Apagar encomendas?"
        texto={t('Vai apagar') + ' ' + bs.map((b) => 'Nº ' + numeroDe(numeros, b.batchId)).join(', ') + '. ' + t('Não se pode desfazer.')}
        ok="Apagar"
        onOk={async () => {
          let falhou = '';
          for (const b of bs) {
            const r = await fetch(`/api/cotacoes/${b.primaryItem.id}`, { method: 'DELETE' }).catch(() => null);
            const j = r ? await r.json().catch(() => ({})) : {};
            if (!r?.ok || !j.success) falhou = j.error || 'Não foi possível apagar a encomenda.';
          }
          vh.toast(falhou || 'Encomendas apagadas');
          recarregar();
        }}
      />,
    );

  return (
    <>
      <Tabs
        tabs={FILTROS.map(([k, l, fa]) => [k, l, fa] as [string, string, string])}
        on={filtro}
        onChange={(k) => vh.nav(k === 'todas' ? BASE : BASE + '/' + k)}
      />
      <DataTable
        id={'encomendas-' + filtro}
        umaLinha
        barraFora
        empilhar="tablet"
        comSelecao
        rows={linhas}
        rowKey={(b) => b.batchId}
        search={(b) => ['Nº ' + numeroDe(numeros, b.batchId), resumoDe(b), statusMeta(b.status, b.sobConsulta).label].join(' ')}
        onRecarregar={recarregar}
        empty={lotes.length ? 'Não há encomendas neste separador' : 'Ainda não tem encomendas'}
        cols={[
          {
            k: 'n',
            t: 'Encomenda',
            sort: (b) => b.createdAt,
            cell: (b) => (
              <button type="button" className="enc-linha" onClick={() => vh.nav(BASE + '/ver/' + b.primaryItem.id)} title={t('Abrir')}>
                <b>Nº {numeroDe(numeros, b.batchId)}</b>
                <span>{resumoDe(b)}</span>
              </button>
            ),
          },
          { k: 't', t: 'Total', right: true, sort: (b) => b.totalMt, cell: (b) => (b.sobConsulta ? t('Sob consulta') : formatMt(b.totalMt) + ' MT') },
          { k: 'e', t: 'Estado', sort: (b) => b.status, cell: (b) => <span className={etiqueta(b.status, b.sobConsulta)}>{t(statusMeta(b.status, b.sobConsulta).label)}</span> },
          {
            k: 'm',
            t: 'Mensagens',
            ate: 1300,
            sort: (b) => porLer[b.batchId] || 0,
            cell: (b) => (porLer[b.batchId] ? <span className="tag w">{porLer[b.batchId]} {t('por ler')}</span> : <span className="enc-nada">—</span>),
          },
          { k: 'd', t: 'Data', ate: 1600, sort: (b) => b.createdAt, cell: (b) => dataPt(b.createdAt) },
        ]}
        actions={(b) => (
          <button className="btn g sm" onClick={() => vh.nav(BASE + '/ver/' + b.primaryItem.id)}>
            <i className="fa-solid fa-folder-open" />
            {t('Abrir')}
          </button>
        )}
        bulk={[
          { t: 'Cancelar encomendas', fa: 'fa-xmark', run: (k) => {
            const bs = escolhidos(k).filter(podeCancelar);
            if (!bs.length) return vh.toast('Só se cancelam encomendas que ainda aguardam pagamento ou confirmação');
            cancelar(bs);
          } },
          { t: 'Apagar encomendas', fa: 'fa-trash', run: (k) => {
            const bs = escolhidos(k).filter(podeApagar);
            if (!bs.length) return vh.toast('Só se apagam encomendas entregues, canceladas ou não aprovadas');
            apagar(bs);
          } },
        ]}
      />
    </>
  );
}

/** Cancelar uma ou mais encomendas, com o motivo (opcional) — no lugar do confirm/prompt do navegador do painel antigo */
function CancelarModal({ lotes, numeros, onFeito }: { lotes: Lote[]; numeros: Record<string, string> | null; onFeito: () => void }) {
  const { t, closeM, toast } = useVH();
  const [motivo, setMotivo] = useState('');
  const [aEnviar, setAEnviar] = useState(false);
  const enviar = async () => {
    setAEnviar(true);
    let falhou = '';
    for (const b of lotes) {
      const r = await fetch(`/api/cotacoes/${b.primaryItem.id}/cancelar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ motivo }),
      }).catch(() => null);
      const j = r ? await r.json().catch(() => ({})) : {};
      if (!r?.ok || !j.success) falhou = j.error || 'Não foi possível cancelar a encomenda.';
    }
    setAEnviar(false);
    closeM();
    toast(falhou || 'Encomenda cancelada');
    onFeito();
  };
  return (
    <>
      <h3>{t(lotes.length === 1 ? 'Cancelar encomenda' : 'Cancelar encomendas')}</h3>
      <p style={{ lineHeight: 1.5 }}>{lotes.map((b) => 'Nº ' + numeroDe(numeros, b.batchId)).join(', ')}</p>
      <label className="enc-campo">
        <span>{t('Motivo do cancelamento (opcional)')}</span>
        <textarea rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </label>
      <div className="mfoot">
        <button className="btn g" onClick={closeM} disabled={aEnviar}>
          {t('Voltar')}
        </button>
        <button className="btn r" onClick={enviar} disabled={aEnviar}>
          {t(lotes.length === 1 ? 'Cancelar encomenda' : 'Cancelar encomendas')}
        </button>
      </div>
    </>
  );
}

// ---------- Detalhe de uma encomenda ----------
const ABAS: [string, string, string][] = [
  ['detalhes', 'Detalhes', 'fa-list-check'],
  ['mensagens', 'Mensagens', 'fa-comments'],
  ['pagamento', 'Pagamento', 'fa-credit-card'],
  ['historico', 'Histórico', 'fa-clock-rotate-left'],
  ['cotacao', 'Cotação', 'fa-file-lines'],
  ['facturas', 'Facturas', 'fa-file-invoice'],
];

/** As linhas completas do lote (com motivos, preço unitário e notas), lidas como no painel antigo: direto do Supabase
 *  com a sessão do cliente. Até chegarem, a página espera (nunca aparece vazia). */
function useLinhas(id: string, versao: number) {
  const espera = useContext(EsperaPagina);
  const [linhas, setLinhas] = useState<Linha[] | null>(null);
  useEffect(() => {
    let fim = false;
    const acabou = espera?.comecar();
    (async () => {
      const { data: row } = await supabase.from('quotation_requests').select('*').eq('id', id).maybeSingle();
      if (!row) return !fim && setLinhas([]);
      const { data: irmas } = await supabase.from('quotation_requests').select('*').eq('batch_id', row.batch_id).order('created_at', { ascending: true });
      if (!fim) setLinhas(((irmas && irmas.length ? irmas : [row]) as Linha[]));
    })()
      .catch(() => !fim && setLinhas([]))
      .finally(() => acabou?.());
    return () => {
      fim = true;
    };
  }, [id, versao, espera]);
  return linhas;
}

function VerEncomenda({ id, aba }: { id: string; aba: string }) {
  const vh = useVH();
  const { t } = vh;
  const { lista, numeros, lotes, recarregar } = useEncomendas();
  const [versao, setVersao] = useState(0);
  const linhas = useLinhas(id, versao);
  const lote = lotes?.find((b) => b.items.some((i) => i.id === id));
  const mudou = useCallback(() => {
    setVersao((v) => v + 1);
    recarregar();
  }, [recarregar]);
  if (!lista.dados || !lotes || !linhas) return <Carregando erro={lista.erro} ler={lista.ler} />;
  if (!lote || !linhas.length) {
    return (
      <div className="imp">
        <i className="fa-solid fa-triangle-exclamation" />
        <div>{t('Encomenda não encontrada')}</div>
        <button className="btn g sm" onClick={() => vh.nav(BASE)}>
          {t('Voltar às encomendas')}
        </button>
      </div>
    );
  }
  const rejeicao = linhas.find((l) => l.rejection_reason)?.rejection_reason;
  const cancelamento = linhas.find((l) => l.cancellation_reason)?.cancellation_reason;
  const caminho = (k: string) => BASE + '/ver/' + id + (k === 'detalhes' ? '' : '/' + k);
  return (
    <>
      <Tabs tabs={ABAS} on={aba} onChange={(k) => vh.nav(caminho(k))} />
      {(rejeicao || cancelamento || lote.status === 'delivered') && (
        <div className="note enc-aviso">
          {lote.status === 'delivered' && <p>{t('Todos os serviços desta encomenda estão concluídos. Para a levantar, falta pagar o remanescente.')}</p>}
          {rejeicao && (
            <p>
              <b>{t('Motivo da rejeição')}:</b> {rejeicao}
            </p>
          )}
          {cancelamento && (
            <p>
              <b>{t('Motivo do cancelamento')}:</b> {cancelamento}
            </p>
          )}
        </div>
      )}
      {aba === 'detalhes' && <Detalhes linhas={linhas} onMudou={mudou} />}
      {aba === 'mensagens' && (
        <div className="vh-site enc-conversa">
          <QuotationMessagesThread quotationId={lote.primaryItem.id} viewerRole="client" onSent={recarregar} />
        </div>
      )}
      {aba === 'pagamento' && <Pagamento lote={lote} numero={numeroDe(numeros, lote.batchId)} />}
      {aba === 'historico' && (
        <div className="vh-site enc-historico">
          <QuotationHistoryTimeline quotationId={lote.primaryItem.id} />
        </div>
      )}
      {aba === 'cotacao' && <iframe key={id} className="enc-doc enc-doc-alto" src={`/cotacao/${lote.primaryItem.id}?embed=1&payment=1`} title={t('Cotação')} />}
      {aba === 'facturas' && <Facturas lote={lote} />}
    </>
  );
}

function Detalhes({ linhas, onMudou }: { linhas: Linha[]; onMudou: () => void }) {
  const vh = useVH();
  const { t } = vh;
  const editar = (l: Linha) =>
    vh.openM(
      <div className="vh-site enc-editar">
        <h3>{t('Editar o serviço')}</h3>
        <EncomendaEditForm
          quotation={l}
          onCancel={vh.closeM}
          onSaved={() => {
            vh.closeM();
            onMudou();
          }}
        />
      </div>,
    );
  return (
    <DataTable
      id="encomenda-servicos"
      umaLinha
      barraFora
      empilhar="tablet"
      rows={linhas}
      rowKey={(l) => l.id}
      porPagina={50}
      cols={[
        {
          k: 's',
          t: 'Serviço',
          cell: (l) => (
            <div className="enc-linha">
              <b>{l.categoria_label}</b>
              <span>{l.produto}</span>
              {l.notas && <span>{l.notas}</span>}
            </div>
          ),
        },
        { k: 'q', t: 'Quantidade', right: true, cell: (l) => l.quantidade },
        { k: 't', t: 'Total', right: true, cell: (l) => (l.sob_consulta ? t('Sob consulta') : formatMt(l.total_mt) + ' MT') },
        { k: 'e', t: 'Estado', cell: (l) => <span className={etiqueta(l.status, l.sob_consulta)}>{t(statusMeta(l.status, l.sob_consulta).label)}</span> },
        { k: 'd', t: 'Entrega até', ate: 1300, cell: (l) => (l.data_limite_entrega ? dataPt(l.data_limite_entrega) : '—') },
      ]}
      actions={(l) =>
        l.status === 'pending' ? (
          <button className="btn g sm" onClick={() => editar(l)}>
            <i className="fa-solid fa-pen" />
            {t('Editar')}
          </button>
        ) : null
      }
    />
  );
}

function Instrucoes({ metodo }: { metodo: string }) {
  const { t } = useVH();
  if (metodo === 'mpesa' || metodo === 'emola')
    return (
      <p>
        {t('Envie o valor para')} <b>{metodo === 'mpesa' ? MPESA_NUMBER : EMOLA_NUMBER}</b>
      </p>
    );
  if (metodo === 'transferencia')
    return (
      <p>
        {BANK_NAME} · {t('Conta')} <b>{BANK_ACCOUNT}</b> · NIB <b>{BANK_NIB}</b>
      </p>
    );
  return null;
}

function Pagamento({ lote, numero }: { lote: Lote; numero: string }) {
  const { t } = useVH();
  const anchor = lote.primaryItem;
  const split = encomendaPaymentSplit(lote.totalMt);
  const metodo = lote.items.find((i) => i.metodo_pagamento)?.metodo_pagamento || '';
  const metodoRem = lote.items.find((i) => i.remanescente_metodo_pagamento)?.remanescente_metodo_pagamento || '';
  const pagar = `/cotacao/${anchor.id}/pagamento`;
  const remanescente = lote.status === 'delivered';
  const facturaPronta = ['approved', 'delivered', 'done'].includes(lote.status);
  return (
    <div className="enc-pag">
      {lote.sobConsulta ? (
        <p className="enc-nota">{t('Esta encomenda é sob consulta: a equipa contacta-o com o preço antes de haver alguma coisa a pagar.')}</p>
      ) : (
        <dl className="enc-valores">
          <dt>{t('Encomenda')}</dt>
          <dd>Nº {numero}</dd>
          <dt>{t('Total com IVA')}</dt>
          <dd>{formatMt(split.totalComIvaMt)} MT</dd>
          <dt>{t('Adiantamento (70%)')}</dt>
          <dd>{formatMt(split.adiantamentoMt)} MT</dd>
          <dt>{t('Remanescente (30%)')}</dt>
          <dd>{formatMt(split.remanescenteMt)} MT</dd>
          {(remanescente ? metodoRem : metodo) && (
            <>
              <dt>{t('Método escolhido')}</dt>
              <dd>
                {t(metodoPagamentoLabel(remanescente ? metodoRem : metodo))}
                <Instrucoes metodo={remanescente ? metodoRem : metodo} />
              </dd>
            </>
          )}
        </dl>
      )}
      {lote.status === 'payment_selected' && <p className="enc-nota">{t('A equipa confirma o pagamento à mão assim que o valor for recebido.')}</p>}
      <div className="enc-botoes">
        {lote.status === 'pending' && !lote.sobConsulta && (
          <a className="btn r" href={pagar}>
            <i className="fa-solid fa-credit-card" />
            {t(metodo ? 'Continuar para pagamento' : 'Escolher método de pagamento')}
          </a>
        )}
        {remanescente && !metodoRem && (
          <a className="btn r" href={pagar}>
            <i className="fa-solid fa-credit-card" />
            {t('Pagar remanescente')}
          </a>
        )}
        {facturaPronta && (
          <button
            className="btn g"
            onClick={() => window.open(`/cotacao/${anchor.id}?embed=1&tipo=factura`, 'factura-' + anchor.id, 'width=900,height=1000,resizable=yes,scrollbars=yes')}
          >
            <i className="fa-solid fa-file-invoice" />
            {t('Ver factura')}
          </button>
        )}
      </div>
    </div>
  );
}

/** Documento do site (factura) num iframe que cresce com o conteúdo — mesmo princípio do painel antigo */
function Documento({ src, titulo }: { src: string; titulo: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [altura, setAltura] = useState(420);
  const carregou = useCallback(() => {
    try {
      const doc = ref.current?.contentWindow?.document;
      if (!doc) return;
      const medir = () => setAltura(Math.max(200, doc.body.scrollHeight));
      medir();
      new ResizeObserver(medir).observe(doc.body);
    } catch {
      /* outra origem: fica com a altura por omissão */
    }
  }, []);
  return <iframe ref={ref} src={src} title={titulo} onLoad={carregou} className="enc-doc" style={{ height: altura }} />;
}

function Facturas({ lote }: { lote: Lote }) {
  const { t } = useVH();
  const id = lote.primaryItem.id;
  const adiantamentoPago = ['approved', 'delivered', 'done'].includes(lote.status);
  return (
    <div className="enc-facturas">
      <h4>{t('Factura do adiantamento')}</h4>
      {adiantamentoPago ? (
        <Documento key={id + '-a'} src={`/cotacao/${id}?embed=1&tipo=factura&fase=adiantamento`} titulo={t('Factura do adiantamento')} />
      ) : (
        <p className="enc-nota">{t('Fica disponível aqui assim que a equipa confirmar o pagamento do adiantamento.')}</p>
      )}
      {lote.status === 'done' && (
        <>
          <h4>{t('Factura do remanescente')}</h4>
          <Documento key={id + '-r'} src={`/cotacao/${id}?embed=1&tipo=factura&fase=remanescente`} titulo={t('Factura do remanescente')} />
        </>
      )}
    </div>
  );
}

// ---------- Nova encomenda: o formulário do site (/cotacao), como no painel antigo ----------
function NovaEncomenda() {
  const { t } = useVH();
  return <iframe className="enc-doc enc-doc-alto" src="/cotacao?panel=1&embed=1" title={t('Nova encomenda')} />;
}

// ---------- Rota ----------
export const encomendasPagina: ScreenFn = (vh: VH) => {
  const [sub, id, aba] = vh.s.sub;
  const base = { t: 'Encomendas', path: BASE };
  const nova = (
    <button className="btn r" onClick={() => vh.nav(BASE + '/nova')}>
      <i className="fa-solid fa-plus" />
      {vh.t('Nova encomenda')}
    </button>
  );
  if (vh.s.stack.length) return { title: 'Encomendas', body: <NaContaDeOutro /> };
  if (sub === 'nova') return { title: 'Nova encomenda', crumbs: [base, { t: 'Nova encomenda' }], body: <NovaEncomenda /> };
  if (sub === 'ver' && id) {
    const k = ABAS.some(([a]) => a === aba) ? aba : 'detalhes';
    return { title: 'Encomenda', crumbs: [base, { t: 'Encomenda' }], descEl: <ResumoEncomenda id={id} />, body: <VerEncomenda key={id} id={id} aba={k} /> };
  }
  const filtro = FILTROS.some(([k]) => k === sub) ? sub : 'todas';
  return { title: 'Encomendas', actions: nova, descEl: <ResumoLista />, body: <ListaEncomendas filtro={filtro} /> };
};

/** Descrição da lista na barra de cima: "N encomendas | X por pagar" */
function ResumoLista() {
  const { t } = useVH();
  const { lotes } = useEncomendas();
  if (!lotes) return <>{t('As suas encomendas à VisualDesign: estado, mensagens e pagamento')}</>;
  const porPagar = lotes.filter(FILTROS[1][3]).length;
  return (
    <>
      {lotes.length} {t(lotes.length === 1 ? 'encomenda' : 'encomendas')}
      {porPagar ? ` | ${porPagar} ${t('por pagar')}` : ''}
    </>
  );
}

/** Descrição do detalhe: "Nº 252026D001 · Aguarda pagamento · 12 300 MT" */
function ResumoEncomenda({ id }: { id: string }) {
  const { t } = useVH();
  const { lotes, numeros } = useEncomendas();
  const b = lotes?.find((x) => x.items.some((i) => i.id === id));
  if (!b) return null;
  return (
    <>
      Nº {numeroDe(numeros, b.batchId)} · {t(statusMeta(b.status, b.sobConsulta).label)} · {b.sobConsulta ? t('Sob consulta') : formatMt(b.totalMt) + ' MT'}
    </>
  );
}
