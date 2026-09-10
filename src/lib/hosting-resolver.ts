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

// ── Owner ────────────────────────────────────────────────────────────────────

/**
 * Devolve o utilizador do servidor responsável pelo domínio.
 *
 * Hestia (Contabo): todos os sites estão sob HESTIA_USER — sem mirror.
 * DA    (Hetzner):  consulta o espelho panel_sites no Supabase.
 */
export async function resolveHostingOwner(domain: string): Promise<string> {
  if (IS_HESTIA) return HESTIA_USER;

  const { getMirrorSiteOwner } = await import('@/lib/panel-mirror-read');
  return (await getMirrorSiteOwner(domain)) ?? 'admin';
}

// ── Domínios ─────────────────────────────────────────────────────────────────

/**
 * Lista todos os domínios web activos no servidor.
 *
 * Hestia (Contabo): chama v-list-web-domains directamente — sem mirror.
 * DA    (Hetzner):  lê panel_sites (Supabase mirror).
 */
export async function listHostingDomains(
  mirrorScope?: { role: 'admin' | 'reseller'; userId?: string; daUsername?: string },
): Promise<PanelWebsite[]> {
  if (IS_HESTIA) {
    const { listWebDomains } = await import('@/lib/hestia-adapter');
    const domains = await listWebDomains(HESTIA_USER);
    return domains.map((d) => ({
      id: d.domain,
      domain: d.domain,
      owner: HESTIA_USER,
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
  return listMirrorWebsites(mirrorScope ?? { role: 'admin' });
}

export async function listHostingUsers(): Promise<PanelUser[]> {
  if (IS_HESTIA) {
    const { listUsers } = await import('@/lib/hestia-adapter');
    const users = await listUsers();
    return users.map((u) => ({
      id: u.username,
      userName: u.username,
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      packageName: u.packageName,
      suspended: u.suspended,
      status: u.suspended ? 'suspended' : 'active',
      existsOnServer: true,
      diskUsedMb: u.diskUsedMb,
      bandwidthUsedMb: u.bandwidthUsedMb,
      quotaLimitMb: u.diskLimitMb,
      bandwidthLimitMb: u.bandwidthLimitMb,
      hostingProvider: 'hestia',
    } satisfies PanelUser));
  }

  const { listMirrorUsers } = await import('@/lib/panel-mirror-read');
  return listMirrorUsers({ role: 'admin' });
}

export async function listHostingPackages(): Promise<PanelPackage[]> {
  if (IS_HESTIA) {
    const { listPackages } = await import('@/lib/hestia-adapter');
    const packages = await listPackages();
    return packages.map((p) => ({
      id: p.packageName,
      packageName: p.packageName,
    } satisfies PanelPackage));
  }

  const { listMirrorPackages } = await import('@/lib/panel-mirror-read');
  return listMirrorPackages({ role: 'admin' });
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
 * Hestia: /home/HESTIA_USER/web/DOMAIN/public_html
 * DA:     /home/OWNER/domains/DOMAIN/public_html
 */
export async function resolveHostingPath(domain: string): Promise<string> {
  if (IS_HESTIA) {
    return `/home/${HESTIA_USER}/web/${domain}/public_html`;
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
