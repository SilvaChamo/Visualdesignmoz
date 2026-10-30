import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { acrescentarIva } from '@/lib/iva';
import { resolveCartItems, toValidatedCartItems, type CatalogCartItem } from '@/lib/package-catalog';
import { isProfileWhoisComplete } from '@/lib/profile-db';
import { promoteBuyerAfterPurchase } from '@/lib/checkout-fulfillment';
import { resolveCheckoutActor } from '@/lib/checkout-actor';
import { validarContasDeHospedagem } from '@/lib/conta-hospedagem-servidor';

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

    // O IVA (16 %) acrescenta-se ao preço dos itens; `total_mt` guarda o total a pagar, já com IVA (ver src/lib/iva.ts).
    const { totalMt } = acrescentarIva(resolved.reduce((sum, r) => sum + r.priceMt, 0));

    const admin = getSupabaseAdmin();
    if (!admin) {
      return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 503 });
    }

    // Se um admin estiver a "entrar como" um revendedor/cliente, o pedido
    // corre como a conta impersonada (dono do domínio, WHOIS, faturação).
    const actor = await resolveCheckoutActor(admin, user);

    // Os dados da conta (telefone, morada, cidade) são precisos em qualquer compra: facturação, contacto e, nos domínios, o registo oficial (WHOIS)
    if (!(await isProfileWhoisComplete(admin, actor.buyerUserId))) {
      return NextResponse.json(
        {
          error: actor.impersonating
            ? `A conta ${actor.impersonatedLabel} ainda não tem telefone, morada e cidade preenchidos — são os dados da conta e do registo oficial dos domínios. Complete o perfil dessa conta antes de comprar.`
            : 'Antes de comprar precisa de completar o telefone, morada e cidade em "A Minha Conta" — são os dados da sua conta e do registo oficial dos domínios.',
        },
        { status: 400 },
      );
    }

    const erroConta = await validarContasDeHospedagem(admin, toValidatedCartItems(resolved), { id: actor.buyerUserId, email: actor.buyerEmail });
    if (erroConta) return NextResponse.json({ error: erroConta }, { status: 400 });

    // Voltar atrás ao checkout e clicar outra vez em «Pagar» não cria outro pedido: o carrinho só esvazia depois de concluir a compra,
    // por isso o mesmo pedido ainda aberto (mesmos itens, mesmo método, sem comprovativo) volta a ser o mesmo. Os pedidos abertos
    // que já não correspondem ao carrinho (mudou itens ou método) ficam substituídos por este.
    const itensValidados = toValidatedCartItems(resolved);
    const assinatura = (itens: CatalogCartItem[], metodo: string, total: number) =>
      JSON.stringify([
        metodo,
        Math.round(Number(total) * 100),
        itens
          .map((i) => [i.type, i.id, i.name, i.period, Math.round(Number(i.price) * 100), i.hostingDomain || '', i.contaUtilizador || '', i.authCode ? 1 : 0].join('|'))
          .sort(),
      ]);
    const { data: abertos } = await admin
      .from('checkout_sessions')
      .select('*')
      .eq('user_id', actor.buyerUserId)
      .eq('status', 'pending')
      .in('metodo_pagamento', VALID_METHODS)
      .is('comprovativo_url', null)
      .order('created_at', { ascending: true });
    const minha = assinatura(itensValidados, metodoPagamento, totalMt);
    let reutilizado: Record<string, unknown> | null = null;
    for (const aberto of abertos || []) {
      const igual = assinatura((aberto.items as CatalogCartItem[]) || [], String(aberto.metodo_pagamento), Number(aberto.total_mt)) === minha;
      if (igual && !reutilizado) {
        reutilizado = aberto;
        continue;
      }
      await admin.from('checkout_sessions').update({ status: 'expired' }).eq('id', aberto.id).eq('status', 'pending').is('comprovativo_url', null);
    }
    if (reutilizado) return NextResponse.json({ success: true, session: reutilizado, reutilizado: true });

    const { data: session, error: insertError } = await admin
      .from('checkout_sessions')
      .insert({
        user_id: actor.buyerUserId,
        items: itensValidados,
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

    // Promove já para o painel certo ('profissional' com plano Pro/Business/
    // Enterprise, 'client' com Básico, email ou domínio — ver promoteBuyerAfterPurchase) — deixa o comprador entrar no
    // painel real (secção do produto visível mas desactivada) enquanto aguarda
    // a equipa confirmar o comprovativo, em vez de ficar preso no /guest
    // genérico. Espera terminar (o browser navega para /profissional logo a
    // seguir a esta resposta) mas nunca falha a criação do pedido por causa
    // disto — o pedido em si já está gravado.
    try {
      await promoteBuyerAfterPurchase(admin, actor.buyerUserId, resolved.map((r) => r.item));
    } catch (err) {
      console.error('[checkout/manual-session] promoteBuyerAfterPurchase falhou:', err);
    }

    // Nada de e-mail nem aviso ao cliente aqui: o primeiro aviso segue quando ele envia o comprovativo (Silva, 29/10/2026).
    // A equipa só é avisada quando o comprovativo chega (ver /api/checkout/[id]/comprovativo): até lá o
    // cliente ainda não pagou e não há nada para confirmar.

    return NextResponse.json({ success: true, session });
  } catch (error: unknown) {
    console.error('[checkout/manual-session] error:', error);
    const message = error instanceof Error ? error.message : 'Erro interno';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
