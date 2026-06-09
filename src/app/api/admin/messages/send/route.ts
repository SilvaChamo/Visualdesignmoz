import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getDefaultFrom } from '@/lib/smtp-mail';
import { sendSmtpMail } from '@/lib/smtp-mail';
import { isBrevoApiConfigured, sendBrevoTransactionalEmail } from '@/lib/brevo-mail';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function sendOne(
    from: string,
    to: string,
    subject: string,
    html: string,
    replyTo?: string,
): Promise<void> {
    if (isBrevoApiConfigured()) {
        await sendBrevoTransactionalEmail({ from, to, subject, html });
        return;
    }
    await sendSmtpMail({ from, to, subject, html, replyTo });
}

export async function POST(req: Request) {
    try {
        const { to, subject, html, replyTo, attachments, targetAudiences } = await req.json();

        if (!to || !Array.isArray(to) || to.length === 0) {
            return NextResponse.json({ error: 'Recipientes em falta' }, { status: 400 });
        }
        if (!subject || !html) {
            return NextResponse.json({ error: 'Assunto ou conteúdo em falta' }, { status: 400 });
        }

        const senderEmail = replyTo || getDefaultFrom();
        const campaignSenderKey = `admin:${senderEmail.toLowerCase()}`;

        let campaignId: string | null = null;

        try {
            await supabaseAdmin
                .from('messages')
                .insert({
                    subject,
                    content: html,
                    sender_email: senderEmail,
                    target_roles: targetAudiences || ['newsletter_subscribers'],
                });

            const { data: campaign } = await supabaseAdmin
                .from('email_campaigns')
                .insert({
                    subject,
                    content: html,
                    sender_email: campaignSenderKey,
                    target_audiences: (targetAudiences || []).join(', '),
                    recipient_count: to.length,
                    status: 'enviando',
                    sent_at: null
                })
                .select('id')
                .single();

            if (campaign) campaignId = campaign.id;
        } catch (e) {
            console.error("Erro ao criar registo de campanha:", e);
        }

        const CHUNK_SIZE = 10;
        let totalSent = 0;
        let totalFailed = 0;
        const errors: string[] = [];

        for (let i = 0; i < to.length; i += CHUNK_SIZE) {
            const chunk = to.slice(i, i + CHUNK_SIZE);

            for (const recipient of chunk) {
                try {
                    await sendOne(senderEmail, recipient, subject, html, senderEmail);
                    totalSent++;
                } catch (error: unknown) {
                    totalFailed++;
                    const msg = error instanceof Error ? error.message : 'Falha no envio';
                    errors.push(`${recipient}: ${msg}`);
                }
            }

            if (i + CHUNK_SIZE < to.length) {
                await sleep(500);
            }
        }

        if (campaignId) {
            try {
                await supabaseAdmin
                    .from('email_campaigns')
                    .update({
                        status: totalFailed === to.length ? 'failed' : totalFailed > 0 ? 'partial' : 'sent',
                        sent_at: new Date().toISOString(),
                        recipient_count: totalSent
                    })
                    .eq('id', campaignId);
            } catch (e) {
                console.error("Erro ao actualizar campanha:", e);
            }
        }

        if (totalFailed === to.length) {
            return NextResponse.json({
                error: errors[0] || 'Falha total no envio',
                details: { success: 0, failed: totalFailed, errors }
            }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            campaignId,
            provider: isBrevoApiConfigured() ? 'brevo-api' : 'smtp',
            details: {
                success: totalSent,
                failed: totalFailed,
                errors: errors.length > 0 ? errors : undefined
            },
            stats: {
                total: to.length,
                sent: totalSent,
                failed: totalFailed
            }
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Erro interno';
        console.error("Erro na API de envio:", error);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
