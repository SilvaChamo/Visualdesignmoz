import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { metodoPagamentoLabel } from '@/lib/quotation-payment-info';
import { PrintButton } from './PrintButton';

function formatMt(value: number) {
  return `${Math.round(value).toLocaleString('pt-PT')} MT`;
}

export default async function ReciboPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?redirect=/recibo/${id}`);
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    return <p className="p-8 text-sm text-red-600">Serviço indisponível.</p>;
  }

  const { data: session } = await admin
    .from('checkout_sessions')
    .select('id, user_id, items, total_mt, metodo_pagamento, status, created_at')
    .eq('id', id)
    .maybeSingle();

  if (!session || session.user_id !== user.id) {
    return <p className="p-8 text-sm text-red-600">Recibo não encontrado.</p>;
  }
  if (session.status !== 'paid') {
    return <p className="p-8 text-sm text-amber-700">Este pedido ainda não tem recibo — o pagamento não está confirmado.</p>;
  }

  const items = (session.items as Array<{ name?: string; price?: number; type?: string }>) || [];
  const paidAt = new Date(session.created_at).toLocaleDateString('pt-PT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="mx-auto max-w-2xl bg-white p-8 text-gray-900">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">VisualDesign</p>
          <h1 className="mt-1 text-2xl font-bold">Recibo</h1>
          <p className="mt-1 text-xs text-gray-500">N.º {session.id.slice(0, 8).toUpperCase()}</p>
        </div>
        <PrintButton />
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 text-sm">
        <div>
          <p className="text-xs font-bold uppercase text-gray-400">Data</p>
          <p className="font-medium">{paidAt}</p>
        </div>
        <div>
          <p className="text-xs font-bold uppercase text-gray-400">Pagamento</p>
          <p className="font-medium">{metodoPagamentoLabel(session.metodo_pagamento)}</p>
        </div>
      </div>

      <table className="mb-6 w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs font-bold uppercase text-gray-400">
            <th className="py-2">Descrição</th>
            <th className="py-2 text-right">Valor</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={idx} className="border-b border-gray-100">
              <td className="py-2">{item.name || item.type || '—'}</td>
              <td className="py-2 text-right">{item.price != null ? formatMt(item.price) : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="text-right text-lg font-bold">Total: {formatMt(session.total_mt || 0)}</p>
      <p className="mt-8 text-xs text-gray-400">Pagamento confirmado. Este recibo comprova a compra no site VisualDesign.</p>
    </div>
  );
}
