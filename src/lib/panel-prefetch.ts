import type { DirectAdminPackage, DirectAdminWebsite } from '@/lib/directadmin-api';
import type { PanelBootstrapScope } from '@/lib/panel-data-from-server';
import { fetchPanelBootstrap } from '@/lib/panel-data-from-server';
import { writeDnsCache, readDnsCache, type CachedDnsRow } from '@/lib/panel-dns-cache';
import { writePackagesCache } from '@/lib/panel-packages-cache';
import { writeRegistrarDomainListCache } from '@/lib/panel-domain-list-cache';
import {
  readSslCertCache,
  readSslHostsCache,
  writeSslCertCache,
  writeSslHostsCache,
  type CachedSslCert,
} from '@/lib/panel-ssl-cert-cache';
import { writePanelUsersCache } from '@/lib/panel-users-cache';
import { writeWpInstallsCache } from '@/lib/panel-wp-cache';
import { writeWpPluginsCache } from '@/lib/wp-panel-cache';
import { prefetchEmailConfigs } from '@/lib/panel-email-config-cache';
import {
  mapEmailContasToWebmailAccounts,
  writeWebmailAccountsCache,
  readWebmailAccountsCache,
  readWebmailListCache,
  writeWebmailListCache,
  readWebmailFolderTotalsCache,
  writeWebmailFolderTotalsCache,
  isWebmailListCacheFresh,
  WEBMAIL_STANDARD_FOLDERS,
  pickDefaultWebmailAccount,
  type WebmailAccountRow,
} from '@/lib/panel-webmail-cache';
import { readSiteSslCache, writeSiteSslCache } from '@/lib/site-ssl-cache';
import {
  NEW_MENU_ITEM_DEFS,
  RESELLER_MAIN_MENU_DEFS,
  resolveSectionId,
} from '@/lib/panel-admin-menu';
import type { UserRole } from '@/lib/user-roles';

function wpUpdateApi(scope: PanelBootstrapScope): string {
  return scope === 'client' ? '/api/client/wp-update' : '/api/admin/wp-update';
}

type QueuedPrefetchStep = {
  sectionId: string;
  run: () => Promise<void>;
};

let prefetchQueueTail: Promise<void> = Promise.resolve();

function yieldUi(ms = 40): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function menuSectionIds(scope: PanelBootstrapScope): string[] {
  const defs = scope === 'reseller' ? RESELLER_MAIN_MENU_DEFS : NEW_MENU_ITEM_DEFS;
  const ids: string[] = [];
  for (const item of defs) {
    if (!item.subItems?.length) {
      if (!item.id.endsWith('-header')) ids.push(item.id);
      continue;
    }
    for (const sub of item.subItems) {
      if (!sub.id.endsWith('-header')) ids.push(sub.id);
    }
  }
  if (scope === 'client') {
    return ['dashboard', 'emails-new', 'webmail', 'dns-central', 'cp-ssl', 'wp-sites', 'wp-plugins'];
  }
  return ids;
}

import { OSHER_DOMAIN } from '@/lib/email-domains';

export function resolvePrimaryDomainFromSites(
  sites: DirectAdminWebsite[],
  daUsername?: string | null,
): string | null {
  if (!sites.length) return null;
  const username = (daUsername || 'admin').toLowerCase();
  if (username === 'oshercollective') {
    const osher = sites.find((s) => s.domain?.toLowerCase() === OSHER_DOMAIN);
    if (osher?.domain) return OSHER_DOMAIN;
  }
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

function sslHostnamesForDomain(domain: string, subdomains: string[] = []): string[] {
  const hostnames = new Set<string>();
  const add = (hostname: string) => hostnames.add(hostname.toLowerCase());
  add(domain);
  add(`www.${domain}`);
  add(`mail.${domain}`);
  add(`webmail.${domain}`);
  for (const sub of subdomains) {
    const name = sub.trim();
    if (!name) continue;
    add(name.includes('.') ? name : `${name}.${domain}`);
  }
  return [...hostnames];
}

function parseSslRenewalDate(dates?: string): string | undefined {
  if (!dates) return undefined;
  const match = String(dates).match(/notAfter=([^\n]+)/i);
  if (!match) return undefined;
  try {
    return new Date(match[1].trim()).toLocaleString('pt-PT');
  } catch {
    return match[1].trim();
  }
}

async function prefetchSslPanelForDomain(domain: string): Promise<void> {
  if (typeof window === 'undefined' || !domain.trim()) return;
  const filterDomain = domain.trim().toLowerCase();
  const cachedHosts = readSslHostsCache(filterDomain, false);
  if (cachedHosts?.hostSsl && Object.keys(cachedHosts.hostSsl).length > 0) return;

  let subdomains: string[] = [];
  try {
    const res = await fetch('/api/da', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'listSubdomains', params: { domain: filterDomain } }),
    });
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      subdomains = json.data.map((row: { subdomain?: string }) => String(row.subdomain || ''));
    }
  } catch {
    /* espelho vazio */
  }

  const hostnames = sslHostnamesForDomain(filterDomain, subdomains);
  const [certRes, sslRes] = await Promise.all([
    fetch('/api/da', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'getSslCertificate', params: { hostname: filterDomain } }),
    }),
    hostnames.length
      ? fetch('/api/server-exec', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'checkSitesSsl', params: { domains: hostnames.slice(0, 30) } }),
        })
      : Promise.resolve(null),
  ]);

  let renewalDate = parseSslRenewalDate(readSslCertCache(filterDomain)?.dates);
  const certJson = await certRes.json();
  if (certJson.success && certJson.data?.success !== false && certJson.data?.certificate) {
    writeSslCertCache(filterDomain, certJson.data as CachedSslCert);
    renewalDate = parseSslRenewalDate(certJson.data.dates) || renewalDate;
  }

  let hostSsl: Record<string, boolean> = {};
  if (sslRes) {
    const sslData = await sslRes.json();
    if (sslData.success && sslData.data?.ssl) {
      hostSsl = sslData.data.ssl as Record<string, boolean>;
      writeSiteSslCache(hostSsl);
    }
  }

  if (Object.keys(hostSsl).length > 0) {
    writeSslHostsCache(filterDomain, { hostSsl, renewalDate });
  }
}

async function prefetchDashboardSiteSsl(domains: string[]): Promise<void> {
  const cached = readSiteSslCache();
  const missing = domains.filter((d) => cached[d] === undefined).slice(0, 20);
  if (!missing.length) return;
  const res = await fetch('/api/server-exec', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'checkSitesSsl', params: { domains: missing } }),
  });
  const data = await res.json();
  if (data.success && data.data?.ssl) {
    writeSiteSslCache({ ...cached, ...(data.data.ssl as Record<string, boolean>) });
  }
}

async function prefetchRegistrarDomainsAsync(): Promise<void> {
  const res = await fetch('/api/registrar/account/domains', { credentials: 'include' });
  const data = await res.json() as {
    success?: boolean;
    domains?: { domain: string; status?: string; expireDate?: string }[];
  };
  if (!data.success || !Array.isArray(data.domains)) return;
  writeRegistrarDomainListCache(
    data.domains.map((d) => ({
      domain: d.domain,
      state: d.status || 'Active',
      status: d.status,
      expireDate: d.expireDate,
    })),
  );
}

async function prefetchDnsForDomainAsync(domain: string): Promise<void> {
  if (!domain.trim()) return;
  if (readDnsCache(domain.trim(), false)?.length) return;
  const res = await fetch(`/api/panel-dns?domain=${encodeURIComponent(domain.trim())}`, { credentials: 'include' });
  const data = await res.json() as {
    success?: boolean;
    records?: { id?: string; name?: string; type?: string; content?: string; ttl?: number }[];
  };
  if (!data.success || !Array.isArray(data.records)) return;
  const rows: CachedDnsRow[] = data.records.map((r) => ({
    id: String(r.id || `${r.name}-${r.type}-${r.content}`),
    name: String(r.name || ''),
    type: String(r.type || '').toUpperCase(),
    content: String(r.content || ''),
    ttl: Number(r.ttl) || 0,
  }));
  writeDnsCache(domain.trim(), rows);
}

async function prefetchPanelUsersAsync(): Promise<void> {
  const res = await fetch('/api/admin/panel-users', { credentials: 'include' });
  const json = await res.json() as { success?: boolean; users?: unknown[]; counts?: Record<string, number> };
  if (!json.success || !Array.isArray(json.users)) return;
  writePanelUsersCache({
    users: json.users as Parameters<typeof writePanelUsersCache>[0]['users'],
    counts: json.counts || {},
  });
}

async function prefetchWordPressInstallsAsync(scope: PanelBootstrapScope): Promise<void> {
  const res = await fetch(wpUpdateApi(scope), { credentials: 'include' });
  const data = await res.json() as { success?: boolean; installs?: { domain: string }[] };
  if (!data.success || !Array.isArray(data.installs)) return;
  const domains = data.installs.map((i) => i.domain.toLowerCase());
  writeWpInstallsCache(domains, scope);
}

async function prefetchWpPluginsForDomainAsync(domain: string, scope: PanelBootstrapScope): Promise<void> {
  if (!domain.trim()) return;
  const res = await fetch(`${wpUpdateApi(scope)}?domain=${encodeURIComponent(domain.trim())}`, { credentials: 'include' });
  const data = await res.json() as {
    success?: boolean;
    plugins?: { name: string; title?: string; status: string; version: string; update: string | null; update_version?: string }[];
    install?: { wpVersion?: string };
  };
  if (!data.success || !Array.isArray(data.plugins)) return;
  writeWpPluginsCache(domain.trim(), data.plugins, data.install?.wpVersion || null);
}

async function prefetchEmailConfigsAdminAsync(): Promise<void> {
  const res = await fetch('/api/email-contas', { credentials: 'include' });
  const data = await res.json() as { success?: boolean; contas?: { email?: string }[] };
  if (!data.success || !Array.isArray(data.contas)) return;
  const accounts = mapEmailContasToWebmailAccounts(data.contas);
  writeWebmailAccountsCache(accounts);
  prefetchEmailConfigs(data.contas.map((c) => c.email || '').filter(Boolean));
  await prefetchWebmailInboxAsync(accounts);
}

async function prefetchWebmailAccountFolder(
  email: string,
  folder: string,
  includeTotals = false,
): Promise<void> {
  if (isWebmailListCacheFresh(email, folder)) return;

  const res = await fetch('/api/read-emails', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email,
      folders: [folder],
      limit: 20,
      includeTotals: includeTotals && folder === 'INBOX',
    }),
  });
  const data = await res.json() as {
    success?: boolean;
    emails?: unknown[];
    folderTotals?: Record<string, number>;
  };
  if (!data.success || !Array.isArray(data.emails)) return;
  writeWebmailListCache(email, folder, data.emails, data.folderTotals);
  if (data.folderTotals) writeWebmailFolderTotalsCache(email, data.folderTotals);
}

async function prefetchWebmailAccountFolders(email: string, allFolders = false): Promise<void> {
  const folders = allFolders
    ? [...WEBMAIL_STANDARD_FOLDERS]
    : (['INBOX'] as const);
  const needTotals = !readWebmailFolderTotalsCache(email, true);

  for (const folder of folders) {
    await prefetchWebmailAccountFolder(email, folder, needTotals && folder === 'INBOX');
    await yieldUi();
  }
}

async function prefetchWebmailInboxAsync(accounts?: WebmailAccountRow[]): Promise<void> {
  const list = accounts?.length ? accounts : readWebmailAccountsCache() || [];
  if (!list.length) return;

  const defaultEmail = pickDefaultWebmailAccount(list);
  if (defaultEmail) {
    await prefetchWebmailAccountFolders(defaultEmail, true);
    await yieldUi();
  }

  const rest = list
    .map((a) => a.email)
    .filter((email) => email && email !== defaultEmail);

  const CONCURRENCY = 2;
  for (let i = 0; i < rest.length; i += CONCURRENCY) {
    const batch = rest.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map((email) => prefetchWebmailAccountFolders(email, false)));
    await yieldUi();
  }
}

/** Prefetch em background das pastas de uma conta (ex.: ao mudar o selector). */
export function prefetchWebmailAccount(email: string, allFolders = true) {
  if (!email) return;
  void prefetchWebmailAccountFolders(email, allFolders).catch(() => undefined);
}

function buildPrefetchQueue(options: PrefetchPanelOptions): QueuedPrefetchStep[] {
  const scope = options.scope ?? 'admin';
  const domainList = new Set<string>();
  if (options.primaryDomain?.trim()) domainList.add(options.primaryDomain.trim().toLowerCase());
  for (const d of options.siteDomains || []) {
    if (d?.trim()) domainList.add(d.trim().toLowerCase());
  }
  const domains = [...domainList];
  const primary = options.primaryDomain?.trim().toLowerCase() || domains[0] || '';
  const sslDomains = [...new Set([primary, ...domains.slice(0, 6)].filter(Boolean))];
  const dnsDomains = domains.slice(0, 5);
  const steps: QueuedPrefetchStep[] = [];
  const seen = new Set<string>();

  const push = (sectionId: string, run: () => Promise<void>) => {
    const key = resolveSectionId(sectionId);
    if (seen.has(key)) return;
    seen.add(key);
    steps.push({ sectionId: key, run });
  };

  for (const sectionId of menuSectionIds(scope)) {
    const resolved = resolveSectionId(sectionId);
    switch (resolved) {
      case 'dashboard':
        push(sectionId, async () => {
          if (domains.length) await prefetchDashboardSiteSsl(domains);
        });
        break;
      case 'cp-users':
        if (scope === 'admin') push(sectionId, () => prefetchPanelUsersAsync());
        break;
      case 'clientes':
      case 'hospedagem-contas':
      case 'packages-list':
        break;
      case 'emails-new':
        if (scope === 'admin' || scope === 'reseller') {
          push(sectionId, () => prefetchEmailConfigsAdminAsync());
        }
        break;
      case 'webmail':
        push(sectionId, async () => {
          await prefetchWebmailInboxAsync();
        });
        break;
      case 'domain-manager':
      case 'porkbun-my-domains':
        push(sectionId, () => prefetchRegistrarDomainsAsync());
        break;
      case 'dns-central':
        push(sectionId, async () => {
          for (const domain of dnsDomains) {
            await prefetchDnsForDomainAsync(domain);
            await yieldUi();
          }
        });
        break;
      case 'cp-ssl':
        push(sectionId, async () => {
          for (const domain of sslDomains) {
            await prefetchSslPanelForDomain(domain);
            await yieldUi();
          }
        });
        break;
      case 'wp-sites':
        push(sectionId, () => prefetchWordPressInstallsAsync(scope));
        break;
      case 'wp-plugins':
        push(sectionId, async () => {
          for (const domain of domains.slice(0, 4)) {
            await prefetchWpPluginsForDomainAsync(domain, scope);
            await yieldUi();
          }
        });
        break;
      default:
        break;
    }
  }

  return steps;
}

export function runPanelPrefetchQueue(steps: QueuedPrefetchStep[]): void {
  if (typeof window === 'undefined' || !steps.length) return;
  prefetchQueueTail = prefetchQueueTail.then(async () => {
    for (const step of steps) {
      try {
        await step.run();
      } catch {
        /* próxima secção */
      }
      await yieldUi();
    }
  });
  void prefetchQueueTail;
}

export function prefetchRegistrarDomains() {
  void prefetchRegistrarDomainsAsync().catch(() => undefined);
}

export function prefetchDnsForDomain(domain: string) {
  void prefetchDnsForDomainAsync(domain).catch(() => undefined);
}

export function prefetchPanelUsers() {
  void prefetchPanelUsersAsync().catch(() => undefined);
}

export function prefetchWordPressInstalls(scope: PanelBootstrapScope = 'admin') {
  void prefetchWordPressInstallsAsync(scope).catch(() => undefined);
}

export function prefetchWpPluginsForDomain(domain: string, scope: PanelBootstrapScope = 'admin') {
  void prefetchWpPluginsForDomainAsync(domain, scope).catch(() => undefined);
}

export function prefetchSslForDomain(domain: string) {
  void prefetchSslPanelForDomain(domain).catch(() => undefined);
}

export type PrefetchPanelOptions = {
  scope?: PanelBootstrapScope;
  primaryDomain?: string | null;
  siteDomains?: string[];
  daUsername?: string | null;
};

/** Pré-carregar dados das secções (fila por ordem do menu). */
export function prefetchPanelContent(options?: PrefetchPanelOptions) {
  const steps = buildPrefetchQueue(options ?? {});
  void runPanelPrefetchQueue(steps);
}

export function prefetchPackages(packages: DirectAdminPackage[], scope: PanelBootstrapScope = 'admin') {
  if (!packages.length) return;
  writePackagesCache(packages, scope);
}

export function prefetchEmailConfigsAdmin() {
  void prefetchEmailConfigsAdminAsync().catch(() => undefined);
}

export function prefetchWebmailInbox(accounts?: WebmailAccountRow[]) {
  void prefetchWebmailInboxAsync(accounts).catch(() => undefined);
}

export function prefetchPanelContentFromBootstrap(
  boot: {
    sites: DirectAdminWebsite[];
    packages?: DirectAdminPackage[];
    resellerContext?: { primaryDomain?: string | null; daUsername?: string } | null;
  },
  scope: PanelBootstrapScope,
) {
  if (boot.packages?.length) prefetchPackages(boot.packages, scope);
  const daUsername = boot.resellerContext?.daUsername ?? null;
  const primary =
    boot.resellerContext?.primaryDomain?.toLowerCase() ||
    resolvePrimaryDomainFromSites(boot.sites, daUsername);
  const siteDomains = boot.sites.map((s) => s.domain?.toLowerCase()).filter(Boolean) as string[];

  prefetchPanelContent({
    scope,
    primaryDomain: primary,
    siteDomains,
    daUsername,
  });
}

export function roleToPrefetchScope(role: UserRole): PanelBootstrapScope | null {
  if (role === 'admin') return 'admin';
  if (role === 'reseller') return 'reseller';
  if (role === 'client') return 'client';
  return null;
}

/** No login: bootstrap + fila de prefetch por ordem do menu. */
export async function prefetchPanelContentOnLogin(role: UserRole): Promise<void> {
  const scope = roleToPrefetchScope(role);
  if (!scope || typeof window === 'undefined') return;
  try {
    const boot = await fetchPanelBootstrap({ fresh: false, scope });
    prefetchPanelContentFromBootstrap(boot, scope);
  } catch {
    prefetchPanelContent({ scope });
  }
}
