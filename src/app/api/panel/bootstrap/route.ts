import { NextResponse } from 'next/server';
import { requirePanelBootstrapAccess } from '@/lib/panel-api-auth';
import { resolvePanelDaContext } from '@/lib/panel-api-context';
import { resolveResellerPanelContext } from '@/lib/panel-reseller-context';
import { scheduleDaSync } from '@/lib/da-sync-engine';
import {
  getMirrorLastSyncAt,
  listMirrorPackages,
  listMirrorUsers,
  listMirrorWebsites,
  listMirrorWebsitesForClientEmail,
} from '@/lib/panel-mirror-read';
import { listBootstrapPanelAccounts } from '@/lib/panel-bootstrap-accounts';

export async function GET() {
  try {
    const auth = await requirePanelBootstrapAccess();
    if ('error' in auth) return auth.error;

    if (auth.user.role === 'client') {
      const sites = await listMirrorWebsitesForClientEmail(auth.user.email || '');
      const lastSyncedAt = await getMirrorLastSyncAt();
      return NextResponse.json({
        success: true,
        sites,
        users: [],
        packages: [],
        accounts: [],
        accountCounts: {},
        resellerContext: null,
        meta: { source: 'mirror', lastSyncedAt },
      });
    }

    const staffAuth = { user: auth.user as { id: string; email?: string; role: 'admin' | 'reseller' } };
    const { mirrorScope, effectiveRole } = await resolvePanelDaContext({ user: staffAuth.user });

    const [sites, users, accountsResult] = await Promise.all([
      listMirrorWebsites(mirrorScope),
      listMirrorUsers(mirrorScope),
      listBootstrapPanelAccounts(staffAuth.user.role),
    ]);

    let sitesOut = sites;
    let usersOut = users;
    let packages = await listMirrorPackages(mirrorScope, sitesOut);

    const resellerContext =
      effectiveRole === 'reseller' ? await resolveResellerPanelContext({ user: staffAuth.user }) : null;

    if (resellerContext?.daUsername) {
      const owner = resellerContext.daUsername;
      sitesOut = sitesOut.filter((s) => !s.owner || s.owner === owner);
      usersOut = usersOut.filter(
        (u) => u.userName === owner || u.parentUsername === owner,
      );
      packages = await listMirrorPackages(mirrorScope, sitesOut);
    }

    if (!sitesOut.length && !usersOut.length) {
      scheduleDaSync(0);
    } else {
      void import('@/lib/panel-mirror-read').then(({ isMirrorStale }) =>
        isMirrorStale(5).then((stale) => {
          if (stale) scheduleDaSync(0);
        }),
      );
    }

    const lastSyncedAt = await getMirrorLastSyncAt();

    return NextResponse.json({
      success: true,
      sites: sitesOut,
      users: usersOut,
      packages,
      accounts: accountsResult.accounts,
      accountCounts: accountsResult.counts,
      resellerContext,
      meta: { source: 'mirror', lastSyncedAt },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erro interno';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
