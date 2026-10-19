import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { resolveCartItems, toValidatedCartItems, type CatalogCartItem } from '@/lib/package-catalog';
import { isProfileWhoisComplete } from '@/lib/profile-db';
import { deductResellerBalance, refundResellerBalance } from '@/lib/reseller-balance';
import { fulfillCheckout } from '@/lib/checkout-fulfillment';
import { resolveCheckoutActor } from '@/lib/checkout-actor';

// Paga uma compra nova do carrinho com o saldo do revendedor
// (reseller_credits) — ao contrário de M-Pesa/Transferência, não fica
// pendente: o saldo já é "dinheiro confirmado" (carregado e aprovado antes
// pela equipa), por isso a sessão nasce 'paid' e os produtos são activados
// de imediato, mesmo princípio do webhook do Stripe.
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Faça login para concluir a compra.' }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 });
    }

    // Se um admin estiver a "entrar como" um revendedor, a compra (e o
    // débito de saldo) corre como a conta impersonada, não como o admin.
    const actor = await resolveCheckoutActor(admin, user);

    const { data: profile } = await admin
      .from('profiles')
      .select('da_username')
      .eq('user_id', actor.buyerUserId)
      .maybeSingle();
    const daUsername = profile?.da_username as string | undefined;
    if (!daUsername) {
      return NextResponse.json(
        {
          error: actor.impersonating
            ? `A conta ${actor.impersonatedLabel} não é de revendedor — não tem saldo próprio.`
            : 'Esta conta não é de revendedor — não tem saldo próprio.',
        },
        { status: 403 },
      );
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

    const deducted = await deductResellerBalance(admin, daUsername, totalMt);
    if (!deducted.ok) {
      return NextResponse.json({ error: deducted.error || 'Saldo insuficiente.' }, { status: 400 });
    }

    const itemsWithStatus = resolved.map((r) => ({ ...r.item, status: 'paid' as const }));

    const { data: session, error: insertError } = await admin
      .from('checkout_sessions')
      .insert({
        user_id: actor.buyerUserId,
        items: itemsWithStatus,
        total_mt: totalMt,
        currency: 'mzn',
        status: 'paid',
        metodo_pagamento: 'saldo',
        fulfilled_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError || !session) {
      console.error('[checkout/saldo-session] insert error:', insertError);
      await refundResellerBalance(admin, daUsername, totalMt);
      return NextResponse.json({ error: 'Não foi possível iniciar o pedido.' }, { status: 500 });
    }

    try {
      await fulfillCheckout(admin, actor.buyerUserId, toValidatedCartItems(resolved), 'saldo');
    } catch (err) {
      console.error('[checkout/saldo-session] fulfillCheckout falhou, a devolver saldo:', err);
      await refundResellerBalance(admin, daUsername, totalMt);
      await admin
        .from('checkout_sessions')
        .update({ status: 'failed', rejection_reason: 'Falha na activação — saldo devolvido automaticamente.' })
        .eq('id', session.id);
      return NextResponse.json(
        { error: 'Não foi possível activar os produtos. O saldo foi devolvido — contacte o suporte se o problema persistir.' },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true, session });
  } catch (error: unknown) {
    console.error('[checkout/saldo-session] error:', error);
    const message = error instanceof Error ? error.message : 'Erro interno';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
