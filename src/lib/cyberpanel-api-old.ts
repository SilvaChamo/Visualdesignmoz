// CyberPanel API Integration
// Library to manage the new private infrastructure (VPS 109.199.104.22)

export interface CyberPanelWebsite {
    domain: string;
    adminEmail: string;
    package: string;
    owner: string;
    status: 'Active' | 'Suspended';
    diskUsage: string;
    bandwidthUsage: string;
}

export interface CyberPanelPackage {
    packageName: string;
    diskSpace: number;     // MB
    bandwidth: number;     // MB
    emailAccounts: number;
    dataBases: number;
    ftpAccounts: number;
    allowedDomains: number;
}

export interface CyberPanelEmail {
    email: string;
    quota: string;
    usage: string;
}

export interface WPInstallParams {
    domainName: string;
    wpTitle: string;
    wpUser: string;
    wpPassword: string;
}

export interface CyberPanelDNSRecord {
    id?: number;
    name: string;
    type: string;
    value: string;
    ttl: number;
    priority?: number;
}

export interface CyberPanelSubdomain {
    subdomain: string;
    domain: string;
    path: string;
}

export interface CyberPanelUser {
    userName: string;
    firstName: string;
    lastName: string;
    email: string;
    acl: string;
    websitesLimit: number;
    status: string;
}

export interface CyberPanelDatabase {
    dbName: string;
    dbUser: string;
}

export interface CyberPanelFTPAccount {
    userName: string;
    path: string;
}

export interface CyberPanelPHPConfig {
    phpVersion: string;
    maxExecutionTime: string;
    memoryLimit: string;
    uploadMaxFilesize: string;
    postMaxSize: string;
    maxInputVars: string;
    maxInputTime: string;
}

export interface CyberPanelSSLInfo {
    domain: string;
    issuer: string;
    expiry: string;
    status: string;
}

export interface CyberPanelResellerACL {
    name: string;
    createWebsite: boolean;
    deleteWebsite: boolean;
    suspendWebsite: boolean;
    createPackage: boolean;
    deletePackage: boolean;
    createEmail: boolean;
    deleteEmail: boolean;
    createDNS: boolean;
    createDatabase: boolean;
    createFTP: boolean;
}

class CyberPanelAPI {
    private baseUrl: string;
    private adminUser: string = 'admin'; // Default administrator
    private adminPass: string = process.env.CYBERPANEL_PASS || '';      // Set from environment variables

    constructor() {
        this.baseUrl = 'https://109.199.104.22:8090/api';
    }

    private async makeRequest(endpoint: string, params: Record<string, any> = {}): Promise<any> {
        try {
            const proxyUrl = '/api/cyberpanel-proxy';

            // Always include admin credentials for CyberPanel API calls
            const requestBody = {
                endpoint,
                params: {
                    ...params,
                    adminUser: this.adminUser,
                    adminPass: this.adminPass
                }
            };

            console.log('Making CyberPanel API request via proxy:', endpoint);

            const response = await fetch(proxyUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                let errorMessage = `CyberPanel Proxy error! status: ${response.status}`;
                try {
                    const errorBody = await response.json();
                    if (errorBody.fix) {
                        errorMessage = `${errorBody.error_message || 'CyberPanel API Error'}\n\n${errorBody.fix}`;
                    } else {
                        errorMessage = errorBody.error_message || errorBody.details || errorBody.error || errorMessage;
                    }
                } catch { }
                throw new Error(errorMessage);
            }

            const data = await response.json();

            // CyberPanel returns status:0 on failure, status:1 on success
            // error_message:'None' is Python None — normal on success responses, only meaningful when status:0
            if (data.status === 0) {
                const msg = (!data.error_message || data.error_message === 'None')
                    ? 'O domínio já existe no servidor ou os parâmetros são inválidos.'
                    : `CyberPanel API Error: ${data.error_message}`;
                throw new Error(msg);
            }

            return data;
        } catch (error) {
            console.error('CyberPanel API Client Error:', error);
            throw error;
        }
    }

    // --- Website Management ---

    async listWebsites(): Promise<CyberPanelWebsite[]> {
        const parseSites = (arr: any[]): CyberPanelWebsite[] =>
            arr.map((site: any) => ({
                domain: site.domain || site.domainName || '',
                adminEmail: site.adminEmail || site.ownerEmail || '',
                package: site.package || site.packageName || 'Default',
                owner: site.owner || site.websiteOwner || 'admin',
                status: site.status || site.state || 'Active',
                diskUsage: site.diskUsage || site.diskspace || '',
                bandwidthUsage: site.bandwidthUsage || site.bandwidth || '',
            })).filter(s => s.domain);

        const tryFetch = async (endpoint: string, extra: Record<string, any> = {}) => {
            try {
                const result = await this.makeRequest(endpoint, extra);
                console.log(`[listWebsites] ${endpoint} (${JSON.stringify(extra)}):`, JSON.stringify(result).substring(0, 300));
                const arr = result.websiteData || result.data || result.websitesData || result.websites || result.websiteList || [];
                if (Array.isArray(arr) && arr.length > 0) return parseSites(arr);
            } catch (e: any) {
                console.log(`[listWebsites] ${endpoint} failed:`, e?.message);
            }
            return null;
        };

        // Step 1: try to get admin's actual email from fetchUsers, then use it
        let adminEmail: string | null = null;
        try {
            const usersResult = await this.makeRequest('fetchUsers');
            const usersArr = usersResult?.data || usersResult?.users || [];
            if (Array.isArray(usersArr)) {
                const adminUser = usersArr.find((u: any) => u.userName === 'admin' || u.username === 'admin');
                if (adminUser?.email) adminEmail = adminUser.email;
            }
        } catch { /* ignore */ }

        if (adminEmail) {
            const result = await tryFetch('fetchWebsites', { ownerEmail: adminEmail });
            if (result) return result;
        }

        // Step 2: fallback attempts with common patterns
        return (
            await tryFetch('fetchWebsites') ||
            await tryFetch('fetchWebsites', { websiteOwner: 'admin' }) ||
            await tryFetch('listWebsites') ||
            await tryFetch('fetchSitesv2') ||
            await tryFetch('getUsersWebsites', { websiteOwner: 'admin' }) ||
            []
        );
    }

    async createWebsite(params: {
        domainName: string;
        ownerEmail: string;
        packageName: string;
        phpSelection: string;
    }): Promise<boolean> {
        // CyberPanel requires ownerEmail to match an existing CyberPanel user's email.
        // Try to get the admin's real email from fetchUsers first.
        let ownerEmail = params.ownerEmail;
        try {
            const usersResult = await this.makeRequest('fetchUsers');
            const usersArr = usersResult?.data || usersResult?.users || [];
            if (Array.isArray(usersArr)) {
                const adminUser = usersArr.find((u: any) => u.userName === 'admin' || u.username === 'admin');
                if (adminUser?.email) ownerEmail = adminUser.email;
            }
        } catch { /* use provided email */ }

        const requestParams = {
            domainName: params.domainName,
            ownerEmail,
            websiteOwner: 'admin',
            packageName: params.packageName,
            phpSelection: params.phpSelection,
            ssl: 1,
            dkimCheck: 1,
            openBasedir: 1,
        };
        // Let the error throw naturally so callers get the real reason
        const result = await this.makeRequest('createWebsite', requestParams);
        return result.status === 1;
    }

    async installWordPress(params: WPInstallParams): Promise<boolean> {
        try {
            const requestParams = {
                domainName: params.domainName,
                wpTitle: params.wpTitle,
                wpUser: params.wpUser,
                wpPassword: params.wpPassword
            };

            // Usage of our specialized SSH-based WP install route
            // Because CyberPanel's REST API lacks a functional WP installer endpoint publicly
            const response = await fetch('/api/cyberpanel-wp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestParams),
            });

            const result = await response.json();

            if (!response.ok) {
                console.error(`Failed to install WordPress on ${params.domainName}:`, result.error || result.details);
                return false;
            }

            return result.success === true;
        } catch (error) {
            console.error(`Failed to install WordPress on ${params.domainName}:`, error);
            return false;
        }
    }

    // --- WP Manager & Operations ---

    async issueSSL(domainName: string): Promise<boolean> {
        try {
            const result = await this.makeRequest('issueSSL', { domainName });
            return result.status === 1 || result.success === 1;
        } catch (error) {
            console.error(`Failed to issue SSL for ${domainName}:`, error);
            return false;
        }
    }

    async wpAutoLogin(domainName: string): Promise<string | null> {
        try {
            // This attempts to call a CyberPanel native or plugin endpoint for WP AutoLogin
            const result = await this.makeRequest('wpAutoLogin', { domainName });
            if (result.status === 1 && result.token) {
                return `https://${domainName}/wp-login.php?cyberpanel_token=${result.token}`;
            }
            return null;
        } catch (error) {
            console.error(`Failed to get AutoLogin URL for ${domainName}:`, error);
            return null;
        }
    }

    async purgeLSCache(domainName: string): Promise<boolean> {
        try {
            const result = await this.makeRequest('purgeLSCache', { domainName });
            return result.status === 1 || result.success === 1;
        } catch (error) {
            console.error(`Failed to purge LSCache for ${domainName}:`, error);
            return false;
        }
    }

    async createBackup(domainName: string): Promise<boolean> {
        try {
            const result = await this.makeRequest('submitWebsiteBackup', { websiteName: domainName });
            return result.status === 1 || result.success === 1;
        } catch (error) {
            console.error(`Failed to create backup for ${domainName}:`, error);
            return false;
        }
    }

    // --- Email Management ---

    async listEmails(domain: string): Promise<CyberPanelEmail[]> {
        try {
            const result = await this.makeRequest('fetchEmails', { domainName: domain });
            if (result.status === 1 && Array.isArray(result.data)) {
                return result.data;
            }
            return [];
        } catch (error) {
            console.error(`Failed to fetch emails for ${domain}:`, error);
            return [];
        }
    }

    async createEmail(params: {
        domainName: string;
        emailUser: string;
        emailPass: string;
        quota: number;
    }): Promise<boolean> {
        try {
            const result = await this.makeRequest('createEmail', params);
            return result.status === 1;
        } catch (error) {
            console.error('Failed to create email in CyberPanel:', error);
            return false;
        }
    }

    // --- Package Management ---

    async listPackages(): Promise<CyberPanelPackage[]> {
        try {
            // Some CyberPanel versions don't expose package lists natively via simple endpoints.
            // Using fetchPackages if available, or we will handle fallback in UI if it fails.
            const result = await this.makeRequest('fetchPackages');

            if (result.status === 1 && Array.isArray(result.data)) {
                return result.data.map((pkg: any) => ({
                    packageName: pkg.packageName,
                    diskSpace: pkg.diskSpace,
                    bandwidth: pkg.bandwidth,
                    emailAccounts: pkg.emailAccounts,
                    dataBases: pkg.dataBases,
                    ftpAccounts: pkg.ftpAccounts,
                    allowedDomains: pkg.allowedDomains
                }));
            }

            return [];
        } catch (error) {
            console.error('Failed to fetch CyberPanel packages:', error);
            return [];
        }
    }

    async createPackage(params: {
        packageName: string;
        diskSpace: number;     // MB
        bandwidth: number;     // MB
        emailAccounts: number;
        dataBases: number;
        ftpAccounts: number;
        allowedDomains: number;
    }): Promise<boolean> {
        try {
            // CyberPanel expects string endpoints, and these are the default API parameters for createPackage.
            const result = await this.makeRequest('createPackage', params);
            return result.status === 1 || result.success === 1 || !result.error_message;
        } catch (error) {
            console.error('Failed to create package in CyberPanel:', error);
            return false;
        }
    }

    async deletePackage(packageName: string): Promise<boolean> {
        try {
            const result = await this.makeRequest('deletePackage', { packageName });
            return result.status === 1 || result.success === 1 || !result.error_message;
        } catch (error) {
            console.error('Failed to delete package in CyberPanel:', error);
            return false;
        }
    }

    // --- Subdomain Management ---

    async listSubdomains(domainName: string): Promise<CyberPanelSubdomain[]> {
        try {
            const result = await this.makeRequest('fetchSubDomains', { domainName });
            if (result.status === 1 && Array.isArray(result.data)) {
                return result.data;
            }
            return [];
        } catch (error) {
            console.error(`Failed to fetch subdomains for ${domainName}:`, error);
            return [];
        }
    }

    async createSubdomain(domainName: string, subdomain: string): Promise<boolean> {
        try {
            const result = await this.makeRequest('createSubDomain', { domainName, subDomain: subdomain });
            return result.status === 1;
        } catch (error) {
            console.error('Failed to create subdomain:', error);
            return false;
        }
    }

    async deleteSubdomain(domainName: string, subdomain: string): Promise<boolean> {
        try {
            const result = await this.makeRequest('deleteSubDomain', { domainName, subDomain: subdomain });
            return result.status === 1;
        } catch (error) {
            console.error('Failed to delete subdomain:', error);
            return false;
        }
    }

    // --- Website Operations ---

    async deleteWebsite(domainName: string): Promise<boolean> {
        try {
            const result = await this.makeRequest('deleteWebsite', { domainName });
            return result.status === 1;
        } catch (error) {
            console.error(`Failed to delete website ${domainName}:`, error);
            return false;
        }
    }

    async suspendWebsite(domainName: string): Promise<boolean> {
        try {
            const result = await this.makeRequest('submitWebsiteSuspend', { websiteName: domainName });
            return result.status === 1;
        } catch (error) {
            console.error(`Failed to suspend website ${domainName}:`, error);
            return false;
        }
    }

    async unsuspendWebsite(domainName: string): Promise<boolean> {
        try {
            const result = await this.makeRequest('submitWebsiteUnsuspend', { websiteName: domainName });
            return result.status === 1;
        } catch (error) {
            console.error(`Failed to unsuspend website ${domainName}:`, error);
            return false;
        }
    }

    async changeWebsitePackage(domainName: string, packageName: string): Promise<boolean> {
        try {
            const result = await this.makeRequest('changePackage', { domainName, packageName });
            return result.status === 1;
        } catch (error) {
            console.error(`Failed to change package for ${domainName}:`, error);
            return false;
        }
    }

    // --- DNS Management ---

    async listDNSRecords(domainName: string): Promise<CyberPanelDNSRecord[]> {
        try {
            const result = await this.makeRequest('fetchDNSRecords', { selectedDomain: domainName, currentSelection: domainName });
            if (result.status === 1 && Array.isArray(result.data)) {
                return result.data;
            }
            return [];
        } catch (error) {
            console.error(`Failed to fetch DNS records for ${domainName}:`, error);
            return [];
        }
    }

    async addDNSRecord(domainName: string, name: string, type: string, value: string, ttl: number, priority?: number): Promise<boolean> {
        try {
            const params: any = { selectedDomain: domainName, recordName: name, recordType: type, recordValue: value, ttl };
            if (priority !== undefined) params.priority = priority;
            const result = await this.makeRequest('addDNSRecord', params);
            return result.status === 1;
        } catch (error) {
            console.error('Failed to add DNS record:', error);
            return false;
        }
    }

    async deleteDNSRecord(domainName: string, recordId: number): Promise<boolean> {
        try {
            const result = await this.makeRequest('deleteDNSRecord', { selectedDomain: domainName, id: recordId });
            return result.status === 1;
        } catch (error) {
            console.error('Failed to delete DNS record:', error);
            return false;
        }
    }

    // --- User/Reseller Management ---

    async listUsers(): Promise<CyberPanelUser[]> {
        try {
            const result = await this.makeRequest('fetchUsers');
            if (result.status === 1 && Array.isArray(result.data)) {
                return result.data;
            }
            return [];
        } catch (error) {
            console.error('Failed to fetch users:', error);
            return [];
        }
    }

    async createUser(params: {
        firstName: string;
        lastName: string;
        email: string;
        userName: string;
        password: string;
        websitesLimit: number;
        acl: string;
    }): Promise<boolean> {
        try {
            // CyberPanel expects 'selectedACL' not 'acl'
            const { acl, ...rest } = params;
            const result = await this.makeRequest('submitUserCreation', { ...rest, selectedACL: acl });
            return result.status === 1;
        } catch (error) {
            console.error('Failed to create user:', error);
            return false;
        }
    }

    async deleteUser(userName: string): Promise<boolean> {
        try {
            const result = await this.makeRequest('submitUserDeletion', { accountUsername: userName });
            return result.status === 1;
        } catch (error) {
            console.error('Failed to delete user:', error);
            return false;
        }
    }

    async modifyUser(params: {
        userName: string;
        firstName?: string;
        lastName?: string;
        email?: string;
        websitesLimit?: number;
        acl?: string;
    }): Promise<boolean> {
        try {
            const result = await this.makeRequest('submitUserModify', { accountUsername: params.userName, ...params });
            return result.status === 1;
        } catch (error) {
            console.error('Failed to modify user:', error);
            return false;
        }
    }

    // --- ACL (Reseller Center) ---

    async listACLs(): Promise<string[]> {
        try {
            const result = await this.makeRequest('fetchACLs');
            if (result.status === 1 && Array.isArray(result.data)) {
                return result.data;
            }
            return ['admin', 'reseller', 'user'];
        } catch (error) {
            console.error('Failed to fetch ACLs:', error);
            return ['admin', 'reseller', 'user'];
        }
    }

    async createACL(params: CyberPanelResellerACL): Promise<boolean> {
        try {
            const result = await this.makeRequest('submitACL', params);
            return result.status === 1;
        } catch (error) {
            console.error('Failed to create ACL:', error);
            return false;
        }
    }

    async deleteACL(name: string): Promise<boolean> {
        try {
            const result = await this.makeRequest('deleteACL', { aclName: name });
            return result.status === 1;
        } catch (error) {
            console.error('Failed to delete ACL:', error);
            return false;
        }
    }

    // --- Database Management ---

    async listDatabases(domainName: string): Promise<CyberPanelDatabase[]> {
        try {
            const result = await this.makeRequest('fetchDatabases', { databaseWebsite: domainName });
            if (result.status === 1 && Array.isArray(result.data)) {
                return result.data;
            }
            return [];
        } catch (error) {
            console.error(`Failed to fetch databases for ${domainName}:`, error);
            return [];
        }
    }

    async createDatabase(domainName: string, dbName: string, dbUser: string, dbPassword: string): Promise<boolean> {
        try {
            const result = await this.makeRequest('submitDBCreation', {
                databaseWebsite: domainName, dbName, dbUsername: dbUser, dbPassword
            });
            return result.status === 1;
        } catch (error) {
            console.error('Failed to create database:', error);
            return false;
        }
    }

    async deleteDatabase(domainName: string, dbName: string): Promise<boolean> {
        try {
            const result = await this.makeRequest('submitDBDeletion', { databaseWebsite: domainName, dbName });
            return result.status === 1;
        } catch (error) {
            console.error('Failed to delete database:', error);
            return false;
        }
    }

    // --- FTP Management ---

    async listFTPAccounts(domainName: string): Promise<CyberPanelFTPAccount[]> {
        try {
            const result = await this.makeRequest('fetchFTPAccounts', { domainName });
            if (result.status === 1 && Array.isArray(result.data)) {
                return result.data;
            }
            return [];
        } catch (error) {
            console.error(`Failed to fetch FTP accounts for ${domainName}:`, error);
            return [];
        }
    }

    async createFTPAccount(domainName: string, userName: string, password: string, path: string): Promise<boolean> {
        try {
            const result = await this.makeRequest('submitFTPCreation', { domainName, userName, password, path });
            return result.status === 1;
        } catch (error) {
            console.error('Failed to create FTP account:', error);
            return false;
        }
    }

    async deleteFTPAccount(domainName: string, userName: string): Promise<boolean> {
        try {
            const result = await this.makeRequest('submitFTPDelete', { domainName, userName });
            return result.status === 1;
        } catch (error) {
            console.error('Failed to delete FTP account:', error);
            return false;
        }
    }

    // --- Email Extended ---

    async deleteEmail(domainName: string, email: string): Promise<boolean> {
        try {
            const result = await this.makeRequest('deleteEmail', { domainName, email });
            return result.status === 1;
        } catch (error) {
            console.error('Failed to delete email:', error);
            return false;
        }
    }

    async changeEmailPassword(domainName: string, email: string, newPassword: string): Promise<boolean> {
        try {
            const result = await this.makeRequest('changeEmailPassword', { domainName, email, password: newPassword });
            return result.status === 1;
        } catch (error) {
            console.error('Failed to change email password:', error);
            return false;
        }
    }

    async getEmailForwarding(domainName: string, email: string): Promise<string[]> {
        try {
            const result = await this.makeRequest('fetchEmailForwarding', { domainName, email });
            if (result.status === 1 && Array.isArray(result.data)) {
                return result.data;
            }
            return [];
        } catch (error) {
            console.error('Failed to fetch email forwarding:', error);
            return [];
        }
    }

    async addEmailForwarding(domainName: string, email: string, forwardTo: string): Promise<boolean> {
        try {
            const result = await this.makeRequest('submitEmailForwarding', { domainName, email, forwardTo });
            return result.status === 1;
        } catch (error) {
            console.error('Failed to add email forwarding:', error);
            return false;
        }
    }

    // --- PHP Configuration ---

    async getPHPConfig(domainName: string): Promise<CyberPanelPHPConfig | null> {
        try {
            const result = await this.makeRequest('fetchPHPConfig', { domainName });
            if (result.status === 1 && result.data) {
                return result.data;
            }
            return null;
        } catch (error) {
            console.error(`Failed to fetch PHP config for ${domainName}:`, error);
            return null;
        }
    }

    async savePHPConfig(domainName: string, config: Partial<CyberPanelPHPConfig>): Promise<boolean> {
        try {
            const result = await this.makeRequest('savePHPConfig', { domainName, ...config });
            return result.status === 1;
        } catch (error) {
            console.error(`Failed to save PHP config for ${domainName}:`, error);
            return false;
        }
    }

    async changePHPVersion(domainName: string, phpVersion: string): Promise<boolean> {
        try {
            const result = await this.makeRequest('changePHP', { childDomain: domainName, phpSelection: phpVersion });
            return result.status === 1;
        } catch (error) {
            console.error(`Failed to change PHP version for ${domainName}:`, error);
            return false;
        }
    }

    // --- Security (Firewall / ModSecurity) ---

    async getFirewallStatus(): Promise<boolean> {
        try {
            const result = await this.makeRequest('fetchFirewallStatus');
            return result.status === 1 && result.firewallStatus === 1;
        } catch (error) {
            console.error('Failed to fetch firewall status:', error);
            return false;
        }
    }

    async toggleFirewall(enable: boolean): Promise<boolean> {
        try {
            const result = await this.makeRequest(enable ? 'enableFirewall' : 'disableFirewall');
            return result.status === 1;
        } catch (error) {
            console.error('Failed to toggle firewall:', error);
            return false;
        }
    }

    async getModSecurityStatus(domainName: string): Promise<boolean> {
        try {
            const result = await this.makeRequest('fetchModSecurityStatus', { domainName });
            return result.status === 1 && result.modsecStatus === 1;
        } catch (error) {
            console.error('Failed to fetch ModSecurity status:', error);
            return false;
        }
    }

    async toggleModSecurity(domainName: string, enable: boolean): Promise<boolean> {
        try {
            const result = await this.makeRequest(enable ? 'enableModSecurity' : 'disableModSecurity', { domainName });
            return result.status === 1;
        } catch (error) {
            console.error('Failed to toggle ModSecurity:', error);
            return false;
        }
    }

    async getBlockedIPs(): Promise<string[]> {
        try {
            const result = await this.makeRequest('fetchBlockedIPs');
            if (result.status === 1 && Array.isArray(result.data)) {
                return result.data;
            }
            return [];
        } catch (error) {
            console.error('Failed to fetch blocked IPs:', error);
            return [];
        }
    }

    async blockIP(ipAddress: string): Promise<boolean> {
        try {
            const result = await this.makeRequest('addBlockedIP', { ipAddress });
            return result.status === 1;
        } catch (error) {
            console.error('Failed to block IP:', error);
            return false;
        }
    }

    async unblockIP(ipAddress: string): Promise<boolean> {
        try {
            const result = await this.makeRequest('deleteBlockedIP', { ipAddress });
            return result.status === 1;
        } catch (error) {
            console.error('Failed to unblock IP:', error);
            return false;
        }
    }

    // --- SSL Management ---

    async getSSLInfo(domainName: string): Promise<CyberPanelSSLInfo | null> {
        try {
            const result = await this.makeRequest('fetchSSLStatus', { domainName });
            if (result.status === 1 && result.data) {
                return result.data;
            }
            return null;
        } catch (error) {
            console.error(`Failed to fetch SSL info for ${domainName}:`, error);
            return null;
        }
    }

    // --- API Access Token ---

    async generateAPIToken(): Promise<string | null> {
        try {
            const result = await this.makeRequest('fetchAPIToken');
            if (result.status === 1 && result.token) {
                return result.token;
            }
            return null;
        } catch (error) {
            console.error('Failed to generate API token:', error);
            return null;
        }
    }

    // --- Server Status ---

    async getServerStatus(): Promise<any> {
        try {
            const result = await this.makeRequest('fetchServerStatus');
            return result;
        } catch (error) {
            console.error('Failed to fetch server status:', error);
            return null;
        }
    }

    // --- DNS Extended ---

    async createNameserver(domainName: string, ns1: string, ns1IP: string, ns2: string, ns2IP: string): Promise<boolean> {
        try {
            const result = await this.makeRequest('createNameserver', { domainName, ns1, ns1IP, ns2, ns2IP });
            return result.status === 1;
        } catch (error) { console.error('Failed to create nameserver:', error); return false; }
    }

    async configDefaultNameservers(ns1: string, ns2: string): Promise<boolean> {
        try {
            const result = await this.makeRequest('configDefaultNameservers', { ns1, ns2 });
            return result.status === 1;
        } catch (error) { console.error('Failed to config default nameservers:', error); return false; }
    }

    async createDNSZone(domainName: string): Promise<boolean> {
        try {
            const result = await this.makeRequest('createDNSZone', { domainName });
            return result.status === 1;
        } catch (error) { console.error('Failed to create DNS zone:', error); return false; }
    }

    async deleteDNSZone(domainName: string): Promise<boolean> {
        try {
            const result = await this.makeRequest('deleteDNSZone', { domainName });
            return result.status === 1;
        } catch (error) { console.error('Failed to delete DNS zone:', error); return false; }
    }

    async configCloudFlare(domainName: string, email: string, apiKey: string): Promise<boolean> {
        try {
            const result = await this.makeRequest('configCloudFlare', { domainName, email, apiKey });
            return result.status === 1;
        } catch (error) { console.error('Failed to config CloudFlare:', error); return false; }
    }

    async resetDNSConfigurations(domainName: string): Promise<boolean> {
        try {
            const result = await this.makeRequest('resetDNSConfigurations', { domainName });
            return result.status === 1;
        } catch (error) { console.error('Failed to reset DNS:', error); return false; }
    }

    // --- Email Extended (Limits, Catch-All, DKIM, Pattern Forwarding, Plus-Addressing) ---

    async getEmailLimits(domainName: string): Promise<any> {
        try {
            const result = await this.makeRequest('fetchEmailLimits', { domainName });
            return result.status === 1 ? result.data : null;
        } catch (error) { console.error('Failed to fetch email limits:', error); return null; }
    }

    async setEmailLimits(domainName: string, email: string, limit: number): Promise<boolean> {
        try {
            const result = await this.makeRequest('submitEmailLimits', { domainName, email, emailLimit: limit });
            return result.status === 1;
        } catch (error) { console.error('Failed to set email limits:', error); return false; }
    }

    async getCatchAllEmail(domainName: string): Promise<string | null> {
        try {
            const result = await this.makeRequest('fetchCatchAllEmail', { domainName });
            return result.status === 1 ? (result.data || result.catchAll || null) : null;
        } catch (error) { console.error('Failed to fetch catch-all:', error); return null; }
    }

    async setCatchAllEmail(domainName: string, email: string): Promise<boolean> {
        try {
            const result = await this.makeRequest('submitCatchAllEmail', { domainName, catchAllEmail: email });
            return result.status === 1;
        } catch (error) { console.error('Failed to set catch-all:', error); return false; }
    }

    async getPatternForwarding(domainName: string): Promise<any[]> {
        try {
            const result = await this.makeRequest('fetchPatternForwarding', { domainName });
            return result.status === 1 && Array.isArray(result.data) ? result.data : [];
        } catch (error) { console.error('Failed to fetch pattern forwarding:', error); return []; }
    }

    async addPatternForwarding(domainName: string, pattern: string, destination: string): Promise<boolean> {
        try {
            const result = await this.makeRequest('submitPatternForwarding', { domainName, pattern, destination });
            return result.status === 1;
        } catch (error) { console.error('Failed to add pattern forwarding:', error); return false; }
    }

    async getPlusAddressing(domainName: string): Promise<boolean> {
        try {
            const result = await this.makeRequest('fetchPlusAddressing', { domainName });
            return result.status === 1 && result.enabled === true;
        } catch (error) { console.error('Failed to fetch plus-addressing:', error); return false; }
    }

    async togglePlusAddressing(domainName: string, enable: boolean): Promise<boolean> {
        try {
            const result = await this.makeRequest('submitPlusAddressing', { domainName, enable: enable ? 1 : 0 });
            return result.status === 1;
        } catch (error) { console.error('Failed to toggle plus-addressing:', error); return false; }
    }

    async getDKIMStatus(domainName: string): Promise<{ enabled: boolean; record: string } | null> {
        try {
            const result = await this.makeRequest('fetchDKIMStatus', { domainName });
            if (result.status === 1) {
                return { enabled: result.dkimEnabled || false, record: result.dkimRecord || '' };
            }
            return null;
        } catch (error) { console.error('Failed to fetch DKIM status:', error); return null; }
    }

    async enableDKIM(domainName: string): Promise<boolean> {
        try {
            const result = await this.makeRequest('enableDKIM', { domainName });
            return result.status === 1;
        } catch (error) { console.error('Failed to enable DKIM:', error); return false; }
    }

    // --- WordPress Extended ---

    async listWordPress(): Promise<any[]> {
        try {
            const result = await this.makeRequest('fetchWordPressSites');
            if (result.status === 1 && Array.isArray(result.data)) return result.data;
            return [];
        } catch (error) { console.error('Failed to list WordPress sites:', error); return []; }
    }

    async listWPPlugins(domainName: string): Promise<any[]> {
        try {
            const result = await this.makeRequest('fetchWPPlugins', { domainName });
            if (result.status === 1 && Array.isArray(result.data)) return result.data;
            return [];
        } catch (error) { console.error('Failed to list WP plugins:', error); return []; }
    }

    async toggleWPPlugin(domainName: string, pluginName: string, activate: boolean): Promise<boolean> {
        try {
            const result = await this.makeRequest(activate ? 'activateWPPlugin' : 'deactivateWPPlugin', { domainName, pluginName });
            return result.status === 1;
        } catch (error) { console.error('Failed to toggle WP plugin:', error); return false; }
    }

    async installWPPlugin(domainName: string, pluginSlug: string): Promise<boolean> {
        try {
            const result = await this.makeRequest('installWPPlugin', { domainName, pluginName: pluginSlug });
            if (result.status === 1) return true;
            // fallback: try activating in case it's already installed but inactive
            return await this.toggleWPPlugin(domainName, pluginSlug, true);
        } catch (error) { console.error('Failed to install WP plugin:', error); return false; }
    }

    async restoreWPBackup(domainName: string, backupFile: string): Promise<boolean> {
        try {
            const result = await this.makeRequest('restoreWordPressBackup', { domainName, backupFile });
            return result.status === 1;
        } catch (error) { console.error('Failed to restore WP backup:', error); return false; }
    }

    async listWPBackups(domainName: string): Promise<string[]> {
        try {
            const result = await this.makeRequest('fetchWPBackups', { domainName });
            if (result.status === 1 && Array.isArray(result.data)) return result.data;
            return [];
        } catch (error) { console.error('Failed to list WP backups:', error); return []; }
    }

    async createRemoteBackup(domainName: string, destination: string): Promise<boolean> {
        try {
            const result = await this.makeRequest('submitRemoteBackup', { websiteName: domainName, destination });
            return result.status === 1;
        } catch (error) { console.error('Failed to create remote backup:', error); return false; }
    }

    // --- Website Modify ---

    async modifyWebsite(domainName: string, packageName: string, phpVersion: string): Promise<boolean> {
        try {
            const result = await this.makeRequest('submitWebsiteModify', { domainName, packageName, phpSelection: phpVersion });
            return result.status === 1;
        } catch (error) { console.error('Failed to modify website:', error); return false; }
    }

    setCredentials(pass: string, user: string = 'admin') {
        this.adminPass = pass;
        this.adminUser = user;
    }
}

export const cyberPanelAPI = new CyberPanelAPI();
