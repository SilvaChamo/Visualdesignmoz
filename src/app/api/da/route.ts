import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';
import { requireDaAccessForDomain } from '@/lib/panel-domain-access';
import { resolvePanelDaContext } from '@/lib/panel-api-context';
import { scheduleDaSync } from '@/lib/da-sync-engine';
import { mirrorAfterDaMutation, mutationSucceeded, deleteMirrorSite, patchMirrorSite } from '@/lib/panel-mirror-write';
import {
  listMirrorDns,
  listMirrorDatabases,
  listMirrorEmails,
  listMirrorFtp,
  listMirrorPackages,
  listMirrorSubdomains,
  listMirrorUsers,
  listMirrorWebsites,
} from '@/lib/panel-mirror-read';
import { listHostingDomains, resolveHostingOwner, hostingProvider as _hostingProvider } from '@/lib/hosting-resolver';
import { resolveMirrorOrLive } from '@/lib/panel-list-resolve';
import { getProviderByUsername } from '@/lib/hosting-provider';
import * as hestiaAdapter from '@/lib/hestia-adapter';
import { getDaSyncAdmin } from '@/lib/da-sync-schema';

// O Webmail lê sempre a password de email_contas (ver WebmailSection.tsx) —
// sem isto, contas de email do Hestia criadas/alteradas aqui nunca ficavam
// com a senha certa aí, e o Webmail deixava de reconhecer a password.
async function syncEmailContasPassword(email: string, password: string): Promise<void> {
  if (!email || !password) return;
  const sb = getDaSyncAdmin();
  if (!sb) return;
  const { encryptStoredPassword } = await import('@/lib/panel-access-credentials');
  await sb.from('email_contas').upsert(
    {
      email,
      senha_servidor: encryptStoredPassword(password),
      tipo_conta: 'webmail',
      status: 'active',
    },
    { onConflict: 'email' },
  );
}

async function deleteEmailContasRow(email: string): Promise<void> {
  if (!email) return;
  const sb = getDaSyncAdmin();
  if (!sb) return;
  await sb.from('email_contas').delete().eq('email', email);
}

const MUTATION_ACTIONS = new Set([
  'createUser', 'modifyUser', 'deleteUser',
  'createWebsite', 'deleteWebsite', 'suspendWebsite', 'unsuspendWebsite', 'modifyWebsite',
  'createPackage', 'modifyPackage', 'editPackage', 'deletePackage',
  'createEmail', 'deleteEmail', 'suspendEmail', 'unsuspendEmail',
  'changeEmailPassword', 'setEmailLimits',
  'addEmailForwarding', 'setCatchAllEmail', 'addPatternForwarding', 'togglePlusAddressing',
  'addDomainPointer', 'deleteDomainPointer',
  'createSubdomain', 'deleteSubdomain',
  'createDatabase', 'deleteDatabase',
  'createFTPAccount', 'deleteFTPAccount',
  'issueSSL', 'enableDKIM',
  'replaceSSL', 'deleteSSL', 'cancelSslRenewal', 'setForceSsl',
  'createDNSZone', 'deleteDNSZone', 'resetDNSConfigurations',
  'configDefaultNameservers', 'createNameserver', 'configCloudFlare',
  'changePHPVersion', 'savePHPConfig',
  'toggleFirewall', 'toggleModSecurity', 'blockIP', 'unblockIP', 'saveBruteForceConfig',
  'installWordPress', 'installWPPlugin', 'toggleWPPlugin',
  'restoreWPBackup', 'createRemoteBackup',
]);

/**
 * BFF DirectAdmin — o painel revendedor e admin chamam esta rota.
 * Revendedores usam credenciais DIRECTADMIN_RESELLER_* (Osher Collective).
 */

// Acções que um cliente comum (dono do domínio, não staff) pode chamar directamente
// sobre o SEU PRÓPRIO domínio — sempre com verificação de posse via
// requireDaAccessForDomain. Tudo o resto (criar/apagar contas, pacotes, execCommand,
// firewall, backups, WordPress, etc.) continua estritamente admin/revendedor.
// SSL foi retirado desta lista de propósito: getSslCertificate devolve o
// certificado E A CHAVE PRIVADA em texto (lido directamente do servidor via
// SSH) — nunca deve poder chegar ao browser de um cliente, mesmo do seu
// próprio domínio. Gestão de SSL fica reservada à equipa (dashboard/revendedor);
// o painel do cliente mostra apenas uma nota informativa (renovação automática).
const CLIENT_SAFE_ACTIONS = new Set([
  'changePHPVersion',
]);

async function resolveApi(action?: string, domain?: string) {
  const hestiaOnly = (process.env.DEFAULT_HOSTING_PROVIDER || '').trim().toLowerCase() === 'hestia';

  // O endpoint mantém o nome legado para compatibilidade com o frontend, mas
  // numa instalação Hestia não pode sequer inicializar credenciais DA.
  if (hestiaOnly) {
    const auth = await requireAdminOrReseller();
    if ('error' in auth) return { error: auth.error } as const;
    const impersonating = auth.user.role === 'admin' ? await (await import('next/headers')).cookies().then((store) => store.get('vd_impersonate_reseller')?.value?.trim() || null) : null;
    return {
      daApi: null,
      user: auth.user,
      mirrorScope: impersonating
        ? { role: 'reseller' as const, daUsername: impersonating }
        : { role: auth.user.role === 'admin' ? 'admin' as const : 'reseller' as const, userId: auth.user.id },
    } as const;
  }

  if (action && CLIENT_SAFE_ACTIONS.has(action)) {
    const auth = await requireDaAccessForDomain(domain || '');
    if ('error' in auth) return { error: auth.error } as const;

    if (auth.user.role === 'client') {
      const { getDirectAdminAPIForAuth } = await import('@/lib/directadmin-adapter');
      const daApi = await getDirectAdminAPIForAuth({ id: auth.user.id, email: auth.user.email, role: 'admin' });
      return { daApi, user: auth.user, mirrorScope: { role: 'admin' as const, userId: auth.user.id } } as const;
    }

    const ctx = await resolvePanelDaContext(auth as Parameters<typeof resolvePanelDaContext>[0]);
    return { daApi: ctx.daApi, user: auth.user, mirrorScope: ctx.mirrorScope } as const;
  }

  const auth = await requireAdminOrReseller();
  if ('error' in auth) return { error: auth.error } as const;
  const ctx = await resolvePanelDaContext(auth);
  return { daApi: ctx.daApi, user: auth.user, mirrorScope: ctx.mirrorScope } as const;
}

// Acções de email/FTP já implementadas para contas Hestia — despachadas aqui,
// ANTES de tocar em `daApi`, porque a conta nem existe no DirectAdmin. Tudo o
// resto (SSL, DNS, WordPress, backups, subdomínios, etc.) continua por
// implementar para Hestia; nesses casos `handled` fica `false` e o pedido
// segue o caminho DA normal (com o mesmo comportamento de sempre para essas
// lacunas, já conhecido/documentado à parte).
const HESTIA_SUPPORTED_ACTIONS = new Set([
  'listWebsites', 'createWebsite',
  'listEmails', 'createEmail', 'deleteEmail', 'suspendEmail', 'unsuspendEmail', 'changeEmailPassword', 'setEmailLimits',
  'listFTPAccounts', 'createFTPAccount', 'deleteFTPAccount',
  'deleteWebsite', 'suspendWebsite', 'unsuspendWebsite',
  'issueSSL', 'listDatabases', 'createDatabase', 'deleteDatabase',
  'listDNS', 'createDNSZone', 'deleteDNSZone',
  'createUser', 'modifyUser', 'deleteUser',
  'createSubdomain', 'deleteSubdomain', 'listSubdomains',
  'listBackups', 'createBackup',
  'listUsers', 'listPackages',
]);

async function tryHestiaAction(
  action: string,
  params: Record<string, unknown>,
  mirrorScope: Parameters<typeof listMirrorWebsites>[0],
): Promise<{ handled: false } | { handled: true; response: NextResponse }> {
  if (!HESTIA_SUPPORTED_ACTIONS.has(action)) return { handled: false };

  const hestiaAdmin = (process.env.HESTIA_USER || 'vdadmin').trim();
  const domainParam = String(params.domain || '');
  const emailParam = String(params.email || '');
  const domain = domainParam || (emailParam.includes('@') ? emailParam.split('@')[1] : '');

  if (action === 'listWebsites') {
    const rows = await listHostingDomains(mirrorScope);
    return {
      handled: true,
      response: NextResponse.json({ success: true, data: rows }),
    };
  }

  if (action === 'listUsers') {
    const { listHostingUsers } = await import('@/lib/hosting-resolver');
    const rows = await listHostingUsers();
    return {
      handled: true,
      response: NextResponse.json({ success: true, data: rows }),
    };
  }

  if (action === 'listPackages') {
    const { listHostingPackages } = await import('@/lib/hosting-resolver');
    const rows = await listHostingPackages();
    return {
      handled: true,
      response: NextResponse.json({ success: true, data: rows }),
    };
  }

  if (action === 'listSubdomains') {
    const { listHostingSubdomains } = await import('@/lib/hosting-resolver');
    const parent = String(params.domain || '');
    const rows = await listHostingSubdomains(parent);
    return {
      handled: true,
      response: NextResponse.json({ success: true, data: rows }),
    };
  }

  // ── Acções que NÃO precisam de lookupde domínio ─────────────────────────
  // Gestão de utilizadores (createUser, modifyUser, deleteUser)
  if (action === 'createUser') {
    try {
      const username = String(params.userName || params.username || '').trim().toLowerCase();
      const password = String(params.password || '');
      const email = String(params.email || '');
      const packageName = String(params.packageName || 'default').trim();
      const domainToAdd = String(params.domain || '').trim();
      if (!username || !password) {
        return { handled: true, response: NextResponse.json({ success: false, error: 'Utilizador e senha são obrigatórios.' }, { status: 400 }) };
      }
      let result: { ok: boolean; error?: string };
      if (domainToAdd) {
        result = await hestiaAdapter.createAccount({ username, password, email, domain: domainToAdd, packageName });
      } else {
        result = await hestiaAdapter.createUserOnly({ username, password, email, packageName });
      }
      if (result.ok) {
        const { scheduleHestiaSync } = await import('@/lib/hestia-sync-engine');
        scheduleHestiaSync(2000);
      }
      return { handled: true, response: NextResponse.json({ success: result.ok, error: result.error }) };
    } catch (err: unknown) {
      return { handled: true, response: NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Erro ao criar utilizador' }, { status: 500 }) };
    }
  }

  if (action === 'modifyUser') {
    try {
      const username = String(params.userName || params.username || '').trim().toLowerCase();
      if (!username) return { handled: true, response: NextResponse.json({ success: false, error: 'Utilizador obrigatório.' }, { status: 400 }) };
      let result: { ok: boolean; error?: string } = { ok: true };
      if (params.password) {
        result = await hestiaAdapter.changePassword(username, String(params.password));
      }
      if (result.ok && params.suspended !== undefined) {
        result = params.suspended
          ? await hestiaAdapter.suspendAccount(username)
          : await hestiaAdapter.unsuspendAccount(username);
      }
      if (result.ok && params.packageName) {
        result = await hestiaAdapter.changeUserPackage(username, String(params.packageName));
      }
      return { handled: true, response: NextResponse.json({ success: result.ok, error: result.error }) };
    } catch (err: unknown) {
      return { handled: true, response: NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Erro ao modificar utilizador' }, { status: 500 }) };
    }
  }

  if (action === 'deleteUser') {
    try {
      const username = String(params.userName || params.username || '').trim().toLowerCase();
      if (!username) return { handled: true, response: NextResponse.json({ success: false, error: 'Utilizador obrigatório.' }, { status: 400 }) };
      const result = await hestiaAdapter.deleteAccount(username);
      if (result.ok) {
        const { scheduleHestiaSync } = await import('@/lib/hestia-sync-engine');
        scheduleHestiaSync(2000);
      }
      return { handled: true, response: NextResponse.json({ success: result.ok, error: result.error }) };
    } catch (err: unknown) {
      return { handled: true, response: NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Erro ao apagar utilizador' }, { status: 500 }) };
    }
  }

  if (action === 'listBackups') {
    try {
      const username = String(params.userName || params.username || hestiaAdmin).trim().toLowerCase();
      const rows = await hestiaAdapter.listBackups(username);
      return { handled: true, response: NextResponse.json({ success: true, data: rows }) };
    } catch (err: unknown) {
      return { handled: true, response: NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Erro ao listar backups' }, { status: 500 }) };
    }
  }

  if (action === 'createBackup') {
    try {
      const username = String(params.userName || params.username || hestiaAdmin).trim().toLowerCase();
      const result = await hestiaAdapter.createBackup(username);
      return { handled: true, response: NextResponse.json({ success: result.ok, error: result.error }) };
    } catch (err: unknown) {
      return { handled: true, response: NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Erro ao criar backup' }, { status: 500 }) };
    }
  }

  // ── Acções baseadas em domínio (owner via hosting-resolver) ─────────────
  if (!domain) return { handled: false };

  // No Contabo: resolveHostingOwner devolve HESTIA_USER directamente (sem mirror)
  // No Hetzner: consulta panel_sites
  const domainOwner = await resolveHostingOwner(domain);
  const sites = await listHostingDomains(mirrorScope);

  // Subdomínios: o domínio de lookup é o domínio PAI (ex.: "entrecamposblog.com")
  // e o subdomínio é um campo separado (ex.: "blog" → "blog.entrecamposblog.com")
  if (action === 'createSubdomain' || action === 'deleteSubdomain') {
    try {
      const subOwner = domainOwner || hestiaAdmin;
      const sub = String(params.subdomain || '').trim().toLowerCase().replace(/\.$/, '');
      if (!sub) return { handled: true, response: NextResponse.json({ success: false, error: 'Subdomínio obrigatório.' }, { status: 400 }) };
      // No Hestia, subdomínios são domínios completos da mesma conta
      const fullSub = sub.includes('.') ? sub : `${sub}.${domain}`;
      const result = action === 'createSubdomain'
        ? await hestiaAdapter.addWebDomain(subOwner, fullSub)
        : await hestiaAdapter.deleteWebDomain(subOwner, fullSub);
      if (result.ok) {
        const { scheduleHestiaSync } = await import('@/lib/hestia-sync-engine');
        scheduleHestiaSync(2000);
      }
      return { handled: true, response: NextResponse.json({ success: result.ok, error: result.error }) };
    } catch (err: unknown) {
      return { handled: true, response: NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Erro com subdomínio' }, { status: 500 }) };
    }
  }

  const site = sites.find((s) => s.domain?.toLowerCase() === domain.toLowerCase());
  const owner = (domainOwner || site?.owner)?.toLowerCase();
  if (!owner) return { handled: false };

  const provider = _hostingProvider === 'hestia' ? 'hestia' : await getProviderByUsername(owner);
  if (provider !== 'hestia') return { handled: false };

  let data: unknown;
  try {
    switch (action) {
      case 'createWebsite': {
        const owner = String(params.owner || process.env.HESTIA_USER || 'vdadmin').trim();
        const result = await hestiaAdapter.addWebDomain(owner, domain);
        data = { success: result.ok, error: result.error };
        break;
      }
      case 'listEmails': {
        let rows = await hestiaAdapter.listMailAccounts(owner, domain);
        // Fallback: se o dono não for o utilizador Hestia principal (ex.: domínio do DA/Hetzner
        // que tem mail configurado no Hestia sob vdadmin), tentar com hestiaAdmin directamente.
        if (rows.length === 0 && owner !== hestiaAdmin) {
          rows = await hestiaAdapter.listMailAccounts(hestiaAdmin, domain);
        }
        data = rows.map((r) => ({
          id: `${r.account}@${domain}`,
          email: `${r.account}@${domain}`,
          domain,
          quota_mb: r.quotaMb ?? undefined,
          usage: String(r.diskUsedMb),
          status: 'active' as const,
        }));
        break;
      }
      case 'createEmail': {
        const userName = String(params.userName || params.user || '');
        const password = String(params.password || '');
        const quotaMb = params.quota ? Number(params.quota) : undefined;
        if (!userName || !password) {
          return {
            handled: true,
            response: NextResponse.json({ success: false, error: 'Utilizador e senha são obrigatórios.' }, { status: 400 }),
          };
        }
        // Tenta com o dono do mirror; se falhar (ex.: dono é 'admin' do DA, não existe no Hestia),
        // retenta com o utilizador principal do Hestia (vdadmin).
        let createResult = await hestiaAdapter.addMailAccount(owner, domain, userName, password, quotaMb);
        if (!createResult.ok && owner !== hestiaAdmin) {
          createResult = await hestiaAdapter.addMailAccount(hestiaAdmin, domain, userName, password, quotaMb);
        }
        data = createResult;
        await syncEmailContasPassword(`${userName}@${domain}`, password);
        break;
      }
      case 'deleteEmail': {
        const userName = String(params.userName || emailParam.split('@')[0] || '');
        let deleteResult = await hestiaAdapter.deleteMailAccount(owner, domain, userName);
        if (!deleteResult.ok && owner !== hestiaAdmin) {
          deleteResult = await hestiaAdapter.deleteMailAccount(hestiaAdmin, domain, userName);
        }
        data = deleteResult;
        await deleteEmailContasRow(`${userName}@${domain}`);
        break;
      }
      case 'suspendEmail':
      case 'unsuspendEmail': {
        const userName = emailParam.split('@')[0] || '';
        let suspendResult = action === 'suspendEmail'
          ? await hestiaAdapter.suspendMailAccount(owner, domain, userName)
          : await hestiaAdapter.unsuspendMailAccount(owner, domain, userName);
        if (!suspendResult.ok && owner !== hestiaAdmin) {
          suspendResult = action === 'suspendEmail'
            ? await hestiaAdapter.suspendMailAccount(hestiaAdmin, domain, userName)
            : await hestiaAdapter.unsuspendMailAccount(hestiaAdmin, domain, userName);
        }
        data = suspendResult;
        break;
      }
      case 'changeEmailPassword': {
        const userName = emailParam.split('@')[0] || '';
        const password = String(params.password || '');
        let passResult = await hestiaAdapter.changeMailAccountPassword(owner, domain, userName, password);
        if (!passResult.ok && owner !== hestiaAdmin) {
          passResult = await hestiaAdapter.changeMailAccountPassword(hestiaAdmin, domain, userName, password);
        }
        data = passResult;
        await syncEmailContasPassword(`${userName}@${domain}`, password);
        break;
      }
      case 'setEmailLimits': {
        const userName = emailParam.split('@')[0] || '';
        const quotaMb = Number(params.limit ?? params.quota ?? 0);
        if (!userName || !quotaMb) {
          return {
            handled: true,
            response: NextResponse.json({ success: false, error: 'Quota inválida.' }, { status: 400 }),
          };
        }
        let quotaResult = await hestiaAdapter.changeMailAccountQuota(owner, domain, userName, quotaMb);
        if (!quotaResult.ok && owner !== hestiaAdmin) {
          quotaResult = await hestiaAdapter.changeMailAccountQuota(hestiaAdmin, domain, userName, quotaMb);
        }
        data = quotaResult;
        break;
      }
      case 'listFTPAccounts': {
        const rows = await hestiaAdapter.listFtpAccounts(owner, domain);
        data = rows.map((r) => ({ username: r.ftpUser, userName: r.ftpUser, domain, path: r.path }));
        break;
      }
      case 'listDatabases': {
        const rows = await hestiaAdapter.listDatabases(owner);
        data = rows.map((row) => ({ database: row.database, dbuser: row.dbUser, type: row.type, charset: row.charset, sizeBytes: row.diskUsedMb * 1024 * 1024, suspended: row.suspended }));
        break;
      }
      case 'createDatabase': {
        const rawName = String(params.name || params.dbName || '').trim();
        const rawUser = String(params.dbuser || params.dbUser || rawName).trim();
        const password = String(params.password || params.dbPassword || '');
        const dbNameSuffix = rawName.startsWith(`${owner}_`) ? rawName.slice(owner.length + 1) : rawName;
        const dbUserSuffix = rawUser.startsWith(`${owner}_`) ? rawUser.slice(owner.length + 1) : rawUser;
        const result = await hestiaAdapter.createDatabase({ username: owner, dbNameSuffix, dbUserSuffix, password });
        data = { success: result.ok, error: result.error, database: result.database, dbuser: result.dbUser };
        break;
      }
      case 'deleteDatabase': {
        const result = await hestiaAdapter.deleteDatabase(owner, String(params.database || params.dbName || ''));
        data = { success: result.ok, error: result.error };
        break;
      }
      case 'listDNS': {
        const rows = await hestiaAdapter.listDnsRecords(owner, domain);
        data = rows.map((row) => ({ name: row.record === '@' ? domain : row.record, type: row.type, value: row.value, ttl: row.ttl }));
        break;
      }
      case 'createDNSZone': {
        const result = await hestiaAdapter.addDnsZone(owner, domain);
        data = { success: result.ok, error: result.error };
        break;
      }
      case 'deleteDNSZone': {
        const result = await hestiaAdapter.deleteDnsZone(owner, domain);
        data = { success: result.ok, error: result.error };
        break;
      }
      case 'createFTPAccount': {
        const usernameSuffix = String(params.username || params.userName || '');
        const password = String(params.password || '');
        const path = params.path ? String(params.path) : undefined;
        if (!usernameSuffix || !password) {
          return {
            handled: true,
            response: NextResponse.json({ success: false, error: 'Utilizador e senha são obrigatórios.' }, { status: 400 }),
          };
        }
        data = await hestiaAdapter.addFtpAccount(owner, domain, usernameSuffix, password, path);
        break;
      }
      case 'deleteFTPAccount': {
        const ftpUser = String(params.username || params.userName || '');
        data = await hestiaAdapter.deleteFtpAccount(owner, domain, ftpUser);
        break;
      }
      case 'deleteWebsite': {
        const result = await hestiaAdapter.deleteWebDomain(owner, domain);
        if (result.ok) await deleteMirrorSite(domain);
        data = { success: result.ok, error: result.error };
        break;
      }
      case 'suspendWebsite':
      case 'unsuspendWebsite': {
        const result =
          action === 'suspendWebsite'
            ? await hestiaAdapter.suspendWebDomain(owner, domain)
            : await hestiaAdapter.unsuspendWebDomain(owner, domain);
        if (result.ok) await patchMirrorSite(domain, { status: action === 'suspendWebsite' ? 'Suspended' : 'Active' });
        data = { success: result.ok, error: result.error };
        break;
      }
      case 'issueSSL': {
        // Hestia: emite Let's Encrypt + recarrega o nginx (o painel deixa o
        // site com o certificado activo sem ninguém tocar no terminal). Se o
        // domínio tiver WordPress, passa também os endereços para https.
        const result = await hestiaAdapter.issueLetsEncrypt(owner, domain);
        if (result.ok) {
          try {
            const { resolveWpInstall, switchWpToHttps } = await import('@/lib/wp-cli-server');
            if (await resolveWpInstall(domain)) await switchWpToHttps(domain);
          } catch {
            /* best-effort — SSL já ficou emitido */
          }
        }
        data = { success: result.ok, error: result.error, output: result.output };
        break;
      }
      default:
        return { handled: false };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno (Hestia)';
    return { handled: true, response: NextResponse.json({ success: false, error: message }, { status: 500 }) };
  }

  return { handled: true, response: NextResponse.json({ success: true, data }) };
}

/** Leituras do painel na Contabo: o browser continua a chamar `/api/da`,
 * mas a fonte é o espelho Hestia/Supabase — nunca 501 numa listagem. */
async function tryHestiaMirrorRead(
  action: string,
  params: Record<string, unknown>,
  mirrorScope: Parameters<typeof listMirrorWebsites>[0],
): Promise<{ handled: false } | { handled: true; response: NextResponse }> {
  const domain = String(params.domain || '');
  try {
    switch (action) {
      case 'listWebsites':
        return {
          handled: true,
          response: NextResponse.json({ success: true, data: await listHostingDomains(mirrorScope) }),
        };
      case 'listUsers': {
        const { listHostingUsers } = await import('@/lib/hosting-resolver');
        return {
          handled: true,
          response: NextResponse.json({ success: true, data: await listHostingUsers() }),
        };
      }
      case 'listPackages': {
        const { listHostingPackages } = await import('@/lib/hosting-resolver');
        return {
          handled: true,
          response: NextResponse.json({ success: true, data: await listHostingPackages() }),
        };
      }
      case 'listSubdomains': {
        const { listHostingSubdomains } = await import('@/lib/hosting-resolver');
        return {
          handled: true,
          response: NextResponse.json({
            success: true,
            data: await listHostingSubdomains(domain),
          }),
        };
      }
      case 'listEmails': {
        const owner = await resolveHostingOwner(domain);
        let rows = await hestiaAdapter.listMailAccounts(owner, domain);
        if (rows.length === 0 && owner !== (process.env.HESTIA_USER || 'vdadmin').trim()) {
          rows = await hestiaAdapter.listMailAccounts((process.env.HESTIA_USER || 'vdadmin').trim(), domain);
        }
        return {
          handled: true,
          response: NextResponse.json({
            success: true,
            data: rows.map((r) => ({
              id: `${r.account}@${domain}`,
              email: `${r.account}@${domain}`,
              domain,
              quota_mb: r.quotaMb ?? undefined,
              usage: String(r.diskUsedMb),
              status: 'active' as const,
            })),
          }),
        };
      }
      case 'listFTPAccounts': {
        const owner = await resolveHostingOwner(domain);
        const rows = await hestiaAdapter.listFtpAccounts(owner, domain);
        return { handled: true, response: NextResponse.json({ success: true, data: rows }) };
      }
      case 'listDatabases': {
        const owner = await resolveHostingOwner(domain);
        const rows = await hestiaAdapter.listDatabases(owner);
        return { handled: true, response: NextResponse.json({ success: true, data: rows }) };
      }
      case 'listDNS': {
        const owner = await resolveHostingOwner(domain);
        const rows = await hestiaAdapter.listDnsRecords(owner, domain);
        return { handled: true, response: NextResponse.json({ success: true, data: rows }) };
      }
      case 'serverStats': {
        const [sites, users] = await Promise.all([
          listHostingDomains(mirrorScope),
          (await import('@/lib/hosting-resolver')).listHostingUsers(),
        ]);
        return {
          handled: true,
          response: NextResponse.json({
            success: true,
            data: {
              sites: sites.length,
              users: users.length,
              load: 0,
              bandwidth: 0,
              disk: 0,
            },
          }),
        };
      }
      default:
        return { handled: false };
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno (espelho Hestia)';
    return {
      handled: true,
      response: NextResponse.json({ success: false, error: message }, { status: 500 }),
    };
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, params = {}, timeoutMs } = body;

    if (!action) {
      return NextResponse.json({ success: false, error: 'action é obrigatória' }, { status: 400 });
    }

    const resolved = await resolveApi(action, String(params.domain || params.hostname || ''));
    if ('error' in resolved) return resolved.error;

      const { daApi, user, mirrorScope } = resolved;

    const hestiaResult = await tryHestiaAction(action, params, mirrorScope);
    if (hestiaResult.handled) return hestiaResult.response;

      if (!daApi) {
        const mirrorRead = await tryHestiaMirrorRead(action, params, mirrorScope);
        if (mirrorRead.handled) return mirrorRead.response;
        return NextResponse.json({ success: false, error: `Acção "${action}" ainda não está disponível no Hestia.` }, { status: 501 });
      }

    let data: unknown;

    switch (action) {
      case 'listWebsites': {
        data = await resolveMirrorOrLive({
          onStale: () => scheduleDaSync(0),
          mirror: () => listHostingDomains(mirrorScope),
          live: async () => {
            const rows = await daApi.listWebsites(timeoutMs);
            if (rows.length > 0) scheduleDaSync(500);
            return rows;
          },
        });
        break;
      }
      case 'createWebsite':
        data = await daApi.createWebsite(params);
        break;
      case 'suspendWebsite':
        data = await daApi.suspendWebsite(params.domain);
        break;
      case 'unsuspendWebsite':
        data = await daApi.unsuspendWebsite(params.domain);
        break;
      case 'deleteWebsite':
        data = await daApi.deleteWebsite(params.domain);
        break;
      case 'modifyWebsite':
        data = await daApi.modifyWebsite(params);
        break;

      case 'listSubdomains': {
        const domain = String(params.domain || '');
        data = await resolveMirrorOrLive({
          onStale: () => scheduleDaSync(0),
          mirror: () => listMirrorSubdomains(domain, mirrorScope),
          live: async () => daApi.listSubdomains(domain),
        });
        break;
      }
      case 'createSubdomain':
        data = await daApi.createSubdomain(params.domain, params.subdomain);
        break;
      case 'deleteSubdomain':
        data = await daApi.deleteSubdomain(params.domain, params.subdomain);
        break;

      case 'listPackages': {
        data = await resolveMirrorOrLive({
          onStale: () => scheduleDaSync(0),
          mirror: () => listMirrorPackages(mirrorScope),
          live: async () => {
            const rows = await daApi.listPackages();
            if (rows.length > 0) scheduleDaSync(500);
            return rows;
          },
        });
        break;
      }
      case 'createPackage':
        data = await daApi.createPackage(params);
        break;
      case 'modifyPackage':
      case 'editPackage':
        data = await daApi.modifyPackage(params);
        break;
      case 'deletePackage':
        data = await daApi.deletePackage(String(params.packageName || ''));
        break;

      case 'listUsers': {
        data = await resolveMirrorOrLive({
          onStale: () => scheduleDaSync(0),
          mirror: () => listMirrorUsers(mirrorScope),
          live: async () => {
            const rows = await daApi.listUsers();
            if (rows.length > 0) scheduleDaSync(500);
            return rows;
          },
        });
        break;
      }
      case 'createUser':
        data = await daApi.createUser(params);
        break;
      case 'modifyUser':
        data = await daApi.modifyUser(params);
        break;
      case 'deleteUser':
        data = await daApi.deleteUser(params);
        break;

      case 'listEmails': {
        const domain = String(params.domain || '');
        data = await resolveMirrorOrLive({
          onStale: () => scheduleDaSync(0),
          mirror: () => listMirrorEmails(domain, mirrorScope),
          live: async () => daApi.listEmails(domain),
        });
        break;
      }
      case 'createEmail':
        data = await daApi.createEmail(params);
        break;
      case 'deleteEmail':
        data = await daApi.deleteEmail(params);
        break;
      case 'suspendEmail':
        data = await daApi.suspendEmail(params.email);
        break;
      case 'unsuspendEmail':
        data = await daApi.unsuspendEmail(params.email);
        break;
      case 'changeEmailPassword':
        data = await daApi.changeEmailPassword(params);
        break;
      case 'setEmailLimits':
        data = await daApi.setEmailLimits(params);
        break;
      case 'getEmailForwarding':
        data = await daApi.getEmailForwarding(params);
        break;
      case 'addEmailForwarding':
        data = await daApi.addEmailForwarding(params);
        break;
      case 'listDomainPointers':
        data = await daApi.listDomainPointers(String(params.domain || ''));
        break;
      case 'addDomainPointer':
        data = await daApi.addDomainPointer(params);
        break;
      case 'deleteDomainPointer':
        data = await daApi.deleteDomainPointer(params);
        break;
      case 'getCatchAllEmail':
        data = await daApi.getCatchAllEmail(params.domain);
        break;
      case 'setCatchAllEmail':
        data = await daApi.setCatchAllEmail(params);
        break;
      case 'getPatternForwarding':
        data = await daApi.getPatternForwarding(params.domain);
        break;
      case 'addPatternForwarding':
        data = await daApi.addPatternForwarding(params);
        break;
      case 'getPlusAddressing':
        data = await daApi.getPlusAddressing(params.domain);
        break;
      case 'togglePlusAddressing':
        data = await daApi.togglePlusAddressing(params);
        break;

      case 'listDatabases': {
        const domain = String(params.domain || '');
        data = await resolveMirrorOrLive({
          onStale: () => scheduleDaSync(0),
          mirror: () => listMirrorDatabases(domain, mirrorScope),
          live: async () => daApi.listDatabases(domain),
        });
        break;
      }
      case 'createDatabase':
        data = await daApi.createDatabase(params);
        break;
      case 'deleteDatabase':
        data = await daApi.deleteDatabase(params);
        break;

      case 'listFTPAccounts': {
        const domain = String(params.domain || '');
        data = await resolveMirrorOrLive({
          onStale: () => scheduleDaSync(0),
          mirror: () => listMirrorFtp(domain, mirrorScope),
          live: async () => daApi.listFTPAccounts(domain),
        });
        break;
      }
      case 'createFTPAccount':
        data = await daApi.createFTPAccount(params);
        break;
      case 'deleteFTPAccount':
        data = await daApi.deleteFTPAccount(params);
        break;

      case 'issueSSL':
        data = await daApi.issueSSL(String(params.domain || ''), {
          force: params.force === true || params.force === 'yes',
          renew: params.renew === true || params.renew === 'yes',
          autoRenewDays: params.autoRenewDays ? String(params.autoRenewDays) : undefined,
        });
        break;
      case 'replaceSSL':
        data = await daApi.replaceSSL(String(params.domain || ''));
        break;
      case 'deleteSSL':
        data = await daApi.deleteSSL(String(params.domain || ''));
        break;
      case 'cancelSslRenewal':
        data = await daApi.cancelSslRenewal(String(params.domain || ''));
        break;
      case 'setForceSsl':
        data = await daApi.setForceSsl(String(params.domain || ''), params.enabled !== false);
        break;
      case 'getSslCertificate':
        data = await daApi.getSslCertificate(String(params.hostname || params.domain || ''));
        break;

      case 'listDNS': {
        const domain = String(params.domain || '');
        data = await resolveMirrorOrLive({
          onStale: () => scheduleDaSync(0),
          mirror: () => listMirrorDns(domain, mirrorScope),
          live: async () => daApi.listDNS(domain),
        });
        break;
      }
      case 'createDNSZone':
        data = await daApi.createDNSZone(params);
        break;
      case 'deleteDNSZone':
        data = await daApi.deleteDNSZone(params);
        break;
      case 'resetDNSConfigurations':
        data = await daApi.resetDNSConfigurations(params.domain);
        break;
      case 'configDefaultNameservers':
        data = await daApi.configDefaultNameservers(params);
        break;
      case 'createNameserver':
        data = await daApi.createNameserver(params);
        break;
      case 'configCloudFlare':
        data = await daApi.configCloudFlare(params);
        break;
      case 'enableDKIM':
        data = await daApi.enableDKIM(params.domain);
        break;
      case 'getDKIMStatus':
        data = await daApi.getDKIMStatus(params.domain);
        break;

      case 'getFirewallStatus':
        data = await daApi.getFirewallStatus();
        break;
      case 'toggleFirewall':
        data = await daApi.toggleFirewall(params);
        break;
      case 'getModSecurityStatus':
        data = await daApi.getModSecurityStatus();
        break;
      case 'toggleModSecurity':
        data = await daApi.toggleModSecurity(params);
        break;
      case 'getBlockedIPs':
        data = await daApi.getBlockedIPs();
        break;
      case 'blockIP':
        data = await daApi.blockIP(params);
        break;
      case 'unblockIP':
        data = await daApi.unblockIP(params);
        break;
      case 'getBruteForceConfig':
        data = await daApi.getBruteForceConfig();
        break;
      case 'getBruteForceHistory':
        data = await daApi.getBruteForceHistory();
        break;
      case 'saveBruteForceConfig':
        data = await daApi.saveBruteForceConfig(params);
        break;

      case 'serverStats':
        data = await daApi.getServerStats();
        break;
      case 'generateAPIToken':
        data = await daApi.generateAPIToken();
        break;

      case 'getPHPConfig':
        data = await daApi.getPHPConfig(params.domain);
        break;
      case 'savePHPConfig':
        data = await daApi.savePHPConfig(params);
        break;
      case 'changePHPVersion':
        data = await daApi.changePHPVersion(params);
        break;

      case 'listACLs':
        data = await daApi.listACLs();
        break;
      case 'createACL':
        data = await daApi.createACL(params);
        break;
      case 'deleteACL':
        data = await daApi.deleteACL(params);
        break;

      case 'listWordPress':
        data = await daApi.listWordPress(params.domain);
        break;
      case 'installWordPress':
        data = await daApi.installWordPress(params);
        break;
      case 'listWPPlugins':
        data = await daApi.listWPPlugins(params);
        break;
      case 'installWPPlugin':
        data = await daApi.installWPPlugin(params);
        break;
      case 'toggleWPPlugin':
        data = await daApi.toggleWPPlugin(params);
        break;
      case 'listWPBackups':
        data = await daApi.listWPBackups(params.domain);
        break;
      case 'restoreWPBackup':
        data = await daApi.restoreWPBackup(params);
        break;
      case 'createRemoteBackup':
        data = await daApi.createRemoteBackup(params);
        break;

      case 'execCommand':
        data = await daApi.execCommand(params.command);
        break;

      default:
        return NextResponse.json(
          { success: false, error: `Acção "${action}" não suportada.`, supported: false },
          { status: 400 },
        );
    }

    if (MUTATION_ACTIONS.has(action)) {
      if (mutationSucceeded(data)) {
        await mirrorAfterDaMutation(action, params as Record<string, unknown>);
      }
      scheduleDaSync(400);
    }

    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    console.error('[DA API ERROR]', message);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const resolved = await resolveApi();
    if ('error' in resolved) return resolved.error;

    const { daApi, user, mirrorScope } = resolved;
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');

    if (!action) {
      return NextResponse.json({ success: false, error: 'action é obrigatória' }, { status: 400 });
    }

    if (!daApi) {
      if (action === 'listWebsites') {
        return NextResponse.json({ success: true, data: await listHostingDomains(mirrorScope) });
      }
      if (action === 'listUsers') {
        return NextResponse.json({ success: true, data: await listMirrorUsers(mirrorScope) });
      }
      if (action === 'listPackages') {
        return NextResponse.json({ success: true, data: await listMirrorPackages(mirrorScope) });
      }
      return NextResponse.json({ success: false, error: `GET action "${action}" ainda não está disponível no Hestia.` }, { status: 501 });
    }

    let data: unknown;
    switch (action) {
      case 'listUsers': {
        data = await listMirrorUsers(mirrorScope);
        if (!Array.isArray(data) || data.length === 0) data = await daApi.listUsers();
        break;
      }
      case 'listPackages': {
        data = await listMirrorPackages(mirrorScope);
        if (!Array.isArray(data) || data.length === 0) data = await daApi.listPackages();
        break;
      }
      case 'listWebsites': {
        data = await listHostingDomains(mirrorScope);
        if (!Array.isArray(data) || (data as unknown[]).length === 0) data = await daApi.listWebsites();
        break;
      }
      default:
        return NextResponse.json(
          { success: false, error: `GET action "${action}" não suportada` },
          { status: 400 },
        );
    }

    return NextResponse.json({ success: true, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
