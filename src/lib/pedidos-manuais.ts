import type { SupabaseClient } from '@supabase/supabase-js';
import { PEDIDO_MANUAL_VALIDADE_DIAS } from '@/lib/checkout-referencia';
import { avisarClienteCompra } from '@/lib/notify-checkout-client';

/**
 * Pedidos pagos por M-Pesa/Transferência que ficaram abertos sem nenhum comprovativo durante `PEDIDO_MANUAL_VALIDADE_DIAS`
 * passam a «expirado» e o cliente é avisado. Nada se apaga: o pedido fica na lista de compras e um pedido novo faz-se à parte.
 * Só toca em pedidos sem comprovativo — o que já tem comprovativo espera sempre pela equipa.
 */
export async function expirarPedidosManuais(admin: SupabaseClient): Promise<{ expirados: number; errors: string[] }> {
  const errors: string[] = [];
  const limite = new Date(Date.now() - PEDIDO_MANUAL_VALIDADE_DIAS * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from('checkout_sessions')
    .select('id, user_id, items, total_mt, metodo_pagamento')
    .eq('status', 'pending')
    .neq('metodo_pagamento', 'stripe')
    .is('comprovativo_url', null)
    .lt('created_at', limite)
    .limit(100);
  if (error) return { expirados: 0, errors: [`pedidos manuais: ${error.message}`] };

  let expirados = 0;
  for (const pedido of data || []) {
    const { error: erroAtualizar } = await admin
      .from('checkout_sessions')
      .update({ status: 'expired' })
      .eq('id', pedido.id)
      .eq('status', 'pending')
      .is('comprovativo_url', null);
    if (erroAtualizar) {
      errors.push(`pedido ${pedido.id}: ${erroAtualizar.message}`);
      continue;
    }
    expirados += 1;
    await avisarClienteCompra({
      userId: pedido.user_id as string,
      evento: 'expirado',
      pedido: {
        id: pedido.id as string,
        total_mt: Number(pedido.total_mt) || 0,
        metodo_pagamento: String(pedido.metodo_pagamento || ''),
        items: Array.isArray(pedido.items) ? (pedido.items as Array<{ name?: string }>) : [],
      },
    });
  }
  return { expirados, errors };
}
