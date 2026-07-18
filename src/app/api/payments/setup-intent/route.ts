import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getStripe, isStripeConfigured } from '@/lib/stripe';

/**
 * Inicia o fluxo de "guardar cartão" (Stripe SetupIntent) para pagamentos futuros
 * (renovações). O cartão nunca passa pelo nosso servidor — só o formulário da
 * Stripe (Elements) o vê; nós só recebemos de volta os IDs (customer/payment_method).
 */
export async function POST() {
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

  const stripe = getStripe();

  // Reutiliza um customer Stripe já associado a este utilizador, se existir.
  const { data: existingMethods } = await supabase
    .from('user_payment_methods')
    .select('metadata')
    .eq('user_id', user.id)
    .eq('type', 'cartao');

  let customerId = existingMethods?.find((m) => m.metadata?.stripe_customer_id)?.metadata
    ?.stripe_customer_id as string | undefined;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email || undefined,
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;
  }

  const setupIntent = await stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ['card'],
  });

  return NextResponse.json({
    success: true,
    clientSecret: setupIntent.client_secret,
  });
}
