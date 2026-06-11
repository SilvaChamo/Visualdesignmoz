// DNS Synchronization — Mozserver ↔ painel de hospedagem (DirectAdmin)

import { daAddDnsRecord } from '@/lib/da-dns-ops';
import { daPostViaSsh } from '@/lib/da-api-ssh';
import { resolveDirectAdminCredentials } from '@/lib/directadmin-credentials';
import { scheduleDaSync } from '@/lib/da-sync-engine';
import { directAdminHostingAPI } from './directadmin-hosting-api';
import { getDefaultEmailDnsRecords } from './email-dns-defaults';
import {
  getMirrorLastSyncAt,
  listMirrorDns,
  listMirrorWebsites,
} from '@/lib/panel-mirror-read';
import { upsertMirrorDns } from '@/lib/panel-mirror-write';
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

const ADMIN_MIRROR_SCOPE = { role: 'admin' as const };

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

async function readMirrorDns(domain: string) {
  const records = await listMirrorDns(domain, ADMIN_MIRROR_SCOPE);
  return records.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type as DNSRecord['type'],
    content: r.content,
    ttl: Number(r.ttl) || 3600,
    source: 'hosting' as const,
  }));
}

export async function checkDomainSyncStatus(domain: string): Promise<DomainDNSStatus> {
  try {
    const hostingRecords = await readMirrorDns(domain);
    const lastSync = (await getMirrorLastSyncAt()) || undefined;

    let mozserverRegistered = false;
    if (MOZSERVER_CONFIG.token) {
      try {
        const mozData = await mozserverCall('/check-domain', 'POST', {
          domain: domain.split('.')[0],
          tld: '.' + domain.split('.').slice(1).join('.'),
        });
        mozserverRegistered = !mozData.available;
      } catch {
        /* Mozserver opcional */
      }
    }

    const hasZone = hostingRecords.length > 0;

    return {
      domain,
      mozserverRegistered,
      hostingZone: hasZone,
      synced: hasZone,
      records: hostingRecords,
      lastSync: lastSync || new Date().toISOString(),
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
    const creds = await resolveDirectAdminCredentials('admin');
    const result = await daPostViaSsh(
      'CMD_API_DNS_CONTROL',
      {
        action: 'add',
        domain,
        type: 'A',
        name: domain,
        value: getServerHost(),
        ttl: '300',
      },
      creds,
    );
    return result.ok;
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
    const creds = await resolveDirectAdminCredentials('admin');
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
      const value =
        record.type === 'MX' && 'priority' in record && record.priority != null
          ? `${record.priority} ${record.value}`
          : record.value;
      const result = await daAddDnsRecord(creds, {
        domain,
        name: record.name,
        type: record.type,
        value,
        ttl: record.ttl,
      });
      if (!result.ok) continue;
      await upsertMirrorDns({
        domain,
        name: record.name === '@' ? domain : record.name,
        type: record.type,
        value,
        ttl: record.ttl,
      });
    }

    scheduleDaSync(30);
    return true;
  } catch (error) {
    console.error('Error adding default DNS records:', error);
    return false;
  }
}

export async function syncDomainToHosting(domain: string): Promise<boolean> {
  try {
    const existing = await readMirrorDns(domain);
    if (existing.length > 0) return true;
    await createDNSZone(domain);
    await addDefaultDNSRecords(domain);
    return true;
  } catch (error) {
    console.error('Error syncing domain:', error);
    return false;
  }
}

export async function getHostingDomains(): Promise<string[]> {
  const mirrorSites = await listMirrorWebsites(ADMIN_MIRROR_SCOPE);
  const fromMirror = mirrorSites.map((s) => s.domain).filter(Boolean);
  if (fromMirror.length > 0) return fromMirror;

  try {
    const sites = await directAdminHostingAPI.listWebsites();
    const live = sites.map((site: { domain?: string }) => site.domain).filter(Boolean) as string[];
    if (live.length > 0) scheduleDaSync(0);
    return live;
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
