import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { createClient } from '@supabase/supabase-js';
import { resend } from '@/lib/resend';
import { detectDomainConfig } from '@/lib/email-autoconfig';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Divide um array em grupos de N elementos
function chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

// Pausa entre chunks para evitar bloqueio do SMTP
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function POST(req: Request) {
    try {
        const { to, subject, html, replyTo, attachments, targetAudiences } = await req.json();

        // 1. Validação básica
        if (!to || !Array.isArray(to) || to.length === 0) {
            return NextResponse.json({ error: 'Recipientes em falta' }, { status: 400 });
        }
        if (!subject || !html) {
            return NextResponse.json({ error: 'Assunto ou conteúdo em falta' }, { status: 400 });
        }

        const senderEmail = replyTo || process.env.SMTP_MASTER_EMAIL || 'admin@visualdesigne.com';
        const config = detectDomainConfig(senderEmail);

        // 2. Configurar transporter SMTP dinâmico
        const transporter = nodemailer.createTransport({
            host: config.smtp,
            port: config.ports.smtp,
            secure: config.ports.smtp === 465,
            auth: {
                user: process.env.SMTP_MASTER_EMAIL || 'admin@visualdesigne.com',
                pass: process.env.SMTP_MASTER_PASSWORD || 'AdvD2425',
            },
            tls: {
                rejectUnauthorized: false
            }
        });

        // 3. Criar registo de campanha na base de dados
        let campaignId: string | null = null;

        try {
            const { data: msgData } = await supabaseAdmin
                .from('messages')
                .insert({
                    subject,
                    content: html,
                    sender_email: senderEmail,
                    target_roles: targetAudiences || ['newsletter_subscribers'],
                })
                .select('id')
                .single();

            const { data: campaign } = await supabaseAdmin
                .from('email_campaigns')
                .insert({
                    subject,
                    content_html: html,
                    sender_email: senderEmail,
                    target_audiences: targetAudiences || [],
                    total_recipients: to.length,
                    status: 'enviando',
                    attachments: attachments || []
                })
                .select('id')
                .single();

            if (campaign) campaignId = campaign.id;
        } catch (e) {
            console.error("Erro ao criar registo de campanha:", e);
        }

        // 4. Preparar anexos
        const mailAttachments = attachments ? attachments.map((url: string) => ({
            filename: decodeURIComponent(url.split('/').pop() || 'anexo'),
            path: url
        })) : [];

        // 5. Envio em chunks de 50 (SMTP seguro)
        const CHUNK_SIZE = 50;
        const chunks = chunkArray(to as string[], CHUNK_SIZE);

        let totalSent = 0;
        let totalFailed = 0;
        let lastError: string | null = null;
        let usedProvider = 'smtp';

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i];

            try {
                await transporter.sendMail({
                    from: `"Visual Design" <${process.env.SMTP_MASTER_EMAIL || 'admin@visualdesigne.com'}>`,
                    replyTo: senderEmail,
                    to: process.env.SMTP_MASTER_EMAIL || 'admin@visualdesigne.com',
                    bcc: chunk,
                    subject,
                    html,
                    attachments: mailAttachments
                });

                totalSent += chunk.length;
                console.log(`Chunk ${i + 1}/${chunks.length} enviado: ${chunk.length} emails`);

            } catch (smtpErr: any) {
                console.error(`Erro SMTP no chunk ${i + 1}, a tentar Resend...`, smtpErr);

                // Fallback para Resend neste chunk
                try {
                    const resendData = await resend.emails.send({
                        from: 'Visual Design <noreply@visualdesigne.com>',
                        to: chunk,
                        subject,
                        html,
                        attachments: attachments ? attachments.map((url: string) => ({
                            path: url,
                            filename: url.split('/').pop() || 'anexo'
                        })) : []
                    });

                    totalSent += chunk.length;
                    usedProvider = 'resend';
                    console.log(`Chunk ${i + 1} enviado via Resend: ${resendData.data?.id}`);

                } catch (resendErr: any) {
                    totalFailed += chunk.length;
                    lastError = resendErr.message;
                    console.error(`Falha total no chunk ${i + 1}:`, resendErr);
                }
            }

            // Pausa de 500ms entre chunks para não sobrecarregar o SMTP
            if (i < chunks.length - 1) {
                await sleep(500);
            }
        }

        // 6. Actualizar campanha com resultados reais
        if (campaignId) {
            try {
                await supabaseAdmin
                    .from('email_campaigns')
                    .update({
                        status: totalFailed === to.length ? 'failed' : totalFailed > 0 ? 'partial' : 'sent',
                        sent_at: new Date().toISOString(),
                        successful_sends: totalSent,
                        failed_sends: totalFailed,
                        metadata: {
                            provider: usedProvider,
                            chunks_total: chunks.length,
                            chunk_size: CHUNK_SIZE,
                            last_error: lastError
                        }
                    })
                    .eq('id', campaignId);
            } catch (e) {
                console.error("Erro ao actualizar campanha:", e);
            }
        }

        // 7. Resposta ao cliente
        if (totalFailed === to.length) {
            return NextResponse.json({ error: lastError || 'Falha total no envio' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            campaignId,
            provider: usedProvider,
            stats: {
                total: to.length,
                sent: totalSent,
                failed: totalFailed,
                chunks: chunks.length
            }
        });

    } catch (error: any) {
        console.error("Erro na API de envio:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
