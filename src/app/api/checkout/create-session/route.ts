import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getStripe, isStripeConfigured, mznToUsdCents } from '@/lib/stripe';
import { resolveCartItems, type CatalogCartItem } from '@/lib/package-catalog';

export async function POST(request: NextRequest) {
  try {
    if (!isStripeConfigured()) {
      return NextResponse.json(
        { error: 'Pagamento por cartão ainda não está configurado. Tente novamente mais tarde.' },
        { status: 503 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Faça login para concluir a compra.' }, { status: 401 });
    }

    const body = await request.json();
    const items: CatalogCartItem[] = body.items ?? [];

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Carrinho vazio.' }, { status: 400 });
    }

    const { resolved, rejected } = resolveCartItems(items);
    if (rejected.length > 0) {
      return NextResponse.json(
        {
          error: `Não foi possível validar o preço de: ${rejected.map((i) => i.name).join(', ')}. Remova estes itens do carrinho e tente novamente.`,
        },
        { status: 400 },
      );
    }

    const totalMt = resolved.reduce((sum, r) => sum + r.priceMt, 0);

    const { data: session, error: insertError } = await supabase
      .from('checkout_sessions')
      .insert({
        user_id: user.id,
        items: resolved.map((r) => r.item),
        total_mt: totalMt,
        currency: 'usd',
        status: 'pending',
      })
      .select()
      .single();

    if (insertError || !session) {
      console.error('[checkout/create-session] insert error:', insertError);
      return NextResponse.json({ error: 'Não foi possível iniciar o pagamento.' }, { status: 500 });
    }

    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_SITE_URL || '';

    const stripe = getStripe();
    const stripeSession = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: user.email || undefined,
      line_items: resolved.map((r) => ({
        price_data: {
          currency: 'usd',
          product_data: { name: r.item.name },
          unit_amount: mznToUsdCents(r.priceMt),
        },
        quantity: 1,
      })),
      metadata: { checkout_session_id: session.id, user_id: user.id },
      success_url: `${origin}/checkout/sucesso?session_id=${session.id}`,
      cancel_url: `${origin}/checkout`,
    });

    await supabase
      .from('checkout_sessions')
      .update({ stripe_session_id: stripeSession.id })
      .eq('id', session.id);

    return NextResponse.json({ success: true, url: stripeSession.url });
  } catch (error: unknown) {
    console.error('[checkout/create-session] error:', error);
    const message = error instanceof Error ? error.message : 'Erro interno';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
