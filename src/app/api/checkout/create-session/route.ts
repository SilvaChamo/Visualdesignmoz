import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getStripe, isStripeConfigured, mznToUsdCents } from '@/lib/stripe';
import { resolveCartItems, toValidatedCartItems, type CatalogCartItem } from '@/lib/package-catalog';
import { isProfileWhoisComplete } from '@/lib/profile-db';
import { promoteGuestToProfissional } from '@/lib/checkout-fulfillment';
import { resolveCheckoutActor } from '@/lib/checkout-actor';

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

    const { resolved, rejected } = await resolveCartItems(items);
    if (rejected.length > 0) {
      return NextResponse.json(
        {
          error: `Não foi possível validar o preço de: ${rejected.map((i) => i.name).join(', ')}. Remova estes itens do carrinho e tente novamente.`,
        },
        { status: 400 },
      );
    }

    const totalMt = resolved.reduce((sum, r) => sum + r.priceMt, 0);

    // #26: a conversão MT->USD usada para cobrar é uma taxa própria, separada
    // da que forma os preços de venda a partir do custo da Dynadot -- por
    // construção não deviam poder divergir, mas isto é a rede de segurança:
    // nunca cobrar em dólar menos do que o custo real dos domínios no carrinho.
    const minCostUsd = resolved.reduce((sum, r) => sum + (r.costUsd || 0), 0);
    const chargeUsd = resolved.reduce((sum, r) => sum + mznToUsdCents(r.priceMt) / 100, 0);
    if (minCostUsd > 0 && chargeUsd < minCostUsd) {
      console.error('[checkout/create-session] cobrança em USD abaixo do custo:', { chargeUsd, minCostUsd, totalMt });
      return NextResponse.json(
        { error: 'Não foi possível calcular o pagamento em dólares para este carrinho. Tente pagar em Meticais ou contacte o suporte.' },
        { status: 400 },
      );
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      console.error('[checkout/create-session] Supabase service role não configurado.');
      return NextResponse.json({ error: 'Pagamento por cartão ainda não está configurado. Tente novamente mais tarde.' }, { status: 503 });
    }

    // Se um admin estiver a "entrar como" um revendedor/cliente, a compra
    // corre como a conta impersonada (dono do domínio, WHOIS, faturação).
    const actor = await resolveCheckoutActor(admin, user);

    const hasDomain = resolved.some((r) => r.item.type === 'domain');
    if (hasDomain && !(await isProfileWhoisComplete(admin, actor.buyerUserId))) {
      return NextResponse.json(
        {
          error: actor.impersonating
            ? `A conta ${actor.impersonatedLabel} ainda não tem telefone, morada e cidade preenchidos — são os dados usados no registo oficial do domínio. Complete o perfil dessa conta antes de comprar.`
            : 'Antes de comprar um domínio precisa de completar o telefone, morada e cidade em "A Minha Conta" — são os dados usados no registo oficial do domínio.',
        },
        { status: 400 },
      );
    }

    const { data: session, error: insertError } = await admin
      .from('checkout_sessions')
      .insert({
        user_id: actor.buyerUserId,
        items: toValidatedCartItems(resolved),
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

    // Promove já para 'profissional' — quando o Stripe devolver o cliente,
    // ele entra logo em /profissional com a secção pendente visível, sem
    // esperar pelo webhook para conseguir sequer ver o painel.
    try {
      await promoteGuestToProfissional(admin, actor.buyerUserId);
    } catch (err) {
      console.error('[checkout/create-session] promoteGuestToProfissional falhou:', err);
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
      metadata: { checkout_session_id: session.id, user_id: actor.buyerUserId },
      success_url: `${origin}/cliente?checkout_session_id=${session.id}`,
      cancel_url: `${origin}/checkout`,
    });

    await admin
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
