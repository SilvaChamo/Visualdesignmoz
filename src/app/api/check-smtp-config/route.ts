import { NextResponse } from 'next/server';
import { getServerHost, getHestiaUrl } from '@/lib/server-config'

export async function GET() {
  // Verificar configurações SMTP (sem expor senhas completas)
  const config = {
    smtp: {
      host: 'mail.visualdesignmoz.com',
      port: 587,  // Porta fixa - sempre 587
      user: process.env.SMTP_MASTER_EMAIL || 'admin@visualdesignmoz.com',
      hasPassword: !!process.env.SMTP_MASTER_PASSWORD,
      passwordLength: process.env.SMTP_MASTER_PASSWORD?.length || 0,
    },
    gmail: {
      email: process.env.GMAIL_CLIENT_EMAIL || null,
      hasPassword: !!process.env.GMAIL_CLIENT_APP_PASSWORD,
    },
    cyberpanel: {
      host: getServerHost(),
      port: 465,
      status: 'online' // assumindo online
    }
  };

  const isConfigured = config.smtp.hasPassword || config.gmail.hasPassword;

  return NextResponse.json({
    configured: isConfigured,
    config: config,
    message: isConfigured 
      ? 'SMTP configurado' 
      : 'SMTP não configurado - necessário adicionar senha',
    recommendation: !isConfigured 
      ? 'Adicione SMTP_MASTER_PASSWORD ao .env.local ou configure GMAIL_CLIENT_EMAIL + GMAIL_CLIENT_APP_PASSWORD'
      : null
  });
}
