import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { CANONICAL_DIRECTADMIN_HOST } from '@/lib/directadmin-url';
import { daOneTimeLoginUrl } from '@/lib/da-api-ssh';
import { buildPanelLoginUrl, getPublicSiteOrigin } from '@/lib/panel-origin';
import { requirePanelBootstrapAccess } from '@/lib/panel-api-auth';
import { isHestiaOnlyDeploy } from '@/lib/hosting-provider';

/** Navegação no browser (botão DirectAdmin) — redirecionar em vez de JSON. */
function isBrowserNavigation(request: NextRequest): boolean {
  const accept = request.headers.get('accept') ?? '';
  if (accept.includes('text/html')) return true;
  const dest = request.headers.get('sec-fetch-dest');
  return dest === 'document' || dest === 'iframe';
}

/**
 * SSO DirectAdmin para clientes finais (hospedagem comprada no carrinho) —
 * nunca aceita um utilizador pedido por parâmetro, só a própria conta DA
 * do cliente autenticado (guardada em profiles.da_username ao ser
 * provisionada em checkout-fulfillment.ts). Ver também /api/directadmin-access,
 * que serve admin/revenda/manager — este é o equivalente restrito a 'client'.
 */
export async function GET(request: NextRequest) {
  const browserNav = isBrowserNavigation(request);
  const dashboardUrl = new URL('/cliente', getPublicSiteOrigin());

  if (isHestiaOnlyDeploy()) {
    if (browserNav) {
      return NextResponse.redirect(dashboardUrl, { status: 307, headers: { 'Cache-Control': 'no-store' } });
    }
    return NextResponse.json(
      { error: 'Neste servidor a hospedagem é gerida neste painel, não no DirectAdmin.' },
      { status: 409 },
    );
  }

  const auth = await requirePanelBootstrapAccess();
  if ('error' in auth) {
    if (browserNav) {
      return NextResponse.redirect(buildPanelLoginUrl(getPublicSiteOrigin()), {
        status: 307,
        headers: { 'Cache-Control': 'no-store' },
      });
    }
    return auth.error;
  }

  if (auth.user.role !== 'client') {
    const forbidden = NextResponse.json({ error: 'Rota restrita a clientes.' }, { status: 403 });
    if (browserNav) {
      return NextResponse.redirect(dashboardUrl, { status: 307, headers: { 'Cache-Control': 'no-store' } });
    }
    return forbidden;
  }

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Supabase Service Role não configurado.');
    const admin = createAdminClient(url, key);

    const { data: profile } = await admin
      .from('profiles')
      .select('da_username')
      .eq('id', auth.user.id)
      .maybeSingle();

    const daUsername = profile?.da_username?.trim();
    if (!daUsername) {
      if (browserNav) {
        return NextResponse.redirect(dashboardUrl, { status: 307, headers: { 'Cache-Control': 'no-store' } });
      }
      return NextResponse.json({ error: 'Conta de hospedagem ainda não provisionada.' }, { status: 404 });
    }

    const oneTimeUrl = await daOneTimeLoginUrl(daUsername, CANONICAL_DIRECTADMIN_HOST);
    if (oneTimeUrl) {
      return NextResponse.redirect(oneTimeUrl, { status: 307, headers: { 'Cache-Control': 'no-store' } });
    }

    console.warn('[client-directadmin-access] one-time login indisponível para', daUsername);
    return NextResponse.redirect(dashboardUrl, { status: 307, headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[client-directadmin-access]', err instanceof Error ? err.message : err);
    return NextResponse.redirect(dashboardUrl, { status: 307, headers: { 'Cache-Control': 'no-store' } });
  }
}
