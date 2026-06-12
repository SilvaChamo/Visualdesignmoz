import { NextRequest, NextResponse } from 'next/server';
import { getServerHost } from '@/lib/server-config';
import type { DirectAdminServerAPI } from '@/lib/directadmin-adapter';
import { getDirectAdminAPIForAuth } from '@/lib/directadmin-adapter';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';
import { resolvePanelDaContext } from '@/lib/panel-api-context';
import { runDaFullSyncDeduped, scheduleDaSync } from '@/lib/da-sync-engine';
import { mirrorAfterDaMutation, mutationSucceeded } from '@/lib/panel-mirror-write';
import {
  listMirrorDns,
  listMirrorEmails,
  listMirrorPackages,
  listMirrorUsers,
  listMirrorWebsites,
  getMirrorLastSyncAt,
} from '@/lib/panel-mirror-read';
import { resolveMirrorOrLive } from '@/lib/panel-list-resolve';

const LIVE_LIST_FALLBACK: Record<
  string,
  (api: DirectAdminServerAPI, params: Record<string, unknown>) => Promise<unknown>
> = {
  listWebsites: (api) => api.listWebsites(),
  listUsers: (api) => api.listUsers(),
  listPackages: (api) => api.listPackages(),
  listEmails: (api, params) => api.listEmails(String(params.domain || '')),
  listDNS: (api, params) => api.listDNS(String(params.domain || '')),
};

/** Mutações legadas do painel — encaminhadas para o adaptador DirectAdmin. */
const DA_MUTATION_PROXY: Record<
  string,
  (api: DirectAdminServerAPI, params: Record<string, unknown>) => Promise<unknown>
> = {
  createWebsite: (api, p) => api.createWebsite(p),
  deleteWebsite: (api, p) => api.deleteWebsite(String(p.domain || '')),
  suspendWebsite: (api, p) => api.suspendWebsite(String(p.domain || '')),
  unsuspendWebsite: (api, p) => api.unsuspendWebsite(String(p.domain || '')),
  modifyWebsite: (api, p) => api.modifyWebsite(p),
  createPackage: (api, p) => api.createPackage(p),
  editPackage: (api, p) => api.modifyPackage(p),
  modifyPackage: (api, p) => api.modifyPackage(p),
  deletePackage: (api, p) => api.deletePackage(String(p.packageName || '')),
  createUser: (api, p) => api.createUser(p),
  modifyUser: (api, p) => api.modifyUser(p),
  deleteUser: (api, p) => api.deleteUser(p),
  createEmail: (api, p) => api.createEmail(p),
  deleteEmail: (api, p) => api.deleteEmail(p),
  issueSSL: (api, p) => api.issueSSL(String(p.domain || p.domainName || '')),
  createSubdomain: (api, p) => api.createSubdomain(String(p.domain || ''), String(p.subdomain || '')),
  deleteSubdomain: (api, p) => api.deleteSubdomain(String(p.domain || ''), String(p.subdomain || '')),
  createDatabase: (api, p) => api.createDatabase(p),
  deleteDatabase: (api, p) => api.deleteDatabase(p),
  createFTPAccount: (api, p) => api.createFTPAccount(p),
  deleteFTPAccount: (api, p) => api.deleteFTPAccount(p),
  enableDKIM: (api, p) => api.enableDKIM(String(p.domain || '')),
  changePHPVersion: (api, p) => api.changePHPVersion(p),
};

async function readFromMirror(
  action: string,
  mirrorScope: Parameters<typeof listMirrorWebsites>[0],
  params: Record<string, unknown>,
) {
  switch (action) {
    case 'listWebsites':
      return listMirrorWebsites(mirrorScope);
    case 'listUsers':
      return listMirrorUsers(mirrorScope);
    case 'listPackages':
      return listMirrorPackages(mirrorScope);
    case 'listEmails':
      return listMirrorEmails(String(params.domain || ''), mirrorScope);
    case 'listDNS':
      return listMirrorDns(String(params.domain || ''), mirrorScope);
    default:
      return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    const { action, params = {} } = await req.json();

    if (!action) {
      return NextResponse.json({ success: false, error: 'action obrigatório' }, { status: 400 });
    }

    if (LIVE_LIST_FALLBACK[action]) {
      const auth = await requireAdminOrReseller();
      if ('error' in auth) return auth.error;

      const { daApi: api, mirrorScope } = await resolvePanelDaContext(auth);
      const fallback = LIVE_LIST_FALLBACK[action];

      const data = await resolveMirrorOrLive({
        onStale: () => scheduleDaSync(0),
        mirror: async () => {
          const rows = await readFromMirror(action, mirrorScope, params);
          return Array.isArray(rows) ? rows : [];
        },
        live: async () => {
          const rows = await fallback(api, params);
          if (Array.isArray(rows) && rows.length > 0) scheduleDaSync(500);
          return Array.isArray(rows) ? rows : [];
        },
      });

      const lastSyncedAt = await getMirrorLastSyncAt();
      return NextResponse.json({
        success: true,
        data,
        meta: { source: 'mirror', lastSyncedAt },
      });
    }

    if (DA_MUTATION_PROXY[action]) {
      const auth = await requireAdminOrReseller();
      if ('error' in auth) return auth.error;

      const { daApi: api } = await resolvePanelDaContext(auth);
      const data = await DA_MUTATION_PROXY[action](api, params as Record<string, unknown>);
      const ok = mutationSucceeded(data);
      if (ok) {
        await mirrorAfterDaMutation(action, params as Record<string, unknown>);
      }
      scheduleDaSync(1500);

      return NextResponse.json({ success: ok, data });
    }

    if (action === 'fullSync') {
      const auth = await requireAdminOrReseller();
      if ('error' in auth) return auth.error;

      const sync = await runDaFullSyncDeduped();
      const [sites, users, packages] = await Promise.all([
        listMirrorWebsites({ role: auth.user.role, userId: auth.user.id }),
        listMirrorUsers({ role: auth.user.role, userId: auth.user.id }),
        listMirrorPackages({ role: auth.user.role, userId: auth.user.id }),
      ]);
      return NextResponse.json({
        success: sync.ok,
        data: {
          message: sync.ok
            ? 'Sincronização DirectAdmin → painel concluída.'
            : 'Sincronização concluída com avisos — ver panel_sync_log.',
          sites,
          users,
          packages,
          sync,
          auditLogs: [],
        },
      });
    }

    if (action === 'serverStats' || action === 'serverDiskUsage' || action === 'siteDiskUsage') {
      const auth = await requireAdminOrReseller();
      if ('error' in auth) return auth.error;

      if (action === 'serverStats') {
        const api = await getDirectAdminAPIForAuth(auth.user);
        const stats = await api.getServerStats();
        return NextResponse.json({ success: true, data: stats });
      }

      return NextResponse.json({
        success: true,
        data: { disabled: false, host: getServerHost() },
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Operação não suportada via server-exec. Use as secções do painel ou o DirectAdmin nativo.',
        disabled: true,
      },
      { status: 501 },
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro interno';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');
  const domain = searchParams.get('domain') || 'visualdesignmoz.com';

  if (action === 'getScreenshot') {
    return NextResponse.redirect(
      `https://image.thum.io/get/width/600/crop/400/noanimate/https://${domain}`,
    );
  }

  return NextResponse.json({ error: 'Action not allowed via GET' }, { status: 405 });
}
