import { cacheService } from './cache-service';

const PANEL_API = '/api/da';
const LONG_TIMEOUT = 120000;

const MUTATION_ACTIONS = new Set([
  'createUser',
  'modifyUser',
  'deleteUser',
  'createWebsite',
  'deleteWebsite',
  'suspendWebsite',
  'unsuspendWebsite',
  'createEmail',
  'deleteEmail',
  'suspendEmail',
  'unsuspendEmail',
  'createSubdomain',
  'deleteSubdomain',
  'createDatabase',
  'deleteDatabase',
  'createFTPAccount',
  'deleteFTPAccount',
  'changeEmailPassword',
  'setEmailLimits',
  'addEmailForwarding',
  'setCatchAllEmail',
  'addPatternForwarding',
  'togglePlusAddressing',
  'enableDKIM',
  'issueSSL',
  'createDNSZone',
  'deleteDNSZone',
  'resetDNSConfigurations',
  'changePHPVersion',
  'savePHPConfig',
  'toggleFirewall',
  'toggleModSecurity',
  'blockIP',
  'unblockIP',
  'installWordPress',
  'installWPPlugin',
  'toggleWPPlugin',
  'restoreWPBackup',
  'createRemoteBackup',
]);

async function run(action: string, params: Record<string, any> = {}, timeoutMs: number = 60000) {
  const isMutation = MUTATION_ACTIONS.has(action);
  const cacheKey = `directadmin_${action}_${JSON.stringify(params)}`;

  if (!isMutation) {
    const cached = cacheService.get(cacheKey);
    if (cached) return cached;
  } else {
    cacheService.clear();
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(new Error(`Timeout: ${action} demorou mais de ${timeoutMs}ms`)),
    timeoutMs
  );

  try {
    const res = await fetch(PANEL_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, params, timeoutMs }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Pedido DirectAdmin falhou');

    if (!isMutation) {
      const ttl = action.includes('list') ? 5 * 60 * 1000 : 60 * 1000;
      cacheService.set(cacheKey, json.data, ttl);
    }

    return json.data;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error(`Pedido expirou após ${timeoutMs / 1000}s`);
    }
    console.error(`[DIRECTADMIN API ERROR] ${action}:`, error.message);
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export interface CyberPanelWebsite {
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

export interface CyberPanelPackage {
  id: string | number;
  packageName: string;
  diskSpace?: number;
  bandwidth?: number;
  emailAccounts?: number;
  dataBases?: number;
}

export interface CyberPanelUser {
  id: string | number;
  userName: string;
  email?: string;
  type?: string;
  suspended?: boolean;
  existsOnServer?: boolean;
}

export interface CyberPanelSubdomain {
  id?: string | number;
  domain: string;
  subdomain: string;
  path?: string;
}

export interface CyberPanelDatabase {
  id?: string | number;
  dbName: string;
  dbUser?: string;
  domain?: string;
}

export interface CyberPanelFTPAccount {
  id?: string | number;
  username: string;
  userName?: string;
  [key: string]: any;
  domain?: string;
  path?: string;
}

export interface CyberPanelEmail {
  id?: string | number;
  email: string;
  domain?: string;
  quota?: number;
  quota_mb?: number;
  usage?: string;
  status?: 'active' | 'suspended' | 'deleted';
  cliente_id?: string | null;
}

export interface CyberPanelPHPConfig {
  domain: string;
  phpVersion?: string;
}

export const cyberPanelAPI = {
  listWebsites: (timeoutMs?: number) => run('listWebsites', {}, timeoutMs),
  listPackages: () => run('listPackages'),
  listUsers: () => run('listUsers'),
  createWebsite: (params: any) => run('createWebsite', params, LONG_TIMEOUT),
  suspendWebsite: (domain: string) => run('suspendWebsite', { domain }),
  unsuspendWebsite: (domain: string) => run('unsuspendWebsite', { domain }),
  deleteWebsite: (domain: string) => run('deleteWebsite', { domain }, LONG_TIMEOUT),
  modifyWebsite: (params: any) => run('modifyWebsite', params, LONG_TIMEOUT),

  listSubdomains: (domain: string) => run('listSubdomains', { domain }),
  createSubdomain: (domain: string, subdomain: string) => run('createSubdomain', { domain, subdomain }),
  deleteSubdomain: (domain: string, subdomain: string) => run('deleteSubdomain', { domain, subdomain }),

  listDatabases: (domain: string) => run('listDatabases', { domain }),
  createDatabase: (params: any) => run('createDatabase', params),
  deleteDatabase: (params: any) => run('deleteDatabase', params),

  listFTPAccounts: (domain: string) => run('listFTPAccounts', { domain }),
  createFTPAccount: (params: any) => run('createFTPAccount', params),
  deleteFTPAccount: (params: any) => run('deleteFTPAccount', params),

  listEmails: (domain: string) => run('listEmails', { domain }),
  createEmail: (params: any) => run('createEmail', params),
  deleteEmail: (params: any) => run('deleteEmail', params),
  suspendEmail: (email: string) => run('suspendEmail', { email }),
  unsuspendEmail: (email: string) => run('unsuspendEmail', { email }),
  changeEmailPassword: (params: any) => run('changeEmailPassword', params),
  setEmailLimits: (params: any) => run('setEmailLimits', params),
  getEmailForwarding: (params: any) => run('getEmailForwarding', params),
  addEmailForwarding: (params: any) => run('addEmailForwarding', params),
  getCatchAllEmail: (domain: string) => run('getCatchAllEmail', { domain }),
  setCatchAllEmail: (params: any) => run('setCatchAllEmail', params),
  getPatternForwarding: (domain: string) => run('getPatternForwarding', { domain }),
  addPatternForwarding: (params: any) => run('addPatternForwarding', params),
  getPlusAddressing: (domain: string) => run('getPlusAddressing', { domain }),
  togglePlusAddressing: (params: any) => run('togglePlusAddressing', params),
  enableDKIM: (domain: string) => run('enableDKIM', { domain }),
  getDKIMStatus: (domain: string) => run('getDKIMStatus', { domain }),

  issueSSL: (domain: string) => run('issueSSL', { domain }, LONG_TIMEOUT),
  getPHPConfig: (domain: string) => run('getPHPConfig', { domain }),
  savePHPConfig: (params: any) => run('savePHPConfig', params),
  changePHPVersion: (params: any) => run('changePHPVersion', params, LONG_TIMEOUT),

  getServerStatus: () => run('serverStats'),
  getServerStats: () => run('serverStats'),
  getFirewallStatus: () => run('getFirewallStatus'),
  toggleFirewall: (params: any) => run('toggleFirewall', params),
  getModSecurityStatus: () => run('getModSecurityStatus'),
  toggleModSecurity: (params: any) => run('toggleModSecurity', params),
  getBlockedIPs: () => run('getBlockedIPs'),
  blockIP: (params: any) => run('blockIP', params),
  unblockIP: (params: any) => run('unblockIP', params),

  createUser: (params: any) => run('createUser', params, LONG_TIMEOUT),
  modifyUser: (params: any) => run('modifyUser', params, LONG_TIMEOUT),
  deleteUser: (params: any) => run('deleteUser', params, LONG_TIMEOUT),
  listACLs: () => run('listACLs'),
  createACL: (params: any) => run('createACL', params),
  deleteACL: (params: any) => run('deleteACL', params),

  listWordPress: (domain: string) => run('listWordPress', { domain }),
  installWordPress: (params: any) => run('installWordPress', params, LONG_TIMEOUT),
  listWPPlugins: (params: any) => run('listWPPlugins', params),
  installWPPlugin: (params: any) => run('installWPPlugin', params, LONG_TIMEOUT),
  toggleWPPlugin: (params: any) => run('toggleWPPlugin', params),
  listWPBackups: (domain: string) => run('listWPBackups', { domain }),
  restoreWPBackup: (params: any) => run('restoreWPBackup', params, LONG_TIMEOUT),
  createRemoteBackup: (params: any) => run('createRemoteBackup', params, LONG_TIMEOUT),

  configDefaultNameservers: (params: any) => run('configDefaultNameservers', params),
  createNameserver: (params: any) => run('createNameserver', params),
  createDNSZone: (params: any) => run('createDNSZone', params),
  deleteDNSZone: (params: any) => run('deleteDNSZone', params),
  resetDNSConfigurations: (domain: string) => run('resetDNSConfigurations', { domain }),
  configCloudFlare: (params: any) => run('configCloudFlare', params),
  listDNS: (domain: string) => run('listDNS', { domain }),

  generateAPIToken: () => run('generateAPIToken'),
  execCommand: (_command: string) =>
    Promise.resolve({
      success: false,
      supported: false,
      error: 'Comandos SSH diretos foram desativados na migração para DirectAdmin',
    }),
};

export default cyberPanelAPI;
