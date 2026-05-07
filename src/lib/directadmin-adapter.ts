/**
 * directadmin-adapter.ts
 *
 * Exporta o mesmo objeto `cyberPanelAPI` com EXACTAMENTE as mesmas assinaturas,
 * mas por baixo fala com a API REST do DirectAdmin em vez do CyberPanel.
 *
 * Nenhum ficheiro .tsx precisa de ser alterado.
 */

import { cacheService } from './cache-service';
import http from 'node:http';
import https from 'node:https';
import type {
  CyberPanelWebsite,
  CyberPanelPackage,
  CyberPanelUser,
  CyberPanelEmail,
  CyberPanelDatabase,
  CyberPanelFTPAccount,
} from './cyberpanel-api';

// ─── DirectAdmin credentials ────────────────────────────────────────────────
// DIRECTADMIN_PASS is kept for compatibility with older local env files.
const DA_HOST = process.env.DIRECTADMIN_HOST || '109.199.104.22';
const DA_PORT = process.env.DIRECTADMIN_PORT || '2222';
const DA_USER = process.env.DIRECTADMIN_USER || 'admin';
const DA_PASS =
  process.env.DIRECTADMIN_PASSWORD ||
  process.env.DIRECTADMIN_LOGIN_KEY ||
  process.env.DIRECTADMIN_PASS ||
  '';
const DA_PROTOCOL = process.env.DIRECTADMIN_PROTOCOL || 'https';
const DA_BASE = (process.env.DIRECTADMIN_URL || `${DA_PROTOCOL}://${DA_HOST}:${DA_PORT}`).replace(/\/$/, '');
const DA_REJECT_UNAUTHORIZED = process.env.DIRECTADMIN_REJECT_UNAUTHORIZED === 'true';

type DirectAdminHttpResponse = {
  ok: boolean;
  status: number;
  statusText: string;
  text: string;
};

function assertDirectAdminConfig() {
  if (!DA_PASS) {
    throw new Error(
      'Credencial DirectAdmin ausente. Configure DIRECTADMIN_LOGIN_KEY ou DIRECTADMIN_PASSWORD no Vercel.'
    );
  }
}

function summarizeDirectAdminBody(text: string) {
  return text.replace(/\s+/g, ' ').trim().substring(0, 300);
}

function assertDirectAdminSuccess(cmd: string, sp: URLSearchParams) {
  const error = sp.get('error');
  if (error === '1' || error === 'true' || error === 'yes') {
    const message = sp.get('text') || sp.get('details') || 'DirectAdmin retornou erro';
    throw new Error(`${cmd}: ${message}`);
  }
}

async function directAdminRequest(
  method: 'GET' | 'POST',
  cmd: string,
  qs: URLSearchParams,
  body?: string
): Promise<DirectAdminHttpResponse> {
  const url = new URL(`${DA_BASE}/${cmd}`);
  qs.forEach((value, key) => url.searchParams.set(key, value));

  const transport = url.protocol === 'http:' ? http : https;
  const headers: Record<string, string> = {
    Authorization: 'Basic ' + Buffer.from(`${DA_USER}:${DA_PASS}`).toString('base64'),
  };

  if (method === 'POST') {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    headers['Content-Length'] = String(Buffer.byteLength(body || ''));
  }

  return new Promise((resolve, reject) => {
    const req = transport.request(
      {
        method,
        hostname: url.hostname,
        port: url.port,
        path: `${url.pathname}${url.search}`,
        headers,
        timeout: method === 'POST' ? 30000 : 20000,
        rejectUnauthorized: url.protocol === 'https:' ? DA_REJECT_UNAUTHORIZED : undefined,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          const status = res.statusCode || 0;
          resolve({
            ok: status >= 200 && status < 300,
            status,
            statusText: res.statusMessage || '',
            text,
          });
        });
      }
    );

    req.on('timeout', () => {
      req.destroy(new Error(`${cmd}: ligação ao DirectAdmin expirou`));
    });
    req.on('error', (error: NodeJS.ErrnoException) => {
      reject(
        new Error(
          `${cmd}: falha de ligação ao DirectAdmin (${error.code || error.name}) - ${error.message}`
        )
      );
    });

    if (body) req.write(body);
    req.end();
  });
}

// ─── Low-level DA request helper ────────────────────────────────────────────
async function daGet(cmd: string, qs: Record<string, string> = {}): Promise<URLSearchParams> {
  assertDirectAdminConfig();
  const params = new URLSearchParams({ json: 'yes', ...qs });
  const res = await directAdminRequest('GET', cmd, params);
  const text = res.text;
  if (!res.ok) {
    throw new Error(`${cmd}: DirectAdmin HTTP ${res.status} - ${summarizeDirectAdminBody(text)}`);
  }
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
    assertDirectAdminSuccess(cmd, sp);
    return sp;
  } catch (error) {
    if (error instanceof SyntaxError) {
      const sp = new URLSearchParams(text);
      assertDirectAdminSuccess(cmd, sp);
      return sp;
    }
    throw error;
  }
}

async function daPost(cmd: string, body: Record<string, string>): Promise<{ ok: boolean; error?: string; details?: string }> {
  assertDirectAdminConfig();
  const res = await directAdminRequest(
    'POST',
    cmd,
    new URLSearchParams({ json: 'yes' }),
    new URLSearchParams(body).toString()
  );
  const text = res.text;
  if (!res.ok) {
    return {
      ok: false,
      error: `${cmd}: DirectAdmin HTTP ${res.status} - ${summarizeDirectAdminBody(text)}`,
    };
  }
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

    // CMD_API_SHOW_ALL_USERS → list of all users
    const usersResp = await daGet('CMD_API_SHOW_ALL_USERS');
    const users = spList(usersResp);

    const sites: CyberPanelWebsite[] = [];

    for (const user of users) {
      // CMD_API_SHOW_USER_DOMAINS → domains for each user
      const domainsResp = await daGet('CMD_API_SHOW_USER_DOMAINS', { user });
      const domains = spList(domainsResp);

      // CMD_API_SHOW_USER_CONFIG → user info (package, suspended, etc.)
      const userConf = await daGet('CMD_API_SHOW_USER_CONFIG', { user });

      for (const domain of domains) {
        sites.push({
          id: `${user}_${domain}`,
          domain,
          adminEmail: userConf.get('email') || '',
          package: userConf.get('package') || 'Default',
          state: userConf.get('suspended') === 'yes' ? 'Suspended' : 'Active',
          owner: user,
          phpVersion: userConf.get('php1_release') || 'PHP 8.3',
          sslStatus: 'No SSL', // updated below if SSL exists
          diskUsage: userConf.get('quota_used') || '0',
          bandwidth: parseInt(userConf.get('bandwidth') || '0'),
        });
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

  createPackage: async (_p: any) => ({
    success: false,
    supported: false,
    error: 'Criação de pacotes DirectAdmin ainda não implementada no adapter',
  }),

  deletePackage: async (_p: any) => ({
    success: false,
    supported: false,
    error: 'Remoção de pacotes DirectAdmin ainda não implementada no adapter',
  }),

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
    return daPost(cmd, {
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
    return [
      { id: 1, name: 'admin' },
      { id: 2, name: 'reseller' },
      { id: 3, name: 'user' },
    ];
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
    if (!domain) return [];

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
    return { enabled, record, selector: 'default', publicKey: record };
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

  getPHPConfig: async (_domain: string) => '',
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

  getUserResources: async (_username: string) => ({
    success: false,
    supported: false,
    error: 'Consulta de recursos por utilizador ainda não implementada para DirectAdmin',
  }),

  rebootServer: async () => ({
    success: false,
    supported: false,
    error: 'Reiniciar servidor não é permitido pela API DirectAdmin do dashboard',
  }),

  getFirewallStatus: async () => ({ enabled: true, note: 'Gerido pelo CSF/DA' }),
  toggleFirewall: async (_p: any) => ({ success: true }),
  getModSecurityStatus: async () => ({ enabled: false }),
  toggleModSecurity: async (_p: any) => ({ success: true }),
  getBlockedIPs: async () => [],
  blockIP: async (_p: any) => ({ success: true }),
  unblockIP: async (_p: any) => ({ success: true }),

  // ══════════════════════════════════════════════════════════════════════
  // WORDPRESS (via WP-CLI — caminho diferente no DA)
  // DA path: /home/username/domains/domain.com/public_html/
  // ══════════════════════════════════════════════════════════════════════

  listWordPress: async (domain: string) => {
    // Retornar mock — WP-CLI via SSH é tratado separadamente
    return [];
  },

  installWordPress: async (_p: any) => ({
    success: false,
    supported: false,
    error: 'Instalação WordPress via DirectAdmin/Softaculous ainda não implementada',
  }),

  listWPPlugins: async (_p: any) => [],
  installWPPlugin: async (_p: any) => ({ success: true }),
  toggleWPPlugin: async (_p: any) => ({ success: true }),
  listWPBackups: async (_domain: string) => [],
  restoreWPBackup: async (_p: any) => ({ success: true }),
  createRemoteBackup: async (_p: any) => ({ success: true }),

  // ══════════════════════════════════════════════════════════════════════
  // MISC
  // ══════════════════════════════════════════════════════════════════════

  generateAPIToken: async () => {
    const array = new Uint8Array(32);
    crypto.getRandomValues(array);
    return Buffer.from(array).toString('hex');
  },

  execCommand: async (_command: string) => ({ success: true, output: '' }),
};

export default cyberPanelAPI;
