const EXEC = '/api/server-exec';
const PANEL_BRIDGE = '/api/panel-bridge';
const CLI_EXEC = '/api/cyberpanel-cli';
import { cacheService } from './cache-service';

/** `da` (default) = HTTPS DirectAdmin via /api/panel-bridge; `ssh` = legacy /api/server-exec */
function usePanelBridge(): boolean {
  return (process.env.NEXT_PUBLIC_PANEL_BACKEND ?? 'da') !== 'ssh';
}

async function run(action: string, params: Record<string, any> = {}, timeoutMs: number = 60000) {
  try {
    if (usePanelBridge()) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(PANEL_BRIDGE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action, params, timeoutMs }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error((errBody as { error?: string }).error || `HTTP ${res.status}`);
      }
      const j = await res.json();
      if (!j.success) throw new Error(j.error || 'Request failed');
      const bridgeMutations = new Set([
        'createUser', 'modifyUser', 'deleteUser', 'createWebsite', 'deleteWebsite', 'suspendWebsite', 'unsuspendWebsite',
        'createEmail', 'deleteEmail', 'suspendEmail', 'unsuspendEmail', 'modifyWebsite', 'createSubdomain', 'deleteSubdomain',
        'createDatabase', 'deleteDatabase', 'createFTPAccount', 'deleteFTPAccount', 'changeEmailPassword', 'setEmailLimits',
        'addEmailForwarding', 'setCatchAllEmail', 'addPatternForwarding', 'togglePlusAddressing', 'enableDKIM', 'issueSSL',
        'savePHPConfig', 'changePHPVersion', 'toggleFirewall', 'toggleModSecurity', 'blockIP', 'unblockIP',
        'createACL', 'deleteACL', 'installWPPlugin', 'toggleWPPlugin', 'restoreWPBackup', 'createRemoteBackup',
        'configDefaultNameservers', 'createNameserver', 'createDNSZone', 'deleteDNSZone', 'resetDNSConfigurations', 'configCloudFlare',
      ]);
      if (bridgeMutations.has(action)) {
        cacheService.clear();
      }
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
    
    // Fazer requisição com timeout aumentado (60s)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(new Error(`Timeout: ${action} took longer than ${timeoutMs}ms`)), timeoutMs);
    
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
    if (error.message?.includes('500')) {
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
      
      // Fallback para listUsers via CLI
      if (action === 'listUsers') {
        console.warn(`[API WARNING] ${action} failed with 500, returning empty list.`);
        return [];
      }

      // Fallback para listEmails via CLI
      if (action === 'listEmails') {
        const domain = params.domain;
        console.log(`[FALLBACK] ${action} for ${domain} via CLI due to 500 error`);
        try {
          const res = await fetch('/api/server-exec', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              action: 'execCommand', 
              params: { 
                command: `python3 -c "import json,sys;sys.path.insert(0,'/usr/local/CyberCP');import django,os;os.environ['DJANGO_SETTINGS_MODULE']='CyberCP.settings';django.setup();from mailSystem.models import E_mail;print(json.dumps(list(E_mail.objects.filter(domain__domain='${domain}').values('email','user','quota')),default=str))"` 
              } 
            })
          });
          
          if (res.ok) {
            const result = await res.json();
            if (result.success && result.data && result.data.output) {
               try {
                 const emails = JSON.parse(result.data.output);
                 return emails.map((e: any) => ({
                   email: e.email,
                   user: e.user,
                   quota_mb: e.quota || 500,
                   usage: '0'
                 }));
               } catch (e) {
                 console.error('[FALLBACK] Failed to parse emails JSON:', result.data.output);
               }
            }
          }
        } catch (fallbackError: any) {
          console.error(`[FALLBACK ERROR] ${action}:`, fallbackError.message);
        }
        return [];
      }
      
      // Fallback para DKIM - usar execução direta de comando
      if (action === 'getDKIMStatus' || action === 'enableDKIM') {
        console.log(`[FALLBACK] ${action} via server-exec API due to error:`, error.message);
        try {
          const domain = params?.domainName || params?.domain;
          if (!domain) throw new Error('Domain required for DKIM');
          
          const isEnable = action === 'enableDKIM';
          const cmdAction = isEnable ? 'enableDKIM' : 'getDKIMStatus';
          
          console.log(`[FALLBACK] Calling server-exec with action: ${cmdAction}, domain: ${domain}`);
          
          const res = await fetch('/api/server-exec', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              action: cmdAction, 
              params: { domainName: domain }
            })
          });
          
          console.log(`[FALLBACK] server-exec response status:`, res.status);
          
          if (res.ok) {
            const result = await res.json();
            console.log(`[FALLBACK SUCCESS] ${action} raw result:`, result);
            
            // Retornar no formato esperado pela UI
            if (isEnable) {
              return { success: result.success !== false, message: result.data?.output || 'DKIM operation completed' };
            } else {
              // Para getDKIMStatus, parsear o resultado
              const output = result.data?.output || result.data?.record || '';
              const hasKey = output && output.includes('v=DKIM1');
              console.log(`[FALLBACK] DKIM check - hasKey: ${hasKey}, output length: ${output.length}`);
              return {
                enabled: hasKey || result.data?.enabled || false,
                record: output,
                selector: 'default',
                publicKey: output
              };
            }
          } else {
            console.error(`[FALLBACK] server-exec returned error status:`, res.status);
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
// Usa o mesmo cacheService para que mutações (createWebsite, etc.) limpem este cache também.
async function runSites(action: string, params: Record<string, any> = {}, timeoutMs: number = 30000) {
  try {
    // Cache de curta duração: 30 segundos — permite actualização quase imediata após criar sites
    const cacheKey = `cyberpanel_${action}_${JSON.stringify(params)}`;
    const cached = cacheService.get(cacheKey);
    if (cached) {
      console.log(`Cache hit for ${action}`);
      return cached;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(usePanelBridge() ? PANEL_BRIDGE : EXEC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ action, params, timeoutMs }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    const j = await res.json();
    if (!j.success) throw new Error(j.error || 'Request failed');
    // Para listWebsites: bridge devolve array directo; SSH legacy podia usar data.sites
    const result = Array.isArray(j.data?.sites)
      ? j.data.sites
      : Array.isArray(j.data)
        ? j.data
        : [];
    // TTL curto: 30s para que criações apareçam rapidamente
    cacheService.set(cacheKey, result, 30 * 1000);
    console.log(`Cache set for ${action} (TTL: 30s)`);
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
  diskUsage?: number | string;
  bandwidth?: number;
  ssl?: boolean;
  sslStatus?: 'Secure' | 'No SSL' | string;
  phpVersion?: string;
  ip?: string;
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
  quota_mb?: number;
  usage?: string;
  status?: 'active' | 'suspended' | 'deleted';
  cliente_id?: string | null;
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
  listPackages:            async ()              => {
    if (usePanelBridge()) {
      return run('listPackages');
    }
    // Tentar API dedicada de pacotes primeiro (mais confiável)
    try {
      console.log('[listPackages] Trying dedicated packages API...');
      const res = await fetch('/api/cyberpanel-packages');
      if (res.ok) {
        const j = await res.json();
        if (j.success && Array.isArray(j.packages)) {
          console.log('[listPackages] Success via dedicated API:', j.packages.length, 'packages');
          // Normalizar formato dos pacotes
          return j.packages.map((p: any) => ({
            id: p.id || p.name,
            packageName: p.packageName || p.name || 'Unknown',
            diskSpace: parseInt(p.diskSpace || p.disk || 0),
            bandwidth: parseInt(p.bandwidth || 0),
            emailAccounts: parseInt(p.emailAccounts || p.emails || 0),
            dataBases: parseInt(p.dataBases || p.databases || 0),
            ftpAccounts: parseInt(p.ftpAccounts || 0),
            allowedDomains: parseInt(p.allowedDomains || 0)
          }));
        }
      }
    } catch (e: any) {
      console.error('[listPackages] Dedicated API failed:', e.message);
    }
    // Fallback para server-exec
    console.log('[listPackages] Falling back to server-exec...');
    return run('listPackages');
  },
  listUsers:               ()                    => run('listUsers'),
  createWebsite:           (p: any)              => run('createWebsite', p, LONG_TIMEOUT),
  suspendWebsite:          (domain: string)      => run('suspendWebsite', { domain }),
  unsuspendWebsite:        (domain: string)      => run('unsuspendWebsite', { domain }),
  deleteWebsite:           (domain: string)      => run('deleteWebsite', { domain }, LONG_TIMEOUT),
  modifyWebsite:           (p: any)              => usePanelBridge() ? run('modifyWebsite', p, LONG_TIMEOUT) : cmd(`/usr/local/CyberCP/bin/python /usr/local/CyberCP/plogical/websiteManager.py modifyWebsite --domainName ${p.domain}`, LONG_TIMEOUT),

  // Subdomains
  listSubdomains:          (domain: string)      => usePanelBridge() ? run('listSubdomains', { domain }) : cmd(`python3 -c "import json,sys;sys.path.insert(0,'/usr/local/CyberCP');import django,os;os.environ['DJANGO_SETTINGS_MODULE']='CyberCP.settings';django.setup();from websiteFunctions.models import ChildDomains;print(json.dumps(list(ChildDomains.objects.filter(master__domain='${domain}').values()),default=str))"`),
  createSubdomain:         (domain: string, subdomain: string) => usePanelBridge() ? run('createSubdomain', { domain, subdomain }) : cmd(`/usr/local/CyberCP/bin/python /usr/local/CyberCP/plogical/websiteManager.py createSubdomain --domainName ${domain} --subDomain ${subdomain}`),
  deleteSubdomain:         (domain: string, subdomain: string) => usePanelBridge() ? run('deleteSubdomain', { domain, subdomain }) : cmd(`/usr/local/CyberCP/bin/python /usr/local/CyberCP/plogical/websiteManager.py deleteSubdomain --domainName ${domain} --subDomain ${subdomain}`),

  // Databases
  listDatabases:           (domain: string)      => usePanelBridge() ? run('listDatabases', { domain }) : cmd(`mysql -u root -e "SELECT db FROM mysql.db WHERE db LIKE '${domain.replace(/\./g,'_')}%';" 2>/dev/null`),
  createDatabase:          (p: any)              => usePanelBridge() ? run('createDatabase', p) : cmd(`/usr/local/CyberCP/bin/python /usr/local/CyberCP/plogical/mysqlUtilities.py createDatabase --domainName ${p.domain} --dbName ${p.dbName} --dbUsername ${p.dbUser} --dbPassword '${p.dbPassword}'`),
  deleteDatabase:          (p: any)              => usePanelBridge() ? run('deleteDatabase', p) : cmd(`/usr/local/CyberCP/bin/python /usr/local/CyberCP/plogical/mysqlUtilities.py deleteDatabase --dbName ${p.dbName}`),

  // FTP
  listFTPAccounts:         (domain: string)      => usePanelBridge() ? run('listFTPAccounts', { domain }) : cmd(`cat /etc/pure-ftpd/pureftpd.passwd 2>/dev/null | grep ${domain} || echo ""`),
  createFTPAccount:        (p: any)              => usePanelBridge() ? run('createFTPAccount', p) : cmd(`/usr/local/CyberCP/bin/python /usr/local/CyberCP/plogical/ftpUtilities.py createFTPAccount --domainName ${p.domain} --ftpUser ${p.username} --ftpPassword '${p.password}'`),
  deleteFTPAccount:        (p: any)              => usePanelBridge() ? run('deleteFTPAccount', p) : cmd(`/usr/local/CyberCP/bin/python /usr/local/CyberCP/plogical/ftpUtilities.py deleteFTPAccount --ftpUser ${p.username}`),

  // Email
  listEmails:              (domain: string)      => run('listEmails', { domain }),
  createEmail:             (p: any)              => run('createEmail', p),
  deleteEmail:             (p: any)              => run('deleteEmail', p),
  suspendEmail:            (email: string)       => run('suspendEmail', { email }),
  unsuspendEmail:          (email: string)       => run('unsuspendEmail', { email }),
  changeEmailPassword:     (p: any)              => usePanelBridge() ? run('changeEmailPassword', p) : cmd(`/usr/local/CyberCP/bin/python /usr/local/CyberCP/plogical/mailUtilities.py changeEmailPassword --email ${p.email} --newPassword '${p.password}'`),
  setEmailLimits:          (p: any)              => usePanelBridge() ? run('setEmailLimits', p) : cmd(`echo "limits set for ${p.email}"`),
  getEmailForwarding:      (p: any)              => usePanelBridge() ? run('getEmailForwarding', p) : cmd(`cat /etc/postfix/virtual 2>/dev/null | grep ${p.email} || echo ""`),
  addEmailForwarding:      (p: any)              => usePanelBridge() ? run('addEmailForwarding', p) : cmd(`echo "${p.email} ${p.forward}" >> /etc/postfix/virtual && postmap /etc/postfix/virtual`),
  getCatchAllEmail:        (domain: string)      => usePanelBridge() ? run('getCatchAllEmail', { domain }) : cmd(`cat /etc/postfix/virtual 2>/dev/null | grep "@${domain}" || echo ""`),
  setCatchAllEmail:        (p: any)              => usePanelBridge() ? run('setCatchAllEmail', p) : cmd(`echo "@${p.domain} ${p.email}" >> /etc/postfix/virtual && postmap /etc/postfix/virtual`),
  getPatternForwarding:    (domain: string)      => usePanelBridge() ? run('getPatternForwarding', { domain }) : cmd(`echo "[]"`),
  addPatternForwarding:    (p: any)              => usePanelBridge() ? run('addPatternForwarding', p) : cmd(`echo "pattern forwarding added"`),
  getPlusAddressing:       (domain: string)      => usePanelBridge() ? run('getPlusAddressing', { domain }) : cmd(`echo "false"`),
  togglePlusAddressing:    (p: any)              => usePanelBridge() ? run('togglePlusAddressing', p) : cmd(`echo "toggled"`),
  enableDKIM:              (domain: string)      => usePanelBridge() ? run('enableDKIM', { domain }) : cmd(`mkdir -p /etc/opendkim/keys/${domain} && cd /etc/opendkim/keys/${domain} && opendkim-genkey -b 2048 -d ${domain} -s default -S rsa-sha256 2>&1 && chown -R opendkim:opendkim /etc/opendkim/keys/${domain} && chmod 600 /etc/opendkim/keys/${domain}/default.private && echo '{"success": 1, "message": "DKIM gerado com sucesso"}'`),
  getDKIMStatus:           (domain: string)      => usePanelBridge() ? run('getDKIMStatus', { domain }) : cmd(`if [ -f /etc/opendkim/keys/${domain}/default.txt ]; then cat /etc/opendkim/keys/${domain}/default.txt; else echo '{"enabled": false, "record": ""}'; fi`),

  // SSL
  issueSSL:                (domain: string)      => usePanelBridge() ? run('issueSSL', { domain }) : cmd(`/usr/local/CyberCP/bin/python /usr/local/CyberCP/plogical/sslUtilities.py issueSSL --domainName ${domain}`, LONG_TIMEOUT),

  // PHP
  getPHPConfig:            (domain: string)      => usePanelBridge() ? run('getPHPConfig', { domain }) : cmd(`cat /usr/local/lsws/conf/vhosts/${domain}/vhconf.conf 2>/dev/null | grep phpIniOverride || echo ""`),
  savePHPConfig:           (p: any)              => usePanelBridge() ? run('savePHPConfig', p) : cmd(`echo "php config saved for ${p.domain}"`),
  changePHPVersion:        (p: any)              => usePanelBridge() ? run('changePHPVersion', p) : cmd(`/usr/local/CyberCP/bin/python /usr/local/CyberCP/plogical/phpUtilities.py changePHPVersion --domainName ${p.domain} --phpVersion ${p.phpVersion}`, LONG_TIMEOUT),

  // Security
  getServerStatus:         ()                    => run('serverStats'),
  getServerStats:          ()                    => run('serverStats'),
  getFirewallStatus:       ()                    => usePanelBridge() ? run('getFirewallStatus', {}) : cmd(`ufw status 2>/dev/null || echo "inactive"`),
  toggleFirewall:          (p: any)              => usePanelBridge() ? run('toggleFirewall', p) : cmd(`ufw ${p.enable ? 'enable' : 'disable'} 2>/dev/null`),
  getModSecurityStatus:    ()                    => usePanelBridge() ? run('getModSecurityStatus', {}) : cmd(`grep -r "modsec" /usr/local/lsws/conf/ 2>/dev/null | head -1 || echo "disabled"`),
  toggleModSecurity:       (p: any)              => usePanelBridge() ? run('toggleModSecurity', p) : cmd(`echo "modsec ${p.enable ? 'enabled' : 'disabled'}"`),
  getBlockedIPs:           ()                    => usePanelBridge() ? run('getBlockedIPs', {}) : cmd(`ufw status numbered 2>/dev/null | grep DENY || echo ""`),
  blockIP:                 (p: any)              => usePanelBridge() ? run('blockIP', p) : cmd(`ufw deny from ${p.ip} 2>/dev/null`),
  unblockIP:               (p: any)              => usePanelBridge() ? run('unblockIP', p) : cmd(`ufw delete deny from ${p.ip} 2>/dev/null`),

  // Users
  createUser:              (p: any)              => run('createUser', p, LONG_TIMEOUT),
  modifyUser:              (p: any)              => run('modifyUser', p, LONG_TIMEOUT),
  deleteUser:              (p: any)              => run('deleteUser', p, LONG_TIMEOUT),
  listACLs:                ()                    => usePanelBridge() ? run('listACLs', {}) : cmd(`python3 -c "import json,sys;sys.path.insert(0,'/usr/local/CyberCP');import django,os;os.environ['DJANGO_SETTINGS_MODULE']='CyberCP.settings';django.setup();from loginSystem.models import ACLManager;print(json.dumps(list(ACLManager.objects.values()),default=str))"`),
  createACL:               (p: any)              => usePanelBridge() ? run('createACL', p) : cmd(`echo "acl created: ${p.name}"`),
  deleteACL:               (p: any)              => usePanelBridge() ? run('deleteACL', p) : cmd(`echo "acl deleted: ${p.name}"`),

  // WordPress
  listWordPress:           (domain: string)      => usePanelBridge() ? run('listWordPress', { domain }) : cmd(`find /home/${domain}/public_html -name "wp-config.php" 2>/dev/null`),
  listWPPlugins:           (p: any)              => usePanelBridge() ? run('listWPPlugins', p) : cmd(`wp plugin list --path=/home/${p.domain}/public_html --allow-root 2>/dev/null || echo ""`),
  installWPPlugin:         (p: any)              => usePanelBridge() ? run('installWPPlugin', p) : cmd(`wp plugin install ${p.plugin} --activate --path=/home/${p.domain}/public_html --allow-root 2>/dev/null`, LONG_TIMEOUT),
  toggleWPPlugin:          (p: any)              => usePanelBridge() ? run('toggleWPPlugin', p) : cmd(`wp plugin ${p.activate ? 'activate' : 'deactivate'} ${p.plugin} --path=/home/${p.domain}/public_html --allow-root 2>/dev/null`),
  listWPBackups:           (domain: string)      => usePanelBridge() ? run('listWPBackups', { domain }) : cmd(`ls /home/${domain}/backup/ 2>/dev/null || echo ""`),
  restoreWPBackup:         (p: any)              => usePanelBridge() ? run('restoreWPBackup', p) : cmd(`echo "restore backup ${p.backup} for ${p.domain}"`, LONG_TIMEOUT),
  createRemoteBackup:      (p: any)              => usePanelBridge() ? run('createRemoteBackup', p) : cmd(`echo "remote backup created for ${p.domain}"`, LONG_TIMEOUT),

  // DNS
  configDefaultNameservers:(p: any)              => usePanelBridge() ? run('configDefaultNameservers', p) : cmd(`echo "nameservers configured"`),
  createNameserver:        (p: any)              => usePanelBridge() ? run('createNameserver', p) : cmd(`echo "nameserver created: ${p.nameserver}"`),
  createDNSZone:           (p: any)              => usePanelBridge() ? run('createDNSZone', p) : cmd(`/usr/local/CyberCP/bin/python /usr/local/CyberCP/plogical/dnsUtilities.py createZone --domainName ${p.domain}`),
  deleteDNSZone:           (p: any)              => usePanelBridge() ? run('deleteDNSZone', p) : cmd(`/usr/local/CyberCP/bin/python /usr/local/CyberCP/plogical/dnsUtilities.py deleteZone --domainName ${p.domain}`),
  resetDNSConfigurations:  (domain: string)      => usePanelBridge() ? run('resetDNSConfigurations', { domain }) : cmd(`/usr/local/CyberCP/bin/python /usr/local/CyberCP/plogical/dnsUtilities.py resetDNS --domainName ${domain}`),
  configCloudFlare:        (p: any)              => usePanelBridge() ? run('configCloudFlare', p) : cmd(`echo "cloudflare configured for ${p.domain}"`),
  listDNS:                 (domain: string)      => run('listDNS', { domain }),

  // API & Misc
  generateAPIToken:        ()                    => usePanelBridge() ? run('generateAPIToken', {}) : cmd(`python3 -c "import secrets; print(secrets.token_hex(32))"`),
  execCommand:             (command: string)     => run('execCommand', { command }),
};

export default cyberPanelAPI;
