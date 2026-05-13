// ==========================================
// DNS Synchronization - Mozserver ↔ Contabo
// Painel Admin como "cérebro" das configurações DNS
// ==========================================

import { directAdminHostingAPI } from './directadmin-hosting-api';

// Tipos de dados
export interface DomainDNSStatus {
  domain: string;
  mozserverRegistered: boolean;
  cyberPanelZone: boolean;
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
  source: 'mozserver' | 'cyberpanel' | 'synced';
}

export interface MozserverDomain {
  domain: string;
  tld: string;
  status: 'active' | 'pending' | 'expired';
  createdAt: string;
  expiresAt: string;
  nameservers?: string[];
}

// ==========================================
// MOZSERVER API CLIENT
// ==========================================

const MOZSERVER_CONFIG = {
  baseURL: 'https://mozserver.co.mz/api',
  token: process.env.MOZSERVER_TOKEN || '',
};

async function mozserverCall(endpoint: string, method: string = 'GET', payload?: any) {
  const url = `${MOZSERVER_CONFIG.baseURL}${endpoint}`;
  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${MOZSERVER_CONFIG.token}`,
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

// ==========================================
// CYBERPANEL DNS API (via Server-Side Proxy)
// ==========================================

async function cyberPanelDNSCall(action: string, data?: any) {
  const response = await fetch('/api/cyberpanel-dns', {
    method: action === 'GET' ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: data ? JSON.stringify(data) : undefined,
  });
  
  if (!response.ok) {
    throw new Error(`CyberPanel DNS API error: ${response.status}`);
  }
  return response.json();
}

// ==========================================
// SYNC FUNCTIONS
// ==========================================

/**
 * Verificar status de sincronização de um domínio
 */
export async function checkDomainSyncStatus(domain: string): Promise<DomainDNSStatus> {
  try {
    // Verificar se domínio existe no CyberPanel
    const cyberPanelRecords = await fetch(`/api/cyberpanel-dns?domain=${domain}`).then(r => r.json());
    
    // Verificar se domínio está registado na Mozserver
    let mozserverRegistered = false;
    try {
      const mozData = await mozserverCall(`/check-domain`, 'POST', { domain: domain.split('.')[0], tld: '.' + domain.split('.').slice(1).join('.') });
      mozserverRegistered = !mozData.available; // Se não está disponível, está registado
    } catch (e) {
      console.log('Mozserver check failed:', e);
    }
    
    return {
      domain,
      mozserverRegistered,
      cyberPanelZone: cyberPanelRecords.success && cyberPanelRecords.records?.length > 0,
      synced: cyberPanelRecords.success && cyberPanelRecords.records?.length > 0,
      records: cyberPanelRecords.records || [],
      lastSync: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error checking domain sync:', error);
    return {
      domain,
      mozserverRegistered: false,
      cyberPanelZone: false,
      synced: false,
      records: [],
    };
  }
}

/**
 * Criar zona DNS no CyberPanel para um domínio
 */
export async function createDNSZone(domain: string): Promise<boolean> {
  try {
    // Usar a API do CyberPanel para criar zona
    const result = await directAdminHostingAPI.createDNSZone({ domain });
    console.log('DNS Zone created for', domain, result);
    return true;
  } catch (error) {
    console.error('Error creating DNS zone:', error);
    return false;
  }
}

/**
 * Adicionar registros DNS padrão para um novo domínio
 */
export async function addDefaultDNSRecords(
  domain: string, 
  serverIP: string = '109.199.104.22'
): Promise<boolean> {
  try {
    const defaultRecords = [
      { name: '@', type: 'A', value: serverIP, ttl: 14400 },
      { name: 'www', type: 'A', value: serverIP, ttl: 14400 },
      { name: 'mail', type: 'A', value: serverIP, ttl: 14400 },
      { name: '@', type: 'MX', value: `mail.${domain}`, ttl: 14400, priority: 10 },
      { name: '@', type: 'TXT', value: 'v=spf1 a mx ~all', ttl: 14400 },
    ];
    
    for (const record of defaultRecords) {
      await fetch('/api/cyberpanel-dns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domainName: domain,
          name: record.name,
          type: record.type,
          value: record.value,
          ttl: record.ttl,
          priority: record.priority,
        }),
      });
    }
    
    console.log('Default DNS records added for', domain);
    return true;
  } catch (error) {
    console.error('Error adding default DNS records:', error);
    return false;
  }
}

/**
 * Sincronizar domínio completo: criar zona + registros padrão
 */
export async function syncDomainToCyberPanel(domain: string): Promise<boolean> {
  try {
    // 1. Criar zona DNS
    await createDNSZone(domain);
    
    // 2. Adicionar registros padrão
    await addDefaultDNSRecords(domain);
    
    console.log('Domain synced successfully:', domain);
    return true;
  } catch (error) {
    console.error('Error syncing domain:', error);
    return false;
  }
}

/**
 * Buscar todos os domínios do CyberPanel
 */
export async function getCyberPanelDomains(): Promise<string[]> {
  try {
    const sites = await directAdminHostingAPI.listWebsites();
    return sites.map((site: any) => site.domain);
  } catch (error) {
    console.error('Error fetching CyberPanel domains:', error);
    return [];
  }
}

/**
 * Webhook handler: Processar notificação de novo domínio registado
 */
export async function handleMozserverWebhook(payload: {
  event: 'domain.registered' | 'domain.renewed' | 'domain.transferred';
  domain: string;
  tld: string;
  clientId?: string;
  nameservers?: string[];
}): Promise<{ success: boolean; message: string }> {
  try {
    const fullDomain = payload.domain + payload.tld;
    
    console.log('Processing Mozserver webhook:', payload.event, fullDomain);
    
    switch (payload.event) {
      case 'domain.registered':
      case 'domain.transferred':
        // Criar zona DNS automaticamente
        const synced = await syncDomainToCyberPanel(fullDomain);
        return {
          success: synced,
          message: synced 
            ? `Domínio ${fullDomain} sincronizado com sucesso para o CyberPanel`
            : `Falha ao sincronizar domínio ${fullDomain}`,
        };
        
      case 'domain.renewed':
        // Apenas log, não precisa de ação DNS
        return {
          success: true,
          message: `Domínio ${fullDomain} renovado - nenhuma alteração DNS necessária`,
        };
        
      default:
        return {
          success: false,
          message: `Evento não suportado: ${payload.event}`,
        };
    }
  } catch (error) {
    console.error('Webhook processing error:', error);
    return {
      success: false,
      message: `Erro ao processar webhook: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

export default {
  checkDomainSyncStatus,
  createDNSZone,
  addDefaultDNSRecords,
  syncDomainToCyberPanel,
  getCyberPanelDomains,
  handleMozserverWebhook,
};
