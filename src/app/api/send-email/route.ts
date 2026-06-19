import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { getServerHost, getHestiaUrl } from '@/lib/server-config'
import { resolvePanelImapHost } from '@/lib/imap-host'

// Resolve o servidor SMTP correto com base no domínio do email remetente
const resolveSmtpConfig = (fromEmail: string, fromPassword: string) => {
  const domain = fromEmail.split('@')[1]?.toLowerCase() || ''

  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    return { host: 'smtp.gmail.com', port: 587, secure: false, authUser: fromEmail, authPass: fromPassword }
  }
  if (['outlook.com', 'hotmail.com', 'hotmail.pt', 'live.com', 'live.pt', 'msn.com'].includes(domain)) {
    return { host: 'smtp-mail.outlook.com', port: 587, secure: false, authUser: fromEmail, authPass: fromPassword }
  }
  if (domain === 'yahoo.com' || domain === 'ymail.com') {
    return { host: 'smtp.mail.yahoo.com', port: 465, secure: true, authUser: fromEmail, authPass: fromPassword }
  }
  if (domain === 'icloud.com' || domain === 'me.com' || domain === 'mac.com') {
    return { host: 'smtp.mail.me.com', port: 587, secure: false, authUser: fromEmail, authPass: fromPassword }
  }
  if (domain === 'zoho.com') {
    return { host: 'smtp.zoho.com', port: 587, secure: false, authUser: fromEmail, authPass: fromPassword }
  }

  // Genérico / servidor hospedado
  // Se existirem credenciais globais de SMTP (ex: Brevo) no .env, usar essas para envio (relay)
  const globalSmtpHost = process.env.SMTP_HOST || process.env.DA_SMTP_HOST;
  const globalSmtpUser = process.env.SMTP_USER || process.env.DA_SMTP_USER;
  const globalSmtpPass = process.env.SMTP_PASS || process.env.DA_SMTP_PASS || process.env.SMTP_MASTER_PASSWORD;

  if (globalSmtpHost && globalSmtpUser && globalSmtpPass) {
    return { 
      host: globalSmtpHost, 
      port: Number(process.env.SMTP_PORT || process.env.DA_SMTP_PORT || 587), 
      secure: process.env.SMTP_SECURE === 'true', 
      authUser: globalSmtpUser, 
      authPass: globalSmtpPass 
    }
  }

  // Fallback: usar o IP directo do VPS e a password individual do utilizador
  return { host: getServerHost(), port: 587, secure: false, authUser: fromEmail, authPass: fromPassword }
}

// 🚀 CONFIGURAÇÃO SMTP - Usar servidor de email local (DirectAdmin/Postfix)
const SMTP_HOST = getServerHost() // IP direto do servidor
const SMTP_PORT = 587; // Forçar porta 587 com STARTTLS
const SMTP_SECURE = false; // 587 usa STARTTLS (não SSL direto)

// 🆕 FUNÇÃO: Enviar via SMTP direto usando Nodemailer
async function sendViaSMTP(
    to: string | string[],
    subject: string,
    html: string,
    fromEmail: string,
    fromPassword: string,
    replyTo?: string
): Promise<any> {
    const smtpCfg = resolveSmtpConfig(fromEmail, fromPassword)
    console.log(`🔄 SMTP: Enviando email de ${fromEmail} → ${smtpCfg.host}:${smtpCfg.port} (Auth: ${smtpCfg.authUser})`);

    const toArray = Array.isArray(to) ? to : [to];

    const transporter = nodemailer.createTransport({
        host: smtpCfg.host,
        port: smtpCfg.port,
        secure: smtpCfg.secure,   // false para 587 (STARTTLS), true para 465 (SSL)
        requireTLS: !smtpCfg.secure, // Forçar STARTTLS quando porta 587
        auth: {
            user: smtpCfg.authUser,
            pass: smtpCfg.authPass
        },
        tls: {
            rejectUnauthorized: false,
            ciphers: 'SSLv3'
        },
        connectionTimeout: 30000,
        greetingTimeout: 30000,
        socketTimeout: 45000,
        // Nome do servidor que se apresenta no HELO/EHLO
        name: smtpCfg.host
    });

    // Verificar conexão antes de enviar
    try {
        await transporter.verify();
        console.log('✅ Conexão SMTP verificada com sucesso');
    } catch (verifyError: any) {
        console.error('❌ Erro na verificação SMTP:', verifyError.message);
        // Se verify falhar, tentar mesmo assim (alguns servidores bloqueiam NOOP)
        console.warn('⚠️ verify() falhou mas tentando enviar mesmo assim...');
    }

    // Enviar email
    const info = await transporter.sendMail({
        from: `"VisualDesigne" <${fromEmail}>`,
        to: toArray,
        subject,
        html,
        replyTo: replyTo || fromEmail
    });

    console.log('✅ Email enviado:', info.messageId);
    console.log('📊 Resposta SMTP:', info.response);

    return {
        success: true,
        messageId: info.messageId,
        response: info.response
    };
}

// 🆕 FUNÇÃO: Guardar email na pasta Sent via IMAP (fire and forget)
async function saveToSentFolder(
    from: string,
    password: string,
    to: string | string[],
    subject: string,
    html: string
): Promise<void> {
    if (!password) {
        console.log('⚠️ Sem senha IMAP, não é possível guardar na pasta Sent');
        return;
    }
    
    try {
        console.log('📁 [IMAP] A guardar email na pasta Sent...');
        const { connectImapClient, FOLDER_VARIATIONS } = await import('@/lib/imap-panel-shared');
        
        const imapClient = await connectImapClient(from, password);
        
        if (!imapClient) {
            console.warn('⚠️ [IMAP] Falha ao ligar para guardar na pasta Sent');
            return;
        }
        
        const sentFolders = FOLDER_VARIATIONS['sent'] || ['Sent', 'INBOX.Sent', 'Sent Items', 'Enviados'];
        
        const toArray = Array.isArray(to) ? to : [to];
        const toStr = toArray.join(', ');
        const senderDomain = from.split('@')[1] || 'visualdesignmoz.com';
        const messageId = `<${Date.now()}.${Math.random().toString(36).substring(2)}@${senderDomain}>`;
        const dateStr = new Date().toUTCString();
        
        // Construir mensagem RFC822 completa
        const fullMessage = `From: ${from}\r\n` +
            `To: ${toStr}\r\n` +
            `Subject: ${subject}\r\n` +
            `Message-ID: ${messageId}\r\n` +
            `Date: ${dateStr}\r\n` +
            `MIME-Version: 1.0\r\n` +
            `Content-Type: text/html; charset=utf-8\r\n` +
            `\r\n` +
            `${html || ''}`;

        let saved = false;
        for (const folder of sentFolders) {
            try {
                await imapClient.append(folder, fullMessage, ['\\Seen']);
                console.log(`✅ [IMAP] Email guardado na pasta: ${folder}`);
                saved = true;
                break;
            } catch (e: any) {
                console.log(`⚠️ [IMAP] Pasta ${folder} falhou:`, e.message);
                continue;
            }
        }

        if (!saved) {
            console.warn('⚠️ [IMAP] Não foi possível guardar em nenhuma pasta Sent conhecida');
        }
        
        await imapClient.logout();
        
    } catch (error: any) {
        console.error('❌ [IMAP] Erro ao guardar na pasta Sent:', error.message);
        // Não propagar erro - é fire and forget
    }
}

export async function POST(req: NextRequest) {
    console.log('🚀 [send-email] Requisição recebida');
    try {
        const body = await req.json();
        console.log('🚀 [send-email] Body:', JSON.stringify(body, null, 2));
        
        const { from, to, cc, bcc, subject, html, replyTo, fromPassword } = body;

        // Validações básicas
        if (!from || !to || !subject) {
            console.log('🚀 [send-email] Erro: Campos obrigatórios em falta');
            return NextResponse.json({ 
                error: 'Campos obrigatórios em falta (from, to, subject)' 
            }, { status: 400 });
        }

        // 🎯 Validar senha do remetente
        if (!fromPassword) {
            console.log('🚀 [send-email] Erro: Senha do remetente em falta');
            return NextResponse.json({
                error: 'Senha do remetente obrigatória para envio SMTP',
                details: 'A senha da conta de email é necessária para autenticação SMTP'
            }, { status: 400 });
        }

        // 🎯 Enviar via SMTP direto usando Nodemailer
        try {
            console.log('📧 Enviando via SMTP direto...');
            const result = await sendViaSMTP(to, subject, html || '', from, fromPassword, replyTo);

            console.log('✅ Email enviado com sucesso via SMTP, ID:', result.messageId);

            // 🚀 Await the IMAP save, otherwise Next.js Serverless kills the process immediately before it finishes.
            try {
                await saveToSentFolder(from, fromPassword, to, subject, html || '');
            } catch (e) {
                console.error('❌ [Background] Erro ao guardar Sent:', e);
            }

            return NextResponse.json({
                success: true,
                messageId: result.messageId,
                provider: 'smtp-direct',
                response: result.response,
                savedToSent: true
            });

        } catch (smtpError: any) {
            console.error('❌ SMTP falhou:', smtpError.message);
            return NextResponse.json({
                success: false,
                error: smtpError.message,
                details: 'Falha no envio via SMTP. Verifique as credenciais e configurações do servidor.'
            }, { status: 500 });
        }
        
    } catch (error: any) {
        console.error('❌ [send-email] Erro:', error);
        return NextResponse.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
}
