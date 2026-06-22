import type { DirectAdminWebsite, DirectAdminUser, DirectAdminPackage } from '@/lib/directadmin-api';
import { PRIMARY_RESELLER_DA_USER } from '@/lib/panel-contas-enrich';

/** Pacotes de marca admin — nunca misturar com revenda. */
const ADMIN_RESERVED_PACKAGES = new Set(['visualdesign', 'aamihe', 'default']);

export function collectResellerOwners(
  users: Array<Pick<DirectAdminUser, 'userName' | 'acl' | 'type'>>,
): Set<string> {
  const owners = new Set(
    users
      .filter((u) => (u.acl || u.type || '').toLowerCase() === 'reseller')
      .map((u) => String(u.userName || '').toLowerCase())
      .filter(Boolean),
  );
  owners.add(PRIMARY_RESELLER_DA_USER.toLowerCase());
  return owners;
}

/** Contas de revenda + sub-contas criadas por revendedores (ex.: clientes Osher). */
export function buildResellerOwnerTree(
  users: Array<Pick<DirectAdminUser, 'userName' | 'acl' | 'type' | 'parentUsername'>>,
): Set<string> {
  const tree = collectResellerOwners(users);
  let changed = true;
  while (changed) {
    changed = false;
    for (const user of users) {
      const name = String(user.userName || '').toLowerCase();
      if (!name || tree.has(name)) continue;
      const parent = String(user.parentUsername || '').toLowerCase();
      if (parent && tree.has(parent)) {
        tree.add(name);
        changed = true;
      }
    }
  }
  return tree;
}

export function isAdminPanelSite(
  site: Pick<DirectAdminWebsite, 'owner'>,
  resellerTree: Set<string>,
): boolean {
  const owner = (site.owner || 'admin').trim().toLowerCase();
  return !resellerTree.has(owner);
}

/** @deprecated Preferir isAdminPanelSite + buildResellerOwnerTree */
export function isAdminOwnedSite(
  site: Pick<DirectAdminWebsite, 'owner'>,
  resellerTree: Set<string>,
): boolean {
  return isAdminPanelSite(site, resellerTree);
}

export function filterSitesForAdminPanel<T extends Pick<DirectAdminWebsite, 'owner' | 'domain'>>(
  sites: T[],
  users: Array<Pick<DirectAdminUser, 'userName' | 'acl' | 'type' | 'parentUsername'>>,
): T[] {
  const resellerTree = buildResellerOwnerTree(users);
  return sites.filter((s) => {
    if (s.domain?.includes('contaboserver')) return false;
    if (s.domain?.toLowerCase().startsWith('mail.')) return false;
    return isAdminPanelSite(s, resellerTree);
  });
}

/** Admin: pacotes dos sites admin + marcas reservadas — exclui Osher/revenda. */
export function filterPackagesForAdminPanel(
  packages: DirectAdminPackage[],
  allSites: DirectAdminWebsite[],
  users: Array<Pick<DirectAdminUser, 'userName' | 'acl' | 'type' | 'parentUsername'>>,
): DirectAdminPackage[] {
  const adminSites = filterSitesForAdminPanel(allSites, users);
  const adminPkgNames = new Set(
    adminSites.map((s) => s.package).filter((name): name is string => Boolean(name)),
  );
  const resellerTree = buildResellerOwnerTree(users);
  const resellerPkgNames = new Set(
    allSites
      .filter((s) => !isAdminPanelSite(s, resellerTree))
      .map((s) => s.package)
      .filter((name): name is string => Boolean(name)),
  );

  return packages.filter((p) => {
    const name = String(p.packageName || '').trim();
    if (!name) return false;
    const key = name.toLowerCase();
    if (key === 'osher') return false;
    if (ADMIN_RESERVED_PACKAGES.has(key)) return true;
    if (resellerPkgNames.has(name) && !adminPkgNames.has(name)) return false;
    return adminPkgNames.has(name) || !resellerPkgNames.has(name);
  });
}

export function applyAdminPanelScope(boot: {
  sites: DirectAdminWebsite[];
  users: DirectAdminUser[];
  packages: DirectAdminPackage[];
}) {
  const resellerTree = buildResellerOwnerTree(boot.users);
  return {
    resellerTree,
    sites: filterSitesForAdminPanel(boot.sites, boot.users),
    users: boot.users,
    packages: boot.packages,
  };
}
