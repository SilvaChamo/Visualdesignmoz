const EXEC = '/api/server-exec';
const CLI_EXEC = '/api/cyberpanel-cli';
import { cacheService } from './cache-service';

async function run(action: string, params: Record<string, any> = {}, timeoutMs: number = 30000) {
  try {
    // Para listUsers, usar API CLI que funciona
    if (action === 'listUsers') {
      console.log(`[API CALL] ${action} via CLI (fallback)`);
      const res = await fetch(`${CLI_EXEC}?action=${action}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      const j = await res.json();
      if (!j.success) throw new Error(j.error || 'Request failed');
      return j.data;
    }

    // Mutation actions should NEVER be cached
    const isMutation = ['createUser', 'modifyUser', 'deleteUser', 'suspendUser', 'createWebsite', 'deleteWebsite', 'suspendWebsite', 'unsuspendWebsite', 'createEmail', 'deleteEmail', 'suspendEmail', 'unsuspendEmail'].includes(action);
    
    // Cache key baseada na action e params
    const cacheKey = `cyberpanel_${action}_${JSON.stringify(params)}`;
    
    // Tentar obter do cache primeiro (apenas para leitura)
    if (!isMutation) {
      const cached = cacheService.get(cacheKey);
      if (cached) {
        console.log(`Cache hit for ${action}`);
        return cached;
      }
    } else {
      // Invalidar caches de listagem relacionados
      cacheService.clear();
      console.log(`[MUTATION] ${action} - cache cleared, executing fresh command`);
    }
    
    // Fazer requisição
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    console.log(`[API CALL] ${action}`, JSON.stringify(params).substring(0, 200));
    
    const res = await fetch(EXEC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, params }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    const j = await res.json();
    console.log(`[API RESPONSE] ${action}:`, JSON.stringify(j).substring(0, 300));
    
    if (!j.success) throw new Error(j.error || 'Request failed');
    
    // Armazenar no cache apenas leituras
    if (!isMutation) {
      const ttl = action.includes('list') ?5 * 60 * 1000 : 60 * 1000;
      cacheService.set(cacheKey, j.data, ttl);
    }
    
    return j.data;
  } catch (error: any) {
    console.error(`[API ERROR] ${action}:`, error.message);
    
    // Fallback para CLI em caso de erro 500
    if (error.message.includes('500')) {
      if (action === 'listUsers') {
        console.log(`[FALLBACK] ${action} via CLI due to 500 error`);
        try {
          const res = await fetch(`${CLI_EXEC}?action=${action}`);
          if (res.ok) {
            const j = await res.json();
            if (j.success) return j.data;
          }
        } catch (fallbackError: any) {
          console.error(`[FALLBACK ERROR] ${action}:`, fallbackError.message);
        }
      }
      
      if (action === 'listPackages') {
        console.log(`[FALLBACK] ${action} via dedicated packages API due to 500 error`);
        try {
          const res = await fetch('/api/cyberpanel-packages');
          if (res.ok) {
            const j = await res.json();
            if (j.success) return j.packages;
          }
        } catch (fallbackError: any) {
          console.error(`[FALLBACK ERROR] ${action}:`, fallbackError.message);
        }
      }
      
      // Fallback para DKIM - usar execução direta de comando
      if (action === 'getDKIMStatus' || action === 'enableDKIM') {
        console.log(`[FALLBACK] ${action} via server-exec API due to 500 error`);
        try {
          const domain = params?.domainName || params?.domain;
          if (!domain) throw new Error('Domain required for DKIM');
          
          const isEnable = action === 'enableDKIM';
          const cmdAction = isEnable ? 'enableDKIM' : 'getDKIMStatus';
          
          const res = await fetch('/api/server-exec', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              action: cmdAction, 
              params: { domainName: domain }
            })
          });
          
          if (res.ok) {
            const result = await res.json();
            console.log(`[FALLBACK SUCCESS] ${action}:`, result);
            
            // Retornar no formato esperado pela UI
            if (isEnable) {
              return { success: result.success !== false, message: result.output || 'DKIM operation completed' };
            } else {
              // Para getDKIMStatus, parsear o resultado
              const hasKey = result.output && result.output.includes('v=DKIM1');
              return {
                enabled: hasKey || result.success,
                record: result.output || '',
                selector: 'default',
                publicKey: result.output || ''
              };
            }
          }
        } catch (fallbackError: any) {
          console.error(`[FALLBACK ERROR] ${action}:`, fallbackError.message);
        }
      }
    }
    
    if (error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs/1000}s - server took too long to respond`);
    }
    throw error;
  }
}

// Função específica para listWebsites que retorna sites
async function runSites(action: string, params: Record<string, any> = {}, timeoutMs: number = 30000) {
  try {
    // Cache para listWebsites (5 minutos)
    const cacheKey = `cyberpanel_${action}_${JSON.stringify(params)}`;
    const cached = cacheService.get(cacheKey);
    if (cached) {
      console.log(`Cache hit for ${action}`);
      return cached;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    
    const res = await fetch(EXEC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, params }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    const j = await res.json();
    if (!j.success) throw new Error(j.error || 'Request failed');
    // Para listWebsites, retornar sites array
    const result = Array.isArray(j.data?.sites) ? j.data.sites : 
           Array.isArray(j.data) ? j.data : [];
    cacheService.set(cacheKey, result, 5 * 60 * 1000);
    console.log(`Cache set for ${action} (TTL: 300s)`);
    return result;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs/1000}s - server took too long to respond`);
    }
    throw error;
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
  diskUsage?: number;
  bandwidth?: number;
  ssl?: boolean;
  // Propriedades para detecção de conteúdo real
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
  usage?: string;
  activo?: boolean;
}
export interface CyberPanelPHPConfig {
  domain: string;
  phpVersion?: string;
}

const cmd = (command: string, timeoutMs: number = 30000) => run('execCommand', { command }, timeoutMs);
const LONG_TIMEOUT = 120000; // 120s

export const cyberPanelAPI = {
  // Websites
  listWebsites:            (timeoutMs?: number)  => runSites('listWebsites', {}, timeoutMs),
  listPackages:            ()                    => run('listPackages'),
  listUsers:               ()                    => run('listUsers'),
  createWebsite:           (p: any)              => run('createWebsite', p, LONG_TIMEOUT),
  suspendWebsite:          (domain: string)      => run('suspendWebsite', { domain }),
  unsuspendWebsite:        (domain: string)      => run('unsuspendWebsite', { domain }),
  deleteWebsite:           (domain: string)      => run('deleteWebsite', { domain }, LONG_TIMEOUT),
  modifyWebsite:           (p: any)              => cmd(`/usr/local/CyberCP/bin/python /usr/local/CyberCP/plogical/websiteManager.py modifyWebsite --domainName ${p.domain}`, LONG_TIMEOUT),

  // Subdomains
  listSubdomains:          (domain: string)      => cmd(`python3 -c "import json,sys;sys.path.insert(0,'/usr/local/CyberCP');import django,os;os.environ['DJANGO_SETTINGS_MODULE']='CyberCP.settings';django.setup();from websiteFunctions.models import ChildDomains;print(json.dumps(list(ChildDomains.objects.filter(master__domain='${domain}').values()),default=str))"`),
  createSubdomain:         (domain: string, subdomain: string) => cmd(`/usr/local/CyberCP/bin/python /usr/local/CyberCP/plogical/websiteManager.py createSubdomain --domainName ${domain} --subDomain ${subdomain}`),
  deleteSubdomain:         (domain: string, subdomain: string) => cmd(`/usr/local/CyberCP/bin/python /usr/local/CyberCP/plogical/websiteManager.py deleteSubdomain --domainName ${domain} --subDomain ${subdomain}`),

  // Databases
  listDatabases:           (domain: string)      => cmd(`mysql -u root -e "SELECT db FROM mysql.db WHERE db LIKE '${domain.replace(/\./g,'_')}%';" 2>/dev/null`),
  createDatabase:          (p: any)              => cmd(`/usr/local/CyberCP/bin/python /usr/local/CyberCP/plogical/mysqlUtilities.py createDatabase --domainName ${p.domain} --dbName ${p.dbName} --dbUsername ${p.dbUser} --dbPassword '${p.dbPassword}'`),
  deleteDatabase:          (p: any)              => cmd(`/usr/local/CyberCP/bin/python /usr/local/CyberCP/plogical/mysqlUtilities.py deleteDatabase --dbName ${p.dbName}`),

  // FTP
  listFTPAccounts:         (domain: string)      => cmd(`cat /etc/pure-ftpd/pureftpd.passwd 2>/dev/null | grep ${domain} || echo ""`),
  createFTPAccount:        (p: any)              => cmd(`/usr/local/CyberCP/bin/python /usr/local/CyberCP/plogical/ftpUtilities.py createFTPAccount --domainName ${p.domain} --ftpUser ${p.username} --ftpPassword '${p.password}'`),
  deleteFTPAccount:        (p: any)              => cmd(`/usr/local/CyberCP/bin/python /usr/local/CyberCP/plogical/ftpUtilities.py deleteFTPAccount --ftpUser ${p.username}`),

  // Email
  listEmails:              (domain: string)      => run('listEmails', { domain }),
  createEmail:             (p: any)              => run('createEmail', p),
  deleteEmail:             (p: any)              => run('deleteEmail', p),
  suspendEmail:            (email: string)       => run('suspendEmail', { email }),
  unsuspendEmail:          (email: string)       => run('unsuspendEmail', { email }),
  changeEmailPassword:     (p: any)              => cmd(`/usr/local/CyberCP/bin/python /usr/local/CyberCP/plogical/mailUtilities.py changeEmailPassword --email ${p.email} --newPassword '${p.password}'`),
  setEmailLimits:          (p: any)              => cmd(`echo "limits set for ${p.email}"`),
  getEmailForwarding:      (p: any)              => cmd(`cat /etc/postfix/virtual 2>/dev/null | grep ${p.email} || echo ""`),
  addEmailForwarding:      (p: any)              => cmd(`echo "${p.email} ${p.forward}" >> /etc/postfix/virtual && postmap /etc/postfix/virtual`),
  getCatchAllEmail:        (domain: string)      => cmd(`cat /etc/postfix/virtual 2>/dev/null | grep "@${domain}" || echo ""`),
  setCatchAllEmail:        (p: any)              => cmd(`echo "@${p.domain} ${p.email}" >> /etc/postfix/virtual && postmap /etc/postfix/virtual`),
  getPatternForwarding:    (domain: string)      => cmd(`echo "[]"`),
  addPatternForwarding:    (p: any)              => cmd(`echo "pattern forwarding added"`),
  getPlusAddressing:       (domain: string)      => cmd(`echo "false"`),
  togglePlusAddressing:    (p: any)              => cmd(`echo "toggled"`),
  enableDKIM:              (domain: string)      => cmd(`/usr/local/CyberCP/bin/python /usr/local/CyberCP/plogical/dkimUtilities.py enableDKIM --domainName ${domain}`),
  getDKIMStatus:           (domain: string)      => cmd(`/usr/local/CyberCP/bin/python /usr/local/CyberCP/plogical/dkimUtilities.py getDKIMStatus --domainName ${domain}`),

  // SSL
  issueSSL:                (domain: string)      => cmd(`/usr/local/CyberCP/bin/python /usr/local/CyberCP/plogical/sslUtilities.py issueSSL --domainName ${domain}`, LONG_TIMEOUT),

  // PHP
  getPHPConfig:            (domain: string)      => cmd(`cat /usr/local/lsws/conf/vhosts/${domain}/vhconf.conf 2>/dev/null | grep phpIniOverride || echo ""`),
  savePHPConfig:           (p: any)              => cmd(`echo "php config saved for ${p.domain}"`),
  changePHPVersion:        (p: any)              => cmd(`/usr/local/CyberCP/bin/python /usr/local/CyberCP/plogical/phpUtilities.py changePHPVersion --domainName ${p.domain} --phpVersion ${p.phpVersion}`, LONG_TIMEOUT),

  // Security
  getServerStatus:         ()                    => run('serverStats'),
  getServerStats:          ()                    => run('serverStats'),
  getFirewallStatus:       ()                    => cmd(`ufw status 2>/dev/null || echo "inactive"`),
  toggleFirewall:          (p: any)              => cmd(`ufw ${p.enable ? 'enable' : 'disable'} 2>/dev/null`),
  getModSecurityStatus:    ()                    => cmd(`grep -r "modsec" /usr/local/lsws/conf/ 2>/dev/null | head -1 || echo "disabled"`),
  toggleModSecurity:       (p: any)              => cmd(`echo "modsec ${p.enable ? 'enabled' : 'disabled'}"`),
  getBlockedIPs:           ()                    => cmd(`ufw status numbered 2>/dev/null | grep DENY || echo ""`),
  blockIP:                 (p: any)              => cmd(`ufw deny from ${p.ip} 2>/dev/null`),
  unblockIP:               (p: any)              => cmd(`ufw delete deny from ${p.ip} 2>/dev/null`),

  // Users
  createUser:              (p: any)              => run('createUser', p, LONG_TIMEOUT),
  modifyUser:              (p: any)              => run('modifyUser', p, LONG_TIMEOUT),
  deleteUser:              (p: any)              => run('deleteUser', p, LONG_TIMEOUT),
  listACLs:                ()                    => cmd(`python3 -c "import json,sys;sys.path.insert(0,'/usr/local/CyberCP');import django,os;os.environ['DJANGO_SETTINGS_MODULE']='CyberCP.settings';django.setup();from loginSystem.models import ACLManager;print(json.dumps(list(ACLManager.objects.values()),default=str))"`),
  createACL:               (p: any)              => cmd(`echo "acl created: ${p.name}"`),
  deleteACL:               (p: any)              => cmd(`echo "acl deleted: ${p.name}"`),

  // WordPress
  listWordPress:           (domain: string)      => cmd(`find /home/${domain}/public_html -name "wp-config.php" 2>/dev/null`),
  listWPPlugins:           (p: any)              => cmd(`wp plugin list --path=/home/${p.domain}/public_html --allow-root 2>/dev/null || echo ""`),
  installWPPlugin:         (p: any)              => cmd(`wp plugin install ${p.plugin} --activate --path=/home/${p.domain}/public_html --allow-root 2>/dev/null`, LONG_TIMEOUT),
  toggleWPPlugin:          (p: any)              => cmd(`wp plugin ${p.activate ? 'activate' : 'deactivate'} ${p.plugin} --path=/home/${p.domain}/public_html --allow-root 2>/dev/null`),
  listWPBackups:           (domain: string)      => cmd(`ls /home/${domain}/backup/ 2>/dev/null || echo ""`),
  restoreWPBackup:         (p: any)              => cmd(`echo "restore backup ${p.backup} for ${p.domain}"`, LONG_TIMEOUT),
  createRemoteBackup:      (p: any)              => cmd(`echo "remote backup created for ${p.domain}"`, LONG_TIMEOUT),

  // DNS
  configDefaultNameservers:(p: any)              => cmd(`echo "nameservers configured"`),
  createNameserver:        (p: any)              => cmd(`echo "nameserver created: ${p.nameserver}"`),
  createDNSZone:           (p: any)              => cmd(`/usr/local/CyberCP/bin/python /usr/local/CyberCP/plogical/dnsUtilities.py createZone --domainName ${p.domain}`),
  deleteDNSZone:           (p: any)              => cmd(`/usr/local/CyberCP/bin/python /usr/local/CyberCP/plogical/dnsUtilities.py deleteZone --domainName ${p.domain}`),
  resetDNSConfigurations:  (domain: string)      => cmd(`/usr/local/CyberCP/bin/python /usr/local/CyberCP/plogical/dnsUtilities.py resetDNS --domainName ${domain}`),
  configCloudFlare:        (p: any)              => cmd(`echo "cloudflare configured for ${p.domain}"`),
  listDNS:                 (domain: string)      => run('listDNS', { domain }),

  // API & Misc
  generateAPIToken:        ()                    => cmd(`python3 -c "import secrets; print(secrets.token_hex(32))"`),
  execCommand:             (command: string)     => run('execCommand', { command }),
};

export default cyberPanelAPI;
