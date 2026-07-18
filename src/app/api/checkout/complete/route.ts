import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { getRedirectPathForRole } from '@/lib/user-roles';
import { fetchUserProductsSummary } from '@/lib/user-products';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';

// NOTA: este endpoint já não é chamado pelo checkout de cartão (que usa
// /api/checkout/create-session + webhook Stripe, a única fonte fiável de que
// o pagamento foi confirmado). Fica apenas como fallback manual para
// admin/revendedor activarem uma compra à mão (ex.: pagamento fora do site).

type CartItem = {
  id: string;
  type: 'domain' | 'hosting' | 'ssl' | 'email';
  name: string;
  price: number;
  period: number;
};

const CART_PLAN_TO_PACKAGE: Record<string, string> = {
  'hosting-basico': 'VD-Host-Basico',
  'hosting-pro': 'VD-Host-Pro',
  'hosting-business': 'VD-Host-Business',
  'hosting-enterprise': 'VD-Host-Enterprise',
  'email-pro': 'VD-Email-Pro',
  'email-starter': 'VD-Email-Starter',
  'email-business': 'VD-Email-Business',
};

function addYears(date: Date, years: number) {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().split('T')[0];
}

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
    const items: CartItem[] = body.items ?? [];
    const paymentMethod = body.paymentMethod ?? 'mpesa';

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Carrinho vazio.' }, { status: 400 });
    }

    const today = new Date().toISOString().split('T')[0];
    const total = items.reduce((sum, item) => sum + (item.price || 0), 0);
    const created: string[] = [];

    for (const item of items) {
      const years = item.period || 1;
      const expires = addYears(new Date(), years);

      if (item.type === 'domain') {
        const domainName = item.name.toLowerCase().trim();
        const { error } = await supabase.from('domain_renewals').upsert(
          {
            user_id: user.id,
            domain_name: domainName,
            registration_date: today,
            expiration_date: expires,
            renewal_price: item.price,
            currency: 'MZN',
            status: 'active',
            registrar: 'VisualDesign',
            notes: `Compra carrinho (${paymentMethod})`,
          },
          { onConflict: 'user_id,domain_name', ignoreDuplicates: false },
        );
        if (error) {
          const { error: insErr } = await supabase.from('domain_renewals').insert({
            user_id: user.id,
            domain_name: domainName,
            registration_date: today,
            expiration_date: expires,
            renewal_price: item.price,
            currency: 'MZN',
            status: 'active',
            registrar: 'VisualDesign',
          });
          if (insErr) console.warn('[checkout] domain_renewals:', insErr.message);
        }
        created.push(`domínio:${domainName}`);
      }

      if (item.type === 'hosting') {
        const domainName = item.name.toLowerCase().trim();
        const packageName = CART_PLAN_TO_PACKAGE[item.id] || item.id || 'VD-Host-Basico';
        const { error: insErr } = await supabase.from('hosting_renewals').insert({
          user_id: user.id,
          domain_name: domainName,
          package_name: packageName,
          start_date: today,
          expiration_date: expires,
          renewal_price: item.price,
          currency: 'MZN',
          status: 'active',
          server: 'DirectAdmin',
          notes: `Compra carrinho (${paymentMethod})`,
        });
        if (insErr) console.warn('[checkout] hosting_renewals:', insErr.message);
        created.push(`hospedagem:${domainName}`);
      }

      if (item.type === 'email') {
        const serviceName = item.name.toLowerCase().trim();
        const packageName = CART_PLAN_TO_PACKAGE[item.id] || item.id || 'VD-Email-Pro';
        const { error: insErr } = await supabase.from('hosting_renewals').insert({
          user_id: user.id,
          domain_name: serviceName,
          package_name: packageName,
          start_date: today,
          expiration_date: expires,
          renewal_price: item.price,
          currency: 'MZN',
          status: 'active',
          server: 'Mail',
          notes: `Plano de e-mail (${paymentMethod})`,
        });
        if (insErr) console.warn('[checkout] email plano:', insErr.message);
        created.push(`email:${serviceName}`);
      }
    }

    await supabase.from('pagamentos').insert({
      user_id: user.id,
      domain: items.map((i) => i.name).join(', '),
      valor: total,
      vencimento: today,
      metodo: paymentMethod,
      pago_em: new Date().toISOString(),
      status: 'paid',
    });

    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (serviceKey && supabaseUrl) {
      const admin = createAdminClient(supabaseUrl, serviceKey);
      await admin.auth.admin.updateUserById(user.id, {
        user_metadata: {
          ...user.user_metadata,
          role: 'client',
          nome:
            user.user_metadata?.nome ||
            user.user_metadata?.full_name ||
            user.email?.split('@')[0],
        },
      });
      const { saveProfileForAuthUser } = await import('@/lib/profile-db');
      await saveProfileForAuthUser(admin, user.id, {
        email: user.email,
        role: 'client',
        name:
          (user.user_metadata?.nome as string) ||
          (user.user_metadata?.full_name as string) ||
          user.email?.split('@')[0],
      });
    }

    const products = await fetchUserProductsSummary(supabase, user.id);

    return NextResponse.json({
      success: true,
      message: 'Pagamento registado. A sua conta foi activada como cliente.',
      created,
      tier: products.tier,
      redirectPath: getRedirectPathForRole('client'),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro interno';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
