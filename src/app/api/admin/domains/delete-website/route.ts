import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-api-auth';
import { getProviderByUsername, deleteHostingWebDomain } from '@/lib/hosting-provider';
import { getDaSyncAdmin } from '@/lib/da-sync-schema';

/**
 * Elimina só este site do servidor (nunca a conta inteira, mesmo que só
 * tenha este domínio) — usado pelo botão "Eliminar domínio de hospedagem"
 * na página de gestão do domínio. Antes disto o botão chamava directamente
 * /api/server-exec (`deleteWebsite`), que só sabe falar com o DirectAdmin —
 * para uma conta Hestia (ex.: aamihe, elimservicos) isso falhava sempre em
 * silêncio, porque o domínio nem existe do lado do DirectAdmin.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  try {
    const body = await req.json().catch(() => ({}));
    const domain = String(body.domain || '').toLowerCase().trim();
    if (!domain) {
      return NextResponse.json({ success: false, error: 'Domínio obrigatório' }, { status: 400 });
    }

    const sb = getDaSyncAdmin();
    if (!sb) {
      return NextResponse.json({ success: false, error: 'Base de dados indisponível' }, { status: 503 });
    }

    const { getMirrorSiteOwner } = await import('@/lib/panel-mirror-read');
    const siteOwner = await getMirrorSiteOwner(domain);
    const site = siteOwner ? { owner: siteOwner } : null;
    if (!site?.owner) {
      return NextResponse.json(
        { success: false, error: 'Não foi possível identificar a conta dona deste domínio.' },
        { status: 404 },
      );
    }

    const provider = await getProviderByUsername(site.owner);
    const result = await deleteHostingWebDomain(provider, site.owner, domain);
    if (!result.ok) {
      return NextResponse.json(
        { success: false, error: result.error || 'Falha ao eliminar o domínio no servidor.' },
        { status: 502 },
      );
    }

    await sb.from('panel_sites').delete().eq('domain', domain);

    return NextResponse.json({ success: true, message: `Domínio "${domain}" eliminado.` });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro interno';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
