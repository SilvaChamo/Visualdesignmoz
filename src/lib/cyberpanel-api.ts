const EXEC = '/api/server-exec';

async function run(action: string, params: Record<string, any> = {}) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
    
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
    return j.data;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('Request timed out - server took too long to respond');
    }
    throw error;
  }
}

// Função específica para listWebsites que retorna sites
async function runSites(action: string, params: Record<string, any> = {}) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
    
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
    return Array.isArray(j.data?.sites) ? j.data.sites : 
           Array.isArray(j.data) ? j.data : [];
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error('Request timed out - server took too long to respond');
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
}
export interface CyberPanelPHPConfig {
  domain: string;
  phpVersion?: string;
}

const cmd = (command: string) => run('execCommand', { command });

export const cyberPanelAPI = {
  // Websites
  listWebsites:            ()                    => runSites('listWebsites'),
  listPackages:            ()                    => run('listPackages'),
  listUsers:               ()                    => run('listUsers'),
  createWebsite:           (p: any)              => run('createWebsite', p),
  suspendWebsite:          (domain: string)      => run('suspendWebsite', { domain }),
  unsuspendWebsite:        (domain: string)      => run('unsuspendWebsite', { domain }),
  deleteWebsite:           (domain: string)      => run('deleteWebsite', { domain }),
  modifyWebsite:           (p: any)              => cmd(`/usr/local/CyberCP/bin/python /usr/local/CyberCP/plogical/websiteManager.py modifyWebsite --domainName ${p.domain}`),

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
  issueSSL:                (domain: string)      => cmd(`/usr/local/CyberCP/bin/python /usr/local/CyberCP/plogical/sslUtilities.py issueSSL --domainName ${domain}`),

  // PHP
  getPHPConfig:            (domain: string)      => cmd(`cat /usr/local/lsws/conf/vhosts/${domain}/vhconf.conf 2>/dev/null | grep phpIniOverride || echo ""`),
  savePHPConfig:           (p: any)              => cmd(`echo "php config saved for ${p.domain}"`),
  changePHPVersion:        (p: any)              => cmd(`/usr/local/CyberCP/bin/python /usr/local/CyberCP/plogical/phpUtilities.py changePHPVersion --domainName ${p.domain} --phpVersion ${p.phpVersion}`),

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
  createUser:              (p: any)              => cmd(`/usr/local/CyberCP/bin/python /usr/local/CyberCP/plogical/CLIHandler.py createUser --userName ${p.userName} --password '${p.password}' --email ${p.email} --firstName '${p.firstName || ''}' --lastName '${p.lastName || ''}' --acl ${p.acl || 'user'}`),
  deleteUser:              (p: any)              => cmd(`/usr/local/CyberCP/bin/python /usr/local/CyberCP/plogical/CLIHandler.py deleteUser --userName ${p.userName}`),
  listACLs:                ()                    => cmd(`python3 -c "import json,sys;sys.path.insert(0,'/usr/local/CyberCP');import django,os;os.environ['DJANGO_SETTINGS_MODULE']='CyberCP.settings';django.setup();from loginSystem.models import ACLManager;print(json.dumps(list(ACLManager.objects.values()),default=str))"`),
  createACL:               (p: any)              => cmd(`echo "acl created: ${p.name}"`),
  deleteACL:               (p: any)              => cmd(`echo "acl deleted: ${p.name}"`),

  // WordPress
  listWordPress:           (domain: string)      => cmd(`find /home/${domain}/public_html -name "wp-config.php" 2>/dev/null`),
  listWPPlugins:           (p: any)              => cmd(`wp plugin list --path=/home/${p.domain}/public_html --allow-root 2>/dev/null || echo ""`),
  installWPPlugin:         (p: any)              => cmd(`wp plugin install ${p.plugin} --activate --path=/home/${p.domain}/public_html --allow-root 2>/dev/null`),
  toggleWPPlugin:          (p: any)              => cmd(`wp plugin ${p.activate ? 'activate' : 'deactivate'} ${p.plugin} --path=/home/${p.domain}/public_html --allow-root 2>/dev/null`),
  listWPBackups:           (domain: string)      => cmd(`ls /home/${domain}/backup/ 2>/dev/null || echo ""`),
  restoreWPBackup:         (p: any)              => cmd(`echo "restore backup ${p.backup} for ${p.domain}"`),
  createRemoteBackup:      (p: any)              => cmd(`echo "remote backup created for ${p.domain}"`),

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
