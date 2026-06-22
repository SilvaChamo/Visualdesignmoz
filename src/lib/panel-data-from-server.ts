/**
 * Carrega sites / utilizadores / pacotes do espelho Supabase via `/api/panel/bootstrap`
 * (uma única chamada).
 */

import type { DirectAdminWebsite, DirectAdminUser, DirectAdminPackage } from '@/lib/directadmin-api';
import type { PanelBootstrapAccount } from '@/lib/panel-mirror-read';
import type { UserProductsSummary } from '@/lib/user-products';
import type { PanelCapabilities, ResellerTier } from '@/lib/panel-role-capabilities';
import { parseJsonResponse } from '@/lib/safe-fetch-json';

const BOOTSTRAP_CACHE_KEY = 'vd_panel_bootstrap_v2';
const BOOTSTRAP_CACHE_MS = 180_000;

export type PanelBootstrapScope = 'admin' | 'reseller' | 'client';

function bootstrapStorageKey(scope?: PanelBootstrapScope): string {
  return scope ? `${BOOTSTRAP_CACHE_KEY}_${scope}` : BOOTSTRAP_CACHE_KEY;
}

export type PanelBootstrapResellerContext = {
  daUsername: string;
  email: string;
  displayName: string;
  primaryDomain: string | null;
  impersonating: boolean;
  resellerTier?: ResellerTier | null;
};

export type PanelBootstrapSession = {
  role: string;
  readOnly: boolean;
  capabilities?: PanelCapabilities;
  resellerTier?: ResellerTier | null;
};

export type PanelBootstrapData = {
  sites: DirectAdminWebsite[];
  users: DirectAdminUser[];
  packages: DirectAdminPackage[];
  accounts: PanelBootstrapAccount[];
  accountCounts: Record<string, number>;
  resellerContext: PanelBootstrapResellerContext | null;
  products?: UserProductsSummary | null;
  session?: PanelBootstrapSession | null;
  meta?: { source?: string; lastSyncedAt?: string | null };
};

export function readBootstrapCache(scope?: PanelBootstrapScope): PanelBootstrapData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(bootstrapStorageKey(scope));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; data: PanelBootstrapData };
    if (Date.now() - parsed.at > BOOTSTRAP_CACHE_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeBootstrapCache(data: PanelBootstrapData, scope?: PanelBootstrapScope) {
  if (typeof window === 'undefined') return;
  if (
    scope === 'admin' &&
    data.sites.length === 0 &&
    data.packages.length === 0 &&
    data.users.length === 0
  ) {
    return;
  }
  try {
    sessionStorage.setItem(bootstrapStorageKey(scope), JSON.stringify({ at: Date.now(), data }));
  } catch {
    /* quota / private mode */
  }
}

export function clearPanelBootstrapCache(scope?: PanelBootstrapScope) {
  if (typeof window === 'undefined') return;
  try {
    const legacyKey = (s?: PanelBootstrapScope) =>
      s ? `vd_panel_bootstrap_v1_${s}` : 'vd_panel_bootstrap_v1';
    if (scope) {
      sessionStorage.removeItem(bootstrapStorageKey(scope));
      sessionStorage.removeItem(legacyKey(scope));
      return;
    }
    for (const s of ['admin', 'reseller', 'client'] as const) {
      sessionStorage.removeItem(bootstrapStorageKey(s));
      sessionStorage.removeItem(legacyKey(s));
    }
    sessionStorage.removeItem(BOOTSTRAP_CACHE_KEY);
    sessionStorage.removeItem(legacyKey());
  } catch {
    /* ignore */
  }
}

export async function fetchPanelBootstrap(options?: {
  fresh?: boolean;
  scope?: PanelBootstrapScope;
}): Promise<PanelBootstrapData> {
  const scope = options?.scope;
  if (!options?.fresh) {
    const cached = readBootstrapCache(scope);
    if (cached) return cached;
  }

  const res = await fetch('/api/panel/bootstrap');
  const json = await parseJsonResponse<{
    success?: boolean;
    error?: string;
    sites?: DirectAdminWebsite[];
    users?: DirectAdminUser[];
    packages?: DirectAdminPackage[];
    accounts?: PanelBootstrapAccount[];
    accountCounts?: Record<string, number>;
    resellerContext?: PanelBootstrapResellerContext | null;
    products?: UserProductsSummary | null;
    session?: PanelBootstrapSession | null;
    meta?: { source?: string; lastSyncedAt?: string | null };
  }>(res);
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Falha ao carregar dados do painel');
  }

  const data: PanelBootstrapData = {
    sites: Array.isArray(json.sites) ? json.sites : [],
    users: Array.isArray(json.users) ? json.users : [],
    packages: Array.isArray(json.packages) ? json.packages : [],
    accounts: Array.isArray(json.accounts) ? json.accounts : [],
    accountCounts:
      json.accountCounts && typeof json.accountCounts === 'object'
        ? json.accountCounts
        : {},
    resellerContext: json.resellerContext || null,
    products: json.products ?? null,
    session: json.session ?? null,
    meta: json.meta,
  };

  writeBootstrapCache(data, scope);
  try {
    if (scope === 'admin' && data.accounts.length) {
      const { writePanelUsersCache } = await import('@/lib/panel-users-cache');
      writePanelUsersCache({ users: data.accounts, counts: data.accountCounts });
    }
  } catch {
    /* ignore */
  }
  return data;
}

/** Cache instantâneo + actualização em background (sem bloquear UI). */
export async function fetchPanelBootstrapStaleWhileRevalidate(
  onUpdate: (data: PanelBootstrapData) => void,
  scope?: PanelBootstrapScope,
): Promise<PanelBootstrapData | null> {
  const cached = readBootstrapCache(scope);
  if (cached) {
    onUpdate(cached);
    void fetchPanelBootstrap({ fresh: true, scope })
      .then(onUpdate)
      .catch(() => {});
    return cached;
  }
  try {
    const fresh = await fetchPanelBootstrap({ fresh: true, scope });
    onUpdate(fresh);
    return fresh;
  } catch {
    return null;
  }
}

function unwrapArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>;
    if (Array.isArray(o.sites)) return o.sites;
    if (Array.isArray(o.users)) return o.users;
    if (Array.isArray(o.packages)) return o.packages;
  }
  return [];
}

function mapSiteType(raw: unknown): DirectAdminWebsite['siteType'] {
  const t = typeof raw === 'string' ? raw : 'empty';
  if (t === 'wordpress' || t === 'nextjs' || t === 'html' || t === 'empty') return t;
  return 'empty';
}

function mapServerSite(row: Record<string, unknown>): DirectAdminWebsite {
  const domain = String(row.domain || '');
  const siteType = mapSiteType(row.site_type ?? row.siteType);
  return {
    id: domain || (row.id != null ? String(row.id) : ''),
    domain,
    adminEmail: row.adminEmail != null ? String(row.adminEmail) : undefined,
    package: row.package != null ? String(row.package) : undefined,
    state: row.state as DirectAdminWebsite['state'],
    owner: row.owner != null ? String(row.owner) : undefined,
    diskUsage: row.diskUsage as DirectAdminWebsite['diskUsage'],
    bandwidth: row.bandwidth as DirectAdminWebsite['bandwidth'],
    ssl: row.sslStatus === 'Secure' || row.ssl === true,
    sslStatus: row.sslStatus != null ? String(row.sslStatus) : undefined,
    phpVersion: row.phpVersion != null ? String(row.phpVersion) : undefined,
    ip: row.ip != null ? String(row.ip) : undefined,
    hasWordPress: siteType === 'wordpress',
    hasNextJs: siteType === 'nextjs',
    hasBasicSite: siteType === 'html',
    siteType,
  };
}

function mapServerUser(row: Record<string, unknown>): DirectAdminUser {
  const id = row.id != null ? Number(row.id) || 0 : 0;
  const userName = String(row.userName || '');
  const stateStr = row.state != null ? String(row.state) : '';
  return {
    id,
    userName,
    email: row.email != null ? String(row.email) : undefined,
    type: row.type != null ? String(row.type) : undefined,
    suspended:
      stateStr === 'SUSPENDED' ||
      stateStr === '0' ||
      row.suspended === true,
    existsOnServer: true,
    firstName: row.firstName != null ? String(row.firstName) : undefined,
    lastName: row.lastName != null ? String(row.lastName) : undefined,
    acl: row.type != null ? String(row.type) : row.acl != null ? String(row.acl) : undefined,
    websitesLimit: typeof row.websitesLimit === 'number' ? row.websitesLimit : undefined,
    emailsLimit: typeof row.emailsLimit === 'number' ? row.emailsLimit : undefined,
    status: stateStr || undefined,
  };
}

function mapServerPackage(row: Record<string, unknown>): DirectAdminPackage {
  return {
    id: row.id != null ? Number(row.id) || 0 : 0,
    packageName: String(row.packageName || ''),
    diskSpace: typeof row.diskSpace === 'number' ? row.diskSpace : Number(row.diskSpace) || 0,
    bandwidth: typeof row.bandwidth === 'number' ? row.bandwidth : Number(row.bandwidth) || 0,
    emailAccounts:
      typeof row.emailAccounts === 'number' ? row.emailAccounts : Number(row.emailAccounts) || 0,
    dataBases: typeof row.dataBases === 'number' ? row.dataBases : Number(row.dataBases) || 0,
  };
}

async function postServerExec(action: string, params: Record<string, unknown> = {}) {
  const res = await fetch('/api/server-exec', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, params }),
  });
  return res.json() as Promise<{ success?: boolean; data?: unknown; error?: string }>;
}

export async function fetchPanelSitesFromServer(): Promise<DirectAdminWebsite[]> {
  const { sites } = await fetchPanelSitesFromServerWithError();
  return sites;
}

export async function fetchPanelSitesFromServerWithError(): Promise<{
  sites: DirectAdminWebsite[];
  error?: string;
}> {
  try {
    const { sites } = await fetchPanelBootstrap({ fresh: true });
    return { sites };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro ao carregar sites do painel';
    return { sites: [], error: message };
  }
}

/** @deprecated Preferir fetchPanelBootstrap */
export async function fetchPanelUsersFromServer(): Promise<DirectAdminUser[]> {
  try {
    const { users } = await fetchPanelBootstrap({ fresh: true });
    return users;
  } catch {
    return [];
  }
}

/** @deprecated Preferir fetchPanelBootstrap */
export async function fetchPanelPackagesFromServer(): Promise<DirectAdminPackage[]> {
  try {
    const { packages } = await fetchPanelBootstrap({ fresh: true });
    return packages;
  } catch {
    return [];
  }
}
