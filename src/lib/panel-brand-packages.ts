import { daRequest } from '@/lib/directadmin';
import { loadResellerCredentialsByDaUsername } from '@/lib/da-credential-store';
import type { PanelPackage } from '@/lib/directadmin-hosting-api';

/** Contas de revenda com pacote de hospedagem próprio. */
export const BRAND_HOSTING_DA_USERS = ['oshercollective'] as const;

function field(data: Record<string, string>, key: string): string {
  return String(data[key] ?? '').trim();
}

function hasPackageFields(data: Record<string, string>): boolean {
  return Boolean(
    field(data, 'quota') ||
      field(data, 'bandwidth') ||
      field(data, 'packagename') ||
      field(data, 'nemails') ||
      field(data, 'mysql'),
  );
}

function normalizeDaFields(data: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v != null && String(v).trim()) out[k] = String(v);
  }
  return out;
}

function parseLimitNumber(value: string): number {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw || raw === 'unlimited' || raw === '-1') return 0;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : 0;
}

function packageRowFromFields(name: string, raw: Record<string, string>): PanelPackage {
  return {
    id: name,
    packageName: name,
    diskSpace: parseLimitNumber(raw.quota),
    bandwidth: parseLimitNumber(raw.bandwidth),
    emailAccounts: parseLimitNumber(raw.nemails),
    dataBases: parseLimitNumber(raw.mysql),
    ftpAccounts: parseLimitNumber(raw.ftp),
    allowedDomains: parseLimitNumber(raw.vdomains),
  };
}

async function readManagePackageFields(
  cmd: 'CMD_API_MANAGE_USER_PACKAGES' | 'CMD_API_MANAGE_RESELLER_PACKAGES',
  packageName: string,
  creds: 'admin' | { role: 'reseller'; user: string; password: string },
): Promise<Record<string, string> | null> {
  const res = await daRequest(cmd, 'GET', { package: packageName, json: 'yes' }, creds);
  if (res.error || !res.data || typeof res.data !== 'object') return null;
  const data = normalizeDaFields(res.data as Record<string, unknown>);
  return hasPackageFields(data) ? data : null;
}

/** Detalhes actuais de um pacote de marca / revenda (leitura live do servidor). */
export async function fetchBrandPackageDetailsByName(
  packageName: string,
): Promise<Record<string, string> | null> {
  const name = packageName.trim();
  if (!name) return null;

  for (const cmd of ['CMD_API_MANAGE_USER_PACKAGES', 'CMD_API_MANAGE_RESELLER_PACKAGES'] as const) {
    const data = await readManagePackageFields(cmd, name, 'admin').catch(() => null);
    if (data) return data;
  }

  for (const username of BRAND_HOSTING_DA_USERS) {
    const stored = await loadResellerCredentialsByDaUsername(username);
    if (!stored) continue;
    for (const cmd of ['CMD_API_MANAGE_RESELLER_PACKAGES', 'CMD_API_MANAGE_USER_PACKAGES'] as const) {
      const data = await readManagePackageFields(cmd, name, {
        role: 'reseller',
        user: stored.user,
        password: stored.password,
      }).catch(() => null);
      if (data) return data;
    }
  }

  for (const username of BRAND_HOSTING_DA_USERS) {
    const res = await daRequest(
      'CMD_API_SHOW_USER_CONFIG',
      'GET',
      { user: username, json: 'yes' },
      'admin',
    );
    if (res.error || !res.data) continue;
    const data = res.data as Record<string, string>;
    const assigned = String(data.package || '').trim();
    if (assigned.toLowerCase() !== name.toLowerCase()) continue;
    return {
      packagename: assigned,
      quota: String(data.quota || ''),
      bandwidth: String(data.bandwidth || ''),
      nemails: String(data.nemails || ''),
      mysql: String(data.mysql || ''),
      ftp: String(data.ftp || ''),
      vdomains: String(data.vdomains || ''),
      nsubdomains: String(data.nsubdomains || ''),
      domainptr: String(data.domainptr || ''),
    };
  }

  return null;
}

export async function fetchBrandHostingPackages(): Promise<PanelPackage[]> {
  const rows: PanelPackage[] = [];

  for (const username of BRAND_HOSTING_DA_USERS) {
    const res = await daRequest(
      'CMD_API_SHOW_USER_CONFIG',
      'GET',
      { user: username, json: 'yes' },
      'admin',
    );
    if (res.error || !res.data) continue;

    const data = res.data as Record<string, string>;
    const packageName = String(data.package || '').trim();
    if (!packageName) continue;

    const details = await fetchBrandPackageDetailsByName(packageName);
    rows.push(packageRowFromFields(packageName, details || (data as Record<string, string>)));
  }

  return rows;
}

export async function mergeBrandHostingPackages(packages: PanelPackage[]): Promise<PanelPackage[]> {
  const byName = new Map(packages.map((p) => [p.packageName.toLowerCase(), p]));
  const brand = await fetchBrandHostingPackages();
  for (const pkg of brand) {
    byName.set(pkg.packageName.toLowerCase(), pkg);
  }
  return [...byName.values()].sort((a, b) => a.packageName.localeCompare(b.packageName));
}
