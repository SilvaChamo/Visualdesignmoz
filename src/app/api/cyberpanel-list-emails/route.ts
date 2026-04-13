import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'ssh2';

// 🚀 SSH para conectar ao CyberPanel
const CP_HOST = '109.199.104.22';
const CP_PORT = 22;
const CP_USER = 'root';

async function execSSH(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let out = '';
    const rawKey = process.env.SSH_PRIVATE_KEY || '';
    
    if (!rawKey.includes('BEGIN') || !rawKey.includes('END')) {
      return reject(new Error('SSH_PRIVATE_KEY inválida'));
    }
    
    const privateKey = rawKey.replace(/\\n/g, '\n');

    const timeout = setTimeout(() => {
      conn.end();
      reject(new Error('SSH timeout'));
    }, 20000);

    conn.on('ready', () => {
      clearTimeout(timeout);
      conn.exec(command, (err, stream) => {
        if (err) { conn.end(); return reject(err); }
        stream.on('data', (d: Buffer) => { out += d.toString(); });
        stream.stderr.on('data', (d: Buffer) => { out += d.toString(); });
        stream.on('close', () => { 
          conn.end(); 
          resolve(out); 
        });
      });
    });

    conn.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    conn.connect({
      host: CP_HOST,
      port: CP_PORT,
      username: CP_USER,
      privateKey: Buffer.from(privateKey),
      readyTimeout: 15000,
    });
  });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const domain = searchParams.get('domain');
  
  if (!domain) {
    return NextResponse.json({ error: 'Domínio não especificado' }, { status: 400 });
  }

  try {
    console.log(`🔍 [CP API] Buscando emails para ${domain}`);
    
    // 🚀 Buscar emails via SSH do CyberPanel
    // 1. Tentar via MySQL do vmail (mais rápido)
    const command = `mysql vmail -e "SELECT username FROM users WHERE domain='${domain}';" -B -N 2>/dev/null || echo ''`;
    
    const raw = await execSSH(command);
    console.log(`📧 [CP API] Raw output:`, raw);
    
    let emails: string[] = [];
    
    if (raw) {
      emails = raw
        .split('\n')
        .filter(line => line.trim() && !line.includes(' '))
        .map(line => `${line.trim()}@${domain}`);
    }
    
    // Se não encontrou no vmail, tentar pelo CyberPanel CLI
    if (emails.length === 0) {
      try {
        const cpCommand = `cyberpanel listEmails --domainName ${domain} 2>&1`;
        const cpRaw = await execSSH(cpCommand);
        console.log(`📧 [CP CLI] Output:`, cpRaw);
        
        // Tentar parsear JSON ou extrair emails
        try {
          const parsed = JSON.parse(cpRaw);
          if (parsed.email_accounts) {
            emails = parsed.email_accounts.map((e: any) => e.email || `${e.user}@${domain}`);
          } else if (Array.isArray(parsed)) {
            emails = parsed.map((e: any) => typeof e === 'string' ? e : (e.email || `${e.user}@${domain}`));
          }
        } catch {
          // Extrair linhas que parecem emails
          emails = cpRaw
            .split('\n')
            .filter(line => line.includes('@') && !line.includes(' '))
            .map(line => line.trim().toLowerCase());
        }
      } catch (cliError) {
        console.error(`📧 [CP CLI] Erro:`, cliError);
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
      success: false,
      domain,
      emails: [],
      count: 0,
      source: 'error',
      error: error.message
    });
  }
}
