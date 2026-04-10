import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Lista de admin emails para verificação
const adminEmails = ['silva.chamo@gmail.com', 'geral@your-domain.com', 'suporte@visualdesigne.com'];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const domain = searchParams.get('domain');
  
  if (!domain) {
    return NextResponse.json({ error: 'Domínio não especificado' }, { status: 400 });
  }

  try {
    // Comando CyberPanel para listar emails do domínio
    // cyberpanel listEmails --domainName DOMAIN
    const command = `/usr/local/CyberCP/bin/python /usr/local/CyberCP/plogical/mailUtilities.py listEmails ${domain}`;
    
    console.log(`🔍 Executando: ${command}`);
    
    let emails: string[] = [];
    
    try {
      const { stdout, stderr } = await execAsync(command, { timeout: 30000 });
      
      console.log('📧 STDOUT:', stdout);
      console.log('📧 STDERR:', stderr);
      
      if (stdout) {
        // Tentar parsear JSON ou extrair emails do output
        try {
          const parsed = JSON.parse(stdout);
          if (Array.isArray(parsed)) {
            emails = parsed.map((e: any) => typeof e === 'string' ? e : e.email);
          } else if (parsed.email_accounts) {
            emails = parsed.email_accounts.map((e: any) => e.email || `${e.user}@${domain}`);
          } else if (parsed.emails) {
            emails = parsed.emails;
          }
        } catch {
          // Se não é JSON, tentar extrair linhas que parecem emails
          emails = stdout
            .split('\n')
            .filter(line => line.includes('@') && !line.includes(' '))
            .map(line => line.trim().toLowerCase());
        }
      }
    } catch (execError: any) {
      console.error('❌ Erro ao executar comando CLI:', execError.message);
      // Se falhar, não adicionar emails fictícios - retornar apenas emails reais
    }
    
    // Garantir formato correto e remover duplicados
    emails = [...new Set(
      emails
        .filter((e: string) => e && e.includes('@'))
        .map((e: string) => e.toLowerCase().trim())
    )];

    console.log(`✅ Emails reais encontrados para ${domain}:`, emails);

    return NextResponse.json({
      success: true,
      domain,
      emails,
      count: emails.length,
      source: emails.length > 0 ? 'cyberpanel' : 'empty'
    });

  } catch (error: any) {
    console.error('Erro ao buscar emails do CyberPanel:', error);
    
    // 🚀 Retornar array vazio em vez de emails falsos
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
