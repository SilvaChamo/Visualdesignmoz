import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getStripe, isStripeConfigured } from '@/lib/stripe';
import type Stripe from 'stripe';

export async function POST(request: NextRequest) {
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Pagamento por cartão ainda não está configurado.' }, { status: 503 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const { setup_intent_id } = await request.json();
  if (!setup_intent_id) {
    return NextResponse.json({ error: 'setup_intent_id em falta' }, { status: 400 });
  }

  const stripe = getStripe();
  const setupIntent = await stripe.setupIntents.retrieve(setup_intent_id, {
    expand: ['payment_method'],
  });

  if (setupIntent.status !== 'succeeded') {
    return NextResponse.json({ error: 'O cartão não foi confirmado pela Stripe.' }, { status: 400 });
  }

  const paymentMethod = setupIntent.payment_method as Stripe.PaymentMethod;
  const customerId =
    typeof setupIntent.customer === 'string' ? setupIntent.customer : setupIntent.customer?.id;

  if (!paymentMethod?.id || !customerId) {
    return NextResponse.json({ error: 'Resposta inesperada da Stripe.' }, { status: 502 });
  }

  const card = paymentMethod.card;

  // Se for o primeiro método do utilizador, fica como principal automaticamente.
  const { count: existingCount } = await supabase
    .from('user_payment_methods')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('is_active', true);

  const { data, error } = await supabase
    .from('user_payment_methods')
    .insert({
      user_id: user.id,
      type: 'cartao',
      provider: card?.brand ? card.brand.toUpperCase() : 'Cartão',
      account_number: card ? `**** ${card.last4}` : '****',
      account_name: paymentMethod.billing_details?.name || user.email?.split('@')[0] || 'Cartão',
      is_default: !existingCount,
      is_active: true,
      metadata: {
        stripe_customer_id: customerId,
        stripe_payment_method_id: paymentMethod.id,
      },
    })
    .select()
    .single();

  if (error) {
    console.error('[payments/confirm-card] erro ao gravar método:', error);
    return NextResponse.json({ error: 'Não foi possível guardar o cartão.' }, { status: 500 });
  }

  return NextResponse.json({ success: true, method: data });
}
