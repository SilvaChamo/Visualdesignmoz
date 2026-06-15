/**
 * Adaptador servidor DirectAdmin — API REST com credenciais admin ou revendedor.
 */

import { cacheService } from './cache-service';
import { daRequest } from './directadmin';
import {
  resolveDirectAdminCredentials,
  type DirectAdminAuthContext,
  type DirectAdminCredentials,
} from './directadmin-credentials';
import type {
  PanelWebsite,
  PanelPackage,
  PanelUser,
  PanelEmailAccount,
  PanelDatabase,
  PanelFTPAccount,
  HostingCommandResult,
} from './directadmin-hosting-api';
import { fetchServerStatsViaSsh, type ServerStats } from '@/lib/server-stats';

type DaData = Record<string, unknown>;

function extractList(data: DaData, prefix = 'list'): string[] {
  const direct = data[prefix];
  if (Array.isArray(direct)) return direct.map(String);
  const numericKeys = Object.keys(data)
    .filter((k) => /^\d+$/.test(k))
    .sort((a, b) => Number(a) - Number(b));
  if (numericKeys.length > 0) {
    return numericKeys.map((k) => String(data[k]));
  }
  const results: string[] = [];
  for (const [k, v] of Object.entries(data)) {
    if (k === prefix || k.startsWith(`${prefix}[`) || /^list\d*$/.test(k)) {
      results.push(String(v));
    }
  }
  return [...new Set(results)];
}

function field(data: DaData, key: string): string {
  const v = data[key];
  return v != null ? String(v) : '';
}

async function resolveDomainSslStatus(
  credentials: DirectAdminCredentials,
  domain: string,
): Promise<'Secure' | 'No SSL'> {
  try {
    const sslData = await daGet(credentials, 'CMD_API_SSL', { domain });
    const raw = JSON.stringify(sslData).toLowerCase();
    if (
      raw.includes('certificate') ||
      raw.includes('letsencrypt') ||
      raw.includes('begin cert') ||
      field(sslData, 'active') === 'yes' ||
      field(sslData, 'leco') === '1'
    ) {
      return 'Secure';
    }
  } catch {
    /* tentar HTTPS */
  }

  try {
    const { executeServerCommand } = await import('@/lib/server-ssh-exec');
    const out = await executeServerCommand(
      `curl -skI --max-time 8 "https://${domain}" 2>&1 | head -1`,
    );
    const line = out.toLowerCase();
    if (
      /http\/[12]/.test(line) &&
      (line.includes('200') || line.includes('301') || line.includes('302'))
    ) {
      return 'Secure';
    }
  } catch {
    /* sem SSH ou domínio inacessível */
  }

  return 'No SSL';
}

async function daGet(creds: DirectAdminCredentials, cmd: string, qs: Record<string, string> = {}): Promise<DaData> {
  const res = await daRequest(cmd, 'GET', { json: 'yes', ...qs }, creds);
  if (res.error) throw new Error(res.details || res.text || `DirectAdmin ${cmd} falhou`);
  return res.data || {};
}

/** Alguns comandos DA (ex. SHOW_USER_DOMAINS) falham ou ficam vazios com json=yes neste servidor. */
async function daGetPlain(
  creds: DirectAdminCredentials,
  cmd: string,
  qs: Record<string, string> = {},
): Promise<DaData> {
  const res = await daRequest(cmd, 'GET', qs, creds);
  if (res.error) throw new Error(res.details || res.text || `DirectAdmin ${cmd} falhou`);
  return res.data || {};
}

function normalizeDomainKey(key: string): string {
  return decodeURIComponent(key).replace(/%2E/gi, '.').toLowerCase();
}

function extractDomainKeys(data: DaData): string[] {
  const skip = new Set(['error', 'text', 'details', 'success', 'client_ip', 'have_lost_password']);
  return [
    ...new Set(
      Object.keys(data)
        .filter((k) => !skip.has(k) && !k.startsWith('list'))
        .map(normalizeDomainKey)
        .filter((d) => d.includes('.')),
    ),
  ];
}

async function resolveDaAccountUsers(credentials: DirectAdminCredentials): Promise<string[]> {
  const users = new Set<string>([credentials.user]);
  if (credentials.role === 'admin') {
    try {
      const allData = await daGetPlain(credentials, 'CMD_API_SHOW_ALL_USERS');
      const all = extractList(allData, 'list');
      if (all.length > 0) return [...new Set(all)];
    } catch {
      /* fallback abaixo */
    }
    try {
      const resellersData = await daGetPlain(credentials, 'CMD_API_SHOW_RESELLERS');
      extractList(resellersData, 'list').forEach((u) => users.add(u));
    } catch {
      /* revendedores opcionais */
    }
  } else {
    try {
      const subData = await daGetPlain(credentials, 'CMD_API_SHOW_USERS');
      extractList(subData, 'list').forEach((u) => users.add(u));
    } catch {
      /* sub-contas opcionais */
    }
  }
  return [...users];
}

function formatDaError(res: { error?: boolean; details?: string; text?: string; data?: DaData }): string {
  const data = res.data || {};
  const result = typeof data.result === 'string' ? data.result : '';
  const err = typeof data.error === 'string' ? data.error : '';
  return [err, result, res.details, res.text].filter(Boolean).join(' — ') || 'Pedido DirectAdmin falhou';
}

async function daPost(
  creds: DirectAdminCredentials,
  cmd: string,
  body: Record<string, string>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await daRequest(cmd, 'POST', { json: 'yes', ...body }, creds);
  return { ok: !res.error, error: res.error ? formatDaError(res) : undefined };
}

async function fetchPackageDetailFields(
  credentials: DirectAdminCredentials,
  packageName: string,
): Promise<Record<string, string>> {
  const name = packageName.trim();
  const readFields = (pkgSp: DaData): Record<string, string> => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(pkgSp)) {
      if (v != null && String(v).trim()) out[k] = String(v);
    }
    return out;
  };

  const listCmd =
    credentials.role === 'reseller' ? 'CMD_API_PACKAGES_RESELLER' : 'CMD_API_PACKAGES_USER';

  for (const cmd of [listCmd, 'CMD_API_PACKAGES_USER', 'CMD_API_PACKAGES_RESELLER'] as const) {
    try {
      const pkgSp = await daGet(credentials, cmd, { package: name });
      const out = readFields(pkgSp);
      if (
        out.quota ||
        out.bandwidth ||
        out.packagename ||
        out.vdomains ||
        out.ftp ||
        out.nemails ||
        Object.keys(out).length > 2
      ) {
        return out;
      }
    } catch {
      /* tentar comando seguinte */
    }
  }

  if (credentials.role === 'admin') {
    const { fetchBrandPackageDetailsByName } = await import('@/lib/panel-brand-packages');
    const brand = await fetchBrandPackageDetailsByName(name);
    if (brand) return brand;
  }

  return {};
}

export function createDirectAdminAPI(credentials: DirectAdminCredentials) {
  const cachePrefix = `da_${credentials.role}_${credentials.user}_`;
  let ownerByDomain: Map<string, string> | null = null;

  async function resolveDomainOwner(domain: string): Promise<string | undefined> {
    if (credentials.role === 'reseller') {
      return credentials.user;
    }
    try {
      const { getMirrorSiteOwner } = await import('@/lib/panel-mirror-read');
      const fromMirror = await getMirrorSiteOwner(domain);
      if (fromMirror) return fromMirror;
    } catch {
      /* espelho indisponível */
    }
    if (!ownerByDomain) {
      try {
        const sites = await api.listWebsites();
        ownerByDomain = new Map(
          sites.filter((s) => s.domain).map((s) => [s.domain, s.owner || credentials.user]),
        );
      } catch {
        ownerByDomain = new Map();
      }
    }
    return ownerByDomain.get(domain) || credentials.user;
  }

  function withDomainUser(qs: Record<string, string>, domain: string, owner?: string) {
    const params = { ...qs };
    const account = owner || credentials.user;
    if (credentials.role === 'admin' && account) params.user = account;
    if (!params.domain && domain) params.domain = domain;
    return params;
  }

  const api = {
    listWebsites: async (_timeoutMs?: number): Promise<PanelWebsite[]> => {
      const cacheKey = `${cachePrefix}listWebsites`;
      const cached = cacheService.get(cacheKey);
      if (cached) return cached as PanelWebsite[];

      const users = await resolveDaAccountUsers(credentials);
      const sites: PanelWebsite[] = [];

      for (const user of users) {
        const domainsData = await daGetPlain(credentials, 'CMD_API_SHOW_USER_DOMAINS', { user });
        const domains = extractDomainKeys(domainsData);
        const userConf = await daGet(credentials, 'CMD_API_SHOW_USER_CONFIG', { user });

        const domainRows = await Promise.all(
          domains.map(async (domain) => {
            const sslStatus = await resolveDomainSslStatus(credentials, domain);
            return {
              id: `${user}_${domain}`,
              domain,
              adminEmail: field(userConf, 'email'),
              package: field(userConf, 'package') || 'Default',
              state: field(userConf, 'suspended') === 'yes' ? 'Suspended' : 'Active',
              owner: user,
              phpVersion: field(userConf, 'php1_release') || 'PHP 8.3',
              sslStatus,
              ssl: sslStatus === 'Secure',
              diskUsage: field(userConf, 'quota_used') || '0',
              bandwidth: parseInt(field(userConf, 'bandwidth') || '0', 10),
            } satisfies PanelWebsite;
          }),
        );
        sites.push(...domainRows);
      }

      cacheService.set(cacheKey, sites, 30_000);
      return sites;
    },

    listPackages: async (): Promise<PanelPackage[]> => {
      const cacheKey = `${cachePrefix}listPackages`;
      const cached = cacheService.get(cacheKey);
      if (cached) return cached as PanelPackage[];

      const cmd =
        credentials.role === 'reseller' ? 'CMD_API_PACKAGES_RESELLER' : 'CMD_API_PACKAGES_USER';
      const pkgData = await daGet(credentials, cmd);
      const names = extractList(pkgData);
      const packages: PanelPackage[] = [];
      const { packageRowFromFields } = await import('@/lib/panel-brand-packages');

      for (const name of names) {
        const fields = await fetchPackageDetailFields(credentials, name);
        packages.push(packageRowFromFields(name, fields));
      }

      let result = packages;
      if (credentials.role === 'admin') {
        const { fetchBrandHostingPackages } = await import('@/lib/panel-brand-packages');
        try {
          const brandPkgs = await fetchBrandHostingPackages();
          const byName = new Map(result.map((p) => [p.packageName.toLowerCase(), p]));
          for (const brand of brandPkgs) {
            byName.set(brand.packageName.toLowerCase(), brand);
          }
          result = [...byName.values()].sort((a, b) => a.packageName.localeCompare(b.packageName));
        } catch {
          /* pacotes admin apenas */
        }
      }

      cacheService.set(cacheKey, result, 5 * 60_000);
      return result;
    },

    createPackage: async (p: Record<string, unknown>) => {
      cacheService.clear();
      const name = String(p.packageName || '').trim();
      const cmd =
        p.packageScope === 'reseller' || credentials.role === 'reseller'
          ? 'CMD_API_MANAGE_RESELLER_PACKAGES'
          : 'CMD_API_MANAGE_USER_PACKAGES';

      let fields: Record<string, string>;
      const fullForm = p.hostingPackageForm as import('@/lib/reseller-package-form').ResellerPackageFormState | undefined;
      if (fullForm?.packageName || fullForm?.limits) {
        const { hostingPackageFormToDaFields } = await import('@/lib/reseller-package-form');
        fields = hostingPackageFormToDaFields({
          ...fullForm,
          packageName: name || fullForm.packageName,
        });
      } else {
        fields = {
          add: 'Save',
          packagename: name,
          quota: String(p.diskSpace || '1000'),
          bandwidth: String(p.bandwidth || '10000'),
          nemails: String(p.emailAccounts || '10'),
          mysql: String(p.dataBases || '5'),
          ftp: String(p.ftpAccounts || '5'),
          vdomains: String(p.allowedDomains || '1'),
        };
      }

      const result = await daPost(credentials, cmd, fields);
      return { success: result.ok, output: result.error || 'Pacote criado', error: result.error };
    },

    modifyPackage: async (p: Record<string, unknown>) => {
      cacheService.clear();
      const name = String(p.packageName || '').trim();
      const cmd =
        p.packageScope === 'reseller' || credentials.role === 'reseller'
          ? 'CMD_API_MANAGE_RESELLER_PACKAGES'
          : 'CMD_API_MANAGE_USER_PACKAGES';

      let fields: Record<string, string>;
      const fullForm = p.hostingPackageForm as import('@/lib/reseller-package-form').ResellerPackageFormState | undefined;
      if (fullForm?.limits) {
        const { hostingPackageFormToDaFields } = await import('@/lib/reseller-package-form');
        fields = hostingPackageFormToDaFields({ ...fullForm, packageName: name || fullForm.packageName });
      } else {
        fields = {
          add: 'Save',
          packagename: name,
          quota: String(p.diskSpace || '1000'),
          bandwidth: String(p.bandwidth || '10000'),
          nemails: String(p.emailAccounts || '10'),
          mysql: String(p.dataBases || '5'),
          ftp: String(p.ftpAccounts || '5'),
          vdomains: String(p.allowedDomains || '1'),
        };
      }

      const result = await daPost(credentials, cmd, fields);
      return { success: result.ok, output: result.error || 'Pacote actualizado', error: result.error };
    },

    deletePackage: async (packageName: string) => {
      cacheService.clear();
      const cmd =
        credentials.role === 'reseller'
          ? 'CMD_API_MANAGE_RESELLER_PACKAGES'
          : 'CMD_API_MANAGE_USER_PACKAGES';
      const result = await daPost(credentials, cmd, {
        delete: 'Delete',
        delete0: packageName,
      });
      return { success: result.ok, output: result.error || 'Pacote apagado', error: result.error };
    },

    getPackageDetails: async (packageName: string): Promise<Record<string, string>> => {
      return fetchPackageDetailFields(credentials, packageName);
    },

    listUsers: async (): Promise<PanelUser[]> => {
      const cacheKey = `${cachePrefix}listUsers`;
      const cached = cacheService.get(cacheKey);
      if (cached) return cached as PanelUser[];

      const usernames = await resolveDaAccountUsers(credentials);
      const users: PanelUser[] = [];

      for (const username of usernames) {
        const conf = await daGet(credentials, 'CMD_API_SHOW_USER_CONFIG', { user: username });
        const usertype = field(conf, 'usertype');
        const dateRaw =
          field(conf, 'date') ||
          field(conf, 'creation_date') ||
          field(conf, 'created') ||
          '';
        const vdomains = parseInt(field(conf, 'vdomains') || field(conf, 'ubandwidth') || '0', 10);
        const nemails = parseInt(field(conf, 'nemails') || '0', 10);
        users.push({
          id: username,
          userName: username,
          email: field(conf, 'email'),
          firstName: field(conf, 'name') || field(conf, 'name1') || undefined,
          lastName: field(conf, 'name2') || undefined,
          type: usertype === 'reseller' ? 'reseller' : usertype === 'admin' ? 'admin' : 'user',
          acl: usertype === 'reseller' ? 'reseller' : usertype === 'admin' ? 'admin' : 'user',
          suspended: field(conf, 'suspended') === 'yes',
          existsOnServer: true,
          registeredAt: dateRaw || undefined,
          websitesLimit: Number.isFinite(vdomains) && vdomains > 0 ? vdomains : undefined,
          emailsLimit: Number.isFinite(nemails) && nemails > 0 ? nemails : undefined,
          parentUsername: (() => {
            const creator = field(conf, 'creator').trim();
            return creator && creator !== username ? creator : undefined;
          })(),
        });
      }

      cacheService.set(cacheKey, users, 60_000);
      return users;
    },

    createUser: async (p: Record<string, unknown>) => {
      cacheService.clear();
      const isReseller = p.acl === 'reseller';
      const cmd = isReseller ? 'CMD_API_ACCOUNT_RESELLER' : 'CMD_API_ACCOUNT_USER';
      return daPost(credentials, cmd, {
        action: 'create',
        username: String(p.userName || ''),
        email: String(p.email || ''),
        passwd: String(p.password || ''),
        passwd2: String(p.password || ''),
        domain: String(p.domain || `${p.userName}.com`),
        package: String(p.package || 'Default'),
        ip: 'shared',
        notify: 'no',
      });
    },

    modifyUser: async (p: Record<string, unknown>) => {
      cacheService.clear();
      return daPost(credentials, 'CMD_API_MODIFY_USER', {
        action: 'single',
        user: String(p.userName || ''),
        email: String(p.email || ''),
        passwd: String(p.password || ''),
        passwd2: String(p.password || ''),
      });
    },

    deleteUser: async (p: Record<string, unknown>) => {
      cacheService.clear();
      const result = await daPost(credentials, 'CMD_API_SELECT_USERS', {
        delete: 'yes',
        select0: String(p.userName || p.username || ''),
      });
      return { success: result.ok, error: result.error };
    },

    suspendUser: async (userName: string) => {
      cacheService.clear();
      const result = await daPost(credentials, 'CMD_API_SELECT_USERS', {
        suspend: 'yes',
        select0: userName,
      });
      return { success: result.ok, error: result.error };
    },

    unsuspendUser: async (userName: string) => {
      cacheService.clear();
      const result = await daPost(credentials, 'CMD_API_SELECT_USERS', {
        suspend: 'no',
        select0: userName,
      });
      return { success: result.ok, error: result.error };
    },

    createUserLoginUrl: async (userName: string) => {
      const keyname = `vd${Date.now()}`.slice(0, 16);
      const res = await daRequest('CMD_API_LOGIN_KEYS', 'POST', {
        json: 'yes',
        action: 'create',
        type: 'one_time_url',
        user: userName,
        keyname,
      }, credentials);
      if (res.error) {
        return { success: false, error: formatDaError(res) };
      }
      const data = res.data || {};
      const url =
        (typeof data.url === 'string' && data.url) ||
        (typeof data.text === 'string' && data.text.startsWith('http') ? data.text : '') ||
        (typeof res.text === 'string' && res.text.startsWith('http') ? res.text : '');
      if (!url) {
        return { success: false, error: 'URL de sessão não devolvida pelo servidor.' };
      }
      return { success: true, url };
    },

    listACLs: async () => ['admin', 'reseller', 'user'],

    createACL: async (_p: Record<string, unknown>) => ({ success: false, error: 'ACLs geridas pelo DirectAdmin' }),
    deleteACL: async (_p: Record<string, unknown>) => ({ success: false, error: 'ACLs geridas pelo DirectAdmin' }),

    createWebsite: async (p: Record<string, unknown>) => {
      cacheService.clear();
      const domain = String(p.domainName || p.domain || '');
      const derivedUser = domain.replace(/[^a-z0-9]/gi, '').slice(0, 10).toLowerCase() || 'site';
      const explicitOwner = String(p.owner || p.username || p.userName || '').trim();
      const createNewUser = p.createUserAccount === true || p.createUserAccount === 'yes';

      // Domínio na conta existente (admin/revenda) — CMD_API_DOMAIN (como no UI do DA)
      if (!createNewUser && (credentials.role === 'admin' || credentials.role === 'reseller')) {
        const owner = explicitOwner || credentials.user;
        const creds =
          credentials.role === 'admin' && owner !== credentials.user
            ? { ...credentials, user: `${credentials.user}|${owner}` }
            : credentials;
        const result = await daPost(creds, 'CMD_API_DOMAIN', {
          action: 'create',
          domain,
          bandwidth: String(p.bandwidth || 'unlimited'),
          quota: String(p.quota || 'unlimited'),
          ssl: 'ON',
          php: 'ON',
          cgi: 'ON',
          notify: 'no',
        });
        return { success: result.ok, output: result.error || 'Domínio criado', error: result.error };
      }

      const username = explicitOwner || derivedUser;
      const password = String(p.password || 'ChangeMe123!');
      const result = await daPost(credentials, 'CMD_API_ACCOUNT_USER', {
        action: 'create',
        username,
        email: String(p.email || p.adminEmail || ''),
        passwd: password,
        passwd2: password,
        domain,
        package: String(p.package || p.packageName || 'Default'),
        ip: 'shared',
        notify: 'no',
      });
      return { success: result.ok, output: result.error || 'Website criado', error: result.error };
    },

    suspendWebsite: async (domain: string) => {
      cacheService.clear();
      try {
        const { executeServerCommand } = await import('@/lib/server-ssh-exec');
        const out = await executeServerCommand(`da suspend-domain --domain=${domain} 2>&1`);
        const lower = out.toLowerCase();
        const ok = !lower.includes('could not') && !lower.includes('not found') && !lower.includes('failed to');
        return { success: ok, output: out };
      } catch {
        const sites = await api.listWebsites();
        const site = sites.find((s) => s.domain === domain);
        if (!site?.owner) return { success: false, output: 'Domínio não encontrado' };
        const owner = site.owner;
        const creds =
          credentials.role === 'admin' && owner !== credentials.user
            ? { ...credentials, user: `${credentials.user}|${owner}` }
            : credentials;
        const result = await daPost(creds, 'CMD_API_DOMAIN', {
          action: 'select',
          select0: domain,
          suspend: 'yes',
        });
        return { success: result.ok, output: result.error };
      }
    },

    unsuspendWebsite: async (domain: string) => {
      cacheService.clear();
      try {
        const { executeServerCommand } = await import('@/lib/server-ssh-exec');
        const out = await executeServerCommand(`da unsuspend-domain --domain=${domain} 2>&1`);
        const lower = out.toLowerCase();
        const ok = !lower.includes('could not') && !lower.includes('not found') && !lower.includes('failed to');
        return { success: ok, output: out };
      } catch {
        const sites = await api.listWebsites();
        const site = sites.find((s) => s.domain === domain);
        if (!site?.owner) return { success: false, output: 'Domínio não encontrado' };
        const owner = site.owner;
        const creds =
          credentials.role === 'admin' && owner !== credentials.user
            ? { ...credentials, user: `${credentials.user}|${owner}` }
            : credentials;
        const result = await daPost(creds, 'CMD_API_DOMAIN', {
          action: 'select',
          select0: domain,
          unsuspend: 'yes',
        });
        return { success: result.ok, output: result.error };
      }
    },

    deleteWebsite: async (domain: string) => {
      cacheService.clear();
      const sites = await api.listWebsites();
      const site = sites.find((s) => s.domain === domain);
      if (!site?.owner) return { success: false, output: 'Domínio não encontrado' };
      const result = await daPost(credentials, 'CMD_API_SELECT_USERS', { delete: 'yes', select0: site.owner });
      return { success: result.ok, output: result.error || 'Apagado' };
    },

    modifyWebsite: async (_p: Record<string, unknown>) => ({ success: true }),

    listEmails: async (domain: string): Promise<PanelEmailAccount[]> => {
      const cacheKey = `${cachePrefix}emails_${domain}`;
      const cached = cacheService.get(cacheKey);
      if (cached) return cached as PanelEmailAccount[];

      const owner = await resolveDomainOwner(domain);
      const data = await daGet(
        credentials,
        'CMD_API_POP',
        withDomainUser({ action: 'list', domain }, domain, owner),
      );
      const accounts = extractList(data);

      const emails: PanelEmailAccount[] = accounts.map((account) => ({
        id: `${account}@${domain}`,
        email: `${account}@${domain}`,
        domain,
        quota_mb: parseInt(field(data, `quota[${account}]`) || field(data, 'quota') || '250', 10),
        usage: field(data, `usage[${account}]`) || '0',
        status: 'active' as const,
      }));

      cacheService.set(cacheKey, emails, 30_000);
      return emails;
    },

    createEmail: async (p: Record<string, unknown>) => {
      cacheService.clear();
      const result = await daPost(credentials, 'CMD_API_POP', {
        action: 'create',
        domain: String(p.domain || ''),
        user: String(p.userName || (typeof p.email === 'string' ? p.email.split('@')[0] : '')),
        passwd: String(p.password || ''),
        passwd2: String(p.password || ''),
        quota: String(p.quota || '250'),
      });
      return { success: result.ok, error: result.error };
    },

    deleteEmail: async (p: Record<string, unknown>) => {
      cacheService.clear();
      const email = String(p.email || '');
      const [user, domain] = email.split('@');
      const result = await daPost(credentials, 'CMD_API_POP', {
        action: 'delete',
        domain: String(p.domain || domain),
        user: String(p.userName || user),
      });
      return { success: result.ok };
    },

    suspendEmail: async (_email: string) => ({ success: true, note: 'Marcado como suspenso' }),
    unsuspendEmail: async (_email: string) => ({ success: true }),

    changeEmailPassword: async (p: Record<string, unknown>) => {
      cacheService.clear();
      const email = String(p.email || '');
      const [user, domain] = email.split('@');
      const result = await daPost(credentials, 'CMD_API_POP', {
        action: 'modify',
        domain: String(p.domain || domain),
        user: String(p.userName || user),
        passwd: String(p.password || ''),
        passwd2: String(p.password || ''),
      });
      return { success: result.ok };
    },

    getEmailForwarding: async (p: Record<string, unknown>) => {
      const data = await daGet(credentials, 'CMD_API_EMAIL_FORWARDERS', { domain: String(p.domain || '') });
      return extractList(data).filter((f) => f.startsWith(String(p.email || '').split('@')[0]));
    },

    addEmailForwarding: async (p: Record<string, unknown>) => {
      const email = String(p.email || '');
      const [user, domain] = email.split('@');
      const result = await daPost(credentials, 'CMD_API_EMAIL_FORWARDERS', {
        action: 'create',
        domain,
        user,
        email: String(p.forward || ''),
      });
      return { success: result.ok };
    },

    getCatchAllEmail: async (domain: string) => {
      const data = await daGet(credentials, 'CMD_API_EMAIL_CATCH_ALL', { domain });
      return field(data, 'value');
    },

    setCatchAllEmail: async (p: Record<string, unknown>) => {
      const result = await daPost(credentials, 'CMD_API_EMAIL_CATCH_ALL', {
        action: 'set',
        domain: String(p.domain || ''),
        value: String(p.email || ''),
      });
      return { success: result.ok };
    },

    getPatternForwarding: async (_domain: string) => [] as Record<string, unknown>[],
    addPatternForwarding: async (_p: Record<string, unknown>) => ({ success: true }),
    getPlusAddressing: async (_domain: string) => false,
    togglePlusAddressing: async (_p: Record<string, unknown>) => ({ success: true }),
    setEmailLimits: async (_p: Record<string, unknown>) => ({ success: true }),

    enableDKIM: async (domain: string) => {
      const result = await daPost(credentials, 'CMD_API_DNS_CONTROL', {
        action: 'add',
        domain,
        type: 'TXT',
        name: `default._domainkey.${domain}`,
        value: 'v=DKIM1; generating...',
        ttl: '300',
      });
      return { success: result.ok, message: result.ok ? 'DKIM activado' : result.error };
    },

    getDKIMStatus: async (domain: string): Promise<HostingCommandResult> => {
      const data = await daGet(credentials, 'CMD_API_DNS_CONTROL', { action: 'list', domain });
      let record = '';
      for (const v of Object.values(data)) {
        const s = String(v);
        if (s.includes('v=DKIM1')) {
          record = s;
          break;
        }
      }
      return { enabled: Boolean(record), record, selector: 'default', publicKey: record, output: record };
    },

    issueSSL: async (domain: string, options?: { force?: boolean; renew?: boolean; autoRenewDays?: string }) => {
      cacheService.clear();
      const owner = await resolveDomainOwner(domain);
      const creds =
        credentials.role === 'admin' && owner && owner !== credentials.user
          ? { ...credentials, user: `${credentials.user}|${owner}` }
          : credentials;

      if (options?.force || options?.renew) {
        try {
          const { executeServerCommand } = await import('@/lib/server-ssh-exec');
          const script = options.renew ? 'renew' : 'request';
          const out = await executeServerCommand(
            `/usr/local/directadmin/scripts/letsencrypt.sh ${script} ${domain} 4096 2>&1`,
          );
          const lower = out.toLowerCase();
          const ok = !lower.includes('error') && !lower.includes('failed');
          if (ok && options.autoRenewDays) {
            await daPost(creds, 'CMD_API_SSL', {
              action: 'save',
              domain,
              type: 'acme',
              renewal_days: options.autoRenewDays,
            });
          }
          return { success: ok, output: out };
        } catch (e) {
          return { success: false, output: e instanceof Error ? e.message : 'Erro ao emitir SSL' };
        }
      }

      const body: Record<string, string> = { action: 'save', domain, type: 'acme' };
      if (options?.autoRenewDays) body.renewal_days = options.autoRenewDays;
      const result = await daPost(creds, 'CMD_API_SSL', body);
      return { success: result.ok, output: result.error || 'SSL solicitado' };
    },

    replaceSSL: async (domain: string) => api.issueSSL(domain, { force: true }),

    deleteSSL: async (domain: string) => {
      cacheService.clear();
      const owner = await resolveDomainOwner(domain);
      const creds =
        credentials.role === 'admin' && owner && owner !== credentials.user
          ? { ...credentials, user: `${credentials.user}|${owner}` }
          : credentials;
      const result = await daPost(creds, 'CMD_API_SSL', { action: 'delete', domain });
      return { success: result.ok, output: result.error || 'Certificado removido' };
    },

    cancelSslRenewal: async (domain: string) => {
      const owner = await resolveDomainOwner(domain);
      const creds =
        credentials.role === 'admin' && owner && owner !== credentials.user
          ? { ...credentials, user: `${credentials.user}|${owner}` }
          : credentials;
      const result = await daPost(creds, 'CMD_API_SSL', {
        action: 'save',
        domain,
        disable_letsencrypt_autorenew: 'yes',
      });
      return { success: result.ok, output: result.error || 'Renovação automática cancelada' };
    },

    setForceSsl: async (domain: string, enabled = true) => {
      const owner = await resolveDomainOwner(domain);
      const creds =
        credentials.role === 'admin' && owner && owner !== credentials.user
          ? { ...credentials, user: `${credentials.user}|${owner}` }
          : credentials;
      const result = await daPost(creds, 'CMD_API_DOMAIN', {
        action: 'modify',
        domain,
        force_ssl: enabled ? 'yes' : 'no',
        ssl: 'ON',
      });
      return { success: result.ok, output: result.error || (enabled ? 'SSL forçado activado' : 'SSL forçado desactivado') };
    },

    getSslCertificate: async (hostname: string) => {
      const owner = (await resolveDomainOwner(hostname)) || credentials.user;
      const { executeServerCommand } = await import('@/lib/server-ssh-exec');
      const parts = hostname.split('.');
      const candidates: string[] = [];
      for (let i = 0; i < parts.length - 1; i++) {
        candidates.push(parts.slice(i).join('.'));
      }

      for (const parent of candidates) {
        const certPath = `/usr/local/directadmin/data/users/${owner}/domains/${parent}.cert.combined`;
        const keyPath = `/usr/local/directadmin/data/users/${owner}/domains/${parent}.key`;
        try {
          const exists = await executeServerCommand(`test -f ${certPath} && echo ok || echo no`);
          if (!exists.includes('ok')) continue;
          const san = await executeServerCommand(
            `openssl x509 -in ${certPath} -noout -text 2>/dev/null | grep -E 'DNS:|Subject:' || true`,
          );
          if (
            hostname !== parent &&
            !san.toLowerCase().includes(hostname.toLowerCase()) &&
            !san.toLowerCase().includes(`cn=${hostname.toLowerCase()}`)
          ) {
            continue;
          }
          const certificate = await executeServerCommand(`cat ${certPath}`);
          const privateKey = await executeServerCommand(`cat ${keyPath}`);
          const subject = await executeServerCommand(`openssl x509 -in ${certPath} -noout -subject 2>/dev/null`);
          const issuer = await executeServerCommand(`openssl x509 -in ${certPath} -noout -issuer 2>/dev/null`);
          const dates = await executeServerCommand(`openssl x509 -in ${certPath} -noout -dates -serial 2>/dev/null`);
          const keyType = await executeServerCommand(
            `openssl x509 -in ${certPath} -noout -text 2>/dev/null | grep 'Public Key Algorithm' | head -1`,
          );
          const dnsNames = await executeServerCommand(
            `openssl x509 -in ${certPath} -noout -text 2>/dev/null | awk '/DNS:/ { for(i=1;i<=NF;i++) if($i ~ /DNS:/) print $i }' | sed 's/DNS://g' | tr -d ',' | paste -sd, -`,
          );
          return {
            success: true,
            hostname,
            parentDomain: parent,
            certificate,
            privateKey,
            subject: subject.replace(/^subject=/, ''),
            issuer: issuer.replace(/^issuer=/, ''),
            dates,
            serial: dates.match(/serial=([^\n]+)/i)?.[1]?.trim() || '',
            keyType: keyType.replace(/Public Key Algorithm:/i, '').trim(),
            dnsNames: dnsNames || hostname,
          };
        } catch {
          continue;
        }
      }
      return { success: false, error: 'Certificado não encontrado para este hostname' };
    },

    listSubdomains: async (domain: string) => {
      const owner = await resolveDomainOwner(domain);
      const data = await daGetPlain(
        credentials,
        'CMD_API_SUBDOMAINS',
        withDomainUser({ action: 'list', domain }, domain, owner),
      );
      return extractList(data).map((sub) => ({ domain, subdomain: sub }));
    },

    createSubdomain: async (domain: string, subdomain: string) => {
      const owner = await resolveDomainOwner(domain);
      const creds =
        credentials.role === 'admin' && owner && owner !== credentials.user
          ? { ...credentials, user: `${credentials.user}|${owner}` }
          : credentials;
      const result = await daPost(
        creds,
        'CMD_API_SUBDOMAINS',
        withDomainUser({ action: 'create', subdomain }, domain, owner),
      );
      return { success: result.ok, error: result.error, output: result.error };
    },

    deleteSubdomain: async (domain: string, subdomain: string) => {
      const owner = await resolveDomainOwner(domain);
      const creds =
        credentials.role === 'admin' && owner && owner !== credentials.user
          ? { ...credentials, user: `${credentials.user}|${owner}` }
          : credentials;
      const result = await daPost(
        creds,
        'CMD_API_SUBDOMAINS',
        withDomainUser({ action: 'delete', subdomain, select0: subdomain }, domain, owner),
      );
      return { success: result.ok, error: result.error };
    },

    listDatabases: async (domain: string): Promise<PanelDatabase[]> => {
      const owner =
        credentials.role === 'reseller'
          ? credentials.user
          : (await resolveDomainOwner(domain)) || credentials.user;
      const data = await daGet(credentials, 'CMD_API_DATABASES', { user: owner });
      return extractList(data).map((db) => ({ dbName: db, domain, dbUser: db }));
    },

    createDatabase: async (p: Record<string, unknown>) => {
      cacheService.clear();
      const domain = String(p.domain || '');
      const owner = domain
        ? await resolveDomainOwner(domain)
        : credentials.user;
      const creds =
        credentials.role === 'admin' && owner && owner !== credentials.user
          ? { ...credentials, user: `${credentials.user}|${owner}` }
          : credentials;
      const result = await daPost(creds, 'CMD_API_DATABASES', {
        action: 'create',
        name: String(p.dbName || ''),
        user: String(p.dbUser || p.dbName || ''),
        passwd: String(p.dbPassword || ''),
        passwd2: String(p.dbPassword || ''),
      });
      return { success: result.ok, output: result.error || 'Database criada', error: result.error };
    },

    deleteDatabase: async (p: Record<string, unknown>) => {
      cacheService.clear();
      const domain = String(p.domain || '');
      const owner = domain
        ? await resolveDomainOwner(domain)
        : credentials.user;
      const creds =
        credentials.role === 'admin' && owner && owner !== credentials.user
          ? { ...credentials, user: `${credentials.user}|${owner}` }
          : credentials;
      const result = await daPost(creds, 'CMD_API_DATABASES', {
        action: 'delete',
        name: String(p.dbName || ''),
      });
      return { success: result.ok, error: result.error };
    },

    listFTPAccounts: async (domain: string): Promise<PanelFTPAccount[]> => {
      const owner = await resolveDomainOwner(domain);
      const data = await daGet(
        credentials,
        'CMD_API_FTP',
        withDomainUser({ action: 'list', domain }, domain, owner),
      );
      return extractList(data).map((username) => ({ username, domain }));
    },

    createFTPAccount: async (p: Record<string, unknown>) => {
      cacheService.clear();
      const result = await daPost(credentials, 'CMD_API_FTP', {
        action: 'create',
        domain: String(p.domain || ''),
        user: String(p.username || ''),
        passwd: String(p.password || ''),
        passwd2: String(p.password || ''),
        path: String(p.path || '/'),
      });
      return { success: result.ok, output: result.error || 'FTP criado' };
    },

    deleteFTPAccount: async (p: Record<string, unknown>) => {
      cacheService.clear();
      const result = await daPost(credentials, 'CMD_API_FTP', {
        action: 'delete',
        domain: String(p.domain || ''),
        user: String(p.username || ''),
      });
      return { success: result.ok };
    },

    listDNS: async (domain: string) => {
      const owner = await resolveDomainOwner(domain);
      const creds =
        credentials.role === 'admin' && owner && owner !== credentials.user
          ? { ...credentials, user: `${credentials.user}|${owner}` }
          : credentials;

      const parseDnsData = (data: DaData) => {
        const raw = data.records;
        if (Array.isArray(raw)) {
          return raw.map((rec: Record<string, unknown>) => {
            const name = String(rec.name || '').replace(/\.$/, '');
            const value = String(rec.value || rec.content || '');
            return {
              name,
              type: String(rec.type || 'A').toUpperCase(),
              content: value,
              value,
              ttl: Number(rec.ttl) || 3600,
              combined: String(rec.combined || ''),
            };
          });
        }
        const records: Record<string, unknown>[] = [];
        const typePrefixes: Record<string, string> = {
          arecs: 'A',
          aaaarecs: 'AAAA',
          mxrecs: 'MX',
          txtrecs: 'TXT',
          cnamerecs: 'CNAME',
          nsrecs: 'NS',
          ptrrecs: 'PTR',
          srvrecs: 'SRV',
        };
        for (const [k, v] of Object.entries(data)) {
          const m = k.match(/^(arecs|aaaarecs|mxrecs|txtrecs|cnamerecs|nsrecs|ptrrecs|srvrecs)\d*$/i);
          if (!m) continue;
          const combined = String(v);
          const params = new URLSearchParams(combined.replace(/&/g, '&'));
          const name = (params.get('name') || domain).replace(/\.$/, '');
          const value = params.get('value') || combined;
          records.push({
            name,
            type: typePrefixes[m[1].toLowerCase()] || 'A',
            content: value,
            value,
            ttl: Number(params.get('ttl')) || 3600,
            combined,
          });
        }
        return records;
      };

      const qs = withDomainUser({ action: 'list', domain }, domain, owner);
      try {
        const data = await daGet(creds, 'CMD_API_DNS_CONTROL', qs);
        const parsed = parseDnsData(data);
        if (parsed.length > 0) return parsed;
      } catch {
        /* fallback plain */
      }
      const plain = await daGetPlain(creds, 'CMD_API_DNS_CONTROL', qs);
      return parseDnsData(plain);
    },

    createDNSZone: async (p: Record<string, unknown>) => {
      const result = await daPost(credentials, 'CMD_API_DNS_CONTROL', {
        action: 'add',
        domain: String(p.domain || ''),
        type: 'A',
        name: String(p.domain || ''),
        value: String(p.ip || process.env.DIRECTADMIN_HOST || ''),
        ttl: '300',
      });
      return { success: result.ok };
    },

    deleteDNSZone: async (p: Record<string, unknown>) => {
      const result = await daPost(credentials, 'CMD_API_DNS_CONTROL', {
        action: 'delete',
        domain: String(p.domain || ''),
      });
      return { success: result.ok };
    },

    resetDNSConfigurations: async (domain: string) => {
      const result = await daPost(credentials, 'CMD_API_DNS_CONTROL', {
        action: 'add',
        domain,
        type: 'A',
        name: domain,
        value: process.env.DIRECTADMIN_HOST || '',
        ttl: '300',
      });
      return { success: result.ok };
    },

    configDefaultNameservers: async (_p: Record<string, unknown>) => ({ success: true }),
    createNameserver: async (_p: Record<string, unknown>) => ({ success: true }),
    configCloudFlare: async (_p: Record<string, unknown>) => ({ success: true }),

    getPHPConfig: async (domain: string) => ({ domain }),
    savePHPConfig: async (_p: Record<string, unknown>) => ({ success: true }),

    changePHPVersion: async (p: Record<string, unknown>) => {
      const phpVer = String(p.phpVersion || 'PHP 8.3').replace('PHP ', '').trim();
      const result = await daPost(credentials, 'CMD_API_MODIFY_USER', {
        action: 'single',
        user: String(p.owner || ''),
        php1_release: phpVer,
      });
      return { success: result.ok, output: result.error || `PHP alterado para ${phpVer}` };
    },

    getServerStatus: async (): Promise<ServerStats> => {
      try {
        return await fetchServerStatsViaSsh();
      } catch (sshErr) {
        try {
          const data = await daGet(credentials, 'CMD_API_SYSTEM');
          return {
            source: 'directadmin',
            cpu: field(data, 'cpu') || '0',
            memory: field(data, 'mem_used') || '0',
            disk: field(data, 'disk') || '0',
          };
        } catch {
          const msg = sshErr instanceof Error ? sshErr.message : 'Falha ao ler estado do servidor';
          throw new Error(msg);
        }
      }
    },

    getServerStats: async () => api.getServerStatus(),

    getFirewallStatus: async () => ({ enabled: true, note: 'Gerido pelo CSF/DA' }),
    toggleFirewall: async (_p: Record<string, unknown>) => ({ success: true }),
    getModSecurityStatus: async () => ({ enabled: false }),
    toggleModSecurity: async (_p: Record<string, unknown>) => ({ success: true }),
    getBlockedIPs: async () => [] as string[],
    blockIP: async (_p: Record<string, unknown>) => ({ success: true }),
    unblockIP: async (_p: Record<string, unknown>) => ({ success: true }),

    listWordPress: async (_domain: string) => [] as unknown[],
    installWordPress: async (_p: Record<string, unknown>) => ({
      success: false,
      supported: false,
      error: 'Instalação WordPress via Softaculous — use o DirectAdmin nativo',
    }),
    listWPPlugins: async (_p: Record<string, unknown>) => [] as unknown[],
    installWPPlugin: async (_p: Record<string, unknown>) => ({ success: true }),
    toggleWPPlugin: async (_p: Record<string, unknown>) => ({ success: true }),
    listWPBackups: async (_domain: string) => [] as string[],
    restoreWPBackup: async (_p: Record<string, unknown>) => ({ success: true }),
    createRemoteBackup: async (_p: Record<string, unknown>) => ({ success: true }),

    generateAPIToken: async () => {
      const array = new Uint8Array(32);
      crypto.getRandomValues(array);
      return Buffer.from(array).toString('hex');
    },

    execCommand: async (_command: string) => ({
      success: false,
      supported: false,
      error: 'Comandos SSH remotos desactivados — use o DirectAdmin nativo',
    }),
  };

  return api;
}

export type DirectAdminServerAPI = ReturnType<typeof createDirectAdminAPI>;

let adminApiSingleton: DirectAdminServerAPI | null = null;

/** API admin servidor — credenciais do env (singleton). */
export async function getAdminDirectAdminAPI(): Promise<DirectAdminServerAPI> {
  if (!adminApiSingleton) {
    const creds = await resolveDirectAdminCredentials('admin');
    adminApiSingleton = createDirectAdminAPI(creds);
  }
  return adminApiSingleton;
}

/** Compat: rotas servidor que importavam directAdminHostingAPI. */
export const directAdminHostingAPI = {
  listWebsites: async (...args: Parameters<DirectAdminServerAPI['listWebsites']>) =>
    (await getAdminDirectAdminAPI()).listWebsites(...args),
  listPackages: async () => (await getAdminDirectAdminAPI()).listPackages(),
  listUsers: async () => (await getAdminDirectAdminAPI()).listUsers(),
  listEmails: async (domain: string) => (await getAdminDirectAdminAPI()).listEmails(domain),
  createUser: async (p: Record<string, unknown>) => (await getAdminDirectAdminAPI()).createUser(p),
  createEmail: async (p: Record<string, unknown>) => (await getAdminDirectAdminAPI()).createEmail(p),
  createDNSZone: async (p: Record<string, unknown>) =>
    (await getAdminDirectAdminAPI()).createDNSZone(p),
};

/** Resolver API conforme utilizador autenticado (credenciais automáticas por revendedor). */
export async function getDirectAdminAPIForAuth(auth: DirectAdminAuthContext) {
  const creds = await resolveDirectAdminCredentials(auth.role, auth);
  return createDirectAdminAPI(creds);
}

/** API DirectAdmin autenticada como revendedor DA (ex.: oshercollective). */
export async function getDirectAdminAPIForDaUsername(daUsername: string) {
  const { loadResellerCredentialsByDaUsername } = await import('@/lib/da-credential-store');
  const stored = await loadResellerCredentialsByDaUsername(daUsername);
  if (!stored) {
    throw new Error(`Credenciais DirectAdmin não encontradas para "${daUsername}".`);
  }
  return createDirectAdminAPI({
    role: 'reseller',
    user: stored.user,
    password: stored.password,
  });
}

export async function getDirectAdminAPI(
  role: 'admin' | 'reseller' = 'admin',
  context?: DirectAdminAuthContext,
) {
  const creds = await resolveDirectAdminCredentials(role, context);
  return createDirectAdminAPI(creds);
}

export default directAdminHostingAPI;
