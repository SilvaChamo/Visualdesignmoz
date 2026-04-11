import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Configuração CyberPanel
const CYBERPANEL_HOST = '109.199.104.22';
const CYBERPANEL_PORT = '8090';
const CYBERPANEL_ADMIN = 'admin';
const CYBERPANEL_PASS = 'EmailAdmin#2425';

export async function POST(req: NextRequest) {
  try {
    const { to, subject, content, fromEmail, fromName } = await req.json();

    if (!to || !Array.isArray(to) || to.length === 0) {
      return NextResponse.json({ error: 'Lista de destinatários vazia' }, { status: 400 });
    }

    console.log(`📧 Enviando email via CyberPanel CLI para ${to.length} destinatários`);
    console.log(`📧 De: ${fromEmail}`);
    console.log(`📧 Assunto: ${subject}`);

    // Usar comando CLI do CyberPanel para enviar email
    // Comando: cyberpanel sendEmail --fromEmail FROM --toEmail TO --subject "SUBJ" --body "BODY"
    
    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    };

    // Enviar um por um (CyberPanel CLI não suporta múltiplos destinatários de uma vez)
    for (const recipient of to.slice(0, 10)) { // Limitar a 10 para teste
      try {
        const command = `/usr/local/CyberCP/bin/cyberpanel sendEmail --fromEmail "${fromEmail}" --toEmail "${recipient}" --subject "${subject.replace(/"/g, '\\"')}" --body "${content.replace(/"/g, '\\"').substring(0, 500)}"`;
        
        console.log(`📤 Executando: ${command.substring(0, 100)}...`);
        
        const { stdout, stderr } = await execAsync(command, { timeout: 60000 });
        
        console.log(`📧 Resultado para ${recipient}:`, stdout);
        
        if (stderr) {
          console.error(`❌ Erro para ${recipient}:`, stderr);
          results.failed++;
          results.errors.push(`${recipient}: ${stderr}`);
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
      success: true,
      details: results,
      message: `Enviados ${results.success} emails. ${results.failed > 0 ? `${results.failed} falhas.` : ''}`
    });

  } catch (error: any) {
    console.error('Erro ao enviar email via CyberPanel:', error);
    return NextResponse.json({
      error: 'Falha no envio via CyberPanel',
      details: error.message
    }, { status: 500 });
  }
}
