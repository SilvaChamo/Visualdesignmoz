/**
 * Leitura do espelho Supabase (panel_*) — reflecte estado do DirectAdmin.
 */

import { getDaSyncAdmin } from '@/lib/da-sync-schema';
import { loadResellerCredentialsByUserId } from '@/lib/da-credential-store';
import { profileName, type ProfileRow } from '@/lib/profile-db';
import { belongsToCurrentPanel, resolveAccountPanelSite } from '@/lib/panel-tenant';
import { getRedirectPathForRole, resolveUserRole, type UserRole } from '@/lib/user-roles';
import { listPanelAuthAccounts, type PanelAuthAccountRow } from '@/lib/panel-auth-accounts';
import { PANEL_SLUG } from '@/lib/panel-tenant';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  PanelWebsite,
  PanelUser,
  PanelPackage,
  PanelEmailAccount,
  PanelSubdomain,
  PanelDatabase,
  PanelFTPAccount,
} from '@/lib/directadmin-hosting-api';

export type MirrorScope = {
  role: 'admin' | 'reseller';
  userId?: string;
  daUsername?: string;
};

const scopeCache = new Map<string, { isAdmin: boolean; daUsername?: string; at: number }>();
const SCOPE_CACHE_MS = 5 * 60_000;

async function resolveScope(scope: MirrorScope): Promise<{ daUsername?: string; isAdmin: boolean }> {
  const cacheKey = `${scope.role}:${scope.userId || ''}:${scope.daUsername || ''}`;
  const cached = scopeCache.get(cacheKey);
  if (cached && Date.now() - cached.at < SCOPE_CACHE_MS) {
    return { isAdmin: cached.isAdmin, daUsername: cached.daUsername };
  }

  let resolved: { daUsername?: string; isAdmin: boolean };
  if (scope.role === 'admin') {
    resolved = { isAdmin: true };
  } else if (scope.daUsername) {
    resolved = { isAdmin: false, daUsername: scope.daUsername };
  } else if (scope.userId) {
    const creds = await loadResellerCredentialsByUserId(scope.userId);
    resolved = creds?.user
      ? { isAdmin: false, daUsername: creds.user }
      : { isAdmin: false };
  } else {
    resolved = { isAdmin: false };
  }

  scopeCache.set(cacheKey, { ...resolved, at: Date.now() });
  return resolved;
}

function mapSite(row: Record<string, unknown>): PanelWebsite {
  const siteType = String(row.site_type || 'empty');
  return {
    id: String(row.domain || row.id || ''),
    domain: String(row.domain || ''),
    adminEmail: row.admin_email ? String(row.admin_email) : undefined,
    package: row.package ? String(row.package) : undefined,
    state: row.status ? String(row.status) : 'Active',
    status: row.status ? String(row.status) : undefined,
    owner: row.owner ? String(row.owner) : undefined,
    diskUsage: row.disk_usage != null ? String(row.disk_usage) : '0',
    bandwidth: Number(row.bandwidth_usage) || 0,
    ssl: row.ssl_status === 'Secure' || String(row.ssl_status || '').toLowerCase().includes('activ'),
    sslStatus: row.ssl_status ? String(row.ssl_status) : undefined,
    phpVersion: row.php_version ? String(row.php_version) : undefined,
    ip: row.ip ? String(row.ip) : undefined,
    siteType:
      siteType === 'wordpress' || siteType === 'nextjs' || siteType === 'html' || siteType === 'empty'
        ? siteType
        : 'empty',
    hasWordPress: siteType === 'wordpress',
    hasNextJs: siteType === 'nextjs',
    hasBasicSite: siteType === 'html',
  };
}

function mapUser(row: Record<string, unknown>): PanelUser {
  const status = String(row.status || 'Active');
  return {
    id: String(row.username || row.id || ''),
    userName: String(row.username || ''),
    email: row.email ? String(row.email) : undefined,
    type: row.acl ? String(row.acl) : undefined,
    acl: row.acl ? String(row.acl) : undefined,
    suspended: status === 'Suspended',
    status,
    existsOnServer: true,
    firstName: row.first_name ? String(row.first_name) : undefined,
    lastName: row.last_name ? String(row.last_name) : undefined,
    websitesLimit: typeof row.websites_limit === 'number' ? row.websites_limit : undefined,
    emailsLimit: typeof row.emails_limit === 'number' ? row.emails_limit : undefined,
    registeredAt: row.created_at ? String(row.created_at) : row.synced_at ? String(row.synced_at) : undefined,
    parentUsername: row.parent_username ? String(row.parent_username) : undefined,
    diskUsedMb: typeof row.disk_used_mb === 'number' ? row.disk_used_mb : undefined,
    bandwidthUsedMb: typeof row.bandwidth_used_mb === 'number' ? row.bandwidth_used_mb : undefined,
    quotaLimitMb:
      'quota_limit_mb' in row && row.quota_limit_mb === null
        ? null
        : typeof row.quota_limit_mb === 'number'
          ? row.quota_limit_mb
          : undefined,
    bandwidthLimitMb:
      'bandwidth_limit_mb' in row && row.bandwidth_limit_mb === null
        ? null
        : typeof row.bandwidth_limit_mb === 'number'
          ? row.bandwidth_limit_mb
          : undefined,
    packageName: row.package_name ? String(row.package_name) : undefined,
  };
}

function mapLimitFromDb(value: unknown): number | string {
  const n = Number(value);
  if (n === -1) return '-';
  return Number.isFinite(n) ? n : 0;
}

function mapPackage(row: Record<string, unknown>): PanelPackage {
  return {
    id: String(row.package_name || row.id || ''),
    packageName: String(row.package_name || ''),
    diskSpace: mapLimitFromDb(row.disk_space),
    bandwidth: mapLimitFromDb(row.bandwidth),
    emailAccounts: mapLimitFromDb(row.email_accounts),
    dataBases: mapLimitFromDb(row.databases),
    ftpAccounts: mapLimitFromDb(row.ftp_accounts),
    allowedDomains: mapLimitFromDb(row.allowed_domains),
  };
}

/** Igual a mapPackage — exportado para carregar formulário a partir do espelho. */
export function mapPackageForForm(row: Record<string, unknown>): PanelPackage {
  return mapPackage(row);
}

export async function getMirrorLastSyncAt(): Promise<string | null> {
  const admin = getDaSyncAdmin();
  if (!admin) return null;
  const { data } = await admin
    .from('panel_sync_log')
    .select('finished_at')
    .eq('status', 'ok')
    .order('finished_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.finished_at || null;
}

let staleCache: { at: number; value: boolean } | null = null;
const STALE_CACHE_MS = 60_000;

export async function isMirrorStale(maxAgeMinutes = 20): Promise<boolean> {
  if (staleCache && Date.now() - staleCache.at < STALE_CACHE_MS) {
    return staleCache.value;
  }
  const value = await isMirrorStaleUncached(maxAgeMinutes);
  staleCache = { at: Date.now(), value };
  return value;
}

async function isMirrorStaleUncached(maxAgeMinutes = 20): Promise<boolean> {
  const admin = getDaSyncAdmin();
  if (!admin) return true;
  const { count } = await admin.from('panel_sites').select('id', { count: 'exact', head: true });
  if (!count) return true;
  const last = await getMirrorLastSyncAt();
  if (!last) return true;
  const ageMs = Date.now() - new Date(last).getTime();
  return ageMs > maxAgeMinutes * 60_000;
}

export async function getMirrorSiteOwner(domain: string): Promise<string | null> {
  const admin = getDaSyncAdmin();
  if (!admin || !domain) return null;
  const { data, error } = await admin
    .from('panel_sites')
    .select('owner')
    .eq('domain', domain)
    .maybeSingle();
  if (error || !data?.owner) return null;
  return String(data.owner);
}

export async function listMirrorWebsites(scope: MirrorScope): Promise<PanelWebsite[]> {
  const admin = getDaSyncAdmin();
  if (!admin) return [];
  const { isAdmin, daUsername } = await resolveScope(scope);

  if (!isAdmin && !daUsername) return [];

  let query = admin.from('panel_sites').select('*').order('domain');
  if (!isAdmin && daUsername) {
    query = query.eq('owner', daUsername);
  }
  const { data, error } = await query;
  if (error) {
    console.error('[panel-mirror] listWebsites:', error.message);
    return [];
  }
  return (data || []).map(mapSite);
}

export async function listMirrorUsers(scope: MirrorScope): Promise<PanelUser[]> {
  const admin = getDaSyncAdmin();
  if (!admin) return [];
  const { isAdmin, daUsername } = await resolveScope(scope);

  if (!isAdmin && !daUsername) return [];

  let query = admin.from('panel_users').select('*').order('username');
  if (!isAdmin && daUsername) {
    query = query.or(`username.eq.${daUsername},parent_username.eq.${daUsername}`);
  }
  const { data, error } = await query;
  if (error) return [];
  return (data || []).map(mapUser);
}

export async function listMirrorWebsitesForClientEmail(email: string): Promise<PanelWebsite[]> {
  const admin = getDaSyncAdmin();
  if (!admin || !email) return [];

  const normalized = email.toLowerCase().trim();
  const localPart = normalized.split('@')[0] || '';

  const { data, error } = await admin.from('panel_sites').select('*').order('domain');
  if (error) return [];

  return (data || [])
    .filter((row) => {
      const adminEmail = String(row.admin_email || '').toLowerCase();
      const owner = String(row.owner || '').toLowerCase();
      const domain = String(row.domain || '').toLowerCase();
      return (
        adminEmail === normalized ||
        owner === normalized ||
        (localPart.length > 2 && domain.includes(localPart))
      );
    })
    .map((row) => mapSite(row as Record<string, unknown>));
}

export async function listMirrorPackages(
  scope: MirrorScope,
  prefetchedSites?: PanelWebsite[],
): Promise<PanelPackage[]> {
  const admin = getDaSyncAdmin();
  if (!admin) return [];
  const { isAdmin, daUsername } = await resolveScope(scope);

  if (!isAdmin && !daUsername) return [];

  const { data, error } = await admin.from('panel_packages').select('*').order('package_name');
  if (error) return [];
  const all = (data || []).map(mapPackage);

  if (isAdmin) {
    const { mergeBrandHostingPackages } = await import('@/lib/panel-brand-packages');
    return mergeBrandHostingPackages(all);
  }

  const sites = prefetchedSites ?? (await listMirrorWebsites(scope));
  const usedNames = new Set(
    sites.map((s) => s.package).filter((name): name is string => Boolean(name)),
  );
  if (!usedNames.size) return [];
  return all.filter((pkg) => usedNames.has(pkg.packageName));
}

/** Formulário completo guardado no painel (limites, recursos, funcionalidades). */
export async function getMirrorPackageForm(
  packageName: string,
): Promise<import('@/lib/reseller-package-form').ResellerPackageFormState | null> {
  const { ensureDaSyncSchema } = await import('@/lib/da-sync-schema');
  await ensureDaSyncSchema();
  const admin = getDaSyncAdmin();
  if (!admin) return null;
  const name = packageName.trim();
  if (!name) return null;
  const { data, error } = await admin
    .from('panel_packages')
    .select('package_form_json')
    .eq('package_name', name)
    .maybeSingle();
  if (error || !data?.package_form_json || typeof data.package_form_json !== 'object') return null;
  const raw = data.package_form_json as import('@/lib/reseller-package-form').ResellerPackageFormState;
  return { ...raw, packageName: raw.packageName || name };
}

export async function listMirrorEmails(domain: string, scope: MirrorScope): Promise<PanelEmailAccount[]> {
  const admin = getDaSyncAdmin();
  if (!admin) return [];
  const { isAdmin, daUsername } = await resolveScope(scope);

  if (!isAdmin && daUsername) {
    const { data: site } = await admin
      .from('panel_sites')
      .select('domain')
      .eq('domain', domain)
      .eq('owner', daUsername)
      .maybeSingle();
    if (!site) return [];
  }

  const { data, error } = await admin.from('panel_emails').select('*').eq('domain', domain);
  if (error) return [];
  return (data || []).map((row) => ({
    id: `${row.email_user}@${domain}`,
    email: row.full_email || `${row.email_user}@${domain}`,
    domain,
    quota_mb: parseInt(String(row.quota || '500'), 10),
    usage: String(row.usage || '0'),
    status: 'active' as const,
  }));
}

async function assertDomainInScope(domain: string, scope: MirrorScope): Promise<boolean> {
  const admin = getDaSyncAdmin();
  if (!admin) return false;
  const { isAdmin, daUsername } = await resolveScope(scope);
  if (isAdmin) return true;
  if (!daUsername) return false;
  const { data: site } = await admin
    .from('panel_sites')
    .select('domain')
    .eq('domain', domain)
    .eq('owner', daUsername)
    .maybeSingle();
  return Boolean(site);
}

export async function listMirrorSubdomains(domain: string, scope: MirrorScope): Promise<PanelSubdomain[]> {
  const admin = getDaSyncAdmin();
  if (!admin || !(await assertDomainInScope(domain, scope))) return [];
  const { data, error } = await admin.from('panel_subdomains').select('*').eq('domain', domain);
  if (error) return [];
  return (data || []).map((row) => ({
    id: row.id,
    domain,
    subdomain: String(row.subdomain || ''),
    path: row.path ? String(row.path) : '',
  }));
}

export async function listMirrorDatabases(domain: string, scope: MirrorScope): Promise<PanelDatabase[]> {
  const admin = getDaSyncAdmin();
  if (!admin || !(await assertDomainInScope(domain, scope))) return [];
  const { data, error } = await admin.from('panel_databases').select('*').eq('domain', domain);
  if (error) return [];
  return (data || []).map((row) => ({
    id: row.id,
    domain,
    dbName: String(row.db_name || ''),
    dbUser: row.db_user ? String(row.db_user) : String(row.db_name || ''),
  }));
}

export async function listMirrorFtp(domain: string, scope: MirrorScope): Promise<PanelFTPAccount[]> {
  const admin = getDaSyncAdmin();
  if (!admin || !(await assertDomainInScope(domain, scope))) return [];
  const { data, error } = await admin.from('panel_ftp').select('*').eq('domain', domain);
  if (error) return [];
  return (data || []).map((row) => ({
    id: row.id,
    username: String(row.username || ''),
    userName: String(row.username || ''),
    domain,
    path: row.path ? String(row.path) : '/',
  }));
}

export async function listMirrorDns(domain: string, scope: MirrorScope) {
  const admin = getDaSyncAdmin();
  if (!admin) return [];
  if (!(await assertDomainInScope(domain, scope))) return [];
  const { data } = await admin.from('panel_dns').select('*').eq('domain', domain);
  return (data || []).map((row) => ({
    id: String(row.id),
    name: String(row.name || ''),
    type: String(row.type || 'A').toUpperCase(),
    content: String(row.value || ''),
    ttl: Number(row.ttl) || 3600,
  }));
}

export type PanelBootstrapAccount = {
  id: string;
  email: string;
  userName: string;
  daUsername?: string | null;
  panelRole: UserRole;
  panelPath: string;
  state: string;
  lastSignIn: string | null;
  nome: string | null;
};

export function buildPanelAccountCounts(users: PanelBootstrapAccount[]) {
  return {
    all: users.length,
    admin: users.filter((u) => u.panelRole === 'admin').length,
    manager: users.filter((u) => u.panelRole === 'manager').length,
    reseller: users.filter((u) => u.panelRole === 'reseller').length,
    client: users.filter((u) => u.panelRole === 'client').length,
    guest: users.filter((u) => u.panelRole === 'guest').length,
  };
}

export function filterPanelAccountsForCaller(
  users: PanelBootstrapAccount[],
  callerRole: 'admin' | 'reseller',
): PanelBootstrapAccount[] {
  if (callerRole === 'admin') return users;
  return users.filter((u) => u.panelRole === 'client');
}

function mapProfileToAccount(profile: ProfileRow): PanelBootstrapAccount | null {
  const email = (profile.email || '').toLowerCase().trim();
  if (!email) return null;

  const panelSite = resolveAccountPanelSite({ email });
  if (!belongsToCurrentPanel(panelSite)) return null;

  const authId = String(profile.user_id || profile.id || '').trim();
  if (!authId) return null;

  const panelRole = resolveUserRole({
    email,
    profileRole: profile.role ?? null,
    daUsername: profile.da_username ?? null,
    hasPaidProducts: false,
  });
  const displayName = profileName(profile, email.split('@')[0]);

  return {
    id: authId,
    email,
    userName: displayName,
    daUsername: profile.da_username ?? null,
    panelRole,
    panelPath: getRedirectPathForRole(panelRole),
    state: 'Active',
    lastSignIn: null,
    nome: displayName,
  };
}

function mapAuthAccountToBootstrap(row: PanelAuthAccountRow): PanelBootstrapAccount {
  const email = row.email.toLowerCase().trim();
  const displayName = row.name || email.split('@')[0];
  return {
    id: row.user_id,
    email,
    userName: displayName,
    daUsername: row.da_username,
    panelRole: row.role,
    panelPath: getRedirectPathForRole(row.role),
    state: 'Active',
    lastSignIn: null,
    nome: displayName,
  };
}

export async function listAllBootstrapPanelAccounts(
  adminClient?: SupabaseClient | null,
): Promise<PanelBootstrapAccount[]> {
  const admin = adminClient ?? getDaSyncAdmin();
  if (!admin) return [];

  const authAccounts = await listPanelAuthAccounts(admin, PANEL_SLUG);
  const authByUserId = new Map(authAccounts.map((row) => [row.user_id, row]));

  const { data, error } = await admin
    .from('profiles')
    .select('id, user_id, email, role, name, da_username');

  if (error) {
    console.error('[panel-mirror] bootstrap accounts:', error.message);
    if (authAccounts.length) {
      return authAccounts.map(mapAuthAccountToBootstrap).sort((a, b) => a.email.localeCompare(b.email));
    }
    return [];
  }

  const rows: PanelBootstrapAccount[] = [];
  const seen = new Set<string>();

  for (const row of data || []) {
    const profile = row as ProfileRow;
    const userId = String(profile.user_id || profile.id || '').trim();
    const authRow = userId ? authByUserId.get(userId) : undefined;

    if (authRow) {
      rows.push(mapAuthAccountToBootstrap(authRow));
      if (userId) seen.add(userId);
      authByUserId.delete(userId);
      continue;
    }

    const mapped = mapProfileToAccount(profile);
    if (mapped) {
      rows.push(mapped);
      seen.add(mapped.id);
    }
  }

  for (const authRow of authByUserId.values()) {
    if (!seen.has(authRow.user_id)) {
      rows.push(mapAuthAccountToBootstrap(authRow));
    }
  }

  return rows.sort((a, b) => a.email.localeCompare(b.email));
}

export async function listBootstrapPanelAccounts(
  callerRole: 'admin' | 'reseller',
  adminClient?: SupabaseClient | null,
): Promise<{ accounts: PanelBootstrapAccount[]; counts: ReturnType<typeof buildPanelAccountCounts> }> {
  const all = await listAllBootstrapPanelAccounts(adminClient);
  const accounts = filterPanelAccountsForCaller(all, callerRole);
  return { accounts, counts: buildPanelAccountCounts(accounts) };
}
