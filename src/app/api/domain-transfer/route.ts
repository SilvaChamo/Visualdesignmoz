import { NextResponse } from 'next/server';
import { requirePanelBootstrapAccess } from '@/lib/panel-api-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

type CheckoutItem = { id?: string; type?: string; name?: string; price?: number; authCode?: string; status?: 'pending' | 'paid' | 'failed' };

/** Lista os pedidos de transferência de domínio do próprio cliente (ou, se admin, todos). */
export async function GET() {
  const auth = await requirePanelBootstrapAccess();
  if ('error' in auth) return auth.error;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ success: false, error: 'Serviço indisponível.' }, { status: 503 });
  }

  let query = supabase.from('domain_transfer_requests').select('*').order('created_at', { ascending: false });
  // as sessões do carrinho leem-se ao mesmo tempo que os pedidos (antes esperavam por eles: duas idas seguidas à base de dados);
  // o administrador filtra-as por dono depois de chegarem
  let sessoesQuery = supabase
    .from('checkout_sessions')
    .select('id, user_id, items, metodo_pagamento, created_at')
    .order('created_at', { ascending: false })
    .limit(1000);
  if (auth.user.role !== 'admin') {
    query = query.eq('user_id', auth.user.id);
    sessoesQuery = sessoesQuery.eq('user_id', auth.user.id);
  }

  const [{ data, error }, { data: sessions }] = await Promise.all([query, sessoesQuery]);
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  // "Pedidos Abertos": custo/pago/tipo de pagamento vêm do item do carrinho
  // que originou o pedido — domain_transfer_requests não guarda preço, só o
  // estado da transferência em si. Junta pelo mesmo dono + domínio, item
  // 'domain' com authCode (é isso que distingue uma transferência de um
  // registo novo no carrinho).
  const userIds = new Set((data || []).map((r) => r.user_id));
  const ordersByKey = new Map<string, { orderId: string; costMt: number; paidMt: number; metodoPagamento: string; status: string }>();
  if (userIds.size > 0) {
    for (const session of sessions || []) {
      if (!userIds.has(session.user_id)) continue;
      const items = (session.items as CheckoutItem[]) || [];
      items.forEach((item, itemIndex) => {
        if (item.type !== 'domain' || !item.authCode) return;
        const domainName = String(item.id || item.name || '').toLowerCase();
        const key = `${session.user_id}:${domainName}`;
        if (ordersByKey.has(key)) return; // sessions já vêm por created_at desc — fica só o mais recente
        ordersByKey.set(key, {
          orderId: `${session.id.slice(0, 8)}-${itemIndex}`,
          costMt: item.price || 0,
          paidMt: item.status === 'paid' ? item.price || 0 : 0,
          metodoPagamento: session.metodo_pagamento,
          status: item.status || 'pending',
        });
      });
    }
  }

  const pedidos = (data || []).map((r) => ({
    ...r,
    order: ordersByKey.get(`${r.user_id}:${r.domain_name.toLowerCase()}`) || null,
  }));

  return NextResponse.json({ success: true, pedidos });
}
