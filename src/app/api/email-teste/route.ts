import { NextRequest, NextResponse } from 'next/server';
import { sendSmtpMail } from '@/lib/smtp-mail';
import { isBrevoApiConfigured, sendBrevoTransactionalEmail } from '@/lib/brevo-mail';

export async function POST(req: NextRequest): Promise<Response> {
    try {
        const { to, from, subject, html } = await req.json();

        if (!to || !from || !subject) {
            return NextResponse.json({
                success: false,
                error: 'Campos obrigatórios: to, from, subject',
            }, { status: 400 });
        }

        const body = html || '<p>Teste</p>';

        if (isBrevoApiConfigured()) {
            const result = await sendBrevoTransactionalEmail({ from, to, subject, html: body });
            return NextResponse.json({
                success: true,
                provider: 'brevo-api',
                messageId: result.messageId,
            });
        }

        const result = await sendSmtpMail({ from, to, subject, html: body });
        return NextResponse.json({
            success: true,
            provider: 'smtp',
            messageId: result.messageId,
        });

    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Erro interno';
        return NextResponse.json({
            success: false,
            error: message
        }, { status: 500 });
    }
}
