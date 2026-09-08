import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { resolveCartItems, toValidatedCartItems, type CatalogCartItem } from '@/lib/package-catalog';
import { notifyQuoteTeam } from '@/lib/notify-quote-team';
import { isProfileWhoisComplete } from '@/lib/profile-db';
import { promoteGuestToProfissional } from '@/lib/checkout-fulfillment';
import { resolveCheckoutActor } from '@/lib/checkout-actor';

const VALID_METHODS = ['mpesa', 'transferencia'];

// Cria uma checkout_session pendente para pagamento manual (M-Pesa ou
// Transferência Bancária) — mesmo princípio da /api/checkout/create-session
// (Stripe), mas sem sessão do Stripe: fica 'pending' até a equipa confirmar
// depois de ver o comprovativo (ver /api/admin/checkout-pagamentos).
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Faça login para concluir a compra.' }, { status: 401 });
    }

    const body = await request.json();
    const items: CatalogCartItem[] = body.items ?? [];
    const metodoPagamento = String(body.metodoPagamento || '');

    if (!VALID_METHODS.includes(metodoPagamento)) {
      return NextResponse.json({ error: 'Método de pagamento inválido.' }, { status: 400 });
    }
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

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 });
    }

    // Se um admin estiver a "entrar como" um revendedor/cliente, o pedido
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
        currency: 'mzn',
        status: 'pending',
        metodo_pagamento: metodoPagamento,
      })
      .select()
      .single();

    if (insertError || !session) {
      console.error('[checkout/manual-session] insert error:', insertError);
      return NextResponse.json({ error: 'Não foi possível iniciar o pedido.' }, { status: 500 });
    }

    // Promove já para 'profissional' — deixa o comprador entrar no painel
    // real (secção do produto visível mas desactivada) enquanto aguarda a
    // equipa confirmar o comprovativo, em vez de ficar preso no /guest
    // genérico. Espera terminar (o browser navega para /profissional logo a
    // seguir a esta resposta) mas nunca falha a criação do pedido por causa
    // disto — o pedido em si já está gravado.
    try {
      await promoteGuestToProfissional(admin, actor.buyerUserId);
    } catch (err) {
      console.error('[checkout/manual-session] promoteGuestToProfissional falhou:', err);
    }

    const quemPaga = actor.impersonating
      ? `${user.email} (em nome de ${actor.impersonatedLabel})`
      : user.email;
    notifyQuoteTeam({
      title: 'Novo pedido de pagamento manual (checkout)',
      message: `${quemPaga} quer pagar ${resolved.map((r) => r.item.name).join(', ')} (${totalMt} MT) via ${
        metodoPagamento === 'mpesa' ? 'M-Pesa' : 'Transferência Bancária'
      }. Fica a aguardar comprovativo e confirmação da equipa.`,
      link: `${process.env.NEXT_PUBLIC_SITE_URL || ''}/admin`,
    }).catch((err) => console.error('[checkout/manual-session] falha ao notificar equipa:', err));

    return NextResponse.json({ success: true, session });
  } catch (error: unknown) {
    console.error('[checkout/manual-session] error:', error);
    const message = error instanceof Error ? error.message : 'Erro interno';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
