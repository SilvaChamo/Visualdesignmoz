import { NextRequest, NextResponse } from 'next/server';
import { executeCyberPanelCommand } from '@/lib/cyberpanel-exec';

const ALLOWED_DOMAINS = [
  'visualdesignmoz.com',
  'visualdesignmoz.com',
  'anap.co.mz',
  'entrecampos.co.mz'
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const domain = searchParams.get('domain');
  
  if (!domain) {
    return NextResponse.json({ error: 'Domínio não especificado' }, { status: 400 });
  }

  try {
    console.log(`🔍 [CP API] Buscando emails para ${domain}`);
    
    const cleanDomain = domain.replace(/[^a-zA-Z0-9_.-]/g, '');
    
    // 🚀 Usar MySQL do CyberPanel para listar emails
    const command = `mysql -D cyberpanel -e "SELECT email FROM e_users WHERE emailOwner_id='${cleanDomain}';" -B -N`;
    
    const raw = await executeCyberPanelCommand(command);
    console.log(`📧 [CP API] Raw output:`, raw);
    
    let emails: string[] = [];
    
    if (raw && raw.trim()) {
      const lines = raw.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.includes('ERROR') && !trimmed.includes('error')) {
          emails.push(trimmed.toLowerCase());
        }
      }
    }
    
    // Remover duplicatas e emails inválidos/suspeitos
    emails = [...new Set(emails)];
    
    // 🚫 FILTRO: Remover emails inválidos ou indesejados
    const emailsInvalidos = [
      'geral@visualdesignmoz.com',
      'teste@',                         // Emails de teste
      'exemplo@',                       // Emails de exemplo
      'admin@your-domain.com',          // Template placeholder
    ];
    
    emails = emails.filter((email) => {
      // 1. Filtrar domínios permitidos
      const emailDomain = email.split('@')[1];
      if (!ALLOWED_DOMAINS.includes(emailDomain)) {
        return false;
      }

      // 2. Verificar se é um dos emails inválidos
      const isInvalid = emailsInvalidos.some(invalid => 
        email.toLowerCase().includes(invalid.toLowerCase())
      );
      
      // 3. Verificar se contém padrões suspeitos
      const isSuspicious = 
        email.includes('joao') ||
        email.includes('teste') ||
        email.includes('exemplo') ||
        email.includes('your-domain');
      
      return !isInvalid && !isSuspicious;
    });

    console.log(`✅ [CP API] Emails encontrados: ${emails.length}`, emails);

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
      success: false,
      domain,
      emails: [],
      count: 0,
      source: 'error',
      error: error.message
    });
  }
}
