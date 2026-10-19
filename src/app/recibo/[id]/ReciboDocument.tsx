import { metodoPagamentoLabel } from '@/lib/quotation-payment-info';
import { formatMt } from '@/lib/pricing-catalog';
import {
  CHECKOUT_ITEM_TYPE_LABELS,
  checkoutItemDetail,
  checkoutItemPeriod,
  type CheckoutItemLike,
} from '@/lib/checkout-item-labels';
import {
  DocumentCard,
  DocumentCompanyHeader,
  DocumentElectronicSeal,
  DocumentEmbedFrame,
} from '@/components/documents/VisualDesignDocument';

const DATE_LONG: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'long', year: 'numeric' };

export type ReciboDocumentProps = {
  receiptNumber: string | null;
  issuedAt: string | null;
  cliente: {
    nome: string | null;
    empresa: string | null;
    morada: string | null;
    telefone: string | null;
    email: string | null;
  };
  compra: {
    items: CheckoutItemLike[];
    totalMt: number;
    metodoPagamento: string | null;
    createdAt: string;
    paidAt: string;
  };
};

/**
 * Recibo de uma compra do carrinho — o mesmo documento oficial da Factura
 * das encomendas (/cotacao/[id]?tipo=factura): mesmo cabeçalho, tabela,
 * caixa de pagamento e selo.
 */
export function ReciboDocument({ receiptNumber, issuedAt, cliente, compra }: ReciboDocumentProps) {
  const dataEmissao = new Date(issuedAt || compra.paidAt).toLocaleDateString('pt-PT', DATE_LONG);

  return (
    <DocumentEmbedFrame>
      <DocumentCard embed>
        <DocumentCompanyHeader />

        <div className="flex flex-col sm:flex-row items-start justify-between gap-4 mb-8">
          <div className="text-xs text-zinc-600 leading-relaxed">
            <p className="font-bold text-zinc-800">Cliente: {cliente.empresa || cliente.nome || cliente.email || '—'}</p>
            {cliente.empresa && cliente.nome && <p>Responsável: {cliente.nome}</p>}
            {cliente.morada && <p>Morada: {cliente.morada}</p>}
            {cliente.telefone && <p>Tele: {cliente.telefone}</p>}
            {cliente.email && <p>Email: {cliente.email}</p>}
          </div>
          <div className="sm:text-right shrink-0">
            <h1 className="text-xl font-bold text-black">Recibo Nº {receiptNumber ?? 'a emitir'}</h1>
            <p className="text-xs font-bold text-red-600 mt-1">Pago na Totalidade</p>
            <p className="text-xs text-zinc-500 mt-1">Data de emissão: {dataEmissao}</p>
            <p className="text-xs text-zinc-500">
              Data da compra: {new Date(compra.createdAt).toLocaleDateString('pt-PT', DATE_LONG)}
            </p>
          </div>
        </div>

        {/* Linhas de serviço */}
        <table className="w-full text-sm mb-8">
          <thead>
            <tr className="border-b border-zinc-300 text-left text-xs uppercase tracking-wide text-zinc-500">
              <th className="pb-2 font-bold">Descrição</th>
              <th className="pb-2 font-bold text-right">Período</th>
              <th className="pb-2 font-bold text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {compra.items.map((item, idx) => (
              <tr key={idx} className="border-b border-zinc-100">
                <td className="py-3">
                  <span className="font-semibold text-zinc-800">
                    {(item.type && CHECKOUT_ITEM_TYPE_LABELS[item.type]) || 'Serviço'}
                  </span>
                  <br />
                  <span className="text-zinc-500">{checkoutItemDetail(item)}</span>
                </td>
                <td className="py-3 text-right">{checkoutItemPeriod(item) ?? '—'}</td>
                <td className="py-3 text-right font-bold">{item.price != null ? `${formatMt(item.price)} MT` : '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} className="pt-2 text-right font-bold text-zinc-900 border-t border-zinc-200">Total pago</td>
              <td className="pt-2 text-right font-bold text-zinc-900 border-t border-zinc-200">{formatMt(compra.totalMt)} MT</td>
            </tr>
          </tfoot>
        </table>

        {/* Pagamento — o que foi efectivamente pago e confirmado. */}
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-sm">
          <p className="font-bold text-zinc-800 mb-2">Pagamento confirmado</p>
          <p className="text-zinc-700">
            {formatMt(compra.totalMt)} MT
            {` — ${metodoPagamentoLabel(compra.metodoPagamento)}`}
            {' — confirmado em '}{new Date(compra.paidAt).toLocaleDateString('pt-PT')}
          </p>
          <p className="text-xs font-bold text-green-700 mt-2">Compra paga na totalidade.</p>
        </div>

        <DocumentElectronicSeal />
      </DocumentCard>
    </DocumentEmbedFrame>
  );
}
