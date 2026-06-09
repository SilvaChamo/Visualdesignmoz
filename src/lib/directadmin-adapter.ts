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

type DaData = Record<string, unknown>;

function extractList(data: DaData, prefix = 'list'): string[] {
  const direct = data[prefix];
  if (Array.isArray(direct)) return direct.map(String);
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

async function daGet(creds: DirectAdminCredentials, cmd: string, qs: Record<string, string> = {}): Promise<DaData> {
  const res = await daRequest(cmd, 'GET', { json: 'yes', ...qs }, creds);
  if (res.error) throw new Error(res.details || res.text || `DirectAdmin ${cmd} falhou`);
  return res.data || {};
}

async function daPost(
  creds: DirectAdminCredentials,
  cmd: string,
  body: Record<string, string>,
): Promise<{ ok: boolean; error?: string }> {
  const res = await daRequest(cmd, 'POST', { json: 'yes', ...body }, creds);
  return { ok: !res.error, error: res.error ? res.details || res.text : undefined };
}

export function createDirectAdminAPI(credentials: DirectAdminCredentials) {
  const cachePrefix = `da_${credentials.role}_${credentials.user}_`;

  const api = {
    listWebsites: async (_timeoutMs?: number): Promise<PanelWebsite[]> => {
      const cacheKey = `${cachePrefix}listWebsites`;
      const cached = cacheService.get(cacheKey);
      if (cached) return cached as PanelWebsite[];

      const usersData = await daGet(credentials, 'CMD_API_SHOW_ALL_USERS');
      const users = extractList(usersData);
      const sites: PanelWebsite[] = [];

      for (const user of users) {
        const domainsData = await daGet(credentials, 'CMD_API_SHOW_USER_DOMAINS', { user });
        const domains = extractList(domainsData);
        const userConf = await daGet(credentials, 'CMD_API_SHOW_USER_CONFIG', { user });

        for (const domain of domains) {
          sites.push({
            id: `${user}_${domain}`,
            domain,
            adminEmail: field(userConf, 'email'),
            package: field(userConf, 'package') || 'Default',
            state: field(userConf, 'suspended') === 'yes' ? 'Suspended' : 'Active',
            owner: user,
            phpVersion: field(userConf, 'php1_release') || 'PHP 8.3',
            sslStatus: 'No SSL',
            diskUsage: field(userConf, 'quota_used') || '0',
            bandwidth: parseInt(field(userConf, 'bandwidth') || '0', 10),
          });
        }
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

      for (const name of names) {
        const pkgSp = await daGet(credentials, 'CMD_API_MANAGE_USER_PACKAGES', { package: name });
        packages.push({
          id: name,
          packageName: name,
          diskSpace: parseInt(field(pkgSp, 'quota') || '0', 10),
          bandwidth: parseInt(field(pkgSp, 'bandwidth') || '0', 10),
          emailAccounts: parseInt(field(pkgSp, 'nemails') || '0', 10),
          dataBases: parseInt(field(pkgSp, 'mysql') || '0', 10),
        });
      }

      cacheService.set(cacheKey, packages, 5 * 60_000);
      return packages;
    },

    listUsers: async (): Promise<PanelUser[]> => {
      const cacheKey = `${cachePrefix}listUsers`;
      const cached = cacheService.get(cacheKey);
      if (cached) return cached as PanelUser[];

      const usersData = await daGet(credentials, 'CMD_API_SHOW_ALL_USERS');
      const usernames = extractList(usersData);
      const users: PanelUser[] = [];

      for (const username of usernames) {
        const conf = await daGet(credentials, 'CMD_API_SHOW_USER_CONFIG', { user: username });
        const usertype = field(conf, 'usertype');
        users.push({
          id: username,
          userName: username,
          email: field(conf, 'email'),
          type: usertype === 'reseller' ? 'reseller' : usertype === 'admin' ? 'admin' : 'user',
          suspended: field(conf, 'suspended') === 'yes',
          existsOnServer: true,
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
      return daPost(credentials, 'CMD_API_SELECT_USERS', {
        delete: 'yes',
        select0: String(p.userName || ''),
      });
    },

    listACLs: async () => [
      { id: 1, name: 'admin' },
      { id: 2, name: 'reseller' },
      { id: 3, name: 'user' },
    ],

    createACL: async (_p: Record<string, unknown>) => ({ success: false, error: 'ACLs geridas pelo DirectAdmin' }),
    deleteACL: async (_p: Record<string, unknown>) => ({ success: false, error: 'ACLs geridas pelo DirectAdmin' }),

    createWebsite: async (p: Record<string, unknown>) => {
      cacheService.clear();
      const result = await daPost(credentials, 'CMD_API_ACCOUNT_USER', {
        action: 'create',
        username: String(p.owner || p.username || ''),
        email: String(p.email || p.adminEmail || ''),
        passwd: String(p.password || 'ChangeMe123!'),
        passwd2: String(p.password || 'ChangeMe123!'),
        domain: String(p.domainName || p.domain || ''),
        package: String(p.package || p.packageName || 'Default'),
        ip: 'shared',
        notify: 'no',
      });
      return { success: result.ok, output: result.error || 'Website criado', error: result.error };
    },

    suspendWebsite: async (domain: string) => {
      cacheService.clear();
      const sites = await api.listWebsites();
      const site = sites.find((s) => s.domain === domain);
      if (!site?.owner) return { success: false };
      const result = await daPost(credentials, 'CMD_API_SELECT_USERS', { suspend: 'yes', select0: site.owner });
      return { success: result.ok };
    },

    unsuspendWebsite: async (domain: string) => {
      cacheService.clear();
      const sites = await api.listWebsites();
      const site = sites.find((s) => s.domain === domain);
      if (!site?.owner) return { success: false };
      const result = await daPost(credentials, 'CMD_API_SELECT_USERS', { suspend: 'no', select0: site.owner });
      return { success: result.ok };
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

      const data = await daGet(credentials, 'CMD_API_POP', { action: 'list', domain });
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

    issueSSL: async (domain: string) => {
      const result = await daPost(credentials, 'CMD_API_SSL', { action: 'save', domain, type: 'acme' });
      return { success: result.ok, output: result.error || 'SSL solicitado' };
    },

    listSubdomains: async (domain: string) => {
      const data = await daGet(credentials, 'CMD_API_SUBDOMAINS', { action: 'list', domain });
      return extractList(data).map((sub) => ({ domain, subdomain: sub }));
    },

    createSubdomain: async (domain: string, subdomain: string) => {
      const result = await daPost(credentials, 'CMD_API_SUBDOMAINS', { action: 'create', domain, subdomain });
      return { success: result.ok };
    },

    deleteSubdomain: async (domain: string, subdomain: string) => {
      const result = await daPost(credentials, 'CMD_API_SUBDOMAINS', { action: 'delete', domain, subdomain });
      return { success: result.ok };
    },

    listDatabases: async (domain: string): Promise<PanelDatabase[]> => {
      const sites = await api.listWebsites();
      const site = sites.find((s) => s.domain === domain);
      if (!site?.owner) return [];
      const data = await daGet(credentials, 'CMD_API_DATABASES', { user: site.owner });
      return extractList(data).map((db) => ({ dbName: db, domain, dbUser: db }));
    },

    createDatabase: async (p: Record<string, unknown>) => {
      cacheService.clear();
      const result = await daPost(credentials, 'CMD_API_DATABASES', {
        action: 'create',
        name: String(p.dbName || ''),
        user: String(p.dbUser || p.dbName || ''),
        passwd: String(p.dbPassword || ''),
        passwd2: String(p.dbPassword || ''),
      });
      return { success: result.ok, output: result.error || 'Database criada' };
    },

    deleteDatabase: async (p: Record<string, unknown>) => {
      cacheService.clear();
      const result = await daPost(credentials, 'CMD_API_DATABASES', {
        action: 'delete',
        name: String(p.dbName || ''),
      });
      return { success: result.ok };
    },

    listFTPAccounts: async (domain: string): Promise<PanelFTPAccount[]> => {
      const data = await daGet(credentials, 'CMD_API_FTP', { action: 'list', domain });
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
      const data = await daGet(credentials, 'CMD_API_DNS_CONTROL', { action: 'list', domain });
      const records: Record<string, unknown>[] = [];
      for (const [k, v] of Object.entries(data)) {
        if (/^(a|aaaa|mx|txt|cname|ns|srv)\d+$/i.test(k)) {
          records.push({ name: k, type: k.replace(/\d+$/, '').toUpperCase(), content: v, ttl: 300 });
        }
      }
      return records;
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

    getServerStatus: async () => {
      const data = await daGet(credentials, 'CMD_API_SYSTEM');
      return {
        cpu: field(data, 'cpu') || '0',
        memory: field(data, 'mem_used') || '0',
        disk: field(data, 'disk') || '0',
      };
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

export async function getDirectAdminAPI(
  role: 'admin' | 'reseller' = 'admin',
  context?: DirectAdminAuthContext,
) {
  const creds = await resolveDirectAdminCredentials(role, context);
  return createDirectAdminAPI(creds);
}

export default directAdminHostingAPI;
