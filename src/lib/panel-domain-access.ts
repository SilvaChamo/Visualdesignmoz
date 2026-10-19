// Acesso a acções de domínio (SSL/DNS/PHP/transferência) escopado ao próprio
// dono. Staff (admin/reseller/manager/profissional) continua a passar
// sempre — o que muda é que agora um 'client' também pode chamar, mas só
// para um domínio que ele realmente possui (confirmado contra o mesmo
// critério usado no bootstrap do painel: username do panel_users ligado ao
// seu auth_user_id, ou o admin_email do site a bater com o email da conta).
import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { requirePanelBootstrapAccess, type PanelBootstrapAuthSuccess } from '@/lib/panel-api-auth';
import { listHostingDomainsForClient } from '@/lib/hosting-resolver';

type DomainAccessFailure = { error: NextResponse };

const ACCESS_DENIED = () =>
  NextResponse.json({ success: false, error: 'Acesso negado a este domínio.' }, { status: 403 });

export async function requireDaAccessForDomain(
  domain: string,
): Promise<PanelBootstrapAuthSuccess | DomainAccessFailure> {
  const auth = await requirePanelBootstrapAccess();
  if ('error' in auth) return auth;

  if (
    auth.user.role === 'admin' ||
    auth.user.role === 'reseller' ||
    auth.user.role === 'manager' ||
    auth.user.role === 'profissional'
  ) {
    return auth;
  }

  // role === 'client'
  const clean = domain.trim().toLowerCase();
  if (!clean) return { error: ACCESS_DENIED() };

  const sites = await listHostingDomainsForClient(auth.user.id, auth.user.email);
  if (sites.some((s) => (s.domain || '').toLowerCase() === clean)) return auth;

  // CORRIGIDO (15 ago 2026): dono só via hospedagem (mirror DA/Hestia) deixava
  // de fora um domínio comprado sozinho, sem hospedagem — uma conta 'client'
  // gerida que compre um domínio extra por conta própria fica sempre 'client'
  // (nunca promovida a 'profissional', ver ELEVATED_ROLES em
  // checkout-fulfillment.ts), por isso tinha de ficar coberta aqui também.
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (serviceKey && supabaseUrl) {
    const admin = createAdminClient(supabaseUrl, serviceKey);
    const { data } = await admin
      .from('domain_renewals')
      .select('id')
      .eq('user_id', auth.user.id)
      .eq('domain_name', clean)
      .maybeSingle();
    if (data) return auth;
  }

  return { error: ACCESS_DENIED() };
}
