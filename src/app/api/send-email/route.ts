import { NextRequest, NextResponse } from 'next/server';
import { sendSmtpMail, isSmtpConfigured } from '@/lib/smtp-mail';

async function saveToSentFolder(
    from: string,
    password: string | undefined,
    to: string | string[],
    subject: string,
    html: string
): Promise<void> {
    if (!password) {
        console.log('⚠️ Senha IMAP não fornecida. Não é possível guardar na pasta "Enviados".');
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
    }
}

export async function POST(req: NextRequest) {
    console.log('🚀 [send-email] Requisição recebida');
    try {
        if (!isSmtpConfigured()) {
            return NextResponse.json({
                success: false,
                error: 'Servidor de SMTP não configurado. Contacte o administrador.',
                code: 'SMTP_NOT_CONFIGURED'
            }, { status: 500 });
        }

        const body = await req.json();
        console.log('🚀 [send-email] Body:', JSON.stringify(body, null, 2));

        const { from, to, cc, bcc, subject, html, replyTo, fromPassword } = body;

        if (!from || !to || !subject) {
            console.log('🚀 [send-email] Erro: Campos obrigatórios em falta');
            return NextResponse.json({ 
                error: 'Campos obrigatórios em falta (from, to, subject)' 
            }, { status: 400 });
        }

        try {
            console.log('📧 Enviando via SMTP centralizado...');
            const result = await sendSmtpMail({
                to,
                from: `"VisualDesigne" <${from}>`,
                subject,
                html: html || '',
                replyTo: replyTo || from,
                cc,
                bcc
            });

            console.log('✅ Email enviado com sucesso via SMTP, ID:', result.messageId);

            if (fromPassword) {
                try {
                    await saveToSentFolder(from, fromPassword, to, subject, html || '');
                } catch (e) {
                    console.error('❌ [Background] Erro ao guardar Sent:', e);
                }
            }

            return NextResponse.json({
                success: true,
                messageId: result.messageId,
                provider: 'smtp-central',
                response: result.response,
                savedToSent: !!fromPassword
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
