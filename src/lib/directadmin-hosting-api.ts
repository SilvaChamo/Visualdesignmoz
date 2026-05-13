/**
 * Cliente da camada de hospedagem usada pelo painel (nomenclatura DirectAdmin).
 * As operações estão desactivadas no stub — não há chamadas de rede aqui.
 * Tipos públicos expostos como DirectAdmin* via `@/lib/directadmin-api`.
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

export interface PanelPackage {
  id: string | number;
  packageName: string;
  diskSpace?: number;
  bandwidth?: number;
  emailAccounts?: number;
  dataBases?: number;
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

/** Resultado genérico de comandos do stub (evita `{}` literal em strict mode). */
export interface HostingCommandResult {
  success?: boolean;
  error?: string;
  record?: string;
  publicKey?: string;
  /** Saída textual (ex.: CLI) quando o painel devolve detalhes de erro. */
  output?: string;
  disabled?: boolean;
  message?: string;
  supported?: boolean;
  [key: string]: unknown;
}

async function run(action: string): Promise<HostingCommandResult> {
  if (action === 'serverStats' || action === 'serverStatus') {
    return { disabled: true, message: 'Sem métricas de hospedagem externa.' };
  }

  throw new Error(
    'Operação desactivada: a gestão de domínios, DNS e email passa a ser feita dentro deste painel (sem ligação a painéis de hospedagem externos).'
  );
}

function emptyList<T>(): Promise<T[]> {
  return Promise.resolve([]);
}

export const panelHostingAPI = {
  listWebsites: (_timeoutMs?: number): Promise<PanelWebsite[]> => emptyList<PanelWebsite>(),
  listPackages: (): Promise<PanelPackage[]> => emptyList<PanelPackage>(),
  listUsers: (): Promise<PanelUser[]> => emptyList<PanelUser>(),
  createWebsite: (_params: unknown) => run('createWebsite'),
  suspendWebsite: (_domain: string) => run('suspendWebsite'),
  unsuspendWebsite: (_domain: string) => run('unsuspendWebsite'),
  deleteWebsite: (_domain: string) => run('deleteWebsite'),
  modifyWebsite: (_params: unknown) => run('modifyWebsite'),

  listSubdomains: (_domain: string): Promise<PanelSubdomain[]> => emptyList<PanelSubdomain>(),
  createSubdomain: (_domain: string, _subdomain: string) => run('createSubdomain'),
  deleteSubdomain: (_domain: string, _subdomain: string) => run('deleteSubdomain'),

  listDatabases: (_domain: string): Promise<PanelDatabase[]> => emptyList<PanelDatabase>(),
  createDatabase: (_params: unknown) => run('createDatabase'),
  deleteDatabase: (_params: unknown) => run('deleteDatabase'),

  listFTPAccounts: (_domain: string): Promise<PanelFTPAccount[]> => emptyList<PanelFTPAccount>(),
  createFTPAccount: (_params: unknown) => run('createFTPAccount'),
  deleteFTPAccount: (_params: unknown) => run('deleteFTPAccount'),

  listEmails: (_domain: string): Promise<PanelEmailAccount[]> => emptyList<PanelEmailAccount>(),
  createEmail: (_params: unknown) => run('createEmail'),
  deleteEmail: (_params: unknown) => run('deleteEmail'),
  suspendEmail: (_email: string) => run('suspendEmail'),
  unsuspendEmail: (_email: string) => run('unsuspendEmail'),
  changeEmailPassword: (_params: unknown) => run('changeEmailPassword'),
  setEmailLimits: (_params: unknown) => run('setEmailLimits'),
  getEmailForwarding: (_params: unknown): Promise<string[]> => emptyList<string>(),
  addEmailForwarding: (_params: unknown) => run('addEmailForwarding'),
  getCatchAllEmail: (_domain: string): Promise<string> => Promise.resolve(''),
  setCatchAllEmail: (_params: unknown) => run('setCatchAllEmail'),
  getPatternForwarding: (_domain: string): Promise<Record<string, unknown>[]> =>
    emptyList<Record<string, unknown>>(),
  addPatternForwarding: (_params: unknown) => run('addPatternForwarding'),
  getPlusAddressing: (_domain: string): Promise<boolean> => Promise.resolve(false),
  togglePlusAddressing: (_params: unknown) => run('togglePlusAddressing'),
  enableDKIM: (_domain: string) => run('enableDKIM'),
  getDKIMStatus: (_domain: string): Promise<HostingCommandResult> => Promise.resolve({ output: '' }),

  issueSSL: (_domain: string) => run('issueSSL'),
  getPHPConfig: (_domain: string): Promise<PanelPHPConfig> =>
    Promise.resolve({ domain: _domain }),
  savePHPConfig: (_params: unknown) => run('savePHPConfig'),
  changePHPVersion: (_params: unknown) => run('changePHPVersion'),

  getServerStatus: () => run('serverStats'),
  getServerStats: () => run('serverStats'),
  getFirewallStatus: (): Promise<boolean> => Promise.resolve(false),
  toggleFirewall: (_params: unknown) => run('toggleFirewall'),
  getModSecurityStatus: (): Promise<boolean> => Promise.resolve(false),
  toggleModSecurity: (_params: unknown) => run('toggleModSecurity'),
  getBlockedIPs: (): Promise<string[]> => emptyList<string>(),
  blockIP: (_params: unknown) => run('blockIP'),
  unblockIP: (_params: unknown) => run('unblockIP'),

  createUser: (_params: unknown) => run('createUser'),
  modifyUser: (_params: unknown) => run('modifyUser'),
  deleteUser: (_params: unknown) => run('deleteUser'),
  listACLs: (): Promise<string[]> => emptyList<string>(),
  createACL: (_params: unknown) => run('createACL'),
  deleteACL: (_params: unknown) => run('deleteACL'),

  listWordPress: (_domain: string): Promise<unknown[]> => emptyList<unknown>(),
  installWordPress: (_params: unknown) => run('installWordPress'),
  listWPPlugins: (_params: unknown): Promise<unknown[]> => emptyList<unknown>(),
  installWPPlugin: (_params: unknown) => run('installWPPlugin'),
  toggleWPPlugin: (_params: unknown) => run('toggleWPPlugin'),
  listWPBackups: (_domain: string): Promise<string[]> => emptyList<string>(),
  restoreWPBackup: (_params: unknown) => run('restoreWPBackup'),
  createRemoteBackup: (_params: unknown) => run('createRemoteBackup'),

  configDefaultNameservers: (_params: unknown) => run('configDefaultNameservers'),
  createNameserver: (_params: unknown) => run('createNameserver'),
  createDNSZone: (_params: unknown) => run('createDNSZone'),
  deleteDNSZone: (_params: unknown) => run('deleteDNSZone'),
  resetDNSConfigurations: (_domain: string) => run('resetDNSConfigurations'),
  configCloudFlare: (_params: unknown) => run('configCloudFlare'),
  listDNS: (_domain: string): Promise<unknown[]> => emptyList<unknown>(),

  generateAPIToken: (): Promise<null> => Promise.resolve(null),
  execCommand: (_command: string): Promise<HostingCommandResult> =>
    Promise.resolve({
      success: false,
      supported: false,
      error: 'Comandos remotos no servidor de hospedagem estão desactivados.',
    }),
};

/** Mesmo objecto que `panelHostingAPI` — nome explícito para imports no servidor. */
export const directAdminHostingAPI = panelHostingAPI;

export default panelHostingAPI;
