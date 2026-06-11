import { NextResponse } from 'next/server';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';
import { resolveResellerPanelContext } from '@/lib/panel-reseller-context';
import { listMirrorWebsites } from '@/lib/panel-mirror-read';
import { resolvePanelDaContext } from '@/lib/panel-api-context';

export async function GET() {
  try {
    const auth = await requireAdminOrReseller();
    if ('error' in auth) return auth.error;

    const ctx = await resolveResellerPanelContext(auth);
    if (!ctx) {
      return NextResponse.json(
        { success: false, error: 'Contexto de revendedor indisponível' },
        { status: 403 },
      );
    }

    const { mirrorScope } = await resolvePanelDaContext(auth);
    const sites = await listMirrorWebsites(mirrorScope);
    const ownedSites = sites
      .filter((s) => !s.domain.includes('contaboserver'))
      .filter((s) => !s.domain.toLowerCase().startsWith('mail.'))
      .filter((s) => !ctx.daUsername || s.owner === ctx.daUsername);

    const primaryDomain =
      ctx.primaryDomain ||
      ownedSites[0]?.domain ||
      null;

    return NextResponse.json({
      success: true,
      daUsername: ctx.daUsername,
      email: ctx.email,
      primaryDomain,
      impersonating: ctx.impersonating,
      siteCount: ownedSites.length,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erro interno';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
