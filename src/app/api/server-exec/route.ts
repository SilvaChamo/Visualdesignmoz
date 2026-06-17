import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { getServerHost } from '@/lib/server-config';
import type { DirectAdminServerAPI } from '@/lib/directadmin-adapter';
import { getDirectAdminAPIForAuth } from '@/lib/directadmin-adapter';
import { requireAdminOrReseller, type PanelAuthSuccess } from '@/lib/panel-api-auth';
import { resolvePanelDaContext } from '@/lib/panel-api-context';
import { runDaFullSyncDeduped, scheduleDaSync } from '@/lib/da-sync-engine';
import { daPostViaSsh } from '@/lib/da-api-ssh';
import {
  deleteMirrorPackage,
  mirrorAfterDaMutation,
  mutationSucceeded,
  packageMirrorRowFromParams,
  upsertMirrorPackage,
} from '@/lib/panel-mirror-write';
import {
  listMirrorDns,
  listMirrorEmails,
  listMirrorPackages,
  listMirrorUsers,
  listMirrorWebsites,
  getMirrorLastSyncAt,
  getMirrorPackageForm,
} from '@/lib/panel-mirror-read';
import { mergePackageListByName, resolveMirrorOrLive } from '@/lib/panel-list-resolve';
import type { PanelPackage } from '@/lib/directadmin-hosting-api';

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

/** Aplica pacote no DirectAdmin em background (não bloqueia a resposta ao painel). */
function pushPackageToDaInBackground(
  action: string,
  params: Record<string, unknown>,
  daManageCmd: string,
  auth: PanelAuthSuccess,
): void {
  void (async () => {
    try {
      const pkgName = String(params.packageName || params.package || '').trim();
      if (!pkgName) return;
      const { daApi: api } = await resolvePanelDaContext(auth);
      const role = auth.user.role;

      if (action === 'deletePackage') {
        if (role === 'admin') {
          await daPostViaSsh(daManageCmd, { delete: 'Delete', delete0: pkgName });
        } else {
          await DA_MUTATION_PROXY.deletePackage(api, params);
        }
        return;
      }

      const fullForm = params.hostingPackageForm as
        | import('@/lib/reseller-package-form').ResellerPackageFormState
        | undefined;
      if (!fullForm?.limits && !fullForm?.packageName) return;

      if (role === 'admin') {
        const { hostingPackageFormToDaFields } = await import('@/lib/reseller-package-form');
        const fields = hostingPackageFormToDaFields({
          ...fullForm,
          packageName: pkgName || fullForm.packageName,
        });
        await daPostViaSsh(daManageCmd, fields);
        return;
      }

      const mutator = DA_MUTATION_PROXY[action];
      if (mutator) await mutator(api, params);
    } catch (e) {
      console.error('[server-exec] pushPackageToDaInBackground:', e);
    }
  })();
}

const DA_READ_PROXY: Record<
  string,
  (api: DirectAdminServerAPI, params: Record<string, unknown>) => Promise<unknown>
> = {
  getPackageDetails: (api, p) => api.getPackageDetails(String(p.packageName || '')),
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

    if (action === 'getPackageForm') {
      const auth = await requireAdminOrReseller();
      if ('error' in auth) return auth.error;

      const name = String(params.packageName || '').trim();
      if (!name) {
        return NextResponse.json({ success: false, error: 'Nome do pacote obrigatório' }, { status: 400 });
      }

      const stored = await getMirrorPackageForm(name);
      if (stored) {
        return NextResponse.json({ success: true, data: stored, meta: { source: 'mirror' } });
      }

      const { packageListRowToForm } = await import('@/lib/reseller-package-form');
      const listRow =
        params.listRow && typeof params.listRow === 'object'
          ? (params.listRow as Record<string, unknown>)
          : { packageName: name };

      const { getDaSyncAdmin } = await import('@/lib/da-sync-schema');
      const admin = getDaSyncAdmin();
      if (admin) {
        const { data: row } = await admin.from('panel_packages').select('*').eq('package_name', name).maybeSingle();
        if (row) {
          const { mapPackageForForm } = await import('@/lib/panel-mirror-read');
          const form = packageListRowToForm(
            mapPackageForForm(row as Record<string, unknown>) as unknown as Record<string, unknown>,
            name,
          );
          return NextResponse.json({ success: true, data: form, meta: { source: 'mirror-limits' } });
        }
      }

      const form = packageListRowToForm(listRow, name);
      return NextResponse.json({ success: true, data: form, meta: { source: 'list' } });
    }

    if (LIVE_LIST_FALLBACK[action]) {
      const auth = await requireAdminOrReseller();
      if ('error' in auth) return auth.error;

      const { daApi: api, mirrorScope } = await resolvePanelDaContext(auth);
      const fallback = LIVE_LIST_FALLBACK[action];

      const mirrorRows = (await readFromMirror(action, mirrorScope, params)) as PanelPackage[];
      const mirrorList = Array.isArray(mirrorRows) ? mirrorRows : [];

      const data = await resolveMirrorOrLive({
        onStale: () => scheduleDaSync(0),
        mirror: async () => mirrorList,
        live: async () => {
          const rows = await fallback(api, params);
          if (Array.isArray(rows) && rows.length > 0) scheduleDaSync(500);
          return Array.isArray(rows) ? rows : [];
        },
      });

      const listData =
        action === 'listPackages' && Array.isArray(data)
          ? mergePackageListByName(mirrorList, data as PanelPackage[])
          : data;

      const lastSyncedAt = await getMirrorLastSyncAt();
      return NextResponse.json({
        success: true,
        data: listData,
        meta: { source: 'mirror', lastSyncedAt },
      });
    }

    if (DA_READ_PROXY[action]) {
      const auth = await requireAdminOrReseller();
      if ('error' in auth) return auth.error;

      const { daApi: api } = await resolvePanelDaContext(auth);
      const data = await DA_READ_PROXY[action](api, params as Record<string, unknown>);
      return NextResponse.json({ success: true, data });
    }

    if (DA_MUTATION_PROXY[action]) {
      const auth = await requireAdminOrReseller();
      if ('error' in auth) return auth.error;

      const isPackageMutation =
        action === 'createPackage' ||
        action === 'editPackage' ||
        action === 'modifyPackage' ||
        action === 'deletePackage';

      if (isPackageMutation) {
        const pkgName = String(params.packageName || params.package || '').trim();
        const paramsRecord = params as Record<string, unknown>;
        const isResellerScope =
          String(paramsRecord.packageScope) === 'reseller' ||
          auth.user.role === 'reseller';
        const daManageCmd = isResellerScope
          ? 'CMD_API_MANAGE_RESELLER_PACKAGES'
          : 'CMD_API_MANAGE_USER_PACKAGES';

        if (action === 'deletePackage') {
          if (!pkgName) {
            return NextResponse.json(
              { success: false, error: 'Nome do pacote obrigatório.' },
              { status: 400 },
            );
          }
          const mirrorDel = await deleteMirrorPackage(pkgName);
          if (!mirrorDel.ok) {
            return NextResponse.json({ success: false, error: mirrorDel.error || 'Falha ao guardar no painel' });
          }
          pushPackageToDaInBackground(action, paramsRecord, daManageCmd, auth);
          scheduleDaSync(2000);
          return NextResponse.json({ success: true, serverSynced: true, data: { savedToMirror: true } });
        }

        const mirrorRow = packageMirrorRowFromParams(paramsRecord);
        if (!mirrorRow) {
          return NextResponse.json(
            { success: false, error: 'Nome do pacote obrigatório.' },
            { status: 400 },
          );
        }

        const mirrorSave = await upsertMirrorPackage(mirrorRow);
        if (!mirrorSave.ok) {
          return NextResponse.json({
            success: false,
            error: mirrorSave.error || 'Falha ao guardar no painel',
          });
        }

        pushPackageToDaInBackground(action, paramsRecord, daManageCmd, auth);
        scheduleDaSync(2000);

        return NextResponse.json({
          success: true,
          serverSynced: true,
          data: { savedToMirror: true },
        });
      }

      const { daApi: api } = await resolvePanelDaContext(auth);
      let data = await DA_MUTATION_PROXY[action](api, params as Record<string, unknown>);
      const ok = mutationSucceeded(data);
      const errMsg =
        ok || typeof data !== 'object' || data === null
          ? undefined
          : String((data as { error?: string; output?: string }).error || (data as { output?: string }).output || '');

      if (ok) {
        await mirrorAfterDaMutation(action, params as Record<string, unknown>);
      }
      scheduleDaSync(400);

      return NextResponse.json({ success: ok, data, error: errMsg || undefined });
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

      if (action === 'siteDiskUsage') {
        const domain = String(params.domain || '').trim();
        const owner = String(params.owner || 'admin').trim();
        if (!domain) {
          return NextResponse.json({ success: true, data: { usage: '—' } });
        }
        try {
          const { executeServerCommand } = await import('@/lib/server-ssh-exec');
          const sitePath = `/home/${owner}/domains/${domain}`;
          const output = await executeServerCommand(
            `du -sh ${sitePath} 2>/dev/null | awk '{print $1}'`,
          );
          const usage = output.trim() || '—';
          return NextResponse.json({ success: true, data: { usage } });
        } catch {
          return NextResponse.json({
            success: true,
            data: { usage: '—', host: getServerHost() },
          });
        }
      }

      return NextResponse.json({
        success: true,
        data: { disabled: false, host: getServerHost() },
      });
    }

    if (action === 'checkSitesSsl') {
      const auth = await requireAdminOrReseller();
      if ('error' in auth) return auth.error;

      const raw = params.domains;
      const domains = Array.isArray(raw)
        ? raw.map((d) => String(d).trim()).filter(Boolean)
        : [String(params.domain || '').trim()].filter(Boolean);

      const ssl: Record<string, boolean> = {};
      if (domains.length) {
        const { executeServerCommand } = await import('@/lib/server-ssh-exec');
        await Promise.all(
          domains.slice(0, 30).map(async (domain) => {
            try {
              const out = await executeServerCommand(
                `curl -skI --max-time 8 "https://${domain}" 2>&1 | head -1`,
              );
              const line = out.toLowerCase();
              ssl[domain] =
                /http\/[12]/.test(line) &&
                (line.includes('200') || line.includes('301') || line.includes('302'));
            } catch {
              ssl[domain] = false;
            }
          }),
        );
      }

      return NextResponse.json({ success: true, data: { ssl } });
    }

    if (action === 'resolveSitePath') {
      const auth = await requireAdminOrReseller();
      if ('error' in auth) return auth.error;

      const targetDomain = String(params.domain || '').trim().toLowerCase();
      if (!targetDomain) {
        return NextResponse.json({ success: false, error: 'domain é obrigatório' }, { status: 400 });
      }

      const { getMirrorSiteOwner } = await import('@/lib/panel-mirror-read');
      const mirrorOwner = await getMirrorSiteOwner(targetDomain);
      if (mirrorOwner) {
        return NextResponse.json({
          success: true,
          data: {
            path: `/home/${mirrorOwner}/domains/${targetDomain}/public_html`,
            owner: mirrorOwner,
          },
        });
      }

      const { resolveDomainSitePath } = await import('@/lib/wp-cli-server');
      const site = await resolveDomainSitePath(targetDomain);
      if (!site) {
        return NextResponse.json({ success: false, error: 'Caminho do site não encontrado' }, { status: 404 });
      }

      return NextResponse.json({
        success: true,
        data: { path: site.path, owner: site.user },
      });
    }

    if (action === 'listDirectory') {
      const auth = await requireAdminOrReseller();
      if ('error' in auth) return auth.error;

      const targetPath = String(params.path || '').trim();
      if (!targetPath.startsWith('/home/') || targetPath.includes('..')) {
        return NextResponse.json({ success: false, error: 'Caminho inválido' }, { status: 400 });
      }

      const { executeServerCommand } = await import('@/lib/server-ssh-exec');
      const script = [
        'import os, json, stat, datetime as dt',
        `p = ${JSON.stringify(targetPath)}`,
        'if not os.path.isdir(p):',
        '    print(json.dumps({"error": "not_found"}))',
        'else:',
        '    rows = []',
        '    for name in sorted(os.listdir(p), key=str.lower):',
        "        if name in ('.', '..'): continue",
        '        fp = os.path.join(p, name)',
        '        try:',
        '            st = os.lstat(fp)',
        '            rows.append({',
        '                "name": name,',
        '                "isDir": stat.S_ISDIR(st.st_mode),',
        '                "isLink": stat.S_ISLNK(st.st_mode),',
        '                "size": st.st_size,',
        '                "permissions": oct(st.st_mode)[-3:],',
        '                "date": dt.datetime.fromtimestamp(st.st_mtime).strftime("%Y-%m-%d %H:%M"),',
        '            })',
        '        except OSError:',
        '            pass',
        '    print(json.dumps(rows))',
      ].join('\n');

      // JSON.stringify em -c quebra no shell remoto (\n vira continuação de linha inválida).
      const b64 = Buffer.from(script, 'utf8').toString('base64');
      const output = await executeServerCommand(
        `python3 -c "import base64; exec(base64.b64decode('${b64}').decode())"`,
      );
      try {
        const parsed = JSON.parse(output.trim());
        if (parsed && typeof parsed === 'object' && 'error' in parsed) {
          return NextResponse.json({ success: false, error: 'Pasta não encontrada' }, { status: 404 });
        }
        return NextResponse.json({ success: true, data: { files: Array.isArray(parsed) ? parsed : [] } });
      } catch {
        return NextResponse.json({ success: false, error: output.slice(0, 300) || 'Erro ao listar pasta' }, { status: 500 });
      }
    }

    if (action === 'execCommand') {
      const auth = await requireAdminOrReseller();
      if ('error' in auth) return auth.error;
      if (auth.user.role !== 'admin') {
        return NextResponse.json({ success: false, error: 'Apenas administradores.' }, { status: 403 });
      }

      const command = String(params.command || '').trim();
      if (!command) {
        return NextResponse.json({ success: false, error: 'Comando obrigatório' }, { status: 400 });
      }

      const blocked = /[;&|`$(){}<>]/.test(command) || /\brm\s+-rf\b/i.test(command);
      const allowed =
        /^ls\s+-lht\s+\/home\/[\w.-]+\/backup\//.test(command) ||
        /^tar\s+-czf\s+\/home\/[\w.-]+\/backup\//.test(command) ||
        /^du\s+-sh\s+\/home\//.test(command) ||
        /^directadmin\s+/.test(command);
      if (blocked || !allowed) {
        return NextResponse.json({ success: false, error: 'Comando não permitido.' }, { status: 400 });
      }

      const { executeServerCommand } = await import('@/lib/server-ssh-exec');
      const output = await executeServerCommand(command);
      return NextResponse.json({ success: true, data: { output } });
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
  const domain = searchParams.get('domain')?.trim();
  const width = searchParams.get('w') || '600';

  if (action === 'getScreenshot' && domain) {
    const safeDomain = domain.replace(/[^a-zA-Z0-9.-]/g, '');
    const proto = searchParams.get('proto') === 'http' ? 'http' : 'https';
    const sources = [
      `https://image.thum.io/get/width/${width}/crop/600/noanimate/${proto}://${safeDomain}`,
      `https://image.thum.io/get/width/${width}/noanimate/${proto}://${safeDomain}`,
    ];

    for (const src of sources) {
      try {
        const res = await fetch(src, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VisualDesignPanel/1.0)' },
          signal: AbortSignal.timeout(35000),
        });
        if (!res.ok) continue;
        const contentType = res.headers.get('content-type') || 'image/png';
        const buffer = await res.arrayBuffer();
        if (buffer.byteLength < 2000) continue;
        return new NextResponse(buffer, {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=300',
          },
        });
      } catch {
        /* tenta próximo URL */
      }
    }

    return NextResponse.json({ error: 'Screenshot indisponível' }, { status: 502 });
  }

  return NextResponse.json({ error: 'Action not allowed via GET' }, { status: 405 });
}
