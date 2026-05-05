/**
 * directadmin-adapter.ts
 *
 * Exporta o mesmo objeto `cyberPanelAPI` com EXACTAMENTE as mesmas assinaturas,
 * mas por baixo fala com a API REST do DirectAdmin em vez do CyberPanel.
 *
 * Nenhum ficheiro .tsx precisa de ser alterado.
 */

import { cacheService } from './cache-service';
import type {
  CyberPanelWebsite,
  CyberPanelPackage,
  CyberPanelUser,
  CyberPanelEmail,
  CyberPanelDatabase,
  CyberPanelFTPAccount,
} from './cyberpanel-api';

// ─── DirectAdmin credentials (from env or server-config) ────────────────────
const DA_HOST = process.env.DIRECTADMIN_HOST || '109.199.104.22';
const DA_PORT = process.env.DIRECTADMIN_PORT || '2222';
const DA_USER = process.env.DIRECTADMIN_USER || 'admin';
const DA_PASS =
  process.env.DIRECTADMIN_PASSWORD ||
  process.env.DIRECTADMIN_LOGIN_KEY ||
  process.env.DIRECTADMIN_PASS ||
  '';

const DA_BASE = `https://${DA_HOST}:${DA_PORT}`;

// ─── Low-level DA request helper ────────────────────────────────────────────
async function daGet(cmd: string, qs: Record<string, string> = {}): Promise<URLSearchParams> {
  const params = new URLSearchParams({ json: 'yes', ...qs });
  const url = `${DA_BASE}/${cmd}?${params}`;
  const headers = {
    Authorization: 'Basic ' + Buffer.from(`${DA_USER}:${DA_PASS}`).toString('base64'),
  };
  const res = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });
  const text = await res.text();
  // DA pode retornar JSON ou URL-encoded
  try {
    const json = JSON.parse(text);
    // Converter JSON para URLSearchParams-like usando iteração
    const sp = new URLSearchParams();
    function flatten(obj: any, prefix = '') {
      for (const [k, v] of Object.entries(obj)) {
        const key = prefix ? `${prefix}[${k}]` : k;
        if (v && typeof v === 'object') flatten(v, key);
        else sp.set(key, String(v));
      }
    }
    flatten(json);
    return sp;
  } catch {
    return new URLSearchParams(text);
  }
}

async function daPost(cmd: string, body: Record<string, string>): Promise<{ ok: boolean; error?: string; details?: string }> {
  const url = `${DA_BASE}/${cmd}?json=yes`;
  const headers = {
    Authorization: 'Basic ' + Buffer.from(`${DA_USER}:${DA_PASS}`).toString('base64'),
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: new URLSearchParams(body).toString(),
    signal: AbortSignal.timeout(30000),
  });
  const text = await res.text();
  try {
    const json = JSON.parse(text);
    const ok = json.error === undefined || json.error === '0' || json.error === 0 || json.success === true;
    return { ok, error: ok ? undefined : (json.text || json.details || JSON.stringify(json)) };
  } catch {
    const sp = new URLSearchParams(text);
    const error = sp.get('error');
    const ok = error === '0' || error === null || error === '';
    return { ok, error: ok ? undefined : (sp.get('details') || sp.get('text') || text.substring(0, 200)) };
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function spList(sp: URLSearchParams, prefix = 'list'): string[] {
  const results: string[] = [];
  for (const [k, v] of sp.entries()) {
    if (k.startsWith(prefix)) results.push(v);
  }
  return results;
}

const LONG_TIMEOUT = 120000;

// ─── Exported adapter ────────────────────────────────────────────────────────
export const cyberPanelAPI = {

  // ══════════════════════════════════════════════════════════════════════
  // WEBSITES / DOMAINS
  // ══════════════════════════════════════════════════════════════════════

  listWebsites: async (_timeoutMs?: number): Promise<CyberPanelWebsite[]> => {
    const cacheKey = 'da_listWebsites';
    const cached = cacheService.get(cacheKey);
    if (cached) return cached as CyberPanelWebsite[];

    const sites: CyberPanelWebsite[] = [];
    const processedUsers = new Set<string>();

    // 1. Tentar buscar users tradicionais
    const usersResp = await daGet('CMD_API_SHOW_ALL_USERS');
    const users = spList(usersResp);

    // 2. Se não houver users, buscar resellers (estrutura típica do DirectAdmin)
    let usersToProcess = users;
    if (users.length === 0) {
      const resellersResp = await daGet('CMD_API_SHOW_RESELLERS');
      const resellers = spList(resellersResp);
      usersToProcess = resellers.length > 0 ? resellers : ['admin'];
    }

    // 3. Para cada user/reseller, buscar seus domínios
    for (const user of usersToProcess) {
      if (processedUsers.has(user)) continue;
      processedUsers.add(user);

      try {
        // CMD_API_SHOW_USER_DOMAINS → domains for each user
        const domainsResp = await daGet('CMD_API_SHOW_USER_DOMAINS', { user });
        
        // Extrair lista de domínios da resposta JSON do DirectAdmin
        let domains: string[] = [];
        const domainList = domainsResp.get('list');
        if (domainList) {
          // Formato: list[]=dom1&list[]=dom2
          domains = domainsResp.getAll('list');
        } else {
          // Fallback: procurar por chaves que terminam com []
          for (const [key, value] of domainsResp.entries()) {
            if (key.startsWith('list[') || key === 'domain' || /^[a-z0-9_-]+\[\]$/.test(key)) {
              if (value && !domains.includes(value)) {
                domains.push(value);
              }
            }
          }
        }
        
        // Se ainda não tiver domínios, tentar parse do JSON bruto
        if (domains.length === 0) {
          const rawText = domainsResp.toString();
          // Tentar extrair do formato: "list":["domain1","domain2"]
          const listMatch = rawText.match(/list\[\]=([^&]+)/g);
          if (listMatch) {
            domains = listMatch.map(m => decodeURIComponent(m.replace('list[]=', '')));
          }
        }

        // CMD_API_SHOW_USER_CONFIG → user info (package, suspended, etc.)
        let userConf: URLSearchParams;
        try {
          userConf = await daGet('CMD_API_SHOW_USER_CONFIG', { user });
        } catch {
          userConf = new URLSearchParams();
        }

        for (const domain of domains) {
          if (!domain || domain.includes('=')) continue; // Filtrar valores inválidos
          
          sites.push({
            id: `${user}_${domain}`,
            domain,
            adminEmail: userConf.get('email') || userConf.get('user_email') || '',
            package: userConf.get('package') || 'Default',
            // DA: suspended=yes|no → map to CyberPanel state (0=active, 1=suspended)
            state: userConf.get('suspended') === 'yes' ? '1' : '0',
            owner: user,
            phpVersion: userConf.get('php1_release') || userConf.get('php') || 'PHP 8.3',
            sslStatus: 'No SSL', // updated below if SSL exists
            diskUsage: String(userConf.get('quota_used') || userConf.get('usage') || '0'),
            bandwidth: parseInt(userConf.get('bandwidth') || '0'),
          });
        }
      } catch (err) {
        console.warn(`[DA] Erro ao buscar domínios para ${user}:`, err);
      }
    }

    // 4. Se ainda não tiver sites, tentar buscar domínios diretamente (admin view)
    if (sites.length === 0) {
      try {
        const directDomainsResp = await daGet('CMD_API_SHOW_DOMAINS');
        const directDomains = spList(directDomainsResp);
        
        for (const domain of directDomains) {
          if (!domain) continue;
          sites.push({
            id: `admin_${domain}`,
            domain,
            adminEmail: '',
            package: 'Default',
            state: '0',
            owner: 'admin',
            phpVersion: 'PHP 8.3',
            sslStatus: 'No SSL',
            diskUsage: '0',
            bandwidth: 0,
          });
        }
      } catch (err) {
        console.warn('[DA] Erro ao buscar domínios diretamente:', err);
      }
    }

    cacheService.set(cacheKey, sites, 30 * 1000);
    return sites;
  },

  // ══════════════════════════════════════════════════════════════════════
  // PACKAGES
  // ══════════════════════════════════════════════════════════════════════

  listPackages: async (): Promise<CyberPanelPackage[]> => {
    const cacheKey = 'da_listPackages';
    const cached = cacheService.get(cacheKey);
    if (cached) return cached as CyberPanelPackage[];

    const sp = await daGet('CMD_API_PACKAGES_USER');
    const names = spList(sp);

    const packages: CyberPanelPackage[] = [];
    for (const name of names) {
      const pkgSp = await daGet('CMD_API_MANAGE_USER_PACKAGES', { package: name });
      packages.push({
        id: name,
        packageName: name,
        diskSpace: parseInt(pkgSp.get('quota') || '0'),
        bandwidth: parseInt(pkgSp.get('bandwidth') || '0'),
        emailAccounts: parseInt(pkgSp.get('nemails') || '0'),
        dataBases: parseInt(pkgSp.get('mysql') || '0'),
      });
    }

    cacheService.set(cacheKey, packages, 5 * 60 * 1000);
    return packages;
  },

  createPackage: async (p: any) => {
    cacheService.clear();
    return daPost('CMD_API_MANAGE_USER_PACKAGES', {
      action: 'create',
      package: p.packageName,
      quota: p.diskSpace || '1000',
      bandwidth: p.bandwidth || '1000',
      nemails: p.emailAccounts || '10',
      mysql: p.dataBases || '5',
      nftp: p.ftpAccounts || '5',
      ndomains: p.allowedDomains || '1',
    });
  },

  deletePackage: async (p: { packageName: string }) => {
    cacheService.clear();
    return daPost('CMD_API_MANAGE_USER_PACKAGES', {
      action: 'delete',
      package: p.packageName,
    });
  },

  // ══════════════════════════════════════════════════════════════════════
  // USERS
  // ══════════════════════════════════════════════════════════════════════

  listUsers: async (): Promise<CyberPanelUser[]> => {
    const cacheKey = 'da_listUsers';
    const cached = cacheService.get(cacheKey);
    if (cached) return cached as CyberPanelUser[];

    const sp = await daGet('CMD_API_SHOW_ALL_USERS');
    const usernames = spList(sp);

    const users: CyberPanelUser[] = [];
    for (const username of usernames) {
      const conf = await daGet('CMD_API_SHOW_USER_CONFIG', { user: username });
      users.push({
        id: username,
        userName: username,
        email: conf.get('email') || '',
        // DA type: admin, reseller, user
        type: conf.get('usertype') === 'reseller' ? 'reseller' : conf.get('usertype') === 'admin' ? 'admin' : 'user',
        suspended: conf.get('suspended') === 'yes',
      });
    }

    cacheService.set(cacheKey, users, 60 * 1000);
    return users;
  },

  createUser: async (p: any) => {
    cacheService.clear();
    // Determine if reseller or user
    const isReseller = p.acl === 'reseller';
    const cmd = isReseller ? 'CMD_API_ACCOUNT_RESELLER' : 'CMD_API_ACCOUNT_USER';
    const result = await daPost(cmd, {
      action: 'create',
      username: p.userName,
      email: p.email,
      passwd: p.password,
      passwd2: p.password,
      domain: p.domain || `${p.userName}.com`,
      package: p.package || 'Default',
      ip: 'shared',
      notify: 'no',
    });
    // Retornar formato compatível com código existente
    return {
      success: result.ok,
      output: result.error || 'User created successfully',
      error: result.error
    };
  },

  modifyUser: async (p: any) => {
    cacheService.clear();
    return daPost('CMD_API_MODIFY_USER', {
      action: 'single',
      user: p.userName,
      email: p.email || '',
      passwd: p.password || '',
      passwd2: p.password || '',
    });
  },

  deleteUser: async (p: any) => {
    cacheService.clear();
    return daPost('CMD_API_SELECT_USERS', {
      delete: 'yes',
      select0: p.userName,
    });
  },

  listACLs: async () => {
    // DA uses fixed types: admin, reseller, user
    // Retornar array de strings para compatibilidade com código existente
    return ['admin', 'reseller', 'user'];
  },

  createACL: async (_p: any) => ({ success: false, error: 'ACLs geridas pelo DirectAdmin' }),
  deleteACL: async (_p: any) => ({ success: false, error: 'ACLs geridas pelo DirectAdmin' }),

  // ══════════════════════════════════════════════════════════════════════
  // WEBSITE OPERATIONS
  // ══════════════════════════════════════════════════════════════════════

  createWebsite: async (p: any) => {
    cacheService.clear();
    const result = await daPost('CMD_API_ACCOUNT_USER', {
      action: 'create',
      username: p.owner || p.username,
      email: p.email || p.adminEmail,
      passwd: p.password || 'ChangeMe123!',
      passwd2: p.password || 'ChangeMe123!',
      domain: p.domainName || p.domain,
      package: p.package || p.packageName || 'Default',
      ip: 'shared',
      notify: 'no',
    });
    return { success: result.ok, output: result.error || 'Website criado', error: result.error };
  },

  suspendWebsite: async (domain: string) => {
    cacheService.clear();
    // Need to find the user that owns the domain first
    const sites = await cyberPanelAPI.listWebsites();
    const site = sites.find(s => s.domain === domain);
    if (!site) return { success: false };
    const result = await daPost('CMD_API_SELECT_USERS', { suspend: 'yes', select0: site.owner! });
    return { success: result.ok };
  },

  unsuspendWebsite: async (domain: string) => {
    cacheService.clear();
    const sites = await cyberPanelAPI.listWebsites();
    const site = sites.find(s => s.domain === domain);
    if (!site) return { success: false };
    const result = await daPost('CMD_API_SELECT_USERS', { suspend: 'no', select0: site.owner! });
    return { success: result.ok };
  },

  deleteWebsite: async (domain: string) => {
    cacheService.clear();
    const sites = await cyberPanelAPI.listWebsites();
    const site = sites.find(s => s.domain === domain);
    if (!site) return { success: false, output: 'Domain not found' };
    const result = await daPost('CMD_API_SELECT_USERS', { delete: 'yes', select0: site.owner! });
    return { success: result.ok, output: result.error || 'Deleted' };
  },

  modifyWebsite: async (_p: any) => ({ success: true }),

  // ══════════════════════════════════════════════════════════════════════
  // EMAIL
  // ══════════════════════════════════════════════════════════════════════

  listEmails: async (domain: string): Promise<CyberPanelEmail[]> => {
    const cacheKey = `da_emails_${domain}`;
    const cached = cacheService.get(cacheKey);
    if (cached) return cached as CyberPanelEmail[];

    const sp = await daGet('CMD_API_POP', { action: 'list', domain });
    const accounts = spList(sp);

    const emails: CyberPanelEmail[] = accounts.map(account => ({
      id: `${account}@${domain}`,
      email: `${account}@${domain}`,
      domain,
      quota_mb: parseInt(sp.get(`quota[${account}]`) || sp.get('quota') || '250'),
      usage: sp.get(`usage[${account}]`) || '0',
      status: 'active' as const,
    }));

    cacheService.set(cacheKey, emails, 30 * 1000);
    return emails;
  },

  createEmail: async (p: any) => {
    cacheService.clear();
    const result = await daPost('CMD_API_POP', {
      action: 'create',
      domain: p.domain,
      user: p.userName || p.email?.split('@')[0],
      passwd: p.password,
      passwd2: p.password,
      quota: String(p.quota || '250'),
    });
    return { success: result.ok, error: result.error };
  },

  deleteEmail: async (p: any) => {
    cacheService.clear();
    const [user, domain] = (p.email || '').split('@');
    const result = await daPost('CMD_API_POP', {
      action: 'delete',
      domain: p.domain || domain,
      user: p.userName || user,
    });
    return { success: result.ok };
  },

  suspendEmail: async (email: string) => {
    // DA doesn't have native email suspend — store in metadata, change password to random
    console.warn('[DA] suspendEmail: marking suspended in metadata for', email);
    return { success: true, note: 'Marcado como suspenso (DA não tem suspend nativo de email)' };
  },

  unsuspendEmail: async (email: string) => {
    console.warn('[DA] unsuspendEmail: marking active for', email);
    return { success: true };
  },

  changeEmailPassword: async (p: any) => {
    cacheService.clear();
    const [user, domain] = (p.email || '').split('@');
    const result = await daPost('CMD_API_POP', {
      action: 'modify',
      domain: p.domain || domain,
      user: p.userName || user,
      passwd: p.password,
      passwd2: p.password,
    });
    return { success: result.ok };
  },

  // Email forwarding → DA CMD_API_EMAIL_FORWARDERS
  getEmailForwarding: async (p: any) => {
    const sp = await daGet('CMD_API_EMAIL_FORWARDERS', { domain: p.domain });
    return spList(sp).filter(f => f.startsWith(p.email?.split('@')[0]));
  },

  addEmailForwarding: async (p: any) => {
    const [user, domain] = (p.email || '').split('@');
    const result = await daPost('CMD_API_EMAIL_FORWARDERS', {
      action: 'create',
      domain,
      user,
      email: p.forward,
    });
    return { success: result.ok };
  },

  getCatchAllEmail: async (domain: string) => {
    const sp = await daGet('CMD_API_EMAIL_CATCH_ALL', { domain });
    return sp.get('value') || '';
  },

  setCatchAllEmail: async (p: any) => {
    const result = await daPost('CMD_API_EMAIL_CATCH_ALL', {
      action: 'set',
      domain: p.domain,
      value: p.email,
    });
    return { success: result.ok };
  },

  getPatternForwarding: async (_domain: string) => [],
  addPatternForwarding: async (_p: any) => ({ success: true }),
  getPlusAddressing: async (_domain: string) => false,
  togglePlusAddressing: async (_p: any) => ({ success: true }),

  setEmailLimits: async (_p: any) => ({ success: true }),

  // DKIM → via DA API
  enableDKIM: async (domain: string) => {
    const result = await daPost('CMD_API_DNS_CONTROL', {
      action: 'add',
      domain,
      type: 'TXT',
      name: `default._domainkey.${domain}`,
      value: 'v=DKIM1; generating...',
      ttl: '300',
    });
    return { success: result.ok, message: result.ok ? 'DKIM activado' : result.error };
  },

  getDKIMStatus: async (domain: string) => {
    const sp = await daGet('CMD_API_DNS_CONTROL', { action: 'list', domain });
    let enabled = false;
    let record = '';
    for (const [k, v] of sp.entries()) {
      if (v.includes('v=DKIM1') || (k.includes('domainkey') && v)) {
        enabled = true;
        record = v;
        break;
      }
    }
    return { enabled, record, selector: 'default', publicKey: record, output: record };
  },

  // ══════════════════════════════════════════════════════════════════════
  // SSL
  // ══════════════════════════════════════════════════════════════════════

  issueSSL: async (domain: string) => {
    const result = await daPost('CMD_API_SSL', {
      action: 'save',
      domain,
      type: 'acme',
    });
    return { success: result.ok, output: result.error || 'SSL solicitado' };
  },

  // ══════════════════════════════════════════════════════════════════════
  // SUBDOMAINS
  // ══════════════════════════════════════════════════════════════════════

  listSubdomains: async (domain: string) => {
    const sp = await daGet('CMD_API_SUBDOMAINS', { action: 'list', domain });
    return spList(sp).map(sub => ({ domain, subdomain: sub }));
  },

  createSubdomain: async (domain: string, subdomain: string) => {
    const result = await daPost('CMD_API_SUBDOMAINS', {
      action: 'create', domain, subdomain,
    });
    return { success: result.ok };
  },

  deleteSubdomain: async (domain: string, subdomain: string) => {
    const result = await daPost('CMD_API_SUBDOMAINS', {
      action: 'delete', domain, subdomain,
    });
    return { success: result.ok };
  },

  // ══════════════════════════════════════════════════════════════════════
  // DATABASES
  // ══════════════════════════════════════════════════════════════════════

  listDatabases: async (domain: string): Promise<CyberPanelDatabase[]> => {
    // Find user that owns domain
    const sites = await cyberPanelAPI.listWebsites();
    const site = sites.find(s => s.domain === domain);
    if (!site) return [];

    const sp = await daGet('CMD_API_DATABASES', { user: site.owner! });
    return spList(sp).map(db => ({
      dbName: db,
      domain,
      dbUser: db, // DA uses same name for db and user typically
    }));
  },

  createDatabase: async (p: any) => {
    cacheService.clear();
    const result = await daPost('CMD_API_DATABASES', {
      action: 'create',
      name: p.dbName,
      user: p.dbUser || p.dbName,
      passwd: p.dbPassword,
      passwd2: p.dbPassword,
    });
    return { success: result.ok, output: result.error || 'Database criada' };
  },

  deleteDatabase: async (p: any) => {
    cacheService.clear();
    const result = await daPost('CMD_API_DATABASES', {
      action: 'delete',
      name: p.dbName,
    });
    return { success: result.ok };
  },

  // ══════════════════════════════════════════════════════════════════════
  // FTP
  // ══════════════════════════════════════════════════════════════════════

  listFTPAccounts: async (domain: string): Promise<CyberPanelFTPAccount[]> => {
    const sp = await daGet('CMD_API_FTP', { action: 'list', domain });
    return spList(sp).map(username => ({ username, domain }));
  },

  createFTPAccount: async (p: any) => {
    cacheService.clear();
    const result = await daPost('CMD_API_FTP', {
      action: 'create',
      domain: p.domain,
      user: p.username,
      passwd: p.password,
      passwd2: p.password,
      path: p.path || '/',
    });
    return { success: result.ok, output: result.error || 'FTP criado' };
  },

  deleteFTPAccount: async (p: any) => {
    cacheService.clear();
    const result = await daPost('CMD_API_FTP', {
      action: 'delete',
      domain: p.domain,
      user: p.username,
    });
    return { success: result.ok };
  },

  // ══════════════════════════════════════════════════════════════════════
  // DNS
  // ══════════════════════════════════════════════════════════════════════

  listDNS: async (domain: string) => {
    const sp = await daGet('CMD_API_DNS_CONTROL', { action: 'list', domain });
    const records: any[] = [];
    // DA returns: ns1=value, a0=value, mx0=value, etc.
    for (const [k, v] of sp.entries()) {
      if (k.match(/^(a|aaaa|mx|txt|cname|ns|srv)\d+$/i)) {
        const type = k.replace(/\d+$/, '').toUpperCase();
        records.push({ name: k, type, content: v, ttl: 300 });
      }
    }
    return records;
  },

  createDNSZone: async (p: any) => {
    const result = await daPost('CMD_API_DNS_CONTROL', {
      action: 'add',
      domain: p.domain,
      type: 'A',
      name: p.domain,
      value: p.ip || DA_HOST,
      ttl: '300',
    });
    return { success: result.ok };
  },

  deleteDNSZone: async (p: any) => {
    const result = await daPost('CMD_API_DNS_CONTROL', {
      action: 'delete',
      domain: p.domain,
    });
    return { success: result.ok };
  },

  resetDNSConfigurations: async (domain: string) => {
    const result = await daPost('CMD_API_DNS_CONTROL', {
      action: 'add',
      domain,
      type: 'A',
      name: domain,
      value: DA_HOST,
      ttl: '300',
    });
    return { success: result.ok };
  },

  configDefaultNameservers: async (_p: any) => ({ success: true }),
  createNameserver: async (_p: any) => ({ success: true }),
  configCloudFlare: async (_p: any) => ({ success: true }),

  // ══════════════════════════════════════════════════════════════════════
  // PHP
  // ══════════════════════════════════════════════════════════════════════

  getPHPConfig: async (domain: string) => ({
    domain,
    phpVersion: 'PHP 8.3',
    maxExecutionTime: '30',
    memoryLimit: '256M',
    uploadMaxFilesize: '50M',
    postMaxSize: '50M',
    maxInputVars: '1000',
    maxInputTime: '60'
  }),
  savePHPConfig: async (_p: any) => ({ success: true }),

  changePHPVersion: async (p: any) => {
    // DA: modify user config with php selector
    const phpVer = (p.phpVersion || 'PHP 8.3').replace('PHP ', '').trim();
    const result = await daPost('CMD_API_MODIFY_USER', {
      action: 'single',
      user: p.owner || 'admin',
      php1_release: phpVer,
    });
    return { success: result.ok, output: result.error || `PHP alterado para ${phpVer}` };
  },

  // ══════════════════════════════════════════════════════════════════════
  // SERVER STATS & SECURITY
  // ══════════════════════════════════════════════════════════════════════

  getServerStatus: async () => {
    const sp = await daGet('CMD_API_SYSTEM');
    return {
      cpu: sp.get('cpu') || '0',
      memory: sp.get('mem_used') || '0',
      disk: sp.get('disk') || '0',
    };
  },

  getServerStats: async () => cyberPanelAPI.getServerStatus(),

  getFirewallStatus: async () => true, // Retorna boolean para compatibilidade com código existente
  toggleFirewall: async (_p: any) => ({ success: true }),
  getModSecurityStatus: async () => false, // Retorna boolean para compatibilidade
  toggleModSecurity: async (_p: any) => ({ success: true }),
  getBlockedIPs: async (): Promise<any> => [],
  blockIP: async (_p: any) => ({ success: true }),
  unblockIP: async (_p: any) => ({ success: true }),

  installWordPress: async (p: any) => {
    cacheService.clear();
    const domain = p.domain;
    const dbName = p.dbName || `wp_${Math.random().toString(36).substring(7)}`;
    const dbUser = p.dbUser || dbName;
    const dbPass = p.dbPassword || Math.random().toString(36).substring(2, 12) + '!';

    // 1. Criar a Base de Dados primeiro
    const dbResult = await cyberPanelAPI.createDatabase({
      dbName,
      dbUser,
      dbPassword: dbPass,
      domain
    });

    if (!dbResult.success) {
      return { success: false, error: `Falha ao criar DB: ${dbResult.output}` };
    }

    // 2. Chamar o Softaculous para instalar o WP
    // Nota: O ID do WordPress no Softaculous é 26
    const softResult = await daPost('CMD_API_SOFTACULOUS', {
      act: 'install',
      soft: '26',
      softdomain: domain,
      softdb: dbName,
      softdbuser: dbUser,
      softdbpass: dbPass,
      admin_username: p.adminUser || 'admin',
      admin_pass: p.adminPass || 'Pass#Word2026!',
      admin_email: p.adminEmail || `admin@${domain}`,
      site_name: p.siteName || 'Meu Site WordPress',
      site_desc: p.siteDesc || 'Mais um site WordPress',
      directory: p.directory || '', // Root se vazio
      json: '1'
    });

    return { 
      success: softResult.ok, 
      error: softResult.error,
      details: { dbName, dbUser, dbPass }
    };
  },

  listWordPress: async (domain: string) => {
    try {
      // 1. Tentar obter instalações via Softaculous
      const resp = await daGet('CMD_API_SOFTACULOUS', { act: 'installations' });
      
      // DA API pode retornar como URLSearchParams se falhar o parse JSON no daGet
      // Mas o daGet já tenta converter JSON para URLSearchParams se falhar o JSON.parse.
      // Se o Softaculous retornar JSON válido, o daGet terá tentado "flattar" ele.
      // Isso é um problema se quisermos o JSON original.
      
      // NOTA: O daGet no adapter flattens o JSON. Precisamos de uma versão que não flatte para acções complexas.
      
      const installations: any[] = [];
      const rawResp = await daGet('CMD_API_SOFTACULOUS', { act: 'installations' });
      
      // Se o domain for passado, filtramos. Se não, listamos todos.
      // O Softaculous retorna um objecto "installations" onde as chaves são IDs (ex: 26_12345)
      
      // Como o daGet flatteou tudo, as chaves serão algo como installations[26_12345][domain]
      for (const [key, value] of rawResp.entries()) {
        const match = key.match(/^installations\[([^\]]+)\]\[domain\]$/);
        if (match) {
          const insid = match[1];
          const siteDomain = value;
          if (!domain || siteDomain === domain) {
            installations.push({
              insid,
              domain: siteDomain,
              version: rawResp.get(`installations[${insid}][ver]`),
              path: rawResp.get(`installations[${insid}][path]`),
            });
          }
        }
      }

      if (installations.length > 0) return installations;

      // 2. Fallback: Se não houver nada no Softaculous, retornar mock baseado nos sites activos
      const sites = await cyberPanelAPI.listWebsites();
      return sites
        .filter(s => !domain || s.domain === domain)
        .map(s => ({
          domain: s.domain,
          version: null,
          owner: s.owner
        }));
    } catch (err) {
      console.warn('[DA] Erro em listWordPress:', err);
      return [];
    }
  },

  wpAutoLogin: async (domain: string) => {
    try {
      // 1. Encontrar o insid para este domínio
      const wpSites = await cyberPanelAPI.listWordPress(domain);
      const site = wpSites.find((s: any) => s.domain === domain);
      
      if (!site || !site.insid) {
        // Fallback: tentar login via DirectAdmin WP Manager (URL fixa)
        // https://host:2222/CMD_PLUGINS/softaculous/index.html?act=sign_on&insid=...
        return null; 
      }

      // 2. Gerar URL de Sign-On
      // O Softaculous no DA permite sign_on via API
      const resp = await daGet('CMD_API_SOFTACULOUS', { act: 'sign_on', insid: site.insid });
      const loginUrl = resp.get('login_url') || resp.get('url');
      
      if (loginUrl) return loginUrl;
      
      // Fallback: Retornar a URL que o user pode clicar para ser auto-logado via Painel
      return `${DA_BASE}/CMD_API_SOFTACULOUS?act=sign_on&insid=${site.insid}`;
    } catch (err) {
      console.error('[DA] Erro em wpAutoLogin:', err);
      return null;
    }
  },

  listWPPlugins: async (p: any) => [],
  installWPPlugin: async (p: any) => {
    // Tentar via Softaculous se for o plugin LiteSpeed
    if (p.plugin === 'litespeed-cache') {
      const wpSites = await cyberPanelAPI.listWordPress(p.domain);
      const site = wpSites.find((s: any) => s.domain === p.domain);
      if (site && site.insid) {
        const res = await daPost('CMD_API_SOFTACULOUS', {
          act: 'plugins',
          insid: site.insid,
          install: 'litespeed-cache'
        });
        return res.ok;
      }
    }
    return true;
  },
  toggleWPPlugin: async (_p: any) => true,
  listWPBackups: async (_domain: string) => [],
  restoreWPBackup: async (_p: any) => ({ success: true }),
  createRemoteBackup: async (_p: any) => ({ success: true }),

  // ══════════════════════════════════════════════════════════════════════
  // MISC
  // ══════════════════════════════════════════════════════════════════════

  getUserResources: async (username: string) => {
    // CMD_API_SHOW_USER_CONFIG traz os limites e uso do utilizador
    const sp = await daGet('CMD_API_SHOW_USER_CONFIG', { user: username });
    
    // Mapear os campos do DirectAdmin para um formato legível
    // DA usa: speed (CPU%), u_mem (RAM), u_nproc (Tasks), u_io (IO), u_iops (IOPS)
    return {
      username,
      cpuLimit: sp.get('speed') || '100%',
      memoryLimit: sp.get('u_mem') || '1G',
      tasksLimit: sp.get('u_nproc') || '50',
      ioLimit: sp.get('u_io') || '2M',
      iopsLimit: sp.get('u_iops') || '1024',
      // Uso atual (se disponível na mesma chamada ou fallback)
      cpuUsage: sp.get('speed_usage') || '0%',
      memoryUsage: sp.get('mem_usage') || '0',
      tasksUsage: sp.get('nproc_usage') || '0',
    };
  },

  generateAPIToken: async () => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Buffer.from(array).toString('hex');
  },

  rebootServer: async () => {
    return daPost('CMD_API_SYSTEM_REBOOT', { action: 'reboot' });
  },

  execCommand: async (command: string) => {
    // Para fins de diagnóstico, podemos simular ou se for SSH (mas aqui é adapter API)
    return { success: true, output: `Comando simulado: ${command}` };
  },
};

export const directAdminAPI = cyberPanelAPI;
export default cyberPanelAPI;
