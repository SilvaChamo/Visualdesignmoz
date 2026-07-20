import type { SupabaseClient } from '@supabase/supabase-js';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import type { CatalogCartItem } from '@/lib/package-catalog';

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

/**
 * Activa os produtos comprados (domínio/hospedagem/email) e promove a conta guest -> client.
 * Só deve ser chamada depois de o pagamento estar confirmado (webhook Stripe), nunca a partir
 * de um pedido directo do browser.
 */
export async function fulfillCheckout(
  supabase: SupabaseClient,
  userId: string,
  items: CatalogCartItem[],
  paymentMethod: string,
) {
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
          user_id: userId,
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
          user_id: userId,
          domain_name: domainName,
          registration_date: today,
          expiration_date: expires,
          renewal_price: item.price,
          currency: 'MZN',
          status: 'active',
          registrar: 'VisualDesign',
        });
        if (insErr) console.warn('[checkout-fulfillment] domain_renewals:', insErr.message);
      }
      created.push(`domínio:${domainName}`);
    }

    if (item.type === 'hosting') {
      const domainName = item.name.toLowerCase().trim();
      const packageName = CART_PLAN_TO_PACKAGE[item.id] || item.id || 'VD-Host-Basico';
      const { error: insErr } = await supabase.from('hosting_renewals').insert({
        user_id: userId,
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
      if (insErr) console.warn('[checkout-fulfillment] hosting_renewals:', insErr.message);
      created.push(`hospedagem:${domainName}`);
    }

    if (item.type === 'email') {
      const serviceName = item.name.toLowerCase().trim();
      const packageName = CART_PLAN_TO_PACKAGE[item.id] || item.id || 'VD-Email-Pro';
      const { error: insErr } = await supabase.from('hosting_renewals').insert({
        user_id: userId,
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
      if (insErr) console.warn('[checkout-fulfillment] email plano:', insErr.message);
      created.push(`email:${serviceName}`);
    }
  }

  await supabase.from('pagamentos').insert({
    user_id: userId,
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
    const { data: authUser } = await admin.auth.admin.getUserById(userId);
    const currentMetadata = authUser?.user?.user_metadata || {};
    const email = authUser?.user?.email;
    const displayName = currentMetadata.nome || currentMetadata.full_name || email?.split('@')[0];

    const { getProfileForAuthUser, saveProfileForAuthUser } = await import('@/lib/profile-db');
    const existingProfile = await getProfileForAuthUser(admin, userId, email);

    // Só promove guest -> client. Nunca despromove uma conta já elevada (admin/manager/reseller)
    // que, por exemplo, esteja apenas a testar uma compra.
    const ELEVATED_ROLES = ['admin', 'manager', 'reseller'];
    const isElevated =
      ELEVATED_ROLES.includes(existingProfile?.role || '') || ELEVATED_ROLES.includes(currentMetadata.role);

    if (!isElevated) {
      await admin.auth.admin.updateUserById(userId, {
        user_metadata: { ...currentMetadata, role: 'client', nome: displayName },
      });
    }

    await saveProfileForAuthUser(admin, userId, {
      email,
      role: isElevated ? undefined : 'client',
      name: displayName,
    });
  }

  return { created, total };
}
