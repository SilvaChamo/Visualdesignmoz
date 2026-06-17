import type { PanelPackage, PanelUser, PanelWebsite } from '@/lib/directadmin-hosting-api';
import { OSHER_DOMAIN } from '@/lib/email-domains';

export const PRIMARY_RESELLER_DA_USER = 'oshercollective';

const VISUALDESIGN_PRIMARY_DOMAINS = [
  'visualdesignmoz.com',
  'visualdesigne.com',
  'visualdesigne.pt',
];

export function isPanelAdminAccount(user: Pick<PanelUser, 'userName' | 'acl' | 'type'>): boolean {
  const acl = String(user.acl || user.type || '').toLowerCase();
  return acl === 'admin' || String(user.userName || '').toLowerCase() === 'admin';
}

export function belongsToResellerAccount(
  user: Pick<PanelUser, 'userName' | 'parentUsername'>,
  daUsername: string,
): boolean {
  const owner = daUsername.toLowerCase();
  const name = String(user.userName || '').toLowerCase();
  const parent = String(user.parentUsername || '').toLowerCase();
  return name === owner || parent === owner;
}

function pickPrimaryDomain(userName: string, owned: PanelWebsite[], acl: string): string {
  if (!owned.length) return `${userName}.com`;

  if (acl === 'admin') {
    for (const preferred of VISUALDESIGN_PRIMARY_DOMAINS) {
      const match = owned.find((s) => s.domain === preferred);
      if (match) return match.domain;
    }
    const visual = owned.find((s) => /visualdesign/i.test(s.domain));
    if (visual) return visual.domain;
  }

  if (userName.toLowerCase() === PRIMARY_RESELLER_DA_USER) {
    const osher = owned.find((s) => s.domain.toLowerCase() === OSHER_DOMAIN);
    if (osher) return osher.domain;
  }

  const exact = owned.find((s) => s.domain === `${userName}.com`);
  if (exact) return exact.domain;
  const partial = owned.find((s) => s.domain.startsWith(userName));
  if (partial) return partial.domain;
  return [...owned].sort((a, b) => a.domain.localeCompare(b.domain))[0].domain;
}

function pickAccountPackage(userName: string, owned: PanelWebsite[], acl: string): string {
  if (acl === 'admin') return 'VisualDESIGN';
  if (userName === PRIMARY_RESELLER_DA_USER) return 'Osher';

  const counts = new Map<string, number>();
  for (const site of owned) {
    const name = site.package || '';
    if (!name || name === 'admin') continue;
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  let packageName = '';
  counts.forEach((count, name) => {
    if (!packageName || count > (counts.get(packageName) || 0)) packageName = name;
  });
  return packageName;
}

function formatPackageSize(value: unknown): string {
  if (value === null) return 'Ilimitado';
  const raw = String(value ?? '').trim();
  if (!raw) return '—';
  if (raw.toLowerCase() === 'unlimited' || raw === '-1') return 'Ilimitado';
  if (/[a-z]/i.test(raw)) return raw.toUpperCase();
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n >= 1024 && n % 1024 === 0) return `${n / 1024}G`;
  return `${n} MB`;
}

function formatDiskUsedMb(mb: number): string {
  if (!Number.isFinite(mb) || mb <= 0) return '0 MB';
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`;
  return `${mb} MB`;
}

export function enrichPanelAccounts(
  users: PanelUser[],
  sites: PanelWebsite[],
  packageMap: Map<string, PanelPackage>,
  options?: { resellerOwnerLabel?: string },
) {
  const ownerLabel = options?.resellerOwnerLabel ?? 'admin';

  return users.map((u) => {
    const owned = sites.filter((s) => s.owner === u.userName);
    const acl = String(u.acl || u.type || '').toLowerCase();
    const primaryDomain = pickPrimaryDomain(u.userName, owned, acl);
    const packageName = u.packageName || pickAccountPackage(u.userName, owned, acl);
    const pkgMeta = packageName ? packageMap.get(packageName) : undefined;
    const siteDiskSum = owned.reduce(
      (sum, s) => sum + (parseInt(String(s.diskUsage || '0'), 10) || 0),
      0,
    );
    const diskUsedMb =
      typeof u.diskUsedMb === 'number' && u.diskUsedMb > 0 ? u.diskUsedMb : siteDiskSum;
    const quotaLabel =
      u.quotaLimitMb !== undefined
        ? formatPackageSize(u.quotaLimitMb)
        : formatPackageSize(pkgMeta?.diskSpace);
    const resellerOwner =
      u.parentUsername ||
      (acl === 'admin' || (acl === 'reseller' && !u.parentUsername) ? ownerLabel : '—');

    return {
      ...u,
      primaryDomain,
      packageName: packageName || '—',
      quotaLabel,
      diskUsedLabel: formatDiskUsedMb(diskUsedMb),
      resellerOwner,
      domainCount: owned.length,
      ownedDomains: owned.map((s) => ({
        domain: s.domain,
        package: s.package || '—',
        diskUsage: String(s.diskUsage ?? '0'),
        status: s.state || s.status || 'Active',
      })),
      registeredAt: u.registeredAt || null,
    };
  });
}
