/**
 * Cliente da camada de hospedagem — browser chama `/api/da` (BFF).
 * Tipos partilhados com o adaptador servidor (`directadmin-adapter.ts`).
 */

import { cacheService } from './cache-service';

const PANEL_API = '/api/da';
const LONG_TIMEOUT = 120_000;

const MUTATION_ACTIONS = new Set([
  'createUser', 'modifyUser', 'deleteUser',
  'createWebsite', 'deleteWebsite', 'suspendWebsite', 'unsuspendWebsite',
  'createPackage', 'modifyPackage', 'editPackage', 'deletePackage',
  'createEmail', 'deleteEmail', 'suspendEmail', 'unsuspendEmail',
  'createSubdomain', 'deleteSubdomain',
  'createDatabase', 'deleteDatabase',
  'createFTPAccount', 'deleteFTPAccount',
  'changeEmailPassword', 'setEmailLimits',
  'addEmailForwarding', 'setCatchAllEmail', 'addPatternForwarding', 'togglePlusAddressing',
  'enableDKIM', 'issueSSL', 'replaceSSL', 'deleteSSL', 'cancelSslRenewal', 'setForceSsl',
  'createDNSZone', 'deleteDNSZone', 'resetDNSConfigurations',
  'changePHPVersion', 'savePHPConfig',
  'toggleFirewall', 'toggleModSecurity', 'blockIP', 'unblockIP',
  'installWordPress', 'installWPPlugin', 'toggleWPPlugin',
  'restoreWPBackup', 'createRemoteBackup',
]);

export interface PanelWebsite {
  id: string | number;
  domain: string;
  adminEmail?: string;
  package?: string;
  state?: string;
  owner?: string;
  status?: string;
  diskUsage?: number | string;
  bandwidth?: number;
  ssl?: boolean;
  sslStatus?: 'Secure' | 'No SSL' | string;
  phpVersion?: string;
  ip?: string;
  isActive?: boolean;
  hasWordPress?: boolean;
  hasNextJs?: boolean;
  hasBasicSite?: boolean;
  siteType?: 'wordpress' | 'nextjs' | 'html' | 'empty';
}

export interface PanelPackage {
  id: string | number;
  packageName: string;
  diskSpace?: number | string;
  bandwidth?: number | string;
  emailAccounts?: number | string;
  dataBases?: number | string;
  ftpAccounts?: number | string;
  allowedDomains?: number | string;
}

export interface PanelUser {
  id: string | number;
  userName: string;
  email?: string;
  type?: string;
  suspended?: boolean;
  existsOnServer?: boolean;
  firstName?: string;
  lastName?: string;
  acl?: string;
  websitesLimit?: number;
  emailsLimit?: number;
  status?: string;
  registeredAt?: string;
  parentUsername?: string;
  diskUsedMb?: number;
  bandwidthUsedMb?: number;
  quotaLimitMb?: number | null;
  bandwidthLimitMb?: number | null;
  packageName?: string;
}

export interface PanelSubdomain {
  id?: string | number;
  domain: string;
  subdomain: string;
  path?: string;
}

export interface PanelDatabase {
  id?: string | number;
  dbName: string;
  dbUser?: string;
  domain?: string;
}

export interface PanelFTPAccount {
  id?: string | number;
  username: string;
  userName?: string;
  [key: string]: unknown;
  domain?: string;
  path?: string;
}

export interface PanelEmailAccount {
  id?: string | number;
  email: string;
  domain?: string;
  quota?: number;
  quota_mb?: number;
  usage?: string;
  status?: 'active' | 'suspended' | 'deleted';
  cliente_id?: string | null;
}

export interface PanelPHPConfig {
  domain: string;
  phpVersion?: string;
}

export interface HostingCommandResult {
  success?: boolean;
  error?: string;
  record?: string;
  publicKey?: string;
  output?: string;
  disabled?: boolean;
  message?: string;
  supported?: boolean;
  [key: string]: unknown;
}

async function run<T = HostingCommandResult>(
  action: string,
  params: Record<string, unknown> = {},
  timeoutMs = 60_000,
): Promise<T> {
  const isMutation = MUTATION_ACTIONS.has(action);
  const cacheKey = `directadmin_${action}_${JSON.stringify(params)}`;

  if (!isMutation) {
    const cached = cacheService.get<T>(cacheKey);
    if (cached) return cached;
  } else {
    cacheService.clear();
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(new Error(`Timeout: ${action} demorou mais de ${timeoutMs}ms`)),
    timeoutMs,
  );

  try {
    const res = await fetch(PANEL_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, params, timeoutMs }),
      signal: controller.signal,
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.error || `HTTP ${res.status}`);
    }

    if (!isMutation) {
      const ttl = action.includes('list') ? 5 * 60_000 : 60_000;
      cacheService.set(cacheKey, json.data, ttl);
    }

    return json.data as T;
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Pedido expirou após ${timeoutMs / 1000}s`);
    }
    const message = error instanceof Error ? error.message : 'Pedido DirectAdmin falhou';
    if (process.env.NODE_ENV === 'development') {
      console.warn(`[DIRECTADMIN CLIENT] ${action}:`, message);
    }
    throw error instanceof Error ? error : new Error(message);
  } finally {
    clearTimeout(timeoutId);
  }
}

export const panelHostingAPI = {
  listWebsites: (timeoutMs?: number) => run<PanelWebsite[]>('listWebsites', {}, timeoutMs),
  listPackages: () => run<PanelPackage[]>('listPackages'),
  listUsers: () => run<PanelUser[]>('listUsers'),
  createPackage: (params: unknown) => run('createPackage', params as Record<string, unknown>, LONG_TIMEOUT),
  modifyPackage: (params: unknown) => run('modifyPackage', params as Record<string, unknown>, LONG_TIMEOUT),
  deletePackage: (packageName: string) => run('deletePackage', { packageName }, LONG_TIMEOUT),
  createWebsite: (params: unknown) => run('createWebsite', params as Record<string, unknown>, LONG_TIMEOUT),
  suspendWebsite: (domain: string) => run('suspendWebsite', { domain }),
  unsuspendWebsite: (domain: string) => run('unsuspendWebsite', { domain }),
  deleteWebsite: (domain: string) => run('deleteWebsite', { domain }, LONG_TIMEOUT),
  modifyWebsite: (params: unknown) => run('modifyWebsite', params as Record<string, unknown>, LONG_TIMEOUT),

  listSubdomains: (domain: string) => run<PanelSubdomain[]>('listSubdomains', { domain }),
  createSubdomain: (domain: string, subdomain: string) => run('createSubdomain', { domain, subdomain }),
  deleteSubdomain: (domain: string, subdomain: string) => run('deleteSubdomain', { domain, subdomain }),

  listDatabases: (domain: string) => run<PanelDatabase[]>('listDatabases', { domain }),
  createDatabase: (params: unknown) => run('createDatabase', params as Record<string, unknown>),
  deleteDatabase: (params: unknown) => run('deleteDatabase', params as Record<string, unknown>),

  listFTPAccounts: (domain: string) => run<PanelFTPAccount[]>('listFTPAccounts', { domain }),
  createFTPAccount: (params: unknown) => run('createFTPAccount', params as Record<string, unknown>),
  deleteFTPAccount: (params: unknown) => run('deleteFTPAccount', params as Record<string, unknown>),

  listEmails: (domain: string) => run<PanelEmailAccount[]>('listEmails', { domain }),
  createEmail: (params: unknown) => run('createEmail', params as Record<string, unknown>),
  deleteEmail: (params: unknown) => run('deleteEmail', params as Record<string, unknown>),
  suspendEmail: (email: string) => run('suspendEmail', { email }),
  unsuspendEmail: (email: string) => run('unsuspendEmail', { email }),
  changeEmailPassword: (params: unknown) => run('changeEmailPassword', params as Record<string, unknown>),
  setEmailLimits: (params: unknown) => run('setEmailLimits', params as Record<string, unknown>),
  getEmailForwarding: (params: unknown) => run<string[]>('getEmailForwarding', params as Record<string, unknown>),
  addEmailForwarding: (params: unknown) => run('addEmailForwarding', params as Record<string, unknown>),
  getCatchAllEmail: (domain: string) => run<string>('getCatchAllEmail', { domain }),
  setCatchAllEmail: (params: unknown) => run('setCatchAllEmail', params as Record<string, unknown>),
  getPatternForwarding: (domain: string) => run<Record<string, unknown>[]>('getPatternForwarding', { domain }),
  addPatternForwarding: (params: unknown) => run('addPatternForwarding', params as Record<string, unknown>),
  getPlusAddressing: (domain: string) => run<boolean>('getPlusAddressing', { domain }),
  togglePlusAddressing: (params: unknown) => run('togglePlusAddressing', params as Record<string, unknown>),
  enableDKIM: (domain: string) => run('enableDKIM', { domain }),
  getDKIMStatus: (domain: string) => run<HostingCommandResult>('getDKIMStatus', { domain }),

  issueSSL: (domain: string, options?: { force?: boolean; renew?: boolean; autoRenewDays?: string }) =>
    run('issueSSL', { domain, ...options }, LONG_TIMEOUT),
  replaceSSL: (domain: string) => run('replaceSSL', { domain }, LONG_TIMEOUT),
  deleteSSL: (domain: string) => run('deleteSSL', { domain }, LONG_TIMEOUT),
  cancelSslRenewal: (domain: string) => run('cancelSslRenewal', { domain }, LONG_TIMEOUT),
  setForceSsl: (domain: string, enabled = true) => run('setForceSsl', { domain, enabled }, LONG_TIMEOUT),
  getSslCertificate: (hostname: string) => run('getSslCertificate', { hostname }, LONG_TIMEOUT),
  getPHPConfig: (domain: string) => run<PanelPHPConfig>('getPHPConfig', { domain }),
  savePHPConfig: (params: unknown) => run('savePHPConfig', params as Record<string, unknown>),
  changePHPVersion: (params: unknown) => run('changePHPVersion', params as Record<string, unknown>, LONG_TIMEOUT),

  getServerStatus: () => run('serverStats'),
  getServerStats: () => run('serverStats'),
  getFirewallStatus: () => run<boolean>('getFirewallStatus'),
  toggleFirewall: (params: unknown) => run('toggleFirewall', params as Record<string, unknown>),
  getModSecurityStatus: () => run<boolean>('getModSecurityStatus'),
  toggleModSecurity: (params: unknown) => run('toggleModSecurity', params as Record<string, unknown>),
  getBlockedIPs: () => run<string[]>('getBlockedIPs'),
  blockIP: (params: unknown) => run('blockIP', params as Record<string, unknown>),
  unblockIP: (params: unknown) => run('unblockIP', params as Record<string, unknown>),

  createUser: (params: unknown) => run('createUser', params as Record<string, unknown>, LONG_TIMEOUT),
  modifyUser: (params: unknown) => run('modifyUser', params as Record<string, unknown>, LONG_TIMEOUT),
  deleteUser: (params: unknown) => run('deleteUser', params as Record<string, unknown>, LONG_TIMEOUT),
  listACLs: () => run<string[]>('listACLs'),
  createACL: (params: unknown) => run('createACL', params as Record<string, unknown>),
  deleteACL: (params: unknown) => run('deleteACL', params as Record<string, unknown>),

  listWordPress: (domain: string) => run<unknown[]>('listWordPress', { domain }),
  installWordPress: (params: unknown) => run('installWordPress', params as Record<string, unknown>, LONG_TIMEOUT),
  listWPPlugins: (params: unknown) => run<unknown[]>('listWPPlugins', params as Record<string, unknown>),
  installWPPlugin: (params: unknown) => run('installWPPlugin', params as Record<string, unknown>, LONG_TIMEOUT),
  toggleWPPlugin: (params: unknown) => run('toggleWPPlugin', params as Record<string, unknown>),
  listWPBackups: (domain: string) => run<string[]>('listWPBackups', { domain }),
  restoreWPBackup: (params: unknown) => run('restoreWPBackup', params as Record<string, unknown>, LONG_TIMEOUT),
  createRemoteBackup: (params: unknown) => run('createRemoteBackup', params as Record<string, unknown>, LONG_TIMEOUT),

  configDefaultNameservers: (params: unknown) => run('configDefaultNameservers', params as Record<string, unknown>),
  createNameserver: (params: unknown) => run('createNameserver', params as Record<string, unknown>),
  createDNSZone: (params: unknown) => run('createDNSZone', params as Record<string, unknown>),
  deleteDNSZone: (params: unknown) => run('deleteDNSZone', params as Record<string, unknown>),
  resetDNSConfigurations: (domain: string) => run('resetDNSConfigurations', { domain }),
  configCloudFlare: (params: unknown) => run('configCloudFlare', params as Record<string, unknown>),
  listDNS: (domain: string) => run<unknown[]>('listDNS', { domain }),

  generateAPIToken: () => run<string | null>('generateAPIToken'),
  execCommand: (command: string) =>
    run<HostingCommandResult>('execCommand', { command }),
};

export const directAdminHostingAPI = panelHostingAPI;
export default panelHostingAPI;
