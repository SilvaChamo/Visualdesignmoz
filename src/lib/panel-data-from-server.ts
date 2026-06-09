/**
 * Carrega sites / utilizadores / pacotes a partir de `/api/server-exec`
 * — a mesma fonte usada pelas secções do painel (MySQL no host via SSH).
 * Não altera o DirectAdmin no servidor; apenas consome a API interna.
 */

import type { DirectAdminWebsite, DirectAdminUser, DirectAdminPackage } from '@/lib/directadmin-api';

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
  try {
    const json = await postServerExec('listWebsites', {});
    if (!json.success) return [];
    return unwrapArray(json.data)
      .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
      .filter((r) => typeof r.domain === 'string' && r.domain.length > 0)
      .map(mapServerSite);
  } catch {
    return [];
  }
}

export async function fetchPanelUsersFromServer(): Promise<DirectAdminUser[]> {
  try {
    const json = await postServerExec('listUsers', {});
    if (!json.success) return [];
    return unwrapArray(json.data)
      .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
      .filter((r) => typeof r.userName === 'string')
      .map(mapServerUser);
  } catch {
    return [];
  }
}

export async function fetchPanelPackagesFromServer(): Promise<DirectAdminPackage[]> {
  try {
    const json = await postServerExec('listPackages', {});
    if (!json.success) return [];
    return unwrapArray(json.data)
      .filter((r): r is Record<string, unknown> => !!r && typeof r === 'object')
      .filter((r) => typeof r.packageName === 'string')
      .map(mapServerPackage);
  } catch {
    return [];
  }
}
