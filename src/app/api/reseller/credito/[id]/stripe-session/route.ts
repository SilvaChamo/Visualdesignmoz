import { NextRequest, NextResponse } from 'next/server';
import { requireAdminResellerOrManager } from '@/lib/panel-api-auth';
import { resolveResellerPanelContext } from '@/lib/panel-reseller-context';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getStripe, isStripeConfigured, mznToUsdCents } from '@/lib/stripe';

// Cria a sessão de Stripe Checkout para um pedido de carregamento já
// registado com método 'stripe' — o saldo só sobe quando o webhook confirmar
// o pagamento (ver /api/webhook/stripe), nunca aqui.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Pagamento por cartão ainda não está configurado.' }, { status: 503 });
  }

  const auth = await requireAdminResellerOrManager();
  if ('error' in auth) return auth.error;

  const ctx = await resolveResellerPanelContext(auth);
  if (!ctx) {
    return NextResponse.json({ error: 'Esta conta não é de revendedor.' }, { status: 403 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 });
  }

  const { id } = await params;

  const { data: pedido, error: pedidoError } = await supabase
    .from('reseller_credit_requests')
    .select('id, da_username, valor_mt, metodo_pagamento, status')
    .eq('id', id)
    .single();
  if (pedidoError || !pedido) {
    return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 });
  }
  if (pedido.da_username !== ctx.mainAccount) {
    return NextResponse.json({ error: 'Não tem permissão para pagar este pedido.' }, { status: 403 });
  }
  if (pedido.metodo_pagamento !== 'stripe') {
    return NextResponse.json({ error: 'Este pedido não é para pagamento por cartão.' }, { status: 409 });
  }
  if (pedido.status !== 'pending') {
    return NextResponse.json({ error: 'Este pedido já foi respondido.' }, { status: 409 });
  }

  try {
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || '';
    const stripe = getStripe();
    const stripeSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: ctx.email || undefined,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: `Carregamento de saldo — ${pedido.da_username}` },
            unit_amount: mznToUsdCents(Number(pedido.valor_mt)),
          },
          quantity: 1,
        },
      ],
      metadata: { kind: 'reseller_credito', credito_id: pedido.id },
      success_url: `${origin}/credito/${pedido.id}?success=1`,
      cancel_url: `${origin}/credito/${pedido.id}`,
    });

    return NextResponse.json({ success: true, url: stripeSession.url });
  } catch (error: unknown) {
    console.error('[reseller/credito stripe-session] error:', error);
    const message = error instanceof Error ? error.message : 'Erro interno';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
