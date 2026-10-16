import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { getRedirectPathForRole } from '@/lib/user-roles';
import { fetchUserProductsSummary } from '@/lib/user-products';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';
import { fulfillCheckout } from '@/lib/checkout-fulfillment';
import type { CatalogCartItem } from '@/lib/package-catalog';

// NOTA: este endpoint já não é chamado pelo checkout de cartão (que usa
// /api/checkout/create-session + webhook Stripe, a única fonte fiável de que
// o pagamento foi confirmado). Fica apenas como fallback manual para
// admin/revendedor activarem uma compra à mão (ex.: pagamento fora do site).
// A activação em si (domínio/hospedagem/email, provisionamento DirectAdmin,
// promoção guest->client) é toda feita por fulfillCheckout — a mesma função
// usada pelo webhook Stripe — para nunca haver duas implementações a divergir.

export async function POST(request: NextRequest) {
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return auth.error;

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
    const paymentMethod = body.paymentMethod ?? 'mpesa';

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Carrinho vazio.' }, { status: 400 });
    }

    const { created } = await fulfillCheckout(supabase, user.id, items, paymentMethod);

    const products = await fetchUserProductsSummary(supabase, user.id);

    return NextResponse.json({
      success: true,
      message: 'Pagamento registado. A sua conta foi activada como cliente.',
      created,
      tier: products.tier,
      redirectPath: getRedirectPathForRole('profissional'),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro interno';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
