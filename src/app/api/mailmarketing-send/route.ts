import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';
import {
  getDomainReputation,
} from '@/lib/warmup-service';

// ============================================================
// SMTP via DirectAdmin (Exim)
// Configurar no .env:
//   DA_SMTP_HOST=109.199.104.22
//   DA_SMTP_PORT=587
//   DA_SMTP_USER=marketing@visualdesignmoz.com (email criado no DA)
//   DA_SMTP_PASS=password-da-conta-email
// ============================================================
const DA_SMTP_HOST = process.env.DA_SMTP_HOST || '109.199.104.22';
const DA_SMTP_PORT = parseInt(process.env.DA_SMTP_PORT || '587');
const DA_SMTP_USER = process.env.DA_SMTP_USER || '';
const DA_SMTP_PASS = process.env.DA_SMTP_PASS || '';

/**
 * Cria um transporter nodemailer com o SMTP do DirectAdmin
 */
function createDirectAdminTransport() {
  return nodemailer.createTransport({
    host: DA_SMTP_HOST,
    port: DA_SMTP_PORT,
    secure: DA_SMTP_PORT === 465, // true para 465 (SSL), false para 587 (TLS)
    auth: {
      user: DA_SMTP_USER,
      pass: DA_SMTP_PASS,
    },
    tls: {
      rejectUnauthorized: false, // Aceitar certificado auto-assinado por agora
    },
    connectionTimeout: 15000,
    greetingTimeout: 10000,
    socketTimeout: 30000,
  });
}

/**
 * Envia emails em lotes via SMTP do DirectAdmin
 */
async function sendViaDirectAdminSMTP(
  to: string[],
  subject: string,
  content: string,
  fromEmail: string,
  fromName: string = 'VisualDesigne'
): Promise<{ success: boolean; sent: number; failed: number; errors: string[] }> {
  const transport = createDirectAdminTransport();

  // Verificar ligação SMTP antes de tentar enviar
  await transport.verify();

  const BATCH_SIZE = 50; // Enviar em grupos de 50 para não sobrecarregar
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < to.length; i += BATCH_SIZE) {
    const batch = to.slice(i, i + BATCH_SIZE);

    try {
      await transport.sendMail({
        from: `"${fromName}" <${fromEmail}>`,
        bcc: batch, // Usar BCC para privacidade dos destinatários
        subject,
        html: content,
        headers: {
          'X-Mailer': 'VisualDesigne Marketing System',
          'List-Unsubscribe': `<mailto:unsubscribe@${fromEmail.split('@')[1]}>`,
        },
      });
      sent += batch.length;
      console.log(`✅ Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} emails enviados`);
    } catch (err: any) {
      failed += batch.length;
      errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${err.message}`);
      console.error(`❌ Batch ${Math.floor(i / BATCH_SIZE) + 1} falhou:`, err.message);
    }

    // Pequena pausa entre batches para não ser marcado como spam
    if (i + BATCH_SIZE < to.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  transport.close();
  return { success: sent > 0, sent, failed, errors };
}

export async function POST(req: NextRequest) {
  console.log('🚀 [mailmarketing-send] Requisição recebida');
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return auth.error;

  try {
    const body = await req.json();
    const { to, subject, content, sender, senderName, clientEmail, domain } = body;

    if (!to || !Array.isArray(to) || to.length === 0) {
      return NextResponse.json({ error: 'Lista de destinatários vazia' }, { status: 400 });
    }

    if (!subject || !content) {
      return NextResponse.json({ error: 'Assunto e conteúdo são obrigatórios' }, { status: 400 });
    }

    // Determinar o email e domínio de envio
    const clientDomain = domain || (clientEmail ? clientEmail.split('@')[1] : null);
    if (!clientDomain) {
      return NextResponse.json({
        error: 'Domínio não especificado. Envie o parâmetro "domain" ou "clientEmail".',
      }, { status: 400 });
    }

    // Email remetente: usa o DA_SMTP_USER se não for passado sender específico
    const fromEmail = sender || DA_SMTP_USER || `marketing@${clientDomain}`;
    const fromName = senderName || 'VisualDesigne Marketing';

    console.log(`🚀 Enviando campanha via DirectAdmin SMTP:`, {
      host: DA_SMTP_HOST,
      port: DA_SMTP_PORT,
      from: fromEmail,
      recipients: to.length,
    });

    const result = await sendViaDirectAdminSMTP(to, subject, content, fromEmail, fromName);

    if (!result.success && result.sent === 0) {
      return NextResponse.json({
        error: `Falha ao enviar emails: ${result.errors.join(', ')}`,
        code: 'SMTP_ERROR',
        details: result,
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: `${result.sent} emails enviados com sucesso${result.failed > 0 ? `, ${result.failed} falharam` : ''}`,
      sent: result.sent,
      failed: result.failed,
      errors: result.errors.length > 0 ? result.errors : undefined,
    });

  } catch (error: any) {
    console.error('❌ [mailmarketing-send] Erro geral:', error?.message);

    // Erro de autenticação SMTP - credenciais em falta
    if (error.code === 'EAUTH' || error.responseCode === 535) {
      return NextResponse.json({
        error: 'Erro de autenticação SMTP. Configure DA_SMTP_USER e DA_SMTP_PASS no .env',
        code: 'SMTP_AUTH_ERROR',
      }, { status: 500 });
    }

    // Erro de ligação - servidor inacessível
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return NextResponse.json({
        error: `Não foi possível ligar ao servidor SMTP (${DA_SMTP_HOST}:${DA_SMTP_PORT}). Verifique se a porta está aberta.`,
        code: 'SMTP_CONNECTION_ERROR',
      }, { status: 500 });
    }

    return NextResponse.json({
      error: error?.message || 'Erro interno no servidor',
      code: 'INTERNAL_ERROR',
    }, { status: 500 });
  }
}

/**
 * GET - Obter status da ligação SMTP e reputação do domínio
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return auth.error;

  try {
    const { searchParams } = new URL(req.url);
    const domain = searchParams.get('domain');

    // Testar ligação SMTP
    let smtpStatus = 'unknown';
    let smtpError = '';
    try {
      const transport = createDirectAdminTransport();
      await transport.verify();
      transport.close();
      smtpStatus = 'connected';
    } catch (err: any) {
      smtpStatus = 'error';
      smtpError = err.message;
    }

    const response: any = {
      success: true,
      smtp: {
        host: DA_SMTP_HOST,
        port: DA_SMTP_PORT,
        user: DA_SMTP_USER ? `${DA_SMTP_USER.substring(0, 3)}***` : '(não configurado)',
        status: smtpStatus,
        error: smtpError || undefined,
      },
    };

    if (domain) {
      const reputation = await getDomainReputation(domain);
      response.domain = domain;
      response.reputation = reputation;
    }

    return NextResponse.json(response);

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
