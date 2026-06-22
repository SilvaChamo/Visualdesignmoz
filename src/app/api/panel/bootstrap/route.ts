import { NextResponse } from 'next/server';
import { requirePanelBootstrapAccess } from '@/lib/panel-api-auth';
import { resolvePanelDaContext } from '@/lib/panel-api-context';
import { resolveResellerPanelContext } from '@/lib/panel-reseller-context';
import { scheduleDaSync } from '@/lib/da-sync-engine';
import { resolveClientPanelContext } from '@/lib/panel-client-context';
import { getProfileForAuthUser } from '@/lib/profile-db';
import { getDaSyncAdmin } from '@/lib/da-sync-schema';
import {
  normalizeResellerTier,
  resolvePanelCapabilities,
  type ResellerTier,
} from '@/lib/panel-role-capabilities';
import {
  getMirrorLastSyncAt,
  listBootstrapPanelAccounts,
  listMirrorPackages,
  listMirrorUsers,
  listMirrorWebsites,
  listMirrorWebsitesForClientUser,
} from '@/lib/panel-mirror-read';
import { applyAdminPanelScope } from '@/lib/panel-scope-filter';
import { createClient } from '@supabase/supabase-js';

async function loadResellerTier(userId: string): Promise<ResellerTier | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const admin = createClient(url, key);
  const profile = await getProfileForAuthUser(admin, userId);
  if (profile?.reseller_tier) return normalizeResellerTier(profile.reseller_tier);
  const sb = getDaSyncAdmin();
  if (sb) {
    const { data } = await sb
      .from('panel_auth_accounts')
      .select('reseller_tier')
      .eq('user_id', userId)
      .maybeSingle();
    if (data?.reseller_tier) return normalizeResellerTier(data.reseller_tier);
  }
  return 'essencial';
}

export async function GET() {
  try {
    const auth = await requirePanelBootstrapAccess();
    if ('error' in auth) return auth.error;

    const lastSyncedAt = await getMirrorLastSyncAt();

    if (auth.user.role === 'client') {
      const ctx = await resolveClientPanelContext(auth.user.id, auth.user.email);
      const capabilities = resolvePanelCapabilities({ role: 'client' });
      return NextResponse.json({
        success: true,
        sites: ctx.sites,
        users: [],
        packages: [],
        accounts: [],
        accountCounts: {},
        resellerContext: null,
        products: ctx.products,
        session: {
          role: 'client',
          readOnly: capabilities.readOnly,
          capabilities,
        },
        meta: { source: 'mirror', lastSyncedAt },
      });
    }

    if (auth.user.role === 'manager') {
      const sites = await listMirrorWebsitesForClientUser(auth.user.id, auth.user.email);
      const capabilities = resolvePanelCapabilities({ role: 'manager' });
      return NextResponse.json({
        success: true,
        sites,
        users: [],
        packages: sites.length ? await listMirrorPackages({ role: 'admin', userId: auth.user.id }, sites) : [],
        accounts: [],
        accountCounts: {},
        resellerContext: null,
        session: {
          role: 'manager',
          readOnly: false,
          capabilities,
        },
        meta: { source: 'mirror', lastSyncedAt },
      });
    }

    const staffAuth = {
      user: auth.user as { id: string; email?: string; role: 'admin' | 'reseller' },
    };
    const { mirrorScope, effectiveRole } = await resolvePanelDaContext({
      user: staffAuth.user.role === 'reseller'
        ? staffAuth.user
        : { ...staffAuth.user, role: 'admin' },
    });
    const isReseller = effectiveRole === 'reseller';
    const resellerTier = isReseller ? await loadResellerTier(auth.user.id) : null;

    const [sites, users, accountsResult, resellerContext] = await Promise.all([
      listMirrorWebsites(mirrorScope),
      listMirrorUsers(mirrorScope),
      isReseller
        ? Promise.resolve({ accounts: [], counts: {} as Record<string, number> })
        : listBootstrapPanelAccounts(staffAuth.user.role === 'admin' ? 'admin' : 'reseller'),
      isReseller ? resolveResellerPanelContext({ user: staffAuth.user }) : Promise.resolve(null),
    ]);

    let sitesOut = sites;
    let usersOut = users;
    let packagesOut = await listMirrorPackages(mirrorScope, sitesOut);

    if (resellerContext?.daUsername) {
      const owner = resellerContext.daUsername;
      sitesOut = sitesOut.filter((s) => !s.owner || s.owner === owner);
      usersOut = usersOut.filter(
        (u) => u.userName === owner || u.parentUsername === owner,
      );
      packagesOut = await listMirrorPackages(mirrorScope, sitesOut);
    } else if (!isReseller) {
      const scoped = applyAdminPanelScope({
        sites: sitesOut,
        users: usersOut,
        packages: packagesOut,
      });
      sitesOut = scoped.sites;
    }

    if (!sitesOut.length && !usersOut.length) {
      scheduleDaSync(0);
    } else {
      void import('@/lib/panel-mirror-read').then(({ isMirrorStale }) =>
        isMirrorStale(1).then((stale) => {
          if (stale) scheduleDaSync(0);
        }),
      );
    }

    const capabilities = resolvePanelCapabilities({
      role: isReseller ? 'reseller' : 'admin',
      resellerTier,
    });

    return NextResponse.json({
      success: true,
      sites: sitesOut,
      users: usersOut,
      packages: packagesOut,
      accounts: accountsResult.accounts,
      accountCounts: accountsResult.counts,
      resellerContext: resellerContext
        ? { ...resellerContext, resellerTier }
        : null,
      session: {
        role: isReseller ? 'reseller' : 'admin',
        readOnly: false,
        capabilities,
        resellerTier,
      },
      meta: { source: 'mirror', lastSyncedAt },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Erro interno';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
