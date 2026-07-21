// ==========================================
// WEBHOOK MOZSERVER - Automação Total DNS
// Endpoint: /api/webhook/mozserver
// ==========================================

import { NextRequest, NextResponse } from 'next/server';
import { getServerHost } from '@/lib/server-config'
import { getServerEmail } from '@/lib/smtp-mail';

// Configurações
const SERVER_IP = getServerHost();

// Tipos de eventos Mozserver
interface MozserverWebhookPayload {
  event: 'domain.registered' | 'domain.renewed' | 'domain.transferred' | 'domain.updated';
  domain: string;           // ex: "exemplo"
  tld: string;              // ex: ".co.mz"
  fullDomain: string;       // ex: "exemplo.co.mz"
  clientId?: string;
  clientEmail?: string;
  nameservers?: string[];
  previousNameservers?: string[];
  timestamp: string;
  signature?: string;       // Para validação de segurança
}

// Resposta do webhook
interface WebhookResponse {
  success: boolean;
  message: string;
  actions: string[];
  details?: any;
}

// ==========================================
// FUNÇÕES DE AUTOMAÇÃO
// ==========================================

/**
 * 1. CRIAR ZONA DNS NO PAINEL DE HOSPEDAGEM
 */
async function createHostingDNSZone(domain: string): Promise<{ success: boolean; output: string }> {
  try {
    // Criar zona DNS via API interna
    const response = await fetch('/api/server-exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'createDNSZone',
        params: { domain }
      }),
    });

    const data = await response.json();
    
    return {
      success: data.success || false,
      output: data.output || data.message || 'Comando executado'
    };
  } catch (error) {
    console.error('Error creating DNS zone:', error);
    return { success: false, output: String(error) };
  }
}

/**
 * 2. ADICIONAR REGISTROS DNS PADRÃO
 */
async function addDefaultDNSRecords(domain: string): Promise<{ success: boolean; records: string[] }> {
  const records = [
    { name: '@', type: 'A', value: SERVER_IP, ttl: 14400 },
    { name: 'www', type: 'A', value: SERVER_IP, ttl: 14400 },
    { name: 'mail', type: 'A', value: SERVER_IP, ttl: 14400 },
    { name: '@', type: 'MX', value: 'inbound1.sendinblue.com.', ttl: 14400, priority: 10 },
    { name: '@', type: 'MX', value: 'inbound2.sendinblue.com.', ttl: 14400, priority: 20 },
    { name: '@', type: 'TXT', value: 'v=spf1 include:spf.brevo.com ~all', ttl: 14400 },
    { name: '@', type: 'NS', value: `ns1.${domain}`, ttl: 86400 },
    { name: '@', type: 'NS', value: `ns2.${domain}`, ttl: 86400 },
  ];

  const created: string[] = [];
  const failed: string[] = [];

  for (const record of records) {
    try {
      const response = await fetch('/api/panel-dns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          domainName: domain,
          name: record.name,
          type: record.type,
          value: record.value,
          ttl: record.ttl,
          priority: (record as any).priority,
        }),
      });

      if (response.ok) {
        created.push(`${record.type} ${record.name}`);
      } else {
        failed.push(`${record.type} ${record.name}`);
      }
    } catch (error) {
      failed.push(`${record.type} ${record.name}`);
    }
  }

  return {
    success: created.length > 0,
    records: [...created, ...failed.map(f => `FALHA: ${f}`)]
  };
}

/**
 * 3. CRIAR WEBSITE NO PAINEL (opcional)
 */
async function createHostingWebsite(
  domain: string, 
  email: string = getServerEmail()
): Promise<{ success: boolean; output: string }> {
  try {
    const response = await fetch('/api/panel-dns', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        endpoint: 'createWebsite',
        params: {
          domainName: domain,
          email: email,
          packageName: 'Default',
          websiteOwner: 'admin'
        }
      }),
    });

    const data = await response.json();
    
    return {
      success: data.status === 1 || data.success === true,
      output: JSON.stringify(data)
    };
  } catch (error) {
    console.error('Error creating website:', error);
    return { success: false, output: String(error) };
  }
}

/**
 * 4. ACTUALIZAR NAMESERVERS NA MOZSERVER (se API permitir)
 */
async function updateMozserverNameservers(
  domain: string, 
  tld: string,
  nameservers: string[]
): Promise<{ success: boolean; message: string }> {
  // Esta função depende da API da Mozserver suportar actualização de NS
  // Por enquanto, retorna instruções manuais
  return {
    success: true,
    message: `Nameservers devem ser atualizados manualmente na Mozserver para: ${nameservers.join(', ')}`
  };
}

/**
 * 5. NOTIFICAR CLIENTE
 */
async function notifyClient(
  clientEmail: string, 
  domain: string, 
  status: 'success' | 'partial' | 'failed',
  details: string[]
): Promise<void> {
  // Implementar envio de email ou notificação
  console.log(`[NOTIFICAÇÃO] ${clientEmail} - Domínio ${domain} - Status: ${status}`);
  console.log('Detalhes:', details);
}

/**
 * 6. SALVAR LOG NO SUPABASE
 */
async function saveSyncLog(
  domain: string,
  event: string,
  success: boolean,
  actions: string[],
  details: any
): Promise<void> {
  try {
    await fetch('/api/supabase-sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: 'dns_sync_logs',
        data: {
          domain,
          event,
          success,
          actions,
          details,
          timestamp: new Date().toISOString(),
          server_ip: SERVER_IP
        }
      }),
    });
  } catch (error) {
    console.error('Error saving log:', error);
  }
}

// ==========================================
// HANDLER PRINCIPAL DO WEBHOOK
// ==========================================

export async function POST(request: NextRequest) {
  const actions: string[] = [];
  const details: any = {};

  try {
    // 1. PARSE DO BODY
    const payload: MozserverWebhookPayload = await request.json();
    
    console.log('============================================');
    console.log('WEBHOOK MOZSERVER RECEBIDO');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Evento:', payload.event);
    console.log('Domínio:', payload.fullDomain);
    console.log('============================================');

    // 2. VALIDAR PAYLOAD
    if (!payload.event || !payload.fullDomain) {
      return NextResponse.json({
        success: false,
        message: 'Payload inválido: event e fullDomain são obrigatórios',
        actions: []
      }, { status: 400 });
    }

    const fullDomain = payload.fullDomain || (payload.domain + payload.tld);

    // 3. PROCESSAR EVENTO
    switch (payload.event) {
      case 'domain.registered':
      case 'domain.transferred':
        console.log(`📝 Processando ${payload.event} para ${fullDomain}`);
        
        // ACÇÃO 1: Criar Zona DNS
        actions.push('1. Criar zona DNS no painel');
        const zoneResult = await createHostingDNSZone(fullDomain);
        details.zoneCreation = zoneResult;
        
        if (!zoneResult.success) {
          // Zona pode já existir, continuar...
          console.log('Zona pode já existir, continuando...');
        }

        // ACÇÃO 2: Adicionar Registros Padrão
        actions.push('2. Adicionar registros DNS padrão');
        const recordsResult = await addDefaultDNSRecords(fullDomain);
        details.recordsCreation = recordsResult;

        // ACÇÃO 3: Criar Website (se não existir)
        actions.push('3. Verificar/criar website no painel');
        const websiteResult = await createHostingWebsite(
          fullDomain, 
          payload.clientEmail
        );
        details.websiteCreation = websiteResult;

        // ACÇÃO 4: Actualizar Nameservers (instruções)
        actions.push('4. Configurar nameservers na Mozserver');
        const nsResult = await updateMozserverNameservers(
          payload.domain,
          payload.tld,
          [
            `ns1.${fullDomain}`,
            `ns2.${fullDomain}`,
            'ns1.visualdesignmoz.com',
            'ns2.visualdesignmoz.com'
          ]
        );
        details.nameserversUpdate = nsResult;

        // ACÇÃO 5: Salvar Log
        actions.push('5. Salvar log de sincronização');
        await saveSyncLog(
          fullDomain,
          payload.event,
          recordsResult.success,
          actions,
          details
        );

        // ACÇÃO 6: Notificar (se tiver email)
        if (payload.clientEmail) {
          actions.push('6. Enviar notificação ao cliente');
          await notifyClient(
            payload.clientEmail,
            fullDomain,
            recordsResult.success ? 'success' : 'partial',
            actions
          );
        }

        return NextResponse.json({
          success: recordsResult.success,
          message: `Domínio ${fullDomain} processado com sucesso`,
          actions,
          details: {
            domain: fullDomain,
            ip: SERVER_IP,
            zoneCreated: zoneResult.success,
            recordsAdded: recordsResult.records.length,
            websiteCreated: websiteResult.success,
            nameservers: [
              `ns1.${fullDomain} → ${SERVER_IP}`,
              `ns2.${fullDomain} → ${SERVER_IP}`
            ]
          }
        });

      case 'domain.renewed':
        // Apenas log, não precisa de acção DNS
        await saveSyncLog(fullDomain, payload.event, true, ['Domínio renovado - sem alterações DNS'], {});
        
        return NextResponse.json({
          success: true,
          message: `Domínio ${fullDomain} renovado - nenhuma alteração DNS necessária`,
          actions: ['Log de renovação salvo']
        });

      case 'domain.updated':
        // Actualização de dados (nameservers, contactos)
        actions.push('Processando actualização de domínio');
        
        if (payload.nameservers && payload.previousNameservers) {
          // Nameservers foram alterados
          actions.push('Nameservers alterados - verificando configuração');
        }

        return NextResponse.json({
          success: true,
          message: `Actualização de ${fullDomain} processada`,
          actions
        });

      default:
        return NextResponse.json({
          success: false,
          message: `Evento não suportado: ${payload.event}`,
          actions: []
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Webhook Error:', error);
    
    return NextResponse.json({
      success: false,
      message: `Erro ao processar webhook: ${error instanceof Error ? error.message : 'Unknown error'}`,
      actions,
      details: { error: String(error) }
    }, { status: 500 });
  }
}

// GET: Verificar status do webhook
export async function GET() {
  return NextResponse.json({
    status: 'online',
    endpoint: '/api/webhook/mozserver',
    description: 'Webhook para automação DNS Mozserver ↔ Contabo',
    supported_events: [
      'domain.registered',
      'domain.renewed', 
      'domain.transferred',
      'domain.updated'
    ],
    server_ip: SERVER_IP,
    timestamp: new Date().toISOString()
  });
}
