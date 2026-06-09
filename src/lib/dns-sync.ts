// DNS Synchronization — Mozserver ↔ painel de hospedagem (DirectAdmin)

import { directAdminHostingAPI } from './directadmin-hosting-api';
import { getDefaultEmailDnsRecords } from './email-dns-defaults';
import { getServerHost } from './server-config';

export interface DomainDNSStatus {
  domain: string;
  mozserverRegistered: boolean;
  hostingZone: boolean;
  synced: boolean;
  lastSync?: string;
  records: DNSRecord[];
  nsRecords?: string[];
}

export interface DNSRecord {
  id?: string;
  name: string;
  type: 'A' | 'AAAA' | 'CNAME' | 'MX' | 'TXT' | 'NS' | 'SRV';
  content: string;
  ttl: number;
  priority?: number;
  source: 'mozserver' | 'hosting' | 'synced';
}

export interface MozserverDomain {
  domain: string;
  tld: string;
  status: 'active' | 'pending' | 'expired';
  createdAt: string;
  expiresAt: string;
  nameservers?: string[];
}

const MOZSERVER_CONFIG = {
  baseURL: 'https://mozserver.co.mz/api',
  token: process.env.MOZSERVER_TOKEN || '',
};

async function mozserverCall(endpoint: string, method: string = 'GET', payload?: unknown) {
  const url = `${MOZSERVER_CONFIG.baseURL}${endpoint}`;
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${MOZSERVER_CONFIG.token}`,
    },
  };

  if (payload && method !== 'GET') {
    options.body = JSON.stringify(payload);
  }

  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`Mozserver API error: ${response.status}`);
  }
  return response.json();
}

async function panelDNSCall(domain: string) {
  const response = await fetch(`/api/panel-dns?domain=${encodeURIComponent(domain)}`);
  if (!response.ok) {
    throw new Error(`Panel DNS API error: ${response.status}`);
  }
  return response.json();
}

export async function checkDomainSyncStatus(domain: string): Promise<DomainDNSStatus> {
  try {
    const hostingRecords = await panelDNSCall(domain);

    let mozserverRegistered = false;
    try {
      const mozData = await mozserverCall('/check-domain', 'POST', {
        domain: domain.split('.')[0],
        tld: '.' + domain.split('.').slice(1).join('.'),
      });
      mozserverRegistered = !mozData.available;
    } catch (e) {
      console.log('Mozserver check failed:', e);
    }

    return {
      domain,
      mozserverRegistered,
      hostingZone: hostingRecords.success && hostingRecords.records?.length > 0,
      synced: hostingRecords.success && hostingRecords.records?.length > 0,
      records: hostingRecords.records || [],
      lastSync: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error checking domain sync:', error);
    return {
      domain,
      mozserverRegistered: false,
      hostingZone: false,
      synced: false,
      records: [],
    };
  }
}

export async function createDNSZone(domain: string): Promise<boolean> {
  try {
    await directAdminHostingAPI.createDNSZone({ domain });
    return true;
  } catch (error) {
    console.error('Error creating DNS zone:', error);
    return false;
  }
}

export async function addDefaultDNSRecords(
  domain: string,
  serverIP: string = getServerHost(),
): Promise<boolean> {
  try {
    const defaultRecords = [
      { name: '@', type: 'A', value: serverIP, ttl: 14400 },
      { name: 'www', type: 'A', value: serverIP, ttl: 14400 },
      ...getDefaultEmailDnsRecords(domain, serverIP).map((r) => ({
        name: r.name,
        type: r.type,
        value: r.value,
        ttl: r.ttl,
        priority: r.priority,
      })),
    ];

    for (const record of defaultRecords) {
      await fetch('/api/panel-dns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domainName: domain,
          name: record.name,
          type: record.type,
          value: record.value,
          ttl: record.ttl,
          priority: 'priority' in record ? record.priority : undefined,
        }),
      });
    }

    return true;
  } catch (error) {
    console.error('Error adding default DNS records:', error);
    return false;
  }
}

export async function syncDomainToHosting(domain: string): Promise<boolean> {
  try {
    await createDNSZone(domain);
    await addDefaultDNSRecords(domain);
    return true;
  } catch (error) {
    console.error('Error syncing domain:', error);
    return false;
  }
}

export async function getHostingDomains(): Promise<string[]> {
  try {
    const sites = await directAdminHostingAPI.listWebsites();
    return sites.map((site: { domain?: string }) => site.domain).filter(Boolean) as string[];
  } catch (error) {
    console.error('Error fetching hosting domains:', error);
    return [];
  }
}

export async function handleMozserverWebhook(payload: {
  event: 'domain.registered' | 'domain.renewed' | 'domain.transferred';
  domain: string;
  tld: string;
  clientId?: string;
  nameservers?: string[];
}): Promise<{ success: boolean; message: string }> {
  try {
    const fullDomain = payload.domain + payload.tld;

    switch (payload.event) {
      case 'domain.registered':
      case 'domain.transferred': {
        const synced = await syncDomainToHosting(fullDomain);
        return {
          success: synced,
          message: synced
            ? `Domínio ${fullDomain} sincronizado com sucesso`
            : `Falha ao sincronizar domínio ${fullDomain}`,
        };
      }
      case 'domain.renewed':
        return {
          success: true,
          message: `Domínio ${fullDomain} renovado — sem alteração DNS`,
        };
      default:
        return { success: false, message: `Evento não suportado: ${payload.event}` };
    }
  } catch (error) {
    return {
      success: false,
      message: `Erro ao processar webhook: ${error instanceof Error ? error.message : 'Unknown'}`,
    };
  }
}

export default {
  checkDomainSyncStatus,
  createDNSZone,
  addDefaultDNSRecords,
  syncDomainToHosting,
  getHostingDomains,
  handleMozserverWebhook,
};
