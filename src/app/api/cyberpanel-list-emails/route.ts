import { NextRequest, NextResponse } from 'next/server';

// 🚀 Usar CyberPanel via HTTP API (não exec local)
const CP_URL = 'https://109.199.104.22:8090/api';
const CP_TOKEN = process.env.CYBERPANEL_API_TOKEN || '';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const domain = searchParams.get('domain');
  
  if (!domain) {
    return NextResponse.json({ error: 'Domínio não especificado' }, { status: 400 });
  }

  try {
    console.log(`🔍 [CP API] Buscando emails para ${domain}`);
    
    // 🚀 Usar a API HTTP do CyberPanel via server-exec
    const res = await fetch('/api/server-exec', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'listEmails',
        params: { domainName: domain }
      })
    });
    
    const data = await res.json();
    console.log(`📧 [CP API] Resposta:`, data);
    
    let emails: string[] = [];
    
    if (data.success && data.data) {
      // Parsear resposta do CyberPanel
      if (Array.isArray(data.data)) {
        emails = data.data.map((e: any) => {
          if (typeof e === 'string') return e;
          if (e.email) return e.email;
          if (e.user) return `${e.user}@${domain}`;
          return null;
        }).filter(Boolean);
      }
    }
    
    // Garantir formato correto
    emails = [...new Set(
      emails
        .filter((e: string) => e && e.includes('@'))
        .map((e: string) => e.toLowerCase().trim())
    )];

    console.log(`✅ [CP API] Emails encontrados:`, emails);

    return NextResponse.json({
      success: true,
      domain,
      emails,
      count: emails.length,
      source: emails.length > 0 ? 'cyberpanel' : 'empty'
    });

  } catch (error: any) {
    console.error('❌ [CP API] Erro:', error);
    
    return NextResponse.json({
      success: true,
      domain,
      emails: [],
      count: 0,
      source: 'error',
      error: error.message
    });
  }
}
