import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'ssh2';

// SSH Connection
async function execSSH(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    let out = '';
    const rawKey = process.env.SSH_PRIVATE_KEY || '';
    
    if (!rawKey.includes('BEGIN') || !rawKey.includes('END')) {
      return reject(new Error('SSH_PRIVATE_KEY inválida'));
    }
    
    const privateKey = rawKey.replace(/\\n/g, '\n');
    const host = process.env.CYBERPANEL_IP || '109.199.104.22';

    const timeout = setTimeout(() => {
      conn.end();
      reject(new Error('SSH timeout'));
    }, 30000);

    conn.on('ready', () => {
      clearTimeout(timeout);
      conn.exec(command, (err, stream) => {
        if (err) { conn.end(); return reject(err); }
        stream.on('data', (d: Buffer) => { out += d.toString(); });
        stream.stderr.on('data', (d: Buffer) => { out += d.toString(); });
        stream.on('close', () => { conn.end(); resolve(out); });
      });
    });

    conn.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    conn.connect({
      host,
      port: 22,
      username: 'root',
      privateKey: Buffer.from(privateKey),
      readyTimeout: 20000,
    });
  });
}

export async function POST(req: NextRequest) {
  try {
    const { to, subject, content, fromEmail, fromName } = await req.json();

    if (!to || !Array.isArray(to) || to.length === 0) {
      return NextResponse.json({ error: 'Lista de destinatários vazia' }, { status: 400 });
    }
    if (!fromEmail) {
      return NextResponse.json({ error: 'Email de remetente obrigatório' }, { status: 400 });
    }

    console.log(`📧 Enviando email via CyberPanel SSH para ${to.length} destinatários`);
    console.log(`📧 De: ${fromEmail} (${fromName || ''})`);
    console.log(`📧 Assunto: ${subject}`);

    const results = { success: 0, failed: 0, errors: [] as string[] };

    // Enviar um por um via SSH
    for (const recipient of to.slice(0, 10)) {
      try {
        // Escape para shell
        const safeSubject = subject.replace(/"/g, '\\"').substring(0, 200);
        const safeBody = content.replace(/"/g, '\\"').substring(0, 1000);
        const safeFrom = fromEmail.replace(/"/g, '\\"');
        const safeTo = recipient.replace(/"/g, '\\"');
        
        const command = `/usr/local/CyberCP/bin/cyberpanel sendEmail --fromEmail "${safeFrom}" --toEmail "${safeTo}" --subject "${safeSubject}" --body "${safeBody}"`;
        
        console.log(`📤 SSH para ${recipient}...`);
        
        const output = await execSSH(command);
        
        console.log(`📧 Resultado:`, output.substring(0, 200));
        
        // Verificar se houve erro no output
        if (output.toLowerCase().includes('error') || output.toLowerCase().includes('failed')) {
          results.failed++;
          results.errors.push(`${recipient}: ${output}`);
        } else {
          results.success++;
        }
      } catch (sendError: any) {
        console.error(`❌ Falha ao enviar para ${recipient}:`, sendError.message);
        results.failed++;
        results.errors.push(`${recipient}: ${sendError.message}`);
      }
    }

    console.log(`📊 Resultados: ${results.success} sucesso, ${results.failed} falhas`);

    return NextResponse.json({
      success: results.success > 0,
      details: results,
      message: results.success > 0 
        ? `Enviados ${results.success} emails. ${results.failed > 0 ? `${results.failed} falhas.` : ''}`
        : `Falha no envio. ${results.errors.join('; ')}`
    });

  } catch (error: any) {
    console.error('Erro ao enviar email via CyberPanel:', error);
    return NextResponse.json({
      error: 'Falha no envio via CyberPanel',
      details: error.message
    }, { status: 500 });
  }
}
