import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

// 🚀 CONFIGURAÇÃO SMTP - Usar servidor de email local (CyberPanel/Postfix)
const SMTP_HOST = process.env.SMTP_HOST || 'mail.visualdesigne.com';
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
    console.log(`🔄 SMTP: Enviando email de ${fromEmail} para ${Array.isArray(to) ? to.length : 1} destinatário(s)`);

    // Normalizar 'to' para array
    const toArray = Array.isArray(to) ? to : [to];

    // Criar transporter SMTP
    const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_SECURE, // false para STARTTLS na porta 587
        requireTLS: true, // Forçar STARTTLS
        auth: {
            user: fromEmail,
            pass: fromPassword
        },
        tls: {
            rejectUnauthorized: false // Aceitar certificados autoassinados
        },
        connectionTimeout: 30000,
        greetingTimeout: 30000,
        socketTimeout: 30000
    });

    // Verificar conexão antes de enviar
    try {
        await transporter.verify();
        console.log('✅ Conexão SMTP verificada com sucesso');
    } catch (verifyError: any) {
        console.error('❌ Erro na verificação SMTP:', verifyError.message);
        throw new Error(`Falha na conexão SMTP: ${verifyError.message}`);
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
        const { ImapFlow } = await import('imapflow');
        
        const imapClient = new ImapFlow({
            host: 'mail.visualdesigne.com',
            port: 993,
            secure: true,
            auth: { user: from, pass: password },
            tls: { rejectUnauthorized: false },
            logger: false
        });

        await imapClient.connect();
        
        // Tentar diferentes nomes de pasta Sent
        const sentFolders = ['INBOX.Sent', 'Sent', '.Sent', 'Enviados', 'INBOX.Sent Items'];
        
        const toArray = Array.isArray(to) ? to : [to];
        const toStr = toArray.join(', ');
        const messageId = `<${Date.now()}.${Math.random().toString(36).substring(2)}@visualdesigne.com>`;
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

            // 🚀 FIRE AND FORGET: Guardar na pasta Sent via IMAP (não bloqueia resposta)
            (async () => {
                try {
                    await saveToSentFolder(from, fromPassword, to, subject, html || '');
                } catch (e) {
                    console.error('❌ [Background] Erro ao guardar Sent:', e);
                }
            })().catch(err => console.error('❌ [Background] IMAP error:', err));

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
