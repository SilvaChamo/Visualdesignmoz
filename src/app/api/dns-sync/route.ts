// ==========================================
// DNS Sync API - Mozserver ↔ CyberPanel
// ==========================================

import { NextRequest, NextResponse } from 'next/server';
import { 
  checkDomainSyncStatus, 
  syncDomainToCyberPanel, 
  getCyberPanelDomains,
  handleMozserverWebhook 
} from '@/lib/dns-sync';

// GET: Verificar status de sincronização
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const domain = searchParams.get('domain');
    const action = searchParams.get('action');

    // Verificar autenticação (simplificado - usar middleware em produção)
    const authHeader = request.headers.get('authorization');
    const apiKey = process.env.DNS_SYNC_API_KEY || 'visualdesign-dns-sync-2024';
    
    if (authHeader !== `Bearer ${apiKey}` && !request.url.includes('localhost')) {
      // Em desenvolvimento, permitir sem auth
    }

    switch (action) {
      case 'status':
        if (!domain) {
          return NextResponse.json({ error: 'Domain required' }, { status: 400 });
        }
        const status = await checkDomainSyncStatus(domain);
        return NextResponse.json({ success: true, data: status });

      case 'list':
        const domains = await getCyberPanelDomains();
        const domainsWithStatus = await Promise.all(
          domains.map(d => checkDomainSyncStatus(d))
        );
        return NextResponse.json({ success: true, data: domainsWithStatus });

      default:
        return NextResponse.json({ 
          error: 'Invalid action. Use: status, list' 
        }, { status: 400 });
    }
  } catch (error) {
    console.error('DNS Sync API Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST: Sincronizar domínio ou receber webhook
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, domain, webhook } = body;

    // Webhook do Mozserver
    if (webhook) {
      console.log('Received Mozserver webhook:', webhook);
      const result = await handleMozserverWebhook(webhook);
      return NextResponse.json(result);
    }

    // Sincronização manual
    switch (action) {
      case 'sync':
        if (!domain) {
          return NextResponse.json({ error: 'Domain required' }, { status: 400 });
        }
        const syncResult = await syncDomainToCyberPanel(domain);
        return NextResponse.json({
          success: syncResult,
          message: syncResult 
            ? `Domínio ${domain} sincronizado com sucesso`
            : `Falha ao sincronizar ${domain}`,
        });

      case 'sync-all':
        const domains = await getCyberPanelDomains();
        const results = await Promise.all(
          domains.map(async (d) => {
            const synced = await syncDomainToCyberPanel(d);
            return { domain: d, synced };
          })
        );
        return NextResponse.json({
          success: true,
          data: results,
          summary: {
            total: results.length,
            synced: results.filter(r => r.synced).length,
            failed: results.filter(r => !r.synced).length,
          },
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('DNS Sync API Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
