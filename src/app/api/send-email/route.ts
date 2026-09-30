import { NextRequest, NextResponse } from 'next/server';
import { sendWebmailSmtpMail, sendSmtpMail, isSmtpConfigured } from '@/lib/smtp-mail';
import { createClient, getVerifiedSession } from '@/utils/supabase/server';
import { resolveMailboxPassword } from '@/lib/imap-panel-shared';

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
        const body = await req.json();
        console.log('🚀 [send-email] Body:', JSON.stringify(body, null, 2));

        const { from, to, cc, bcc, subject, html, replyTo, fromPassword, attachments } = body;

        if (!from || !to || !subject) {
            console.log('🚀 [send-email] Erro: Campos obrigatórios em falta');
            return NextResponse.json({
                error: 'Campos obrigatórios em falta (from, to, subject)'
            }, { status: 400 });
        }

        // Sem isto, qualquer pedido não autenticado conseguia enviar email
        // como qualquer conta gerida — mais grave ainda agora que o envio é
        // directo pelo domínio real (SPF/DKIM alinhados dão-lhe mais
        // credibilidade num ataque de spoofing).
        const supabase = await createClient();
        const session = await getVerifiedSession(supabase);
        if (!session) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
        }
        const authorizedPassword = await resolveMailboxPassword(from, fromPassword, session);
        if (!authorizedPassword) {
            return NextResponse.json({ error: 'Sem permissão para enviar a partir desta conta.' }, { status: 403 });
        }

        const mailAttachments = Array.isArray(attachments)
            ? attachments
                .filter((a: { filename?: string; content?: string }) => a?.filename && a?.content)
                .map((a: { filename: string; contentType?: string; content: string }) => ({
                    filename: a.filename,
                    contentType: a.contentType,
                    content: Buffer.from(a.content, 'base64'),
                }))
            : undefined;

        const mailInput = {
            to,
            from,
            subject,
            html: html || '',
            replyTo: replyTo || from,
            cc,
            bcc,
            attachments: mailAttachments
        };

        // Cada cliente envia com o seu próprio endereço — sem nome/remetente
        // fixo. O envio vai directo pelo servidor local (Exim, porta 25, sem
        // AUTH — o servidor confia por IP porque a app corre na mesma
        // máquina desde a migração para o Hetzner). Isto mantém SPF/DKIM
        // alinhados com o domínio real de cada conta, ao contrário do relay
        // Brevo central (que usava sempre a mesma identidade partilhada).
        try {
            console.log('📧 Enviando via SMTP local do servidor (Exim, autenticado)...');
            const result = await sendWebmailSmtpMail(mailInput, { user: from, pass: authorizedPassword });

            console.log('✅ Email enviado com sucesso via SMTP local, ID:', result.messageId);

            if (authorizedPassword) {
                try {
                    await saveToSentFolder(from, authorizedPassword, to, subject, html || '');
                } catch (e) {
                    console.error('❌ [Background] Erro ao guardar Sent:', e);
                }
            }

            return NextResponse.json({
                success: true,
                messageId: result.messageId,
                provider: 'smtp-local',
                response: result.response,
                savedToSent: !!authorizedPassword
            });
        } catch (localError: any) {
            console.error('❌ SMTP local falhou:', localError.message);

            // Reserva: se o envio directo falhar (ex.: destino a rejeitar o IP
            // do servidor), tenta o relay Brevo como caminho alternativo,
            // mantendo sempre o endereço real do cliente como remetente.
            if (!isSmtpConfigured()) {
                return NextResponse.json({
                    success: false,
                    error: localError.message,
                    details: 'Falha no envio directo pelo servidor de correio.'
                }, { status: 500 });
            }

            try {
                console.log('📧 A tentar via relay Brevo (reserva)...');
                const result = await sendSmtpMail(mailInput);
                console.log('✅ Email enviado com sucesso via Brevo (reserva), ID:', result.messageId);

                if (authorizedPassword) {
                    try {
                        await saveToSentFolder(from, authorizedPassword, to, subject, html || '');
                    } catch (e) {
                        console.error('❌ [Background] Erro ao guardar Sent:', e);
                    }
                }

                return NextResponse.json({
                    success: true,
                    messageId: result.messageId,
                    provider: 'smtp-brevo-fallback',
                    response: result.response,
                    savedToSent: !!authorizedPassword
                });
            } catch (brevoError: any) {
                console.error('❌ SMTP Brevo (reserva) também falhou:', brevoError.message);
                return NextResponse.json({
                    success: false,
                    error: brevoError.message,
                    details: 'Falha no envio via SMTP (directo e reserva). Verifique as configurações do servidor.'
                }, { status: 500 });
            }
        }

    } catch (error: any) {
        console.error('❌ [send-email] Erro:', error);
        return NextResponse.json({ 
            success: false,
            error: error.message 
        }, { status: 500 });
    }
}
