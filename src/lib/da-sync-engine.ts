/**
 * Sincronização completa DirectAdmin → espelho Supabase (panel_*).
 * Fonte de verdade operacional: DirectAdmin. O painel lê o espelho.
 */

import { createDirectAdminAPI, fetchDaUserUsageStats, getAdminDirectAdminAPI } from '@/lib/directadmin-adapter';
import type { DirectAdminServerAPI } from '@/lib/directadmin-adapter';
import { loadResellerCredentialsByDaUsername } from '@/lib/da-credential-store';
import { ensureDaLoginKeyForUsername } from '@/lib/da-login-key-ssh';
import type { DirectAdminCredentials } from '@/lib/directadmin-credentials';
import { resolveDirectAdminCredentials } from '@/lib/directadmin-credentials';
import type {
  PanelWebsite,
  PanelUser,
  PanelPackage,
  PanelEmailAccount,
} from '@/lib/directadmin-hosting-api';
import { ensureDaSyncSchema, getDaSyncAdmin } from '@/lib/da-sync-schema';

export type DaSyncResult = {
  ok: boolean;
  syncId?: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  counts: {
    sites: number;
    users: number;
    packages: number;
    emails: number;
    subdomains: number;
    databases: number;
    ftp: number;
    dns: number;
  };
  errors: string[];
};

const DOMAIN_CONCURRENCY = 4;

async function resolveSiteDiskUsageMb(owner: string, domain: string): Promise<string> {
  try {
    const { executeServerCommand } = await import('@/lib/server-ssh-exec');
    const safeOwner = owner.replace(/[^a-zA-Z0-9._-]/g, '');
    const safeDomain = domain.replace(/[^a-zA-Z0-9._-]/g, '');
    if (!safeOwner || !safeDomain) return '0';
    const out = await executeServerCommand(
      `du -sm "/home/${safeOwner}/domains/${safeDomain}" 2>/dev/null | awk '{print $1}'`,
    );
    const mb = parseInt(out.trim(), 10);
    return Number.isFinite(mb) ? String(mb) : '0';
  } catch {
    return '0';
  }
}

async function syncUserMirrorRow(
  admin: NonNullable<ReturnType<typeof getDaSyncAdmin>>,
  user: PanelUser,
  syncedAt: string,
  parentUsername?: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const username = user.userName;
  if (!username) return { ok: false, error: 'username vazio' };

  let usage = {
    diskUsedMb: 0,
    bandwidthUsedMb: 0,
    diskLimitMb: null as number | null,
    bandwidthLimitMb: null as number | null,
    packageName: '',
  };
  try {
    const creds = await resolveDirectAdminCredentials('admin');
    usage = await fetchDaUserUsageStats(creds, username);
  } catch {
    /* limites/uso opcionais */
  }

  const { error } = await admin.from('panel_users').upsert(
    {
      username,
      first_name: user.firstName || '',
      last_name: user.lastName || '',
      email: user.email || '',
      acl: user.acl || user.type || 'user',
      websites_limit: user.websitesLimit ?? 0,
      emails_limit: user.emailsLimit ?? 0,
      parent_username: parentUsername ?? user.parentUsername ?? null,
      package_name: usage.packageName || null,
      disk_used_mb: usage.diskUsedMb,
      bandwidth_used_mb: usage.bandwidthUsedMb,
      quota_limit_mb: usage.diskLimitMb,
      bandwidth_limit_mb: usage.bandwidthLimitMb,
      status: user.suspended ? 'Suspended' : user.status || 'Active',
      synced_at: syncedAt,
      updated_at: syncedAt,
    },
    { onConflict: 'username' },
  );
  return error ? { ok: false, error: error.message } : { ok: true };
}

async function mapPool<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

function nowIso() {
  return new Date().toISOString();
}

export async function runDaFullSync(): Promise<DaSyncResult> {
  const startedAt = nowIso();
  const t0 = Date.now();
  const errors: string[] = [];
  const counts = {
    sites: 0,
    users: 0,
    packages: 0,
    emails: 0,
    subdomains: 0,
    databases: 0,
    ftp: 0,
    dns: 0,
  };

  await ensureDaSyncSchema();
  const admin = getDaSyncAdmin();
  if (!admin) {
    return {
      ok: false,
      startedAt,
      finishedAt: nowIso(),
      durationMs: Date.now() - t0,
      counts,
      errors: ['Supabase Service Role não configurado'],
    };
  }

  let syncId: string | undefined;
  try {
    const staleBefore = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    await admin
      .from('panel_sync_log')
      .update({
        status: 'failed',
        finished_at: nowIso(),
        errors: ['Sync anterior expirou — substituído por nova execução'],
      })
      .eq('status', 'running')
      .lt('started_at', staleBefore);

    const { data: logRow } = await admin
      .from('panel_sync_log')
      .insert({ status: 'running', started_at: startedAt })
      .select('id')
      .single();
    syncId = logRow?.id;
  } catch {
    /* tabela pode não existir ainda */
  }

  const da = await getAdminDirectAdminAPI();

  let sites: PanelWebsite[] = [];
  let users: PanelUser[] = [];
  let packages: PanelPackage[] = [];

  try {
    sites = await da.listWebsites();
    users = await da.listUsers();
    packages = await da.listPackages().catch(() => [] as PanelPackage[]);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Falha ao ler DirectAdmin';
    errors.push(msg);
    await finishLog(admin, syncId, 'failed', counts, errors, Date.now() - t0);
    return {
      ok: false,
      syncId,
      startedAt,
      finishedAt: nowIso(),
      durationMs: Date.now() - t0,
      counts,
      errors,
    };
  }

  const syncedAt = nowIso();
  const liveDomains = new Set<string>();

  // ── Sites ──
  for (const site of sites) {
    if (!site.domain) continue;
    liveDomains.add(site.domain);
    const owner = site.owner || 'admin';
    const disk_usage = await resolveSiteDiskUsageMb(owner, site.domain);
    const { error } = await admin.from('panel_sites').upsert(
      {
        domain: site.domain,
        admin_email: site.adminEmail || '',
        package: site.package || 'Default',
        owner,
        status: site.state || site.status || 'Active',
        disk_usage,
        bandwidth_usage: String(site.bandwidth ?? '0'),
        php_version: site.phpVersion || null,
        ssl_status: site.sslStatus || (site.ssl ? 'Secure' : 'No SSL'),
        ip: site.ip || null,
        site_type: site.siteType || 'empty',
        synced_at: syncedAt,
        updated_at: syncedAt,
      },
      { onConflict: 'domain' },
    );
    if (error) errors.push(`site ${site.domain}: ${error.message}`);
    else counts.sites++;
  }

  const { data: existingSites } = await admin.from('panel_sites').select('domain');
  const staleDomains = (existingSites || [])
    .map((r) => r.domain as string)
    .filter((d) => d && !liveDomains.has(d));
  if (staleDomains.length) {
    await admin.from('panel_sites').delete().in('domain', staleDomains);
    for (const d of staleDomains) {
      await admin.from('panel_emails').delete().eq('domain', d);
      await admin.from('panel_subdomains').delete().eq('domain', d);
      await admin.from('panel_databases').delete().eq('domain', d);
      await admin.from('panel_ftp').delete().eq('domain', d);
      await admin.from('panel_dns').delete().eq('domain', d);
    }
  }

  // ── Users ──
  const liveUsernames = new Set<string>();
  for (const user of users) {
    const username = user.userName;
    if (!username) continue;
    liveUsernames.add(username);
    const saved = await syncUserMirrorRow(admin, user, syncedAt);
    if (!saved.ok) errors.push(`user ${username}: ${saved.error}`);
    else counts.users++;
  }

  // ── Sub-contas sob revenda (quando SHOW_ALL_USERS não as inclui) ──
  const resellerNames = new Set<string>();
  for (const user of users) {
    const acl = (user.acl || user.type || '').toLowerCase();
    if (acl.includes('reseller') && user.userName) {
      resellerNames.add(user.userName);
    }
  }
  const legacyReseller = process.env.DIRECTADMIN_RESELLER_USER?.trim();
  if (legacyReseller) resellerNames.add(legacyReseller);
  resellerNames.add('oshercollective');

  for (const resellerUsername of resellerNames) {
    if (!resellerUsername || resellerUsername === 'admin') continue;
    try {
      const stored = await loadResellerCredentialsByDaUsername(resellerUsername);
      const legacyPass =
        process.env.DIRECTADMIN_RESELLER_LOGIN_KEY?.trim() ||
        process.env.DIRECTADMIN_RESELLER_PASSWORD?.trim() ||
        process.env.DIRECTADMIN_RESELLER_PASS?.trim();
      let creds: DirectAdminCredentials | null = null;
      if (stored) {
        creds = { role: 'reseller', user: stored.user, password: stored.password };
      } else if (legacyReseller === resellerUsername && legacyPass) {
        creds = { role: 'reseller', user: legacyReseller, password: legacyPass };
      }
      if (!creds) continue;

      const resellerApi = createDirectAdminAPI(creds);
      const subUsers = await resellerApi.listUsers();
      for (const sub of subUsers) {
        const username = sub.userName;
        if (!username || username === resellerUsername) continue;
        liveUsernames.add(username);
        const saved = await syncUserMirrorRow(admin, sub, syncedAt, resellerUsername);
        if (!saved.ok) errors.push(`reseller sub ${username}: ${saved.error}`);
        else counts.users++;
      }
    } catch (e: unknown) {
      errors.push(
        `reseller subs ${resellerUsername}: ${e instanceof Error ? e.message : 'erro'}`,
      );
    }
  }

  const { data: existingUsers } = await admin.from('panel_users').select('username');
  const staleUsers = (existingUsers || [])
    .map((r) => r.username as string)
    .filter((u) => u && !liveUsernames.has(u));
  if (staleUsers.length) {
    await admin.from('panel_users').delete().in('username', staleUsers);
  }

  // ── Packages ──
  const livePackages = new Set<string>();
  const { data: panelManagedRows } = await admin
    .from('panel_packages')
    .select('package_name, package_form_json')
    .not('package_form_json', 'is', null);
  const panelManaged = new Set(
    (panelManagedRows || [])
      .filter((r) => r.package_form_json)
      .map((r) => String(r.package_name || '').toLowerCase())
      .filter(Boolean),
  );
  for (const row of panelManagedRows || []) {
    const name = String(row.package_name || '').trim();
    if (name) livePackages.add(name);
  }

  for (const pkg of packages) {
    const name = pkg.packageName;
    if (!name) continue;
    livePackages.add(name);
    if (panelManaged.has(name.toLowerCase())) continue;
    const { error } = await admin.from('panel_packages').upsert(
      {
        package_name: name,
        disk_space: pkg.diskSpace ?? 1000,
        bandwidth: pkg.bandwidth ?? 10000,
        email_accounts: pkg.emailAccounts ?? 10,
        databases: pkg.dataBases ?? 1,
        ftp_accounts: pkg.ftpAccounts ?? 0,
        allowed_domains: pkg.allowedDomains ?? 0,
        synced_at: syncedAt,
        updated_at: syncedAt,
      },
      { onConflict: 'package_name' },
    );
    if (error) errors.push(`package ${name}: ${error.message}`);
    else counts.packages++;
  }

  const { fetchBrandHostingPackages } = await import('@/lib/panel-brand-packages');
  const brandPackages = await fetchBrandHostingPackages().catch(() => []);
  for (const pkg of brandPackages) {
    const name = pkg.packageName;
    if (!name) continue;
    livePackages.add(name);
    if (panelManaged.has(name.toLowerCase())) continue;
    const { error } = await admin.from('panel_packages').upsert(
      {
        package_name: name,
        disk_space: pkg.diskSpace ?? 1000,
        bandwidth: pkg.bandwidth ?? 10000,
        email_accounts: pkg.emailAccounts ?? 0,
        databases: pkg.dataBases ?? 0,
        ftp_accounts: pkg.ftpAccounts ?? 0,
        allowed_domains: pkg.allowedDomains ?? 0,
        synced_at: syncedAt,
        updated_at: syncedAt,
      },
      { onConflict: 'package_name' },
    );
    if (error) errors.push(`brand package ${name}: ${error.message}`);
    else counts.packages++;
  }

  const { data: existingPkgs } = await admin.from('panel_packages').select('package_name, package_form_json');
  const stalePkgs = (existingPkgs || [])
    .map((r) => r.package_name as string)
    .filter(
      (p) =>
        p &&
        !livePackages.has(p) &&
        !panelManaged.has(String(p).toLowerCase()),
    );
  if (stalePkgs.length) {
    await admin.from('panel_packages').delete().in('package_name', stalePkgs);
  }

  const ownerApis = new Map<string, DirectAdminServerAPI>();
  async function apiForOwner(owner: string): Promise<DirectAdminServerAPI> {
    const key = owner || 'admin';
    const cached = ownerApis.get(key);
    if (cached) return cached;

    let creds: DirectAdminCredentials;
    if (!owner || owner === 'admin') {
      const adminCreds = await import('@/lib/directadmin-credentials').then((m) =>
        m.resolveDirectAdminCredentials('admin'),
      );
      creds = adminCreds;
    } else {
      const stored = await loadResellerCredentialsByDaUsername(owner);
      const legacyUser = process.env.DIRECTADMIN_RESELLER_USER?.trim();
      const legacyPass =
        process.env.DIRECTADMIN_RESELLER_LOGIN_KEY?.trim() ||
        process.env.DIRECTADMIN_RESELLER_PASSWORD?.trim() ||
        process.env.DIRECTADMIN_RESELLER_PASS?.trim();
      if (stored) {
        creds = { role: 'reseller', user: stored.user, password: stored.password };
      } else if (legacyUser === owner && legacyPass) {
        creds = { role: 'reseller', user: legacyUser, password: legacyPass };
      } else {
        throw new Error(`Sem credenciais DA para conta "${owner}"`);
      }
    }

    const api = createDirectAdminAPI(creds);
    ownerApis.set(key, api);
    return api;
  }

  const siteOwners = new Map(sites.map((s) => [s.domain, s.owner || 'admin']));
  const uniqueOwners = [...new Set(siteOwners.values())].filter((o) => o && o !== 'admin');
  for (const owner of uniqueOwners) {
    const creds = await loadResellerCredentialsByDaUsername(owner);
    if (!creds) {
      const sb = getDaSyncAdmin();
      const { data: panelUser } = sb
        ? await sb.from('panel_users').select('email').eq('username', owner).maybeSingle()
        : { data: null };
      await ensureDaLoginKeyForUsername(owner, panelUser?.email || undefined);
    }
  }

  // ── Recursos por domínio (emails, subdomínios, BD, FTP, DNS) ──
  await mapPool([...liveDomains], DOMAIN_CONCURRENCY, async (domain) => {
    const owner = siteOwners.get(domain) || 'admin';
    try {
      const ownerDa = await apiForOwner(owner);
      await syncDomainResources(ownerDa, admin, domain, syncedAt, counts, errors);
    } catch (e: unknown) {
      errors.push(`owner ${owner}@${domain}: ${e instanceof Error ? e.message : 'sem credenciais'}`);
    }
  });

  const durationMs = Date.now() - t0;
  const status: 'ok' | 'partial' | 'failed' =
    errors.length === 0 ? 'ok' : counts.sites > 0 ? 'partial' : 'failed';
  const ok = status !== 'failed';
  await finishLog(admin, syncId, status, counts, errors, durationMs);

  return {
    ok,
    syncId,
    startedAt,
    finishedAt: nowIso(),
    durationMs,
    counts,
    errors,
  };
}

async function syncDomainResources(
  da: DirectAdminServerAPI,
  admin: NonNullable<ReturnType<typeof getDaSyncAdmin>>,
  domain: string,
  syncedAt: string,
  counts: DaSyncResult['counts'],
  errors: string[],
) {
  // Emails
  try {
    const emails: PanelEmailAccount[] = await da.listEmails(domain);
    const liveEmailUsers = new Set<string>();
    for (const acc of emails) {
      const full = acc.email || '';
      const user = full.includes('@') ? full.split('@')[0] : acc.id?.toString().split('@')[0] || '';
      if (!user) continue;
      liveEmailUsers.add(user);
      const { error } = await admin.from('panel_emails').upsert(
        {
          domain,
          email_user: user,
          quota: String(acc.quota_mb ?? acc.quota ?? '500'),
          usage: String(acc.usage ?? '0'),
        },
        { onConflict: 'domain,email_user' },
      );
      if (error) errors.push(`email ${user}@${domain}: ${error.message}`);
      else counts.emails++;
    }
    const { data: oldEmails } = await admin.from('panel_emails').select('email_user').eq('domain', domain);
    const staleEmails = (oldEmails || [])
      .map((r) => r.email_user as string)
      .filter((u) => u && !liveEmailUsers.has(u));
    if (staleEmails.length) {
      await admin.from('panel_emails').delete().eq('domain', domain).in('email_user', staleEmails);
    }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'erro';
      if (!msg.includes('You do not own') && !msg.includes('não possui')) errors.push(`emails ${domain}: ${msg}`);
    }

  // Subdomínios
  try {
    const subs = await da.listSubdomains(domain);
    const liveSubs = new Set<string>();
    for (const sub of subs) {
      const name = sub.subdomain;
      if (!name) continue;
      liveSubs.add(name);
      const { error } = await admin.from('panel_subdomains').upsert(
        { domain, subdomain: name, path: '' },
        { onConflict: 'domain,subdomain' },
      );
      if (error) errors.push(`sub ${name}.${domain}: ${error.message}`);
      else counts.subdomains++;
    }
    const { data: oldSubs } = await admin.from('panel_subdomains').select('subdomain').eq('domain', domain);
    const staleSubs = (oldSubs || [])
      .map((r) => r.subdomain as string)
      .filter((s) => s && !liveSubs.has(s));
    if (staleSubs.length) {
      await admin.from('panel_subdomains').delete().eq('domain', domain).in('subdomain', staleSubs);
    }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'erro';
      if (!msg.includes('no action included') && !msg.includes('You do not own')) {
        errors.push(`subdomains ${domain}: ${msg}`);
      }
    }

  // Bases de dados
  try {
    const dbs = await da.listDatabases(domain);
    const liveDbs = new Set<string>();
    for (const db of dbs) {
      const name = db.dbName;
      if (!name) continue;
      liveDbs.add(name);
      const { error } = await admin.from('panel_databases').upsert(
        { domain, db_name: name, db_user: db.dbUser || name },
        { onConflict: 'domain,db_name' },
      );
      if (error) errors.push(`db ${name}@${domain}: ${error.message}`);
      else counts.databases++;
    }
    const { data: oldDbs } = await admin.from('panel_databases').select('db_name').eq('domain', domain);
    const staleDbs = (oldDbs || [])
      .map((r) => r.db_name as string)
      .filter((n) => n && !liveDbs.has(n));
    if (staleDbs.length) {
      await admin.from('panel_databases').delete().eq('domain', domain).in('db_name', staleDbs);
    }
  } catch (e: unknown) {
    errors.push(`databases ${domain}: ${e instanceof Error ? e.message : 'erro'}`);
  }

  // FTP
  try {
    const ftps = await da.listFTPAccounts(domain);
    const liveFtp = new Set<string>();
    for (const ftp of ftps) {
      const user = ftp.username || ftp.userName || '';
      if (!user) continue;
      liveFtp.add(user);
      const { error } = await admin.from('panel_ftp').upsert(
        { domain, username: user, path: ftp.path || '/' },
        { onConflict: 'domain,username' },
      );
      if (error) errors.push(`ftp ${user}@${domain}: ${error.message}`);
      else counts.ftp++;
    }
    const { data: oldFtp } = await admin.from('panel_ftp').select('username').eq('domain', domain);
    const staleFtp = (oldFtp || [])
      .map((r) => r.username as string)
      .filter((u) => u && !liveFtp.has(u));
    if (staleFtp.length) {
      await admin.from('panel_ftp').delete().eq('domain', domain).in('username', staleFtp);
    }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'erro';
      if (!msg.includes('não possui') && !msg.includes('You do not own')) errors.push(`ftp ${domain}: ${msg}`);
    }

  // DNS — substituir zona completa (não apagar se a listagem falhar)
  try {
    const records = await da.listDNS(domain);
    await admin.from('panel_dns').delete().eq('domain', domain);
    for (const rec of records) {
      const name = String(rec.name || domain);
      const type = String(rec.type || 'A').toUpperCase();
      const value = String(rec.content || rec.value || '');
      if (!value) continue;
      const { error } = await admin.from('panel_dns').upsert(
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
      if (error) errors.push(`dns ${name} ${domain}: ${error.message}`);
      else counts.dns++;
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'erro';
    errors.push(`dns ${domain}: ${msg}`);
  }
}

async function finishLog(
  admin: NonNullable<ReturnType<typeof getDaSyncAdmin>>,
  syncId: string | undefined,
  status: 'ok' | 'partial' | 'failed',
  counts: DaSyncResult['counts'],
  errors: string[],
  durationMs: number,
) {
  if (!syncId) return;
  try {
    await admin
      .from('panel_sync_log')
      .update({
        status,
        sites_count: counts.sites,
        users_count: counts.users,
        packages_count: counts.packages,
        emails_count: counts.emails,
        subdomains_count: counts.subdomains,
        databases_count: counts.databases,
        ftp_count: counts.ftp,
        dns_count: counts.dns,
        errors: errors.slice(0, 50),
        duration_ms: durationMs,
        finished_at: nowIso(),
      })
      .eq('id', syncId);
  } catch {
    /* ignore */
  }
}

/** Sync rápido após mutação no painel (não bloqueia UI). */
export function scheduleDaSync(delayMs = 2000) {
  if (typeof setImmediate !== 'undefined') {
    setImmediate(() => {
      setTimeout(() => {
        runDaFullSync().catch((e) => console.error('[da-sync] background:', e));
      }, delayMs);
    });
  }
}

let syncInFlight: Promise<DaSyncResult> | null = null;

/** Evita syncs paralelos. */
export function runDaFullSyncDeduped(): Promise<DaSyncResult> {
  if (syncInFlight) return syncInFlight;
  syncInFlight = runDaFullSync().finally(() => {
    syncInFlight = null;
  });
  return syncInFlight;
}
