import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
import { getServerHost } from '@/lib/server-config';
import type { DirectAdminServerAPI } from '@/lib/directadmin-adapter';
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
  isMirrorStale,
} from '@/lib/panel-mirror-read';
import { mergePackageListByName, resolveMirrorOrLive } from '@/lib/panel-list-resolve';
import type { PanelPackage } from '@/lib/directadmin-hosting-api';
import { isValidHomePath, assertPathsOwnedByCaller } from '@/lib/panel-fs-ownership';

function normalizeHomePaths(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => String(item).trim()).filter(isValidHomePath);
}

/** Domínio/username têm de bater certo com formato de hostname/DA-username — evita injecção em comandos shell. */
function isSafeShellToken(value: string): boolean {
  return /^[a-z0-9]([a-z0-9._-]{0,63})?$/i.test(value);
}

async function runPythonOnServer(script: string): Promise<string> {
  const { executeServerCommand } = await import('@/lib/server-ssh-exec');
  const b64 = Buffer.from(script, 'utf8').toString('base64');
  return executeServerCommand(
    `python3 -c "import base64; exec(base64.b64decode('${b64}').decode())"`,
  );
}

function parsePythonJsonOutput(output: string): unknown {
  return JSON.parse(output.trim());
}

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
  addDomainPointer: (api, p) => api.addDomainPointer(p),
  deleteDomainPointer: (api, p) => api.deleteDomainPointer(p),
};

/** Aplica pacote no DirectAdmin de forma síncrona. */
async function pushPackageToDa(
  action: string,
  params: Record<string, unknown>,
  daManageCmd: string,
  auth: PanelAuthSuccess,
): Promise<void> {
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
      const res = await daPostViaSsh(daManageCmd, fields);
      if (!res.ok) {
        throw new Error(res.error || 'Falha ao guardar pacote no DirectAdmin');
      }
      return;
    }

    const mutator = DA_MUTATION_PROXY[action];
    if (mutator) {
      const res = (await mutator(api, params)) as { success?: boolean; error?: string; output?: string } | boolean;
      if (typeof res === 'object' && res !== null) {
        if (res.success === false || res.error) {
          throw new Error(res.error || res.output || 'Falha ao guardar pacote no DirectAdmin');
        }
      } else if (!res) {
        throw new Error('Falha ao guardar pacote no DirectAdmin');
      }
    }
  } catch (e) {
    console.error('[server-exec] pushPackageToDa:', e);
    throw e;
  }
}

/** Cria um domínio adicional numa conta Hestia — equivalente ao CMD_API_DOMAIN
 * do DirectAdmin usado por DA_MUTATION_PROXY.createWebsite (o único caminho
 * antes disto, mesmo para contas Hestia — confirmado ao vivo 1 set: dava
 * sempre erro do DirectAdmin real ao tentar criar um domínio numa conta que
 * só existe no Hestia). O DomainCreateModal nunca envia 'owner', por isso a
 * conta alvo tem de ser inferida: revendedor/impersonação usa a conta real
 * dele (só avança se essa conta for mesmo Hestia); admin puro (sem conta
 * escolhida) segue a mesma regra já usada para decidir o provider de contas
 * NOVAS (ver resolveNewAccountProvider em checkout-fulfillment.ts) — Contabo
 * (DEFAULT_HOSTING_PROVIDER=hestia) usa a conta principal do Hestia
 * (HESTIA_USER, normalmente 'vdadmin'); Hetzner continua no DirectAdmin como
 * sempre. Devolve null quando a conta é DirectAdmin — segue o caminho antigo. */
async function tryHestiaCreateWebsite(
  mirrorScope: { role: 'admin' | 'reseller'; daUsername?: string },
  params: Record<string, unknown>,
): Promise<NextResponse | null> {
  const domain = String(params.domain || params.domainName || '').trim().toLowerCase();
  if (!domain) return null;

  const { getProviderByUsername } = await import('@/lib/hosting-provider');

  let owner: string;
  if (mirrorScope.role === 'reseller' && mirrorScope.daUsername) {
    owner = mirrorScope.daUsername;
    const provider = await getProviderByUsername(owner);
    if (provider !== 'hestia') return null;
  } else {
    const defaultProvider = (process.env.DEFAULT_HOSTING_PROVIDER || '').trim().toLowerCase();
    if (defaultProvider !== 'hestia') return null;
    owner = (process.env.HESTIA_USER || 'vdadmin').trim();
  }

  const { addWebDomain } = await import('@/lib/hestia-adapter');
  const result = await addWebDomain(owner, domain);
  if (!result.ok) {
    return NextResponse.json(
      { success: false, error: result.error || 'Falha ao criar domínio no Hestia' },
      { status: 500 },
    );
  }

  // Aponta o domínio para o servidor — melhor esforço, mesma lógica de
  // attach-hosting/route.ts. Sem isto o site fica criado no Hestia mas
  // continua sem resolver (NXDOMAIN), porque criar o website aqui nunca
  // mexe na Cloudflare — confirmado ao vivo 1 set com entrecamposblog.com.
  (async () => {
    try {
      const { findCloudflareZoneId, upsertCloudflareRecord } = await import('@/lib/cloudflare-dns');
      const zoneId = await findCloudflareZoneId(domain);
      if (zoneId) {
        const serverIp = getServerHost();
        await Promise.all([
          upsertCloudflareRecord(zoneId, domain, { type: 'A', name: '@', content: serverIp, proxied: false }),
          upsertCloudflareRecord(zoneId, domain, { type: 'A', name: 'www', content: serverIp, proxied: false }),
        ]);
      }
    } catch {
      // best-effort — não bloqueia a criação do website
    }
  })();

  await mirrorAfterDaMutation('createWebsite', { ...params, owner }).catch(() => undefined);
  scheduleDaSync(400);
  return NextResponse.json({ success: true, data: { output: 'website has been created' } });
}

const DA_READ_PROXY: Record<
  string,
  (api: DirectAdminServerAPI, params: Record<string, unknown>) => Promise<unknown>
> = {
  getPackageDetails: (api, p) => api.getPackageDetails(String(p.packageName || '')),
  listDomainPointers: (api, p) => api.listDomainPointers(String(p.domain || '')),
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

      // Só ir ao DirectAdmin ao vivo quando o espelho está desactualizado ou vazio —
      // evita esperar por uma chamada DA em toda a visita (mesmo padrão de /api/admin/clientes).
      let liveList: PanelPackage[] = [];
      const stale = await isMirrorStale(120);
      if (stale) scheduleDaSync(0);
      if (stale || mirrorList.length === 0) {
        try {
          liveList = (await fallback(api, params)) as PanelPackage[];
          if (Array.isArray(liveList) && liveList.length > 0) scheduleDaSync(500);
        } catch {
          /* espelho apenas */
        }
      }

      const data =
        action === 'listPackages'
          ? mergePackageListByName(mirrorList, liveList)
          : await resolveMirrorOrLive({
              onStale: () => scheduleDaSync(0),
              mirror: async () => mirrorList,
              live: async () => liveList,
            });

      const lastSyncedAt = await getMirrorLastSyncAt();
      return NextResponse.json({
        success: true,
        data,
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
          await pushPackageToDa(action, paramsRecord, daManageCmd, auth);
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

        try {
          await pushPackageToDa(action, paramsRecord, daManageCmd, auth);
        } catch (e: any) {
          return NextResponse.json(
            { success: false, error: e.message || 'Falha ao guardar pacote no DirectAdmin' },
            { status: 500 },
          );
        }

        const mirrorSave = await upsertMirrorPackage(mirrorRow);
        if (!mirrorSave.ok) {
          return NextResponse.json({
            success: false,
            error: mirrorSave.error || 'Falha ao guardar no painel',
          });
        }

        scheduleDaSync(2000);

        return NextResponse.json({
          success: true,
          serverSynced: true,
          data: { savedToMirror: true },
        });
      }

      const { daApi: api, mirrorScope } = await resolvePanelDaContext(auth);

      if (action === 'createWebsite') {
        const hestiaResponse = await tryHestiaCreateWebsite(mirrorScope, params as Record<string, unknown>);
        if (hestiaResponse) return hestiaResponse;
      }

      let data = await DA_MUTATION_PROXY[action](api, params as Record<string, unknown>);
      const ok = mutationSucceeded(data);
      const errMsg =
        ok || typeof data !== 'object' || data === null
          ? undefined
          : String((data as { error?: string; output?: string }).error || (data as { output?: string }).output || '');

      if (ok) {
        // DomainCreateModal (e outros formulários antigos deste route) nunca
        // enviam 'owner'/'userName' — sem isto, o espelho gravava sempre
        // owner:'admin' (fallback literal em mirrorAfterDaMutation), mesmo
        // quando o pedido real ao DirectAdmin já corria correctamente na
        // conta certa (via mirrorScope, resolvido no servidor). O domínio
        // ficava então invisível na lista do revendedor/cliente dono real.
        const contextOwner = mirrorScope.role === 'reseller' ? mirrorScope.daUsername : undefined;
        const paramsWithOwner = contextOwner
          ? { ...(params as Record<string, unknown>), owner: (params as Record<string, unknown>).owner || contextOwner }
          : (params as Record<string, unknown>);
        await mirrorAfterDaMutation(action, paramsWithOwner);
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
        const { daApi: api } = await resolvePanelDaContext(auth);
        const stats = await api.getServerStats();
        return NextResponse.json({ success: true, data: stats });
      }

      if (action === 'siteDiskUsage') {
        const domain = String(params.domain || '').trim().toLowerCase();
        if (!domain) {
          return NextResponse.json({ success: true, data: { usage: '—' } });
        }
        if (!isSafeShellToken(domain)) {
          return NextResponse.json({ success: false, error: 'Domínio inválido' }, { status: 400 });
        }
        try {
          const { getMirrorSiteOwner } = await import('@/lib/panel-mirror-read');
          const owner = (await getMirrorSiteOwner(domain)) || 'admin';
          if (!isSafeShellToken(owner)) {
            return NextResponse.json({ success: true, data: { usage: '—' } });
          }
          if (auth.user.role !== 'admin' && !(await assertPathsOwnedByCaller([`/home/${owner}/`], auth.user.id))) {
            return NextResponse.json({ success: false, error: 'Domínio fora do seu painel.' }, { status: 403 });
          }
          const { executeServerCommand } = await import('@/lib/server-ssh-exec');
          // O Hestia guarda os sites em .../web/<dominio>, nao .../domains/<dominio>
          // (so o DirectAdmin usa esse padrao) — sem isto, o espaco em disco de
          // uma conta Hestia aparecia sempre como "—" (pasta errada, vazia).
          const { getProviderByUsername } = await import('@/lib/hosting-provider');
          const siteProvider = await getProviderByUsername(owner);
          const sitePath = `/home/${owner}/${siteProvider === 'hestia' ? 'web' : 'domains'}/${domain}`;
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

    if (action === 'pm2ProcessList') {
      const auth = await requireAdminOrReseller();
      if ('error' in auth) return auth.error;
      if (auth.user.role !== 'admin') {
        return NextResponse.json({ success: false, error: 'Apenas administradores' }, { status: 403 });
      }

      try {
        const { executeServerCommand } = await import('@/lib/server-ssh-exec');
        const output = await executeServerCommand('pm2 jlist');
        const list = JSON.parse(output) as Array<{
          name?: string;
          monit?: { cpu?: number; memory?: number };
          pm2_env?: { status?: string; pm_uptime?: number; restart_time?: number };
        }>;
        const processes = list.map((p) => ({
          name: String(p.name || ''),
          status: String(p.pm2_env?.status || ''),
          cpu: Number(p.monit?.cpu) || 0,
          memoryMb: Math.round((Number(p.monit?.memory) || 0) / 1024 / 1024),
          uptimeMs: p.pm2_env?.pm_uptime ? Date.now() - Number(p.pm2_env.pm_uptime) : null,
          restarts: Number(p.pm2_env?.restart_time) || 0,
        }));
        return NextResponse.json({ success: true, data: { processes } });
      } catch (e: unknown) {
        return NextResponse.json({
          success: false,
          error: e instanceof Error ? e.message : 'Falha ao consultar processos PM2',
        }, { status: 502 });
      }
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

    // ── Hestia direct: lista de domínios web sem mirror ──────────────────────
    if (action === 'listHestiaWebDomains') {
      const auth = await requireAdminOrReseller();
      if ('error' in auth) return auth.error;
      const { listWebDomains } = await import('@/lib/hestia-adapter');
      const hestiaUser = (process.env.HESTIA_USER || 'vdadmin').trim();
      const domains = await listWebDomains(hestiaUser);
      const result = domains.map((d) => ({
        domain: d.domain,
        owner: hestiaUser,
        path: `/home/${hestiaUser}/web/${d.domain}/public_html`,
        suspended: d.suspended,
      }));
      return NextResponse.json({ success: true, data: result });
    }

    if (action === 'resolveSitePath') {
      const auth = await requireAdminOrReseller();
      if ('error' in auth) return auth.error;

      const targetDomain = String(params.domain || '').trim().toLowerCase();
      if (!targetDomain) {
        return NextResponse.json({ success: false, error: 'domain é obrigatório' }, { status: 400 });
      }

      // Usa hosting-resolver: no Contabo vai directo ao Hestia, no Hetzner usa mirror
      const { resolveHostingOwner, resolveHostingPath } = await import('@/lib/hosting-resolver');
      const owner = await resolveHostingOwner(targetDomain);
      const resolvedPath = await resolveHostingPath(targetDomain);

      if (owner) {
        if (auth.user.role !== 'admin' && !(await assertPathsOwnedByCaller([`/home/${owner}/`], auth.user.id))) {
          return NextResponse.json({ success: false, error: 'Domínio fora do seu painel.' }, { status: 403 });
        }
        return NextResponse.json({
          success: true,
          data: { path: resolvedPath, owner },
        });
      }

      const { resolveDomainSitePath } = await import('@/lib/wp-cli-server');
      const site = await resolveDomainSitePath(targetDomain);
      if (!site) {
        return NextResponse.json({ success: false, error: 'Caminho do site não encontrado' }, { status: 404 });
      }
      if (auth.user.role !== 'admin' && !(await assertPathsOwnedByCaller([`/home/${site.user}/`], auth.user.id))) {
        return NextResponse.json({ success: false, error: 'Domínio fora do seu painel.' }, { status: 403 });
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
      if (auth.user.role !== 'admin' && !(await assertPathsOwnedByCaller([targetPath], auth.user.id))) {
        return NextResponse.json({ success: false, error: 'Caminho fora do seu painel.' }, { status: 403 });
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

    const FILE_OPS = new Set([
      'readFileContent',
      'writeFileContent',
      'deletePaths',
      'copyPaths',
      'movePaths',
      'duplicatePath',
      'compressPaths',
      'extractArchive',
      'renamePath',
      'setPathPermissions',
      'createFolder',
      'downloadFile',
    ]);

    if (FILE_OPS.has(action)) {
      const auth = await requireAdminOrReseller();
      if ('error' in auth) return auth.error;

      const p = params as Record<string, unknown>;

      if (auth.user.role !== 'admin') {
        const candidatePaths = [p.path, p.destDir, p.archivePath]
          .concat(Array.isArray(p.paths) ? p.paths : [])
          .concat(Array.isArray(p.sources) ? p.sources : [])
          .filter((v): v is string => typeof v === 'string' && v.trim().startsWith('/home/'));
        if (!(await assertPathsOwnedByCaller(candidatePaths, auth.user.id))) {
          return NextResponse.json({ success: false, error: 'Caminho fora do seu painel.' }, { status: 403 });
        }
      }

      if (action === 'readFileContent') {
        const filePath = String(p.path || '').trim();
        if (!isValidHomePath(filePath)) {
          return NextResponse.json({ success: false, error: 'Caminho inválido' }, { status: 400 });
        }
        const maxBytes = Math.min(Number(p.maxBytes) || 2 * 1024 * 1024, 4 * 1024 * 1024);
        const script = [
          'import os, json, base64',
          `p = ${JSON.stringify(filePath)}`,
          `limit = ${maxBytes}`,
          'if not os.path.isfile(p):',
          '    print(json.dumps({"error": "not_file"}))',
          'elif os.path.getsize(p) > limit:',
          '    print(json.dumps({"error": "too_large"}))',
          'else:',
          '    with open(p, "rb") as f:',
          '        data = base64.b64encode(f.read()).decode()',
          '    print(json.dumps({"content": data, "size": os.path.getsize(p)}))',
        ].join('\n');
        const output = await runPythonOnServer(script);
        try {
          const parsed = parsePythonJsonOutput(output) as { error?: string; content?: string };
          if (parsed.error === 'not_file') {
            return NextResponse.json({ success: false, error: 'Ficheiro não encontrado' }, { status: 404 });
          }
          if (parsed.error === 'too_large') {
            return NextResponse.json({ success: false, error: 'Ficheiro demasiado grande para editar' }, { status: 413 });
          }
          return NextResponse.json({ success: true, data: parsed });
        } catch {
          return NextResponse.json({ success: false, error: output.slice(0, 300) }, { status: 500 });
        }
      }

      if (action === 'writeFileContent') {
        const filePath = String(p.path || '').trim();
        if (!isValidHomePath(filePath) || p.contentBase64 === undefined || p.contentBase64 === null) {
          return NextResponse.json({ success: false, error: 'Dados inválidos' }, { status: 400 });
        }
        const contentB64 = String(p.contentBase64);
        const script = [
          'import os, json, base64',
          `p = ${JSON.stringify(filePath)}`,
          `data = base64.b64decode(${JSON.stringify(contentB64)})`,
          'parent = os.path.dirname(p)',
          'if not parent.startswith("/home/"):',
          '    print(json.dumps({"error": "invalid"}))',
          'else:',
          '    os.makedirs(parent, exist_ok=True)',
          '    with open(p, "wb") as f:',
          '        f.write(data)',
          '    os.chmod(p, 0o644)',
          '    print(json.dumps({"ok": True}))',
        ].join('\n');
        const output = await runPythonOnServer(script);
        try {
          const parsed = parsePythonJsonOutput(output) as { error?: string };
          if (parsed.error) {
            return NextResponse.json({ success: false, error: 'Não foi possível guardar' }, { status: 400 });
          }
          return NextResponse.json({ success: true });
        } catch {
          return NextResponse.json({ success: false, error: output.slice(0, 300) }, { status: 500 });
        }
      }

      if (action === 'deletePaths') {
        const paths = normalizeHomePaths(p.paths);
        if (!paths.length) {
          return NextResponse.json({ success: false, error: 'Nenhum caminho válido' }, { status: 400 });
        }
        const script = [
          'import os, shutil, json',
          `paths = ${JSON.stringify(paths)}`,
          'deleted = []',
          'errors = []',
          'for p in paths:',
          '    if not p.startswith("/home/") or ".." in p:',
          '        continue',
          '    try:',
          '        if os.path.isdir(p) and not os.path.islink(p):',
          '            shutil.rmtree(p)',
          '        elif os.path.exists(p):',
          '            os.remove(p)',
          '        deleted.append(p)',
          '    except OSError as e:',
          '        errors.append({"path": p, "error": str(e)})',
          'print(json.dumps({"deleted": deleted, "errors": errors}))',
        ].join('\n');
        const output = await runPythonOnServer(script);
        try {
          const parsed = parsePythonJsonOutput(output) as { deleted?: string[]; errors?: unknown[] };
          const ok = (parsed.deleted?.length || 0) > 0;
          return NextResponse.json({
            success: ok,
            data: parsed,
            error: ok ? undefined : 'Não foi possível eliminar',
          });
        } catch {
          return NextResponse.json({ success: false, error: output.slice(0, 300) }, { status: 500 });
        }
      }

      if (action === 'copyPaths' || action === 'movePaths') {
        const sources = normalizeHomePaths(p.sources);
        const destDir = String(p.destDir || '').trim();
        if (!sources.length || !isValidHomePath(destDir)) {
          return NextResponse.json({ success: false, error: 'Origem ou destino inválido' }, { status: 400 });
        }
        const op = action === 'movePaths' ? 'move' : 'copy';
        const script = [
          'import os, shutil, json',
          `sources = ${JSON.stringify(sources)}`,
          `dest_dir = ${JSON.stringify(destDir)}`,
          `op = ${JSON.stringify(op)}`,
          'if not os.path.isdir(dest_dir):',
          '    print(json.dumps({"error": "dest_missing"}))',
          'else:',
          '    done = []',
          '    errors = []',
          '    for src in sources:',
          '        try:',
          '            target = os.path.join(dest_dir, os.path.basename(src))',
          '            if op == "move":',
          '                shutil.move(src, target)',
          '            elif os.path.isdir(src):',
          '                shutil.copytree(src, target)',
          '            else:',
          '                shutil.copy2(src, target)',
          '            done.append(target)',
          '        except Exception as e:',
          '            errors.append({"path": src, "error": str(e)})',
          '    print(json.dumps({"done": done, "errors": errors}))',
        ].join('\n');
        const output = await runPythonOnServer(script);
        try {
          const parsed = parsePythonJsonOutput(output) as { error?: string; done?: string[] };
          if (parsed.error === 'dest_missing') {
            return NextResponse.json({ success: false, error: 'Pasta de destino não encontrada' }, { status: 404 });
          }
          const ok = (parsed.done?.length || 0) > 0;
          return NextResponse.json({ success: ok, data: parsed });
        } catch {
          return NextResponse.json({ success: false, error: output.slice(0, 300) }, { status: 500 });
        }
      }

      if (action === 'duplicatePath') {
        const source = String(p.path || '').trim();
        if (!isValidHomePath(source)) {
          return NextResponse.json({ success: false, error: 'Caminho inválido' }, { status: 400 });
        }
        const script = [
          'import os, shutil, json',
          `src = ${JSON.stringify(source)}`,
          'if not os.path.exists(src):',
          '    print(json.dumps({"error": "missing"}))',
          'else:',
          '    base = os.path.basename(src)',
          '    parent = os.path.dirname(src)',
          '    name, ext = os.path.splitext(base)',
          '    candidate = f"{name}_copia{ext}" if ext else f"{base}_copia"',
          '    i = 1',
          '    while os.path.exists(os.path.join(parent, candidate)):',
          '        candidate = f"{name}_copia{i}{ext}" if ext else f"{base}_copia{i}"',
          '        i += 1',
          '    dest = os.path.join(parent, candidate)',
          '    if os.path.isdir(src) and not os.path.islink(src):',
          '        shutil.copytree(src, dest)',
          '    else:',
          '        shutil.copy2(src, dest)',
          '    print(json.dumps({"path": dest}))',
        ].join('\n');
        const output = await runPythonOnServer(script);
        try {
          const parsed = parsePythonJsonOutput(output) as { error?: string; path?: string };
          if (parsed.error) {
            return NextResponse.json({ success: false, error: 'Origem não encontrada' }, { status: 404 });
          }
          return NextResponse.json({ success: true, data: parsed });
        } catch {
          return NextResponse.json({ success: false, error: output.slice(0, 300) }, { status: 500 });
        }
      }

      if (action === 'compressPaths') {
        const sources = normalizeHomePaths(p.sources);
        const archivePath = String(p.archivePath || '').trim();
        if (!sources.length || !isValidHomePath(archivePath)) {
          return NextResponse.json({ success: false, error: 'Dados inválidos' }, { status: 400 });
        }
        const script = [
          'import os, zipfile, json',
          `sources = ${JSON.stringify(sources)}`,
          `archive = ${JSON.stringify(archivePath)}`,
          'with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as zf:',
          '    for src in sources:',
          '        if not os.path.exists(src):',
          '            continue',
          '        if os.path.isfile(src):',
          '            zf.write(src, os.path.basename(src))',
          '        else:',
          '            for root, _, files in os.walk(src):',
          '                for fn in files:',
          '                    fp = os.path.join(root, fn)',
          '                    arc = os.path.relpath(fp, os.path.dirname(src))',
          '                    zf.write(fp, arc)',
          'print(json.dumps({"path": archive}))',
        ].join('\n');
        const output = await runPythonOnServer(script);
        try {
          const parsed = parsePythonJsonOutput(output) as { path?: string };
          return NextResponse.json({ success: true, data: parsed });
        } catch {
          return NextResponse.json({ success: false, error: output.slice(0, 300) }, { status: 500 });
        }
      }

      if (action === 'extractArchive') {
        const archivePath = String(p.path || '').trim();
        const destDir = String(p.destDir || '').trim();
        if (!isValidHomePath(archivePath) || !isValidHomePath(destDir)) {
          return NextResponse.json({ success: false, error: 'Caminho inválido' }, { status: 400 });
        }
        const script = [
          'import os, zipfile, tarfile, json',
          `archive = ${JSON.stringify(archivePath)}`,
          `dest = ${JSON.stringify(destDir)}`,
          'if not os.path.isfile(archive):',
          '    print(json.dumps({"error": "missing"}))',
          'elif archive.endswith(".zip"):',
          '    with zipfile.ZipFile(archive, "r") as zf:',
          '        zf.extractall(dest)',
          '    print(json.dumps({"ok": True}))',
          'elif archive.endswith((".tar.gz", ".tgz", ".tar")):',
          '    with tarfile.open(archive, "r:*") as tf:',
          '        tf.extractall(dest)',
          '    print(json.dumps({"ok": True}))',
          'else:',
          '    print(json.dumps({"error": "format"}))',
        ].join('\n');
        const output = await runPythonOnServer(script);
        try {
          const parsed = parsePythonJsonOutput(output) as { error?: string };
          if (parsed.error === 'missing') {
            return NextResponse.json({ success: false, error: 'Arquivo não encontrado' }, { status: 404 });
          }
          if (parsed.error === 'format') {
            return NextResponse.json({ success: false, error: 'Formato não suportado' }, { status: 400 });
          }
          return NextResponse.json({ success: true });
        } catch {
          return NextResponse.json({ success: false, error: output.slice(0, 300) }, { status: 500 });
        }
      }

      if (action === 'renamePath') {
        const source = String(p.path || '').trim();
        const newName = String(p.newName || '').trim();
        if (!isValidHomePath(source) || !newName || newName.includes('/') || newName.includes('..')) {
          return NextResponse.json({ success: false, error: 'Nome inválido' }, { status: 400 });
        }
        const script = [
          'import os, json',
          `src = ${JSON.stringify(source)}`,
          `new_name = ${JSON.stringify(newName)}`,
          'dest = os.path.join(os.path.dirname(src), new_name)',
          'if not os.path.exists(src):',
          '    print(json.dumps({"error": "missing"}))',
          'elif os.path.exists(dest):',
          '    print(json.dumps({"error": "exists"}))',
          'else:',
          '    os.rename(src, dest)',
          '    print(json.dumps({"path": dest}))',
        ].join('\n');
        const output = await runPythonOnServer(script);
        try {
          const parsed = parsePythonJsonOutput(output) as { error?: string; path?: string };
          if (parsed.error === 'missing') {
            return NextResponse.json({ success: false, error: 'Origem não encontrada' }, { status: 404 });
          }
          if (parsed.error === 'exists') {
            return NextResponse.json({ success: false, error: 'Já existe um item com esse nome' }, { status: 409 });
          }
          return NextResponse.json({ success: true, data: parsed });
        } catch {
          return NextResponse.json({ success: false, error: output.slice(0, 300) }, { status: 500 });
        }
      }

      if (action === 'setPathPermissions') {
        const paths = normalizeHomePaths(p.paths);
        const modeRaw = String(p.mode || '').trim();
        if (!paths.length || !/^[0-7]{3,4}$/.test(modeRaw)) {
          return NextResponse.json({ success: false, error: 'Permissões inválidas (ex.: 644 ou 755).' }, { status: 400 });
        }
        const script = [
          'import os, json',
          `paths = ${JSON.stringify(paths)}`,
          `mode = int(${JSON.stringify(modeRaw)}, 8)`,
          'updated = []',
          'errors = []',
          'for p in paths:',
          '    if not p.startswith("/home/") or ".." in p:',
          '        continue',
          '    try:',
          '        if os.path.exists(p):',
          '            os.chmod(p, mode)',
          '            updated.append(p)',
          '    except OSError as e:',
          '        errors.append({"path": p, "error": str(e)})',
          'print(json.dumps({"updated": updated, "errors": errors}))',
        ].join('\n');
        const output = await runPythonOnServer(script);
        try {
          const parsed = parsePythonJsonOutput(output) as { updated?: string[]; errors?: Array<{ path: string; error: string }> };
          if (!parsed.updated?.length) {
            return NextResponse.json({ success: false, error: 'Não foi possível alterar permissões.' }, { status: 400 });
          }
          if (parsed.errors?.length) {
            return NextResponse.json({
              success: true,
              warning: `${parsed.errors.length} item(ns) com erro.`,
              data: parsed,
            });
          }
          return NextResponse.json({ success: true, data: parsed });
        } catch {
          return NextResponse.json({ success: false, error: output.slice(0, 300) }, { status: 500 });
        }
      }

      if (action === 'createFolder') {
        const folderPath = String(p.path || '').trim();
        if (!isValidHomePath(folderPath)) {
          return NextResponse.json({ success: false, error: 'Caminho inválido' }, { status: 400 });
        }
        const script = [
          'import os, json',
          `p = ${JSON.stringify(folderPath)}`,
          'os.makedirs(p, exist_ok=True)',
          'print(json.dumps({"ok": True}))',
        ].join('\n');
        await runPythonOnServer(script);
        return NextResponse.json({ success: true });
      }

      if (action === 'downloadFile') {
        const filePath = String(p.path || '').trim();
        if (!isValidHomePath(filePath)) {
          return NextResponse.json({ success: false, error: 'Caminho inválido' }, { status: 400 });
        }
        const maxBytes = Math.min(Number(p.maxBytes) || 50 * 1024 * 1024, 50 * 1024 * 1024);
        const script = [
          'import os, json, base64, mimetypes',
          `p = ${JSON.stringify(filePath)}`,
          `limit = ${maxBytes}`,
          'if not os.path.isfile(p):',
          '    print(json.dumps({"error": "not_file"}))',
          'elif os.path.getsize(p) > limit:',
          '    print(json.dumps({"error": "too_large"}))',
          'else:',
          '    mime, _ = mimetypes.guess_type(p)',
          '    with open(p, "rb") as f:',
          '        data = base64.b64encode(f.read()).decode()',
          '    print(json.dumps({"content": data, "filename": os.path.basename(p), "mime": mime or "application/octet-stream"}))',
        ].join('\n');
        const output = await runPythonOnServer(script);
        try {
          const parsed = parsePythonJsonOutput(output) as {
            error?: string;
            content?: string;
            filename?: string;
            mime?: string;
          };
          if (parsed.error === 'not_file') {
            return NextResponse.json({ success: false, error: 'Ficheiro não encontrado' }, { status: 404 });
          }
          if (parsed.error === 'too_large') {
            return NextResponse.json({ success: false, error: 'Ficheiro demasiado grande' }, { status: 413 });
          }
          return NextResponse.json({ success: true, data: parsed });
        } catch {
          return NextResponse.json({ success: false, error: output.slice(0, 300) }, { status: 500 });
        }
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
