import { NextResponse } from 'next/server';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';
import { resolvePanelDaContext } from '@/lib/panel-api-context';
import { resolveResellerPanelContext } from '@/lib/panel-reseller-context';
import { scheduleDaSync } from '@/lib/da-sync-engine';
import {
  getMirrorLastSyncAt,
  listMirrorPackages,
  listMirrorUsers,
  listMirrorWebsites,
} from '@/lib/panel-mirror-read';
import { resolveMirrorOrLive } from '@/lib/panel-list-resolve';

export async function GET() {
  try {
    const auth = await requireAdminOrReseller();
    if ('error' in auth) return auth.error;

    const { daApi, mirrorScope, effectiveRole } = await resolvePanelDaContext(auth);

    let [sites, users] = await Promise.all([
      listMirrorWebsites(mirrorScope),
      listMirrorUsers(mirrorScope),
    ]);
    let packages = await listMirrorPackages(mirrorScope, sites);

    let source: 'mirror' | 'live' = 'mirror';

    if (!sites.length && !users.length) {
      [sites, users, packages] = await Promise.all([
        resolveMirrorOrLive({
          mirror: async () => sites,
          live: async () => {
            const rows = await daApi.listWebsites();
            if (rows.length > 0) scheduleDaSync(500);
            return rows;
          },
          onStale: () => scheduleDaSync(0),
        }),
        resolveMirrorOrLive({
          mirror: async () => users,
          live: async () => {
            const rows = await daApi.listUsers();
            if (rows.length > 0) scheduleDaSync(500);
            return rows;
          },
          onStale: () => scheduleDaSync(0),
        }),
        resolveMirrorOrLive({
          mirror: async () => packages,
          live: async () => {
            const rows = await daApi.listPackages();
            if (rows.length > 0) scheduleDaSync(500);
            return rows;
          },
          onStale: () => scheduleDaSync(0),
        }),
      ]);
      source = sites.length || users.length || packages.length ? 'live' : 'mirror';
    } else {
      packages = await listMirrorPackages(mirrorScope, sites);
    }

    const resellerContext =
      effectiveRole === 'reseller' ? await resolveResellerPanelContext(auth) : null;

    if (resellerContext?.daUsername) {
      const owner = resellerContext.daUsername;
      sites = sites.filter((s) => !s.owner || s.owner === owner);
      users = users.filter(
        (u) => u.userName === owner || u.parentUsername === owner,
      );
    }

    const lastSyncedAt = await getMirrorLastSyncAt();

    return NextResponse.json({
      success: true,
      sites,
      users,
      packages,
      resellerContext,
      meta: { source, lastSyncedAt },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erro interno';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
