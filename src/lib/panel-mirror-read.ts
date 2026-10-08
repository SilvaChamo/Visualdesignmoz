/**
 * Leitura do espelho Supabase (panel_*) — reflecte estado do DirectAdmin.
 *
 * Contabo (DEFAULT_HOSTING_PROVIDER=hestia): NÃO há espelho. Cada função
 * abaixo lê directamente do Hestia (hosting-resolver) e só usa a base de
 * dados para o registo do painel (que login/revenda é dono de que conta).
 * O espelho só existe para o DirectAdmin no Hetzner, cuja API é lenta.
 */

import { getDaSyncAdmin } from '@/lib/da-sync-schema';
import { loadResellerCredentialsByUserId } from '@/lib/da-credential-store';
import { getProfileForAuthUser, profileName, type ProfileRow } from '@/lib/profile-db';
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
  /** Contas de domínio ligadas que este âmbito também gere directamente
   * (Enterprise — ver linked-accounts.ts). Nunca inclui contas trancadas. */
  linkedOwners?: string[];
};

const IS_HESTIA =
  (process.env.DEFAULT_HOSTING_PROVIDER || '').trim().toLowerCase() === 'hestia';

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
    // O username do dono não pode depender de haver password DA guardada e
    // legível — uma conta já migrada para o Hestia não tem isso (de
    // propósito) mas continua a ser dona dos seus próprios dados no espelho.
    // Sem este fallback directo ao perfil, um revendedor no Hestia via aqui
    // o próprio painel completamente vazio (nenhum site/email/etc.).
    const creds = await loadResellerCredentialsByUserId(scope.userId);
    let daUsername = creds?.user;
    if (!daUsername) {
      const sb = getDaSyncAdmin();
      const profile = sb ? await getProfileForAuthUser(sb, scope.userId) : null;
      daUsername = profile?.da_username || undefined;
      if (!daUsername && sb) {
        const { data: panelUser } = await sb
          .from('panel_users')
          .select('username')
          .eq('auth_user_id', scope.userId)
          .maybeSingle();
        daUsername = panelUser?.username || undefined;
      }
    }
    resolved = daUsername ? { isAdmin: false, daUsername } : { isAdmin: false };
  } else {
    resolved = { isAdmin: false };
  }

  scopeCache.set(cacheKey, { ...resolved, at: Date.now() });
  return resolved;
}

/** Contas que um âmbito não-admin gere: a própria + ligadas (Enterprise). */
function scopeOwners(daUsername: string, linkedOwners?: string[]): Set<string> {
  return new Set([daUsername, ...(linkedOwners || [])].map((o) => o.trim().toLowerCase()).filter(Boolean));
}

/** Contabo: dono real do domínio no Hestia, se o âmbito o puder ver; null
 * quando o domínio não existe ou é de outra conta. */
async function hestiaOwnerInScope(domain: string, scope: MirrorScope): Promise<string | null> {
  const { getHestiaDomainOwner } = await import('@/lib/hosting-resolver');
  const owner = await getHestiaDomainOwner(domain);
  if (!owner) return null;
  const { isAdmin, daUsername } = await resolveScope(scope);
  if (isAdmin) return owner;
  if (!daUsername) return null;
  return scopeOwners(daUsername, scope.linkedOwners).has(owner.toLowerCase()) ? owner : null;
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
    hostingProvider: row.hosting_provider ? String(row.hosting_provider) : undefined,
  };
}

function mapLimitFromDb(value: unknown): number | string {
  const n = Number(value);
  if (n === -1) return '-';
  return Number.isFinite(n) ? n : 0;
}

function mapPackage(row: Record<string, unknown>): PanelPackage {
  const pkg: PanelPackage = {
    id: String(row.package_name || row.id || ''),
    packageName: String(row.package_name || ''),
    diskSpace: mapLimitFromDb(row.disk_space),
    bandwidth: mapLimitFromDb(row.bandwidth),
    emailAccounts: mapLimitFromDb(row.email_accounts),
    dataBases: mapLimitFromDb(row.databases),
    ftpAccounts: mapLimitFromDb(row.ftp_accounts),
    allowedDomains: mapLimitFromDb(row.allowed_domains),
  };

  const form = row.package_form_json as
    | { limits?: Record<string, { value?: string; unlimited?: boolean }> }
    | null
    | undefined;

  if (form?.limits) {
    const fromForm = (key: string, fallback: number | string | undefined) => {
      const rowLimit = form.limits?.[key];
      if (!rowLimit) return fallback ?? 0;
      if (rowLimit.unlimited) return '-';
      const n = Number(String(rowLimit.value || '').replace(/[^\d.]/g, ''));
      return Number.isFinite(n) && n > 0 ? n : (fallback ?? 0);
    };
    if (!Number(pkg.diskSpace)) pkg.diskSpace = fromForm('quota', pkg.diskSpace);
    if (!Number(pkg.bandwidth)) pkg.bandwidth = fromForm('bandwidth', pkg.bandwidth);
    if (!Number(pkg.emailAccounts)) pkg.emailAccounts = fromForm('nemails', pkg.emailAccounts);
    if (!Number(pkg.dataBases)) pkg.dataBases = fromForm('mysql', pkg.dataBases);
    if (!Number(pkg.ftpAccounts)) pkg.ftpAccounts = fromForm('ftp', pkg.ftpAccounts);
    if (!Number(pkg.allowedDomains)) pkg.allowedDomains = fromForm('vdomains', pkg.allowedDomains);
  }

  return pkg;
}

/** Igual a mapPackage — exportado para carregar formulário a partir do espelho. */
export function mapPackageForForm(row: Record<string, unknown>): PanelPackage {
  return mapPackage(row);
}

export async function getMirrorLastSyncAt(): Promise<string | null> {
  // Leitura directa: os dados são sempre os de agora.
  if (IS_HESTIA) return new Date().toISOString();
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

export async function isMirrorStale(maxAgeMinutes = 120): Promise<boolean> {
  // Sem espelho no Contabo — nunca está "desactualizado" nem pede sync.
  if (IS_HESTIA) return false;
  if (staleCache && Date.now() - staleCache.at < STALE_CACHE_MS) {
    return staleCache.value;
  }
  const value = await isMirrorStaleUncached(maxAgeMinutes);
  staleCache = { at: Date.now(), value };
  return value;
}

async function isMirrorStaleUncached(maxAgeMinutes = 120): Promise<boolean> {
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
  if (IS_HESTIA) {
    const { getHestiaDomainOwner } = await import('@/lib/hosting-resolver');
    return getHestiaDomainOwner(domain);
  }
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
  if (IS_HESTIA) {
    const { isAdmin, daUsername } = await resolveScope(scope);
    if (!isAdmin && !daUsername) return [];
    const { listHestiaLiveSites } = await import('@/lib/hosting-resolver');
    return listHestiaLiveSites(isAdmin ? null : scopeOwners(daUsername!, scope.linkedOwners));
  }
  const admin = getDaSyncAdmin();
  if (!admin) return [];
  const { isAdmin, daUsername } = await resolveScope(scope);

  if (!isAdmin && !daUsername) return [];

  let query = admin.from('panel_sites').select('*').order('domain');
  if (!isAdmin && daUsername) {
    const owners = [daUsername, ...(scope.linkedOwners || [])];
    query = owners.length > 1 ? query.in('owner', owners) : query.eq('owner', daUsername);
  }
  const { data, error } = await query;
  if (error) {
    console.error('[panel-mirror] listWebsites:', error.message);
    return [];
  }
  return (data || []).map(mapSite);
}

export async function listMirrorUsers(scope: MirrorScope): Promise<PanelUser[]> {
  if (IS_HESTIA) {
    const { isAdmin, daUsername } = await resolveScope(scope);
    if (!isAdmin && !daUsername) return [];
    const { listHestiaLiveUsers } = await import('@/lib/hosting-resolver');
    const users = await listHestiaLiveUsers();
    if (isAdmin) return users.sort((a, b) => a.userName.localeCompare(b.userName));
    const main = daUsername!.toLowerCase();
    return users
      .filter((u) => u.userName.toLowerCase() === main || (u.parentUsername || '').toLowerCase() === main)
      .sort((a, b) => a.userName.localeCompare(b.userName));
  }
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
  const { data: profile } = await admin
    .from('profiles')
    .select('user_id, id')
    .ilike('email', normalized)
    .maybeSingle();
  const userId = String(profile?.user_id || profile?.id || '').trim();
  if (userId) return listMirrorWebsitesForClientUser(userId, normalized);
  // Sem perfil no painel não há dono confirmado — no Contabo não se adivinha
  // pelo nome do domínio (era o que o espelho fazia aqui em baixo).
  if (IS_HESTIA) return [];

  const { data, error } = await admin.from('panel_sites').select('*').order('domain');
  if (error) return [];

  const localPart = normalized.split('@')[0] || '';
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

/** Sites do cliente — ligação forte auth_user_id → panel_users → panel_sites.owner */
export async function listMirrorWebsitesForClientUser(
  userId: string,
  email?: string | null,
): Promise<PanelWebsite[]> {
  const admin = getDaSyncAdmin();
  if (!admin || !userId) return [];

  const { data: panelUser } = await admin
    .from('panel_users')
    .select('username, email')
    .eq('auth_user_id', userId)
    .maybeSingle();

  const username = String(panelUser?.username || '').trim().toLowerCase();
  const normalizedEmail = String(email || panelUser?.email || '').toLowerCase().trim();

  if (IS_HESTIA) {
    // Mesma ligação que o espelho usava (conta do login, ou conta Hestia com
    // o email do cliente), mas os domínios vêm directo do servidor — incluindo
    // os domínios só de email dos planos de email.
    const owners = new Set<string>();
    if (username) owners.add(username);
    if (!username) {
      const profile = await getProfileForAuthUser(admin, userId);
      const fromProfile = String(profile?.da_username || '').trim().toLowerCase();
      if (fromProfile) owners.add(fromProfile);
    }
    const { listHestiaLiveUsers, listHestiaLiveSites } = await import('@/lib/hosting-resolver');
    if (normalizedEmail) {
      for (const u of await listHestiaLiveUsers()) {
        if ((u.email || '').toLowerCase() === normalizedEmail) owners.add(u.userName.toLowerCase());
      }
    }
    if (!owners.size) return [];
    return listHestiaLiveSites(owners);
  }

  const { data, error } = await admin.from('panel_sites').select('*').order('domain');
  if (error) return [];

  return (data || [])
    .filter((row) => {
      const owner = String(row.owner || '').toLowerCase();
      const adminEmail = String(row.admin_email || '').toLowerCase();
      if (username && owner === username) return true;
      if (normalizedEmail && adminEmail === normalizedEmail) return true;
      return false;
    })
    .map((row) => mapSite(row as Record<string, unknown>));
}

export async function listMirrorPackages(
  scope: MirrorScope,
  prefetchedSites?: PanelWebsite[],
): Promise<PanelPackage[]> {
  const admin = getDaSyncAdmin();
  if (!admin && !IS_HESTIA) return [];
  const { isAdmin, daUsername } = await resolveScope(scope);

  if (!isAdmin && !daUsername) return [];

  let all: PanelPackage[];
  if (IS_HESTIA) {
    const { listHestiaLivePackages } = await import('@/lib/hosting-resolver');
    all = await listHestiaLivePackages();
  } else {
    const { data, error } = await admin!.from('panel_packages').select('*').order('package_name');
    if (error) return [];
    all = (data || []).map(mapPackage);
  }

  if (isAdmin) {
    try {
      const { mergeBrandHostingPackages } = await import('@/lib/panel-brand-packages');
      return await mergeBrandHostingPackages(all);
    } catch (e) {
      console.error('[panel-mirror] mergeBrandHostingPackages:', e);
      return all;
    }
  }

  // `panel_packages` não tem coluna de dono — restringir aos pacotes já
  // atribuídos a algum site do próprio revendedor, para não expor os
  // pacotes de outros revendedores (que não teriam nome "reseller"/"revenda").
  const sites = prefetchedSites ?? (await listMirrorWebsites(scope));
  const ownPackageNames = new Set(
    sites
      .filter((s) => (s.owner || '').toLowerCase() === (daUsername || '').toLowerCase())
      .map((s) => s.package)
      .filter(Boolean),
  );
  return all.filter((pkg) => ownPackageNames.has(pkg.packageName));
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
  const { normalizePackageFormForEditor } = await import('@/lib/reseller-package-form');
  return normalizePackageFormForEditor({ ...raw, packageName: raw.packageName || name }, name);
}

export async function listMirrorEmails(domain: string, scope: MirrorScope): Promise<PanelEmailAccount[]> {
  if (IS_HESTIA) {
    const owner = await hestiaOwnerInScope(domain, scope);
    if (!owner) return [];
    const { listMailAccounts } = await import('@/lib/hestia-adapter');
    return (await listMailAccounts(owner, domain)).map((a) => ({
      id: `${a.account}@${domain}`,
      email: `${a.account}@${domain}`,
      domain,
      quota_mb: a.quotaMb ?? undefined,
      usage: String(a.diskUsedMb),
      status: 'active' as const,
    }));
  }
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
  if (IS_HESTIA) {
    const owner = await hestiaOwnerInScope(domain, scope);
    if (!owner) return [];
    const { listHostingSubdomains } = await import('@/lib/hosting-resolver');
    return (await listHostingSubdomains(domain)).map((row) => ({
      id: `${row.subdomain}.${domain}`,
      domain,
      subdomain: row.subdomain,
      path: `/home/${owner}/web/${row.subdomain}.${domain}/public_html`,
    }));
  }
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
  if (IS_HESTIA) {
    // No Hestia as bases de dados são da conta, não do domínio.
    const owner = await hestiaOwnerInScope(domain, scope);
    if (!owner) return [];
    const { listDatabases } = await import('@/lib/hestia-adapter');
    return (await listDatabases(owner)).map((db) => ({
      id: db.database,
      domain,
      dbName: db.database,
      dbUser: db.dbUser || db.database,
    }));
  }
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
  if (IS_HESTIA) {
    const owner = await hestiaOwnerInScope(domain, scope);
    if (!owner) return [];
    const { listFtpAccounts } = await import('@/lib/hestia-adapter');
    return (await listFtpAccounts(owner, domain)).map((f) => ({
      id: f.ftpUser,
      username: f.ftpUser,
      userName: f.ftpUser,
      domain,
      path: f.path || '/',
    }));
  }
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
  if (IS_HESTIA) {
    const owner = await hestiaOwnerInScope(domain, scope);
    if (!owner) return [];
    const { listDnsRecords } = await import('@/lib/hestia-adapter');
    return (await listDnsRecords(owner, domain)).map((r) => ({
      id: r.id,
      name: r.record === '@' ? domain : r.record,
      type: r.type,
      content: r.value,
      ttl: r.ttl,
    }));
  }
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
  serverLinked?: boolean;
  panelRole: UserRole;
  panelPath: string;
  state: string;
  lastSignIn: string | null;
  nome: string | null;
  /** #17: sem utilizador correspondente em auth.users — linha órfã, não editável/promovível. */
  orphaned?: boolean;
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

function mapProfileToAccount(
  profile: ProfileRow,
  extra: { userMetadata?: Record<string, unknown> | null; hasPaidProducts: boolean; orphaned?: boolean },
): PanelBootstrapAccount | null {
  const email = (profile.email || '').toLowerCase().trim();
  if (!email) return null;

  const panelSite = resolveAccountPanelSite({ email });
  if (!belongsToCurrentPanel(panelSite)) return null;

  const authId = String(profile.user_id || profile.id || '').trim();
  if (!authId) return null;

  // #15: considera também o papel gravado no Auth (user_metadata), não só o
  // do perfil — a activação da compra escreve o papel nos dois sítios, e se
  // a escrita no perfil falhar/desalinhar, a listagem ficava só com o valor
  // desactualizado do perfil. Regra de desempate: a mesma cascata de
  // prioridade que resolveUserRole já usa entre profileRole/metaRole (ou
  // seja, ganha o papel mais elevado dos dois, nunca o mais baixo).
  const panelRole = resolveUserRole({
    email,
    profileRole: profile.role ?? null,
    userMetadata: extra.userMetadata ?? null,
    daUsername: profile.da_username ?? null,
    hasPaidProducts: extra.hasPaidProducts,
  });
  const displayName = profileName(profile, email.split('@')[0]);

  return {
    id: authId,
    email,
    userName: displayName,
    daUsername: profile.da_username ?? null,
    serverLinked: Boolean(profile.da_username),
    panelRole,
    panelPath: getRedirectPathForRole(panelRole),
    state: extra.orphaned ? 'Orphaned' : 'Active',
    orphaned: extra.orphaned,
    lastSignIn: null,
    nome: displayName,
  };
}

function mapAuthAccountToBootstrap(row: PanelAuthAccountRow, orphaned = false): PanelBootstrapAccount {
  const email = row.email.toLowerCase().trim();
  const displayName = row.name || email.split('@')[0];
  return {
    id: row.user_id,
    email,
    userName: displayName,
    daUsername: row.da_username,
    serverLinked: row.server_linked === true || Boolean(row.da_username),
    panelRole: row.role,
    panelPath: getRedirectPathForRole(row.role),
    state: orphaned ? 'Orphaned' : 'Active',
    lastSignIn: null,
    nome: displayName,
    orphaned,
  };
}

/** #15: quem tem pelo menos uma compra confirmada (pagamento, domínio, hospedagem ou site) — reaproveitado pela listagem de contas e pela sincronização automática de papéis. */
export async function loadPaidUserIds(admin: SupabaseClient, userIds: string[]): Promise<Set<string>> {
  const paid = new Set<string>();
  if (!userIds.length) return paid;

  const chunkSize = 200;
  for (let i = 0; i < userIds.length; i += chunkSize) {
    const chunk = userIds.slice(i, i + chunkSize);
    const [pagamentos, domains, hosting, sites] = await Promise.all([
      admin.from('pagamentos').select('user_id').in('user_id', chunk).in('status', ['paid', 'completed']),
      admin.from('domain_renewals').select('user_id').in('user_id', chunk),
      admin.from('hosting_renewals').select('user_id').in('user_id', chunk),
      admin.from('site_clientes').select('cliente_id').in('cliente_id', chunk),
    ]);

    for (const row of (pagamentos.data ?? []) as Array<{ user_id?: string }>) {
      if (row.user_id) paid.add(row.user_id);
    }
    for (const row of (domains.data ?? []) as Array<{ user_id?: string }>) {
      if (row.user_id) paid.add(row.user_id);
    }
    for (const row of (hosting.data ?? []) as Array<{ user_id?: string }>) {
      if (row.user_id) paid.add(row.user_id);
    }
    for (const row of (sites.data ?? []) as Array<{ cliente_id?: string }>) {
      if (row.cliente_id) paid.add(row.cliente_id);
    }
  }

  return paid;
}

/** #15: papel gravado no Auth (user_metadata) por utilizador — para detectar quando diverge do perfil. */
async function loadAuthMetaRoleById(admin: SupabaseClient): Promise<Map<string, Record<string, unknown>>> {
  const map = new Map<string, Record<string, unknown>>();
  let page = 1;
  while (page <= 50) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error || !data?.users?.length) break;
    for (const user of data.users) {
      map.set(user.id, (user.user_metadata as Record<string, unknown>) || {});
    }
    if (data.users.length < 1000) break;
    page += 1;
  }
  return map;
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
      return authAccounts.map((row) => mapAuthAccountToBootstrap(row)).sort((a, b) => a.email.localeCompare(b.email));
    }
    return [];
  }

  const profileRows = (data || []) as ProfileRow[];
  const userIds = profileRows
    .map((p) => String(p.user_id || p.id || '').trim())
    .filter(Boolean);
  const [paidIds, authMetaById] = await Promise.all([
    loadPaidUserIds(admin, userIds),
    loadAuthMetaRoleById(admin),
  ]);

  const rows: PanelBootstrapAccount[] = [];
  const seen = new Set<string>();

  for (const profile of profileRows) {
    const userId = String(profile.user_id || profile.id || '').trim();
    const authRow = userId ? authByUserId.get(userId) : undefined;

    // #15: panel_auth_accounts é um espelho que a activação da compra só
    // escreve quando há hospedagem — uma compra só de domínio nunca o toca.
    // Uma linha antiga aqui pode por isso ficar com um papel desactualizado
    // indefinidamente. Só usamos esta linha se ela concordar, ou disser um
    // papel mais elevado do que o que o perfil/Auth diriam — nunca para
    // *rebaixar* uma conta que o perfil/Auth já dizem ter sido promovida.
    const profileBasedRole = mapProfileToAccount(profile, {
      userMetadata: userId ? authMetaById.get(userId) : null,
      hasPaidProducts: userId ? paidIds.has(userId) : false,
      orphaned: Boolean(userId) && !authMetaById.has(userId),
    });

    if (authRow) {
      const ROLE_RANK: Record<UserRole, number> = { guest: 0, client: 1, profissional: 2, reseller: 3, manager: 4, admin: 5 };
      const useProfileRole =
        profileBasedRole && ROLE_RANK[profileBasedRole.panelRole] > ROLE_RANK[authRow.role];
      const orphaned = Boolean(userId) && !authMetaById.has(userId);
      rows.push(useProfileRole ? profileBasedRole! : mapAuthAccountToBootstrap(authRow, orphaned));
      if (userId) seen.add(userId);
      authByUserId.delete(userId);
      continue;
    }

    if (profileBasedRole) {
      rows.push(profileBasedRole);
      seen.add(profileBasedRole.id);
    }
  }

  for (const authRow of authByUserId.values()) {
    if (!seen.has(authRow.user_id)) {
      rows.push(mapAuthAccountToBootstrap(authRow, !authMetaById.has(authRow.user_id)));
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
