/**
 * Cliente do painel de hospedagem (legado).
 * Integração com DirectAdmin / painéis externos está DESACTIVADA — não há chamadas de rede.
 * Tipos mantêm aliases históricos (DirectAdmin*) via `@/lib/directadmin-api`.
 */

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

/** @deprecated Use PanelWebsite */
export type CyberPanelWebsite = PanelWebsite;

export interface PanelPackage {
  id: string | number;
  packageName: string;
  diskSpace?: number;
  bandwidth?: number;
  emailAccounts?: number;
  dataBases?: number;
}

/** @deprecated Use PanelPackage */
export type CyberPanelPackage = PanelPackage;

export interface PanelUser {
  id: string | number;
  userName: string;
  email?: string;
  type?: string;
  suspended?: boolean;
  existsOnServer?: boolean;
}

/** @deprecated Use PanelUser */
export type CyberPanelUser = PanelUser;

export interface PanelSubdomain {
  id?: string | number;
  domain: string;
  subdomain: string;
  path?: string;
}

/** @deprecated Use PanelSubdomain */
export type CyberPanelSubdomain = PanelSubdomain;

export interface PanelDatabase {
  id?: string | number;
  dbName: string;
  dbUser?: string;
  domain?: string;
}

/** @deprecated Use PanelDatabase */
export type CyberPanelDatabase = PanelDatabase;

export interface PanelFTPAccount {
  id?: string | number;
  username: string;
  userName?: string;
  [key: string]: unknown;
  domain?: string;
  path?: string;
}

/** @deprecated Use PanelFTPAccount */
export type CyberPanelFTPAccount = PanelFTPAccount;

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

/** @deprecated Use PanelEmailAccount */
export type CyberPanelEmail = PanelEmailAccount;

export interface PanelPHPConfig {
  domain: string;
  phpVersion?: string;
}

/** @deprecated Use PanelPHPConfig */
export type CyberPanelPHPConfig = PanelPHPConfig;

const EMPTY_LIST = new Set([
  'listWebsites',
  'listPackages',
  'listUsers',
  'listSubdomains',
  'listDatabases',
  'listFTPAccounts',
  'listEmails',
  'listACLs',
  'listWordPress',
  'listWPPlugins',
  'listWPBackups',
  'listDNS',
  'getBlockedIPs',
]);

const EMPTY_OBJECT = new Set([
  'getEmailForwarding',
  'getCatchAllEmail',
  'getPatternForwarding',
  'getPlusAddressing',
  'getPHPConfig',
  'getDKIMStatus',
  'getFirewallStatus',
  'getModSecurityStatus',
]);

async function run(action: string): Promise<unknown> {
  if (EMPTY_LIST.has(action)) return [];
  if (EMPTY_OBJECT.has(action)) return {};
  if (action === 'serverStats' || action === 'serverStatus') {
    return { disabled: true, message: 'Sem métricas de hospedagem externa.' };
  }
  if (action === 'generateAPIToken') return null;

  throw new Error(
    'Operação desactivada: a gestão de domínios, DNS e email passa a ser feita dentro deste painel (sem ligação a painéis de hospedagem externos).'
  );
}

export const panelHostingAPI = {
  listWebsites: (timeoutMs?: number) => run('listWebsites'),
  listPackages: () => run('listPackages'),
  listUsers: () => run('listUsers'),
  createWebsite: (_params: unknown) => run('createWebsite'),
  suspendWebsite: (_domain: string) => run('suspendWebsite'),
  unsuspendWebsite: (_domain: string) => run('unsuspendWebsite'),
  deleteWebsite: (_domain: string) => run('deleteWebsite'),
  modifyWebsite: (_params: unknown) => run('modifyWebsite'),

  listSubdomains: (_domain: string) => run('listSubdomains'),
  createSubdomain: (_domain: string, _subdomain: string) => run('createSubdomain'),
  deleteSubdomain: (_domain: string, _subdomain: string) => run('deleteSubdomain'),

  listDatabases: (_domain: string) => run('listDatabases'),
  createDatabase: (_params: unknown) => run('createDatabase'),
  deleteDatabase: (_params: unknown) => run('deleteDatabase'),

  listFTPAccounts: (_domain: string) => run('listFTPAccounts'),
  createFTPAccount: (_params: unknown) => run('createFTPAccount'),
  deleteFTPAccount: (_params: unknown) => run('deleteFTPAccount'),

  listEmails: (_domain: string) => run('listEmails'),
  createEmail: (_params: unknown) => run('createEmail'),
  deleteEmail: (_params: unknown) => run('deleteEmail'),
  suspendEmail: (_email: string) => run('suspendEmail'),
  unsuspendEmail: (_email: string) => run('unsuspendEmail'),
  changeEmailPassword: (_params: unknown) => run('changeEmailPassword'),
  setEmailLimits: (_params: unknown) => run('setEmailLimits'),
  getEmailForwarding: (_params: unknown) => run('getEmailForwarding'),
  addEmailForwarding: (_params: unknown) => run('addEmailForwarding'),
  getCatchAllEmail: (_domain: string) => run('getCatchAllEmail'),
  setCatchAllEmail: (_params: unknown) => run('setCatchAllEmail'),
  getPatternForwarding: (_domain: string) => run('getPatternForwarding'),
  addPatternForwarding: (_params: unknown) => run('addPatternForwarding'),
  getPlusAddressing: (_domain: string) => run('getPlusAddressing'),
  togglePlusAddressing: (_params: unknown) => run('togglePlusAddressing'),
  enableDKIM: (_domain: string) => run('enableDKIM'),
  getDKIMStatus: (_domain: string) => run('getDKIMStatus'),

  issueSSL: (_domain: string) => run('issueSSL'),
  getPHPConfig: (_domain: string) => run('getPHPConfig'),
  savePHPConfig: (_params: unknown) => run('savePHPConfig'),
  changePHPVersion: (_params: unknown) => run('changePHPVersion'),

  getServerStatus: () => run('serverStats'),
  getServerStats: () => run('serverStats'),
  getFirewallStatus: () => run('getFirewallStatus'),
  toggleFirewall: (_params: unknown) => run('toggleFirewall'),
  getModSecurityStatus: () => run('getModSecurityStatus'),
  toggleModSecurity: (_params: unknown) => run('toggleModSecurity'),
  getBlockedIPs: () => run('getBlockedIPs'),
  blockIP: (_params: unknown) => run('blockIP'),
  unblockIP: (_params: unknown) => run('unblockIP'),

  createUser: (_params: unknown) => run('createUser'),
  modifyUser: (_params: unknown) => run('modifyUser'),
  deleteUser: (_params: unknown) => run('deleteUser'),
  listACLs: () => run('listACLs'),
  createACL: (_params: unknown) => run('createACL'),
  deleteACL: (_params: unknown) => run('deleteACL'),

  listWordPress: (_domain: string) => run('listWordPress'),
  installWordPress: (_params: unknown) => run('installWordPress'),
  listWPPlugins: (_params: unknown) => run('listWPPlugins'),
  installWPPlugin: (_params: unknown) => run('installWPPlugin'),
  toggleWPPlugin: (_params: unknown) => run('toggleWPPlugin'),
  listWPBackups: (_domain: string) => run('listWPBackups'),
  restoreWPBackup: (_params: unknown) => run('restoreWPBackup'),
  createRemoteBackup: (_params: unknown) => run('createRemoteBackup'),

  configDefaultNameservers: (_params: unknown) => run('configDefaultNameservers'),
  createNameserver: (_params: unknown) => run('createNameserver'),
  createDNSZone: (_params: unknown) => run('createDNSZone'),
  deleteDNSZone: (_params: unknown) => run('deleteDNSZone'),
  resetDNSConfigurations: (_domain: string) => run('resetDNSConfigurations'),
  configCloudFlare: (_params: unknown) => run('configCloudFlare'),
  listDNS: (_domain: string) => run('listDNS'),

  generateAPIToken: () => run('generateAPIToken'),
  execCommand: (_command: string) =>
    Promise.resolve({
      success: false,
      supported: false,
      error: 'Comandos remotos no servidor de hospedagem estão desactivados.',
    }),
};

/** Alias histórico — mesmo objecto que `panelHostingAPI`. */
export const cyberPanelAPI = panelHostingAPI;

export default panelHostingAPI;
