/**
 * Escrita imediata no espelho Supabase (panel_*) após mutações.
 */

import { scheduleDaSync } from '@/lib/da-sync-engine';
import { getDaSyncAdmin } from '@/lib/da-sync-schema';

function now() {
  return new Date().toISOString();
}

export async function upsertMirrorUser(row: {
  username: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  acl?: string;
  status?: string;
  websites_limit?: number;
  emails_limit?: number;
  parent_username?: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const sb = getDaSyncAdmin();
  if (!sb) return { ok: false, error: 'Base de dados indisponível' };
  const ts = now();
  const { error } = await sb.from('panel_users').upsert(
    {
      username: row.username,
      email: row.email ?? '',
      first_name: row.first_name ?? '',
      last_name: row.last_name ?? '',
      acl: row.acl ?? 'user',
      status: row.status ?? 'Active',
      websites_limit: row.websites_limit ?? 0,
      emails_limit: row.emails_limit ?? 0,
      parent_username: row.parent_username ?? null,
      synced_at: ts,
      updated_at: ts,
    },
    { onConflict: 'username' },
  );
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function patchMirrorUser(
  username: string,
  updates: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  const sb = getDaSyncAdmin();
  if (!sb) return { ok: false, error: 'Base de dados indisponível' };
  const { error } = await sb
    .from('panel_users')
    .update({ ...updates, updated_at: now() })
    .eq('username', username);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function deleteMirrorUser(username: string): Promise<{ ok: boolean; error?: string }> {
  const sb = getDaSyncAdmin();
  if (!sb) return { ok: false, error: 'Base de dados indisponível' };
  const { error } = await sb.from('panel_users').delete().eq('username', username);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function upsertMirrorSite(row: {
  domain: string;
  owner: string;
  admin_email?: string;
  package?: string;
  status?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const sb = getDaSyncAdmin();
  if (!sb) return { ok: false, error: 'Base de dados indisponível' };
  const ts = now();
  const { error } = await sb.from('panel_sites').upsert(
    {
      domain: row.domain,
      owner: row.owner,
      admin_email: row.admin_email ?? '',
      package: row.package ?? 'Default',
      status: row.status ?? 'Active',
      synced_at: ts,
      updated_at: ts,
    },
    { onConflict: 'domain' },
  );
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function deleteMirrorSite(domain: string): Promise<{ ok: boolean; error?: string }> {
  const sb = getDaSyncAdmin();
  if (!sb) return { ok: false, error: 'Base de dados indisponível' };
  const { error } = await sb.from('panel_sites').delete().eq('domain', domain);
  if (error) return { ok: false, error: error.message };
  await sb.from('panel_emails').delete().eq('domain', domain);
  await sb.from('panel_subdomains').delete().eq('domain', domain);
  await sb.from('panel_databases').delete().eq('domain', domain);
  await sb.from('panel_ftp').delete().eq('domain', domain);
  await sb.from('panel_dns').delete().eq('domain', domain);
  return { ok: true };
}

export async function upsertMirrorEmail(row: {
  domain: string;
  email_user: string;
  quota?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const sb = getDaSyncAdmin();
  if (!sb) return { ok: false, error: 'Base de dados indisponível' };
  const { error } = await sb.from('panel_emails').upsert(
    {
      domain: row.domain,
      email_user: row.email_user,
      quota: row.quota ?? '500',
      usage: '0',
    },
    { onConflict: 'domain,email_user' },
  );
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function deleteMirrorEmail(domain: string, emailUser: string): Promise<{ ok: boolean; error?: string }> {
  const sb = getDaSyncAdmin();
  if (!sb) return { ok: false, error: 'Base de dados indisponível' };
  const { error } = await sb.from('panel_emails').delete().eq('domain', domain).eq('email_user', emailUser);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function upsertMirrorSubdomain(row: {
  domain: string;
  subdomain: string;
  path?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const sb = getDaSyncAdmin();
  if (!sb) return { ok: false, error: 'Base de dados indisponível' };
  const { error } = await sb.from('panel_subdomains').upsert(
    { domain: row.domain, subdomain: row.subdomain, path: row.path ?? '' },
    { onConflict: 'domain,subdomain' },
  );
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function deleteMirrorSubdomain(domain: string, subdomain: string): Promise<{ ok: boolean; error?: string }> {
  const sb = getDaSyncAdmin();
  if (!sb) return { ok: false, error: 'Base de dados indisponível' };
  const { error } = await sb.from('panel_subdomains').delete().eq('domain', domain).eq('subdomain', subdomain);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function upsertMirrorDatabase(row: {
  domain: string;
  db_name: string;
  db_user?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const sb = getDaSyncAdmin();
  if (!sb) return { ok: false, error: 'Base de dados indisponível' };
  const { error } = await sb.from('panel_databases').upsert(
    { domain: row.domain, db_name: row.db_name, db_user: row.db_user ?? row.db_name },
    { onConflict: 'domain,db_name' },
  );
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function deleteMirrorDatabase(domain: string, dbName: string): Promise<{ ok: boolean; error?: string }> {
  const sb = getDaSyncAdmin();
  if (!sb) return { ok: false, error: 'Base de dados indisponível' };
  const { error } = await sb.from('panel_databases').delete().eq('domain', domain).eq('db_name', dbName);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function upsertMirrorFtp(row: {
  domain: string;
  username: string;
  path?: string;
}): Promise<{ ok: boolean; error?: string }> {
  const sb = getDaSyncAdmin();
  if (!sb) return { ok: false, error: 'Base de dados indisponível' };
  const { error } = await sb.from('panel_ftp').upsert(
    { domain: row.domain, username: row.username, path: row.path ?? '/' },
    { onConflict: 'domain,username' },
  );
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function deleteMirrorFtp(domain: string, username: string): Promise<{ ok: boolean; error?: string }> {
  const sb = getDaSyncAdmin();
  if (!sb) return { ok: false, error: 'Base de dados indisponível' };
  const { error } = await sb.from('panel_ftp').delete().eq('domain', domain).eq('username', username);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function upsertMirrorDns(row: {
  domain: string;
  name: string;
  type: string;
  value: string;
  ttl?: string | number;
}): Promise<{ ok: boolean; id?: string; error?: string }> {
  const sb = getDaSyncAdmin();
  if (!sb) return { ok: false, error: 'Base de dados indisponível' };
  const ts = now();
  const { data, error } = await sb
    .from('panel_dns')
    .upsert(
      {
        domain: row.domain,
        name: row.name,
        type: row.type.toUpperCase(),
        value: row.value,
        ttl: String(row.ttl ?? '3600'),
        synced_at: ts,
      },
      { onConflict: 'domain,name,type' },
    )
    .select('id')
    .maybeSingle();
  return error ? { ok: false, error: error.message } : { ok: true, id: data?.id ? String(data.id) : undefined };
}

export async function deleteMirrorDnsById(id: string): Promise<{ ok: boolean; error?: string }> {
  const sb = getDaSyncAdmin();
  if (!sb) return { ok: false, error: 'Base de dados indisponível' };
  const { error } = await sb.from('panel_dns').delete().eq('id', id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function deleteMirrorDnsRecord(
  domain: string,
  name: string,
  type: string,
): Promise<{ ok: boolean; error?: string }> {
  const sb = getDaSyncAdmin();
  if (!sb) return { ok: false, error: 'Base de dados indisponível' };
  const { error } = await sb
    .from('panel_dns')
    .delete()
    .eq('domain', domain)
    .eq('name', name)
    .eq('type', type.toUpperCase());
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function patchMirrorSite(
  domain: string,
  updates: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  const sb = getDaSyncAdmin();
  if (!sb) return { ok: false, error: 'Base de dados indisponível' };
  const { error } = await sb
    .from('panel_sites')
    .update({ ...updates, updated_at: now() })
    .eq('domain', domain);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function upsertMirrorPackage(row: {
  package_name: string;
  disk_space?: number;
  bandwidth?: number;
  email_accounts?: number;
  databases?: number;
  ftp_accounts?: number;
  allowed_domains?: number;
  package_form_json?: import('@/lib/reseller-package-form').ResellerPackageFormState | null;
}): Promise<{ ok: boolean; error?: string }> {
  const { ensureDaSyncSchema } = await import('@/lib/da-sync-schema');
  await ensureDaSyncSchema();
  const sb = getDaSyncAdmin();
  if (!sb) return { ok: false, error: 'Base de dados indisponível' };
  const ts = now();
  const payload: Record<string, unknown> = {
    package_name: row.package_name,
    disk_space: row.disk_space ?? 1000,
    bandwidth: row.bandwidth ?? 10000,
    email_accounts: row.email_accounts ?? 10,
    databases: row.databases ?? 1,
    ftp_accounts: row.ftp_accounts ?? 0,
    allowed_domains: row.allowed_domains ?? 0,
    synced_at: ts,
    updated_at: ts,
  };
  if (row.package_form_json) {
    payload.package_form_json = row.package_form_json;
  }
  const { error } = await sb.from('panel_packages').upsert(payload, { onConflict: 'package_name' });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function deleteMirrorPackage(packageName: string): Promise<{ ok: boolean; error?: string }> {
  const sb = getDaSyncAdmin();
  if (!sb) return { ok: false, error: 'Base de dados indisponível' };
  const { error } = await sb.from('panel_packages').delete().eq('package_name', packageName);
  return error ? { ok: false, error: error.message } : { ok: true };
}

type PackageLimitKey = 'quota' | 'bandwidth' | 'nemails' | 'mysql' | 'ftp' | 'vdomains';

function limitNumberFromForm(
  limits: Record<string, { value: string; unlimited: boolean }> | undefined,
  key: PackageLimitKey,
  fallback: number,
): number {
  const row = limits?.[key];
  if (!row) return fallback;
  if (row.unlimited) return -1;
  const n = Number(row.value);
  return Number.isFinite(n) ? n : fallback;
}

/** Espelho Supabase a partir do formulário do painel (fonte de verdade do painel). */
export function packageMirrorRowFromParams(
  params: Record<string, unknown>,
): Parameters<typeof upsertMirrorPackage>[0] | null {
  const package_name = str(params, 'packageName', 'package');
  if (!package_name) return null;

  const form = params.hostingPackageForm as
    | import('@/lib/reseller-package-form').ResellerPackageFormState
    | undefined;
  const limits = form?.limits;

  return {
    package_name,
    disk_space: limitNumberFromForm(limits, 'quota', 1000),
    bandwidth: limitNumberFromForm(limits, 'bandwidth', 10000),
    email_accounts: limitNumberFromForm(limits, 'nemails', 10),
    databases: limitNumberFromForm(limits, 'mysql', 1),
    ftp_accounts: limitNumberFromForm(limits, 'ftp', 0),
    allowed_domains: limitNumberFromForm(limits, 'vdomains', 1),
    package_form_json: form?.packageName || form?.limits ? { ...form, packageName: package_name } : undefined,
  };
}

function str(params: Record<string, unknown>, ...keys: string[]): string {
  for (const k of keys) {
    const v = params[k];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return '';
}

/** Re-sincroniza zona DNS de um domínio para o espelho (após mutação ou reset). */
export async function resyncMirrorDnsForDomain(domain: string): Promise<void> {
  const sb = getDaSyncAdmin();
  if (!sb || !domain) return;

  const { data: site } = await sb
    .from('panel_sites')
    .select('owner')
    .eq('domain', domain)
    .maybeSingle();
  const owner = String(site?.owner || 'admin');

  const { loadResellerCredentialsByDaUsername } = await import('@/lib/da-credential-store');
  const { resolveDirectAdminCredentials } = await import('@/lib/directadmin-credentials');
  const { createDirectAdminAPI } = await import('@/lib/directadmin-adapter');

  let creds: import('@/lib/directadmin-credentials').DirectAdminCredentials;
  if (!owner || owner === 'admin') {
    creds = await resolveDirectAdminCredentials('admin');
  } else {
    const stored = await loadResellerCredentialsByDaUsername(owner);
    creds = stored
      ? { role: 'reseller', user: stored.user, password: stored.password }
      : await resolveDirectAdminCredentials('admin');
  }

  const da = createDirectAdminAPI(creds);
  const records = await da.listDNS(domain);
  const syncedAt = now();
  await sb.from('panel_dns').delete().eq('domain', domain);

  for (const rec of records) {
    const name = String(rec.name || domain);
    const type = String(rec.type || 'A').toUpperCase();
    const value = String(rec.content || rec.value || '');
    if (!value) continue;
    await sb.from('panel_dns').upsert(
      {
        domain,
        name,
        type,
        value,
        ttl: String(rec.ttl ?? '3600'),
        synced_at: syncedAt,
      },
      { onConflict: 'domain,name,type' },
    );
  }
}

/** Espelho imediato Supabase após mutação bem-sucedida no servidor. */
export async function mirrorAfterDaMutation(
  action: string,
  params: Record<string, unknown>,
): Promise<void> {
  const domain = str(params, 'domain', 'domainName');
  const userName = str(params, 'userName', 'username');

  switch (action) {
    case 'createSubdomain': {
      const sub = str(params, 'subdomain');
      const full = sub.includes('.') ? sub : domain && sub ? `${sub}.${domain}` : sub;
      if (domain && full) await upsertMirrorSubdomain({ domain, subdomain: full });
      break;
    }
    case 'deleteSubdomain': {
      const sub = str(params, 'subdomain');
      if (domain && sub) await deleteMirrorSubdomain(domain, sub);
      break;
    }
    case 'createDatabase': {
      const dbName = str(params, 'dbName', 'db_name');
      if (domain && dbName) {
        await upsertMirrorDatabase({
          domain,
          db_name: dbName,
          db_user: str(params, 'dbUser', 'db_user') || dbName,
        });
      }
      break;
    }
    case 'deleteDatabase': {
      const dbName = str(params, 'dbName', 'db_name', 'name');
      if (!dbName) break;
      if (domain) await deleteMirrorDatabase(domain, dbName);
      else {
        const sb = getDaSyncAdmin();
        if (sb) await sb.from('panel_databases').delete().eq('db_name', dbName);
      }
      break;
    }
    case 'createFTPAccount': {
      const ftpUser = str(params, 'username', 'userName');
      if (domain && ftpUser) {
        await upsertMirrorFtp({ domain, username: ftpUser, path: str(params, 'path') || '/' });
      }
      break;
    }
    case 'deleteFTPAccount': {
      const ftpUser = str(params, 'username', 'userName');
      if (!ftpUser) break;
      if (domain) await deleteMirrorFtp(domain, ftpUser);
      else {
        const sb = getDaSyncAdmin();
        if (sb) await sb.from('panel_ftp').delete().eq('username', ftpUser);
      }
      break;
    }
    case 'createEmail': {
      const email = str(params, 'email');
      const emailUser = str(params, 'userName') || (email.includes('@') ? email.split('@')[0] : '');
      const emailDomain = domain || (email.includes('@') ? email.split('@')[1] : '');
      if (emailDomain && emailUser) {
        await upsertMirrorEmail({
          domain: emailDomain,
          email_user: emailUser,
          quota: str(params, 'quota') || '500',
        });
      }
      break;
    }
    case 'deleteEmail': {
      const email = str(params, 'email');
      if (email.includes('@')) {
        const [u, d] = email.split('@');
        await deleteMirrorEmail(d, u);
      }
      break;
    }
    case 'createUser': {
      const createdDomain = str(params, 'domain') || (userName ? `${userName}.com` : '');
      if (userName) {
        await upsertMirrorUser({
          username: userName,
          email: str(params, 'email'),
          acl: str(params, 'acl') || 'user',
          parent_username: str(params, 'parentReseller', 'parent_username') || null,
          status: 'Active',
        });
      }
      if (createdDomain.includes('.') && userName) {
        await upsertMirrorSite({
          domain: createdDomain,
          owner: userName,
          admin_email: str(params, 'email', 'adminEmail'),
          package: str(params, 'package', 'packageName') || 'Default',
        });
      }
      break;
    }
    case 'modifyUser':
      if (userName) {
        await patchMirrorUser(userName, {
          ...(str(params, 'email') ? { email: str(params, 'email') } : {}),
        });
      }
      break;
    case 'deleteUser':
      if (userName) await deleteMirrorUser(userName);
      break;
    case 'createWebsite': {
      const siteDomain = str(params, 'domain');
      const owner = str(params, 'owner', 'userName') || userName;
      if (siteDomain) {
        await upsertMirrorSite({
          domain: siteDomain,
          owner: owner || 'admin',
          admin_email: str(params, 'adminEmail', 'email'),
          package: str(params, 'package', 'packageName') || 'Default',
        });
      }
      break;
    }
    case 'deleteWebsite':
      if (domain) await deleteMirrorSite(domain);
      break;
    case 'suspendWebsite':
      if (domain) await patchMirrorSite(domain, { status: 'Suspended' });
      break;
    case 'unsuspendWebsite':
      if (domain) await patchMirrorSite(domain, { status: 'Active' });
      break;
    case 'modifyWebsite':
      if (domain) {
        await patchMirrorSite(domain, {
          ...(str(params, 'package', 'packageName') ? { package: str(params, 'package', 'packageName') } : {}),
          ...(str(params, 'adminEmail', 'email') ? { admin_email: str(params, 'adminEmail', 'email') } : {}),
        });
      }
      break;
    case 'createPackage':
    case 'modifyPackage':
    case 'editPackage': {
      const pkg = str(params, 'packageName', 'package');
      if (!pkg) break;
      const rowFromForm = packageMirrorRowFromParams(params as Record<string, unknown>);
      if (rowFromForm?.package_form_json) {
        await upsertMirrorPackage(rowFromForm);
        break;
      }
      try {
        const { getAdminDirectAdminAPI } = await import('@/lib/directadmin-adapter');
        const { packageRowFromFields } = await import('@/lib/panel-brand-packages');
        const api = await getAdminDirectAdminAPI();
        const fields = await api.getPackageDetails(pkg);
        const row = packageRowFromFields(pkg, fields);
        const asNum = (v: string | number | undefined) => {
          const n = typeof v === 'number' ? v : Number(v);
          return Number.isFinite(n) ? n : undefined;
        };
        await upsertMirrorPackage({
          package_name: row.packageName,
          disk_space: asNum(row.diskSpace),
          bandwidth: asNum(row.bandwidth),
          email_accounts: asNum(row.emailAccounts),
          databases: asNum(row.dataBases),
          ftp_accounts: asNum(row.ftpAccounts),
          allowed_domains: asNum(row.allowedDomains),
        });
      } catch {
        if (rowFromForm) await upsertMirrorPackage(rowFromForm);
      }
      break;
    }
    case 'deletePackage': {
      const pkg = str(params, 'packageName');
      if (pkg) await deleteMirrorPackage(pkg);
      break;
    }
    case 'issueSSL':
      if (domain) await patchMirrorSite(domain, { ssl_status: 'Secure' });
      break;
    case 'replaceSSL':
      if (domain) await patchMirrorSite(domain, { ssl_status: 'Secure' });
      break;
    case 'deleteSSL':
      if (domain) await patchMirrorSite(domain, { ssl_status: 'No SSL' });
      break;
    case 'changePHPVersion':
      if (str(params, 'domain')) {
        await patchMirrorSite(str(params, 'domain'), {
          php_version: str(params, 'phpVersion', 'php1_release'),
        });
      }
      break;
    case 'suspendEmail':
    case 'unsuspendEmail':
    case 'changeEmailPassword':
    case 'setEmailLimits':
    case 'addEmailForwarding':
    case 'setCatchAllEmail':
      scheduleDaSync(800);
      break;
    case 'createDNSZone':
    case 'resetDNSConfigurations':
      if (domain) await resyncMirrorDnsForDomain(domain);
      else scheduleDaSync(800);
      break;
    case 'deleteDNSZone':
      if (domain) {
        const sb = getDaSyncAdmin();
        if (sb) await sb.from('panel_dns').delete().eq('domain', domain);
      }
      break;
    case 'installWordPress':
      if (domain) {
        await patchMirrorSite(domain, { site_type: 'wordpress', status: 'Active' });
      }
      break;
    default:
      break;
  }
}

export function mutationSucceeded(data: unknown): boolean {
  if (data === null || data === undefined) return true;
  if (typeof data !== 'object') return true;
  const row = data as { success?: boolean; ok?: boolean };
  if (row.success === false || row.ok === false) return false;
  return true;
}
