import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { getStripe } from '@/lib/stripe';
import { fulfillCheckout } from '@/lib/checkout-fulfillment';

// Stripe precisa do corpo em bruto para validar a assinatura — nunca fazer request.json() aqui.
export async function POST(request: NextRequest) {
  const signature = request.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    return NextResponse.json({ error: 'Webhook não configurado.' }, { status: 400 });
  }

  const rawBody = await request.text();
  const stripe = getStripe();

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error('[webhook/stripe] assinatura inválida:', err);
    return NextResponse.json({ error: 'Assinatura inválida.' }, { status: 400 });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !supabaseUrl) {
    console.error('[webhook/stripe] Supabase service role não configurado.');
    return NextResponse.json({ error: 'Configuração em falta.' }, { status: 500 });
  }
  const admin = createAdminClient(supabaseUrl, serviceKey);

  if (event.type === 'checkout.session.completed') {
    const stripeSession = event.data.object as { id: string; metadata?: Record<string, string> };
    const checkoutSessionId = stripeSession.metadata?.checkout_session_id;

    const { data: checkoutSession, error } = await admin
      .from('checkout_sessions')
      .select('*')
      .eq(checkoutSessionId ? 'id' : 'stripe_session_id', checkoutSessionId || stripeSession.id)
      .maybeSingle();

    if (error || !checkoutSession) {
      console.error('[webhook/stripe] checkout_session não encontrada:', checkoutSessionId || stripeSession.id);
      return NextResponse.json({ received: true });
    }

    // Idempotência: se já foi cumprida (reentrega do webhook), não repetir.
    if (checkoutSession.status === 'paid') {
      return NextResponse.json({ received: true });
    }

    try {
      await fulfillCheckout(admin, checkoutSession.user_id, checkoutSession.items, 'stripe');
      await admin
        .from('checkout_sessions')
        .update({
          status: 'paid',
          stripe_payment_intent_id:
            (event.data.object as { payment_intent?: string }).payment_intent || null,
          fulfilled_at: new Date().toISOString(),
        })
        .eq('id', checkoutSession.id);
    } catch (fulfillError) {
      console.error('[webhook/stripe] erro ao activar produtos:', fulfillError);
      await admin.from('checkout_sessions').update({ status: 'failed' }).eq('id', checkoutSession.id);
      return NextResponse.json({ error: 'Erro ao activar produtos.' }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true });
}
