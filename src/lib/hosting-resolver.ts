/**
 * hosting-resolver.ts
 *
 * Camada de abstracção entre o painel e o servidor de hospedagem.
 *
 * No deploy Contabo (DEFAULT_HOSTING_PROVIDER=hestia) lemos directamente da
 * API Hestia — sem espelho, sem dependência do servidor Hetzner/DirectAdmin.
 *
 * No deploy Hetzner (DA) usamos as funções do mirror como antes.
 *
 * Todos os routes/libs que precisem do owner de um domínio ou da lista de
 * domínios devem importar daqui em vez de chamar directamente
 * getMirrorSiteOwner / listMirrorWebsites.
 */

import type { PanelPackage, PanelUser, PanelWebsite } from '@/lib/directadmin-hosting-api';

const IS_HESTIA =
  (process.env.DEFAULT_HOSTING_PROVIDER || '').trim().toLowerCase() === 'hestia';

const HESTIA_USER = (process.env.HESTIA_USER || 'vdadmin').trim();

type HestiaDomainRow = {
  username: string;
  domain: string;
  ip: string;
  suspended: boolean;
  sslEnabled: boolean;
  diskUsedMb: number;
  bandwidthUsedMb: number;
};

let hestiaDomainCache: { at: number; rows: HestiaDomainRow[] } | null = null;
let hestiaMailDomainCache: { at: number; rows: { username: string; domain: string }[] } | null = null;
let hestiaUsersCache: { at: number; rows: import('@/lib/hestia-adapter').HestiaUser[] } | null = null;
const HESTIA_DOMAIN_CACHE_MS = 60_000;

export function invalidateHestiaDomainCache(): void {
  hestiaDomainCache = null;
  hestiaMailDomainCache = null;
  hestiaUsersCache = null;
}

/** v-list-users com a mesma cache curta das listas de domínios — várias
 * leituras no mesmo pedido (sites, domínios de email, contas) partilham-na. */
async function listHestiaUsersCached(): Promise<import('@/lib/hestia-adapter').HestiaUser[]> {
  if (hestiaUsersCache && Date.now() - hestiaUsersCache.at < HESTIA_DOMAIN_CACHE_MS) {
    return hestiaUsersCache.rows;
  }
  const { listUsers } = await import('@/lib/hestia-adapter');
  const rows = await listUsers();
  hestiaUsersCache = { at: Date.now(), rows };
  return rows;
}

/**
 * Domínios de email de todas as contas Hestia. Um plano só de email é uma
 * conta sem nenhum site — sem isto o dono desses domínios nunca era
 * reconhecido (caía em HESTIA_USER) e o cliente via "Domínio fora do seu
 * painel" ao gerir as próprias caixas.
 */
async function listAllHestiaMailDomainRows(): Promise<{ username: string; domain: string }[]> {
  if (hestiaMailDomainCache && Date.now() - hestiaMailDomainCache.at < HESTIA_DOMAIN_CACHE_MS) {
    return hestiaMailDomainCache.rows;
  }
  const { listMailDomains } = await import('@/lib/hestia-adapter');
  const users = await listHestiaUsersCached();
  const usernames = [HESTIA_USER, ...users.map((u) => u.username).filter((name) => name !== HESTIA_USER)];
  const rows: { username: string; domain: string }[] = [];
  await Promise.all(
    usernames.map(async (username) => {
      try {
        for (const domain of await listMailDomains(username)) rows.push({ username, domain });
      } catch (err) {
        console.warn(`[hosting-resolver] v-list-mail-domains(${username}) falhou:`, err);
      }
    }),
  );
  hestiaMailDomainCache = { at: Date.now(), rows };
  return rows;
}

/**
 * União de v-list-web-domains para todos os utilizadores Hestia (vdadmin +
 * contas cliente como aamihe). listUsers() exclui HESTIA_USER de propósito
 * (não é uma conta de cliente no sync) — aqui voltamos a incluí-lo.
 */
async function listAllHestiaDomainRows(): Promise<HestiaDomainRow[]> {
  if (hestiaDomainCache && Date.now() - hestiaDomainCache.at < HESTIA_DOMAIN_CACHE_MS) {
    return hestiaDomainCache.rows;
  }

  const { listWebDomains } = await import('@/lib/hestia-adapter');
  const users = await listHestiaUsersCached();
  const usernames = [
    HESTIA_USER,
    ...users.map((u) => u.username).filter((name) => name !== HESTIA_USER),
  ];

  const rows: HestiaDomainRow[] = [];
  await Promise.all(
    usernames.map(async (username) => {
      try {
        const domains = await listWebDomains(username);
        for (const d of domains) {
          rows.push({
            username,
            domain: d.domain,
            ip: d.ip,
            suspended: d.suspended,
            sslEnabled: d.sslEnabled,
            diskUsedMb: d.diskUsedMb,
            bandwidthUsedMb: d.bandwidthUsedMb,
          });
        }
      } catch (err) {
        console.warn(`[hosting-resolver] v-list-web-domains(${username}) falhou:`, err);
      }
    }),
  );

  hestiaDomainCache = { at: Date.now(), rows };
  return rows;
}

function hestiaPublicHtml(owner: string, domain: string): string {
  return `/home/${owner}/web/${domain}/public_html`;
}

// ── Owner ────────────────────────────────────────────────────────────────────

/**
 * Devolve o utilizador do servidor responsável pelo domínio.
 *
 * Hestia (Contabo): dono real da conta (vdadmin, aamihe, …) — sem mirror.
 * DA    (Hetzner):  consulta o espelho panel_sites no Supabase.
 */
export async function resolveHostingOwner(domain: string): Promise<string> {
  if (IS_HESTIA) {
    const needle = domain.trim().toLowerCase();
    if (!needle) return HESTIA_USER;

    const rows = await listAllHestiaDomainRows();
    const hit = rows.find((r) => r.domain.toLowerCase() === needle);
    if (hit) return hit.username;

    // Sem site: pode ser um domínio só de email (plano de email).
    const mailHit = (await listAllHestiaMailDomainRows()).find((r) => r.domain.toLowerCase() === needle);
    if (mailHit) return mailHit.username;

    try {
      const { resolveDomainSitePath } = await import('@/lib/wp-cli-server');
      const site = await resolveDomainSitePath(needle);
      if (site?.user) return site.user;
    } catch {
      /* filesystem lookup é fallback — se o SSH falhar, usa HESTIA_USER */
    }
    return HESTIA_USER;
  }

  const { getMirrorSiteOwner } = await import('@/lib/panel-mirror-read');
  return (await getMirrorSiteOwner(domain)) ?? 'admin';
}

/**
 * Conta Hestia que já tem este domínio (site ou email), ou null se o domínio
 * não existe no servidor. Ao contrário de resolveHostingOwner, nunca cai em
 * HESTIA_USER — serve para saber se um domínio está livre antes de o criar.
 */
export async function findHestiaDomainOwner(domain: string): Promise<string | null> {
  const needle = domain.trim().toLowerCase();
  if (!needle) return null;
  invalidateHestiaDomainCache();
  const web = (await listAllHestiaDomainRows()).find((r) => r.domain.toLowerCase() === needle);
  if (web) return web.username;
  const mail = (await listAllHestiaMailDomainRows()).find((r) => r.domain.toLowerCase() === needle);
  return mail?.username ?? null;
}

// ── Leitura directa do Hestia (Contabo) — substitui o espelho panel_* ───────
//
// No Contabo o painel não lê cópias (panel_sites, panel_emails, panel_dns…):
// essas tabelas vinham do DirectAdmin no Hetzner, onde a API era lenta. Uma
// cópia desactualizada apagou do painel um domínio que continuava no servidor
// (concordia.co.mz, 8 out). Aqui só há a cache curta das listagens.

let wpDomainsCache: { at: number; domains: Set<string> } | null = null;
const WP_CACHE_MS = 5 * 60_000;

/** Domínios com WordPress (wp-config.php no servidor) — uma pesquisa por SSH
 * para todo o servidor, guardada 5 min. Falha = mantém o último resultado. */
async function listWpDomainsCached(): Promise<Set<string>> {
  if (wpDomainsCache && Date.now() - wpDomainsCache.at < WP_CACHE_MS) return wpDomainsCache.domains;
  try {
    const { listWpInstalls } = await import('@/lib/wp-cli-server');
    const domains = new Set((await listWpInstalls()).map((w) => w.domain.toLowerCase()));
    wpDomainsCache = { at: Date.now(), domains };
    return domains;
  } catch {
    return wpDomainsCache?.domains ?? new Set();
  }
}

/** Dono (conta Hestia) de um domínio — site ou só email —, ou null se o
 * domínio não existe no servidor. Usa a cache curta (não a invalida). */
export async function getHestiaDomainOwner(domain: string): Promise<string | null> {
  const needle = domain.trim().toLowerCase();
  if (!needle) return null;
  const web = (await listAllHestiaDomainRows()).find((r) => r.domain.toLowerCase() === needle);
  if (web) return web.username;
  const mail = (await listAllHestiaMailDomainRows()).find((r) => r.domain.toLowerCase() === needle);
  return mail?.username ?? null;
}

/**
 * Todos os domínios do servidor, directo do Hestia: sites + domínios só de
 * email (planos de email), no mesmo formato que o espelho devolvia
 * ('Active'/'Suspended', package/adminEmail da conta dona). `owners` limita
 * às contas indicadas (minúsculas); omisso = servidor inteiro.
 */
export async function listHestiaLiveSites(owners?: Set<string> | null): Promise<PanelWebsite[]> {
  const [webRows, mailRows, users, wpDomains] = await Promise.all([
    listAllHestiaDomainRows(),
    listAllHestiaMailDomainRows(),
    listHestiaUsersCached(),
    listWpDomainsCached(),
  ]);
  const userByName = new Map(users.map((u) => [u.username.toLowerCase(), u]));
  const inScope = (owner: string) => !owners || owners.has(owner.toLowerCase());

  const out: PanelWebsite[] = [];
  const seen = new Set<string>();
  for (const d of webRows) {
    if (!inScope(d.username)) continue;
    const domain = d.domain.toLowerCase();
    seen.add(domain);
    const owner = userByName.get(d.username.toLowerCase());
    const isWp = wpDomains.has(domain);
    const status = d.suspended ? 'Suspended' : 'Active';
    out.push({
      id: d.domain,
      domain: d.domain,
      owner: d.username,
      adminEmail: owner?.email || undefined,
      package: owner?.packageName || 'Default',
      state: status,
      status,
      isActive: !d.suspended,
      diskUsage: String(d.diskUsedMb),
      bandwidth: d.bandwidthUsedMb,
      ssl: d.sslEnabled,
      sslStatus: d.sslEnabled ? 'Secure' : 'No SSL',
      ip: d.ip || undefined,
      siteType: isWp ? 'wordpress' : 'empty',
      hasWordPress: isWp,
      hasNextJs: false,
      hasBasicSite: false,
    });
  }
  for (const m of mailRows) {
    const domain = m.domain.toLowerCase();
    if (seen.has(domain) || !inScope(m.username)) continue;
    seen.add(domain);
    const owner = userByName.get(m.username.toLowerCase());
    const status = owner?.suspended ? 'Suspended' : 'Active';
    out.push({
      id: m.domain,
      domain: m.domain,
      owner: m.username,
      adminEmail: owner?.email || undefined,
      package: owner?.packageName || 'Default',
      state: status,
      status,
      isActive: !owner?.suspended,
      diskUsage: '0',
      bandwidth: 0,
      ssl: false,
      sslStatus: 'No SSL',
      siteType: 'empty',
      hasWordPress: false,
      hasNextJs: false,
      hasBasicSite: false,
      mailOnly: true,
    });
  }
  return out.sort((a, b) => a.domain.localeCompare(b.domain));
}

type PanelUserRegistryRow = {
  username: string;
  parent_username: string | null;
  auth_user_id: string | null;
  package_name: string | null;
  quota_limit_mb: number | null;
  bandwidth_limit_mb: number | null;
  websites_limit: number | null;
  emails_limit: number | null;
  acl: string | null;
  created_at: string | null;
};

/** Registo de contas do painel (panel_users): quem é dono de cada conta, que
 * revenda a criou, que login está ligado e os limites definidos no painel.
 * Isto não é cópia do Hestia — o Hestia não conhece nada disto. */
async function loadPanelUserRegistry(): Promise<Map<string, PanelUserRegistryRow>> {
  const map = new Map<string, PanelUserRegistryRow>();
  try {
    const { getDaSyncAdmin } = await import('@/lib/da-sync-schema');
    const sb = getDaSyncAdmin();
    if (!sb) return map;
    const { data } = await sb
      .from('panel_users')
      .select('username, parent_username, auth_user_id, package_name, quota_limit_mb, bandwidth_limit_mb, websites_limit, emails_limit, acl, created_at');
    for (const row of (data || []) as PanelUserRegistryRow[]) {
      const username = String(row.username || '').trim().toLowerCase();
      if (username) map.set(username, row);
    }
  } catch {
    /* sem ligação à base — contas aparecem só com os dados do servidor */
  }
  return map;
}

// ── Domínios ─────────────────────────────────────────────────────────────────

/**
 * Lista todos os domínios web activos no servidor.
 *
 * Hestia (Contabo): une v-list-web-domains de todas as contas — sem mirror.
 * DA    (Hetzner):  lê panel_sites (Supabase mirror).
 */
export async function listHostingDomains(
  mirrorScope?: { role: string; userId?: string; daUsername?: string; linkedOwners?: string[] },
): Promise<PanelWebsite[]> {
  if (IS_HESTIA) {
    const rows = await listAllHestiaDomainRows();
    let scoped: typeof rows = [];
    if (mirrorScope?.role === 'admin') {
      const impersonating = mirrorScope.daUsername;
      if (impersonating) {
        const owners = new Set([impersonating, ...(mirrorScope.linkedOwners || [])].map((o) => o.trim().toLowerCase()));
        scoped = rows.filter((r) => owners.has(r.username.toLowerCase()));
      } else {
        scoped = rows;
      }
    } else if (mirrorScope?.daUsername) {
      const owners = new Set([mirrorScope.daUsername, ...(mirrorScope.linkedOwners || [])].map((o) => o.trim().toLowerCase()));
      scoped = rows.filter((r) => owners.has(r.username.toLowerCase()));
    } else {
      scoped = [];
    }
    return scoped.map((d) => ({
      id: d.domain,
      domain: d.domain,
      owner: d.username,
      state: d.suspended ? 'suspended' : 'active',
      status: d.suspended ? 'suspended' : 'active',
      ssl: d.sslEnabled,
      sslStatus: d.sslEnabled ? 'Secure' : 'No SSL',
      ip: d.ip,
      diskUsage: d.diskUsedMb,
      bandwidth: d.bandwidthUsedMb,
      isActive: !d.suspended,
    } satisfies PanelWebsite));
  }

  const { listMirrorWebsites } = await import('@/lib/panel-mirror-read');
  const scope = mirrorScope?.role === 'reseller' ? { role: 'reseller' as const, userId: mirrorScope.userId, daUsername: mirrorScope.daUsername, linkedOwners: mirrorScope.linkedOwners } : { role: 'admin' as const };
  return listMirrorWebsites(scope);
}

export async function listHostingUsers(): Promise<PanelUser[]> {
  if (IS_HESTIA) {
    // Mesmo formato de sempre desta função ('active'/'suspended' em minúsculas).
    return (await listHestiaLiveUsers()).map((u) => ({
      ...u,
      status: u.suspended ? 'suspended' : 'active',
    }));
  }

  const { listMirrorUsers } = await import('@/lib/panel-mirror-read');
  return listMirrorUsers({ role: 'admin' });
}

/**
 * Contas directo do Hestia (estado, uso, pacote) juntas com o registo do
 * painel: conta principal (parent_username) e, nas contas com login no
 * painel, o pacote/limites definidos no painel — a mesma regra que o sync
 * aplicava ao espelho. Estado no formato do espelho ('Active'/'Suspended').
 */
export async function listHestiaLiveUsers(): Promise<PanelUser[]> {
  const [users, registry] = await Promise.all([listHestiaUsersCached(), loadPanelUserRegistry()]);
  return users.map((u) => {
    const reg = registry.get(u.username.toLowerCase());
    const panelManaged = Boolean(reg?.auth_user_id);
    const status = u.suspended ? 'Suspended' : 'Active';
    return {
      id: u.username,
      userName: u.username,
      email: u.email || undefined,
      firstName: u.firstName || undefined,
      lastName: u.lastName || undefined,
      type: reg?.acl || 'user',
      acl: reg?.acl || 'user',
      packageName: (panelManaged && reg?.package_name) || u.packageName || undefined,
      suspended: u.suspended,
      status,
      existsOnServer: true,
      registeredAt: reg?.created_at || undefined,
      diskUsedMb: u.diskUsedMb,
      bandwidthUsedMb: u.bandwidthUsedMb,
      quotaLimitMb: panelManaged && reg?.quota_limit_mb != null ? reg.quota_limit_mb : u.diskLimitMb,
      bandwidthLimitMb: panelManaged && reg?.bandwidth_limit_mb != null ? reg.bandwidth_limit_mb : u.bandwidthLimitMb,
      websitesLimit: reg?.websites_limit ?? undefined,
      emailsLimit: reg?.emails_limit ?? undefined,
      hostingProvider: 'hestia',
      parentUsername: reg?.parent_username || undefined,
    } satisfies PanelUser;
  });
}

export async function listHostingPackages(): Promise<PanelPackage[]> {
  if (IS_HESTIA) return listHestiaLivePackages();

  const { listMirrorPackages } = await import('@/lib/panel-mirror-read');
  return listMirrorPackages({ role: 'admin' });
}

/** Pacotes com os limites reais do Hestia ('-' = ilimitado, como no espelho). */
export async function listHestiaLivePackages(): Promise<PanelPackage[]> {
  const { listPackagesDetailed } = await import('@/lib/hestia-adapter');
  const limit = (n: number | null) => (n === null ? '-' : n);
  return (await listPackagesDetailed()).map((p) => ({
    id: p.packageName,
    packageName: p.packageName,
    diskSpace: limit(p.diskQuotaMb),
    bandwidth: limit(p.bandwidthMb),
    emailAccounts: limit(p.mailAccounts),
    dataBases: limit(p.databases),
    allowedDomains: limit(p.webDomains),
  } satisfies PanelPackage));
}

export async function listHostingSubdomains(parentDomain: string): Promise<{ domain: string; subdomain: string }[]> {
  const parent = parentDomain.trim().toLowerCase();
  if (!parent) return [];
  const sites = await listHostingDomains();
  const suffix = `.${parent}`;
  return sites
    .filter((s) => s.domain.toLowerCase().endsWith(suffix))
    .map((s) => ({
      domain: parent,
      subdomain: s.domain.slice(0, -suffix.length),
    }));
}

// ── Caminho no sistema de ficheiros ──────────────────────────────────────────

/**
 * Devolve o caminho absoluto do public_html de um domínio no servidor.
 *
 * Hestia: /home/OWNER/web/DOMAIN/public_html  (OWNER = conta real, não só vdadmin)
 * DA:     /home/OWNER/domains/DOMAIN/public_html
 */
export async function resolveHostingPath(domain: string): Promise<string> {
  if (IS_HESTIA) {
    try {
      const { resolveDomainSitePath } = await import('@/lib/wp-cli-server');
      const site = await resolveDomainSitePath(domain);
      if (site?.path) return site.path;
    } catch {
      /* cai no caminho construído a partir do dono */
    }
    const owner = await resolveHostingOwner(domain);
    return hestiaPublicHtml(owner, domain);
  }

  const owner = await resolveHostingOwner(domain);
  return `/home/${owner}/domains/${domain}/public_html`;
}

// ── Domínios por cliente ──────────────────────────────────────────────────────

/**
 * Lista os domínios associados a um utilizador cliente específico.
 *
 * A propriedade do domínio por cliente é sempre registada no Supabase
 * (panel_sites / panel_users) tanto no deploy Hestia como no DA — esta
 * função centraliza esse acesso para desacoplar os chamadores de
 * panel-mirror-read.
 */
export async function listHostingDomainsForClient(
  userId: string,
  email?: string | null,
): Promise<PanelWebsite[]> {
  // panel_sites é mantido em sincronia pelo sync engine (Hestia ou DA),
  // por isso esta consulta funciona correctamente em ambos os deployments.
  const { listMirrorWebsitesForClientUser } = await import('@/lib/panel-mirror-read');
  return listMirrorWebsitesForClientUser(userId, email);
}

// ── Metadados ─────────────────────────────────────────────────────────────────

export const hostingProvider = IS_HESTIA ? 'hestia' : 'da';
export const hostingUser = IS_HESTIA ? HESTIA_USER : null;
