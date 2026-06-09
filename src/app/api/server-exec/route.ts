import { NextRequest, NextResponse } from 'next/server';
import { getServerHost } from '@/lib/server-config';
import { getDirectAdminAPIForAuth, type DirectAdminServerAPI } from '@/lib/directadmin-adapter';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';

const LIST_ACTIONS: Record<string, (api: DirectAdminServerAPI, params: Record<string, unknown>) => Promise<unknown>> = {
  listWebsites: (api) => api.listWebsites(),
  listUsers: (api) => api.listUsers(),
  listPackages: (api) => api.listPackages(),
  listEmails: (api, params) => api.listEmails(String(params.domain || '')),
  listDNS: (api, params) => api.listDNS(String(params.domain || '')),
};

export async function POST(req: NextRequest) {
  try {
    const { action, params = {} } = await req.json();

    if (!action) {
      return NextResponse.json({ success: false, error: 'action obrigatório' }, { status: 400 });
    }

    if (LIST_ACTIONS[action]) {
      const auth = await requireAdminOrReseller();
      if ('error' in auth) return auth.error;

      const api = await getDirectAdminAPIForAuth(auth.user);
      const data = await LIST_ACTIONS[action](api, params);
      return NextResponse.json({ success: true, data });
    }

    if (action === 'fullSync') {
      const auth = await requireAdminOrReseller();
      if ('error' in auth) return auth.error;

      const api = await getDirectAdminAPIForAuth(auth.user);
      const [sites, users, packages] = await Promise.all([
        api.listWebsites(),
        api.listUsers(),
        api.listPackages(),
      ]);
      return NextResponse.json({
        success: true,
        data: {
          message: 'Sincronização DirectAdmin concluída.',
          sites,
          users,
          packages,
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
