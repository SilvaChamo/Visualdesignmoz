import type { DirectAdminWebsite } from '@/lib/directadmin-api';
import type { DirectAdminPackage } from '@/lib/directadmin-api';
import type { PanelBootstrapScope } from '@/lib/panel-data-from-server';
import { writeDnsCache, type CachedDnsRow } from '@/lib/panel-dns-cache';
import { writePackagesCache } from '@/lib/panel-packages-cache';
import { writeRegistrarDomainListCache } from '@/lib/panel-domain-list-cache';
import { writeSslCertCache, type CachedSslCert } from '@/lib/panel-ssl-cert-cache';
import { writePanelUsersCache } from '@/lib/panel-users-cache';
import { writeWpInstallsCache } from '@/lib/panel-wp-cache';
import { writeWpPluginsCache } from '@/lib/wp-panel-cache';

function wpUpdateApi(scope: PanelBootstrapScope): string {
  return scope === 'client' ? '/api/client/wp-update' : '/api/admin/wp-update';
}

export function resolvePrimaryDomainFromSites(
  sites: DirectAdminWebsite[],
  daUsername?: string | null,
): string | null {
  if (!sites.length) return null;
  const username = (daUsername || 'admin').toLowerCase();
  const vd = sites.find((s) => s.domain?.toLowerCase() === 'visualdesignmoz.com');
  if (vd?.domain) return vd.domain.toLowerCase();
  const owned = sites.find((s) => {
    const owner = (s.owner || 'admin').toLowerCase();
    return owner === username || (owner === 'admin' && (username === 'visualdesign' || username === 'admin'));
  });
  if (owned?.domain) return owned.domain.toLowerCase();
  const wpSite = sites.find((s) => s.hasWordPress || s.siteType === 'wordpress');
  if (wpSite?.domain) return wpSite.domain.toLowerCase();
  const first = sites.find((s) => s.domain && !s.domain.includes('contaboserver'));
  return (first?.domain || sites[0]?.domain || '').toLowerCase() || null;
}

export function prefetchRegistrarDomains() {
  if (typeof window === 'undefined') return;
  void fetch('/api/registrar/account/domains', { credentials: 'include' })
    .then((res) => res.json())
    .then((data: { success?: boolean; domains?: { domain: string; status?: string; expireDate?: string }[] }) => {
      if (!data.success || !Array.isArray(data.domains)) return;
      writeRegistrarDomainListCache(
        data.domains.map((d) => ({
          domain: d.domain,
          state: d.status || 'Active',
          status: d.status,
          expireDate: d.expireDate,
        })),
      );
    })
    .catch(() => undefined);
}

export function prefetchDnsForDomain(domain: string) {
  if (typeof window === 'undefined' || !domain.trim()) return;
  void fetch(`/api/panel-dns?domain=${encodeURIComponent(domain.trim())}`, { credentials: 'include' })
    .then((res) => res.json())
    .then((data: { success?: boolean; records?: { id?: string; name?: string; type?: string; content?: string; ttl?: number }[] }) => {
      if (!data.success || !Array.isArray(data.records)) return;
      const rows: CachedDnsRow[] = data.records.map((r) => ({
        id: String(r.id || `${r.name}-${r.type}-${r.content}`),
        name: String(r.name || ''),
        type: String(r.type || '').toUpperCase(),
        content: String(r.content || ''),
        ttl: Number(r.ttl) || 0,
      }));
      writeDnsCache(domain.trim(), rows);
    })
    .catch(() => undefined);
}

export function prefetchPanelUsers() {
  if (typeof window === 'undefined') return;
  void fetch('/api/admin/panel-users', { credentials: 'include' })
    .then((res) => res.json())
    .then((json: { success?: boolean; users?: unknown[]; counts?: Record<string, number> }) => {
      if (!json.success || !Array.isArray(json.users)) return;
      writePanelUsersCache({
        users: json.users as Parameters<typeof writePanelUsersCache>[0]['users'],
        counts: json.counts || {},
      });
    })
    .catch(() => undefined);
}

export function prefetchWordPressInstalls(scope: PanelBootstrapScope = 'admin') {
  if (typeof window === 'undefined') return;
  void fetch(wpUpdateApi(scope), { credentials: 'include' })
    .then((res) => res.json())
    .then((data: { success?: boolean; installs?: { domain: string }[] }) => {
      if (!data.success || !Array.isArray(data.installs)) return;
      const domains = data.installs.map((i) => i.domain.toLowerCase());
      writeWpInstallsCache(domains);
      for (const domain of domains.slice(0, 8)) {
        prefetchWpPluginsForDomain(domain, scope);
      }
    })
    .catch(() => undefined);
}

export function prefetchWpPluginsForDomain(domain: string, scope: PanelBootstrapScope = 'admin') {
  if (typeof window === 'undefined' || !domain.trim()) return;
  void fetch(`${wpUpdateApi(scope)}?domain=${encodeURIComponent(domain.trim())}`, { credentials: 'include' })
    .then((res) => res.json())
    .then((data: {
      success?: boolean;
      plugins?: { name: string; title?: string; status: string; version: string; update: string | null; update_version?: string }[];
      install?: { wpVersion?: string };
    }) => {
      if (!data.success || !Array.isArray(data.plugins)) return;
      writeWpPluginsCache(domain.trim(), data.plugins, data.install?.wpVersion || null);
    })
    .catch(() => undefined);
}

export function prefetchSslForDomain(domain: string) {
  if (typeof window === 'undefined' || !domain.trim()) return;
  void fetch('/api/da', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'getSslCertificate', params: { hostname: domain.trim() } }),
  })
    .then((res) => res.json())
    .then((json: { success?: boolean; data?: CachedSslCert & { success?: boolean; certificate?: string } }) => {
      if (!json.success || json.data?.success === false || !json.data?.certificate) return;
      writeSslCertCache(domain.trim(), json.data);
    })
    .catch(() => undefined);
}

export type PrefetchPanelOptions = {
  scope?: PanelBootstrapScope;
  primaryDomain?: string | null;
  siteDomains?: string[];
  daUsername?: string | null;
};

/** Pré-carregar dados das secções ao iniciar sessão (cache imediato ao navegar). */
export function prefetchPanelContent(options?: PrefetchPanelOptions) {
  const scope = options?.scope ?? 'admin';
  const domains = new Set<string>();

  if (options?.primaryDomain?.trim()) {
    domains.add(options.primaryDomain.trim().toLowerCase());
  }
  for (const d of options?.siteDomains || []) {
    if (d?.trim()) domains.add(d.trim().toLowerCase());
  }

  if (scope === 'admin') {
    prefetchPanelUsers();
    prefetchRegistrarDomains();
  } else if (scope === 'reseller') {
    prefetchRegistrarDomains();
  }

  prefetchWordPressInstalls(scope);

  for (const domain of domains) {
    prefetchDnsForDomain(domain);
    prefetchSslForDomain(domain);
    prefetchWpPluginsForDomain(domain, scope);
  }
}

export function prefetchPackages(packages: DirectAdminPackage[]) {
  if (!packages.length) return;
  writePackagesCache(packages);
}

/** Após bootstrap: pré-carrega com base nos sites do espelho. */
export function prefetchPanelContentFromBootstrap(
  boot: {
    sites: DirectAdminWebsite[];
    packages?: DirectAdminPackage[];
    resellerContext?: { primaryDomain?: string | null; daUsername?: string } | null;
  },
  scope: PanelBootstrapScope,
) {
  if (boot.packages?.length) prefetchPackages(boot.packages);
  const daUsername = boot.resellerContext?.daUsername ?? null;
  const primary =
    boot.resellerContext?.primaryDomain?.toLowerCase() ||
    resolvePrimaryDomainFromSites(boot.sites, daUsername);
  const siteDomains = boot.sites
    .map((s) => s.domain?.toLowerCase())
    .filter(Boolean) as string[];

  prefetchPanelContent({
    scope,
    primaryDomain: primary,
    siteDomains,
    daUsername,
  });
}
