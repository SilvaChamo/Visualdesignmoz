import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getServerHost, getHestiaUrl } from '@/lib/server-config'

const execAsync = promisify(exec);

// Credenciais do Contabo
const SSH_HOST = getServerHost();
const SSH_USER = 'ADMIN';
const SSH_PASS = process.env.VPS_PASS || process.env.SSH_PASS || '';

export async function POST(req: NextRequest) {
  try {
    console.log('🚀 Iniciando configuração SMTP no Contabo...');

    // Comando SSH para configurar Postfix
    const sshCommand = `sshpass -p '${SSH_PASS}' ssh -o StrictHostKeyChecking=no ${SSH_USER}@${SSH_HOST} 'sudo bash -c "
      # Abrir portas
      ufw allow 587/tcp 2>/dev/null || true
      ufw allow 465/tcp 2>/dev/null || true
      ufw reload 2>/dev/null || true
      
      # Configurar Postfix
      postconf -e \\"inet_interfaces=all\\" 2>/dev/null || true
      postconf -e \\"smtpd_sasl_auth_enable=yes\\" 2>/dev/null || true
      postconf -e \\"smtpd_recipient_restrictions=permit_mynetworks,permit_sasl_authenticated,reject_unauth_destination\\" 2>/dev/null || true
      
      # Adicionar submission
      if ! grep -q \\"^submission\\" /etc/postfix/master.cf; then
        echo \\"\\
submission inet n       -       -       -       -       smtpd
  -o smtpd_tls_security_level=encrypt
  -o smtpd_sasl_auth_enable=yes
  -o smtpd_client_restrictions=permit_sasl_authenticated,reject\\" >> /etc/postfix/master.cf
      fi
      
      # Restart
      systemctl restart postfix 2>/dev/null || service postfix restart 2>/dev/null || true
      
      # Verificar
      if netstat -tlnp 2>/dev/null | grep -q ":587"; then
        echo \\"✅ SMTP OK - Porta 587 aberta\\"
      else
        echo \\"⚠️ Verificar manualmente\\"
      fi
    "'`;

    console.log('📡 A ligar ao servidor Contabo...');
    
    const { stdout, stderr } = await execAsync(sshCommand, { timeout: 60000 });
    
    console.log('📧 Resultado:', stdout);
    if (stderr) console.error('⚠️ Stderr:', stderr);

    return NextResponse.json({
      success: true,
      message: 'Configuração SMTP executada no servidor',
      output: stdout,
      errors: stderr || null,
      nextSteps: [
        'Verificar no painel Contabo se firewall permite portas 587/465',
        'Testar envio de email no painel cliente'
      ]
    });

  } catch (error: any) {
    console.error('❌ Erro na configuração:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
      code: 'SETUP_FAILED',
      manualFallback: 'Execute os comandos no ficheiro QUICK-SETUP.txt manualmente'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'POST para /api/setup-smtp-server para configurar automaticamente',
    server: SSH_HOST,
    user: SSH_USER
  });
}
