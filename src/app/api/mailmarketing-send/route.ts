import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

export async function POST(req: NextRequest) {
    try {
        const { to, subject, content, sender, clientName, clientEmail } = await req.json();

        if (!to || !Array.isArray(to) || to.length === 0) {
            return NextResponse.json({ error: 'Lista de destinatários vazia' }, { status: 400 });
        }

        // CLIENT PANEL: usar conta dedicada (neutra) para nao misturar com admin.
        const clientSmtpUser = process.env.CLIENT_SMTP_EMAIL || process.env.GMAIL_CLIENT_EMAIL || '';
        const clientSmtpPass = process.env.CLIENT_SMTP_PASSWORD || process.env.GMAIL_CLIENT_APP_PASSWORD || '';
        const clientSmtpHost = process.env.CLIENT_SMTP_HOST || 'smtp.gmail.com';
        const clientSmtpPort = Number(process.env.CLIENT_SMTP_PORT || 587);
        const clientSmtpSecure = String(process.env.CLIENT_SMTP_SECURE || 'false') === 'true';
        const allowClientFallback = String(process.env.CLIENT_SMTP_ALLOW_FALLBACK || 'false') === 'true';

        if (!clientSmtpUser || !clientSmtpPass) {
            return NextResponse.json(
                { error: 'Conta SMTP do painel cliente não configurada. Defina CLIENT_SMTP_EMAIL e CLIENT_SMTP_PASSWORD.' },
                { status: 500 }
            );
        }

        let emailConfig = {
            smtp: clientSmtpHost,
            ports: { smtp: clientSmtpPort },
            ssl: clientSmtpSecure
        };

        const safeClientName = (clientName || '').toString().trim();
        const safeClientEmail = (clientEmail || '').toString().trim();
        const safeSender = (sender || '').toString().trim();

        console.log(`CONFIGURAÇÃO SMTP:`, {
            host: emailConfig.smtp,
            port: emailConfig.ports.smtp,
            clientName: safeClientName || '(não definido)',
            clientEmail: safeClientEmail || '(não definido)',
            status: 'SMTP MASTER COM REMETENTE PERSONALIZADO'
        });

        let activeAuthUser = clientSmtpUser;

        // Tentar conta dedicada do painel cliente
        let transporter = nodemailer.createTransport({
            host: emailConfig.smtp,
            port: emailConfig.ports.smtp,
            secure: emailConfig.ssl,
            auth: {
                user: clientSmtpUser,
                pass: clientSmtpPass
            },
            tls: { rejectUnauthorized: false },
            authMethod: 'LOGIN',
            connectionTimeout: 10000,
            socketTimeout: 15000
        });

        // Testar conexao Gmail
        try {
            await transporter.verify();
            console.log('SMTP Connection verified successfully (CLIENT ACCOUNT)');
        } catch (verifyError: any) {
            console.error('Conta SMTP do cliente falhou:', verifyError.message);
            if (!allowClientFallback) {
                return NextResponse.json({ 
                    error: 'Conta SMTP do cliente falhou. Corrija as credenciais ou ative CLIENT_SMTP_ALLOW_FALLBACK=true.' 
                }, { status: 500 });
            }

            // Fallback opcional para SMTP da plataforma (desligado por default).
            console.log('CONFIGURANDO SMTP FALLBACK DA PLATAFORMA...');
            emailConfig = {
                smtp: process.env.SMTP_HOST || '109.199.104.22',
                ports: { smtp: Number(process.env.SMTP_PORT || 465) },
                ssl: String(process.env.SMTP_SECURE || 'true') === 'true'
            };
            activeAuthUser = process.env.SMTP_MASTER_EMAIL || 'admin@visualdesigne.com';

            transporter = nodemailer.createTransport({
                host: emailConfig.smtp,
                port: emailConfig.ports.smtp,
                secure: emailConfig.ssl,
                auth: {
                    user: process.env.SMTP_MASTER_EMAIL || 'admin@visualdesigne.com',
                    pass: process.env.SMTP_MASTER_PASSWORD || ''
                },
                tls: { rejectUnauthorized: false },
                authMethod: 'LOGIN',
                connectionTimeout: 10000,
                socketTimeout: 15000
            });

            try {
                await transporter.verify();
                console.log('SMTP Connection verified successfully (PLATFORM FALLBACK)');
            } catch (fallbackError: any) {
                console.error('Fallback da plataforma também falhou:', fallbackError.message);
                return NextResponse.json({ 
                    error: 'SMTP do cliente e fallback da plataforma falharam.' 
                }, { status: 500 });
            }
        }

        console.log(`Iniciando envio de newsletter para ${to.length} contactos via ${emailConfig.smtp}...`);

        // Envio individual para evitar que um e-mail inválido bloqueie todos
        const results = {
            success: 0,
            failed: 0,
            errors: [] as string[]
        };
        const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const LIKELY_TYPO_DOMAINS = new Set(['gail.com', 'gmial.com', 'gmai.com', 'hotnail.com', 'yaho.com']);

        // Processamento em LOTES (Batches) para velocidade e segurança
        const BATCH_SIZE = 10;
        for (let i = 0; i < to.length; i += BATCH_SIZE) {
            const batch = to.slice(i, i + BATCH_SIZE);
            
            await Promise.all(batch.map(async (email) => {
                try {
                    const normalizedEmail = (email || '').toString().trim().toLowerCase();
                    if (!EMAIL_REGEX.test(normalizedEmail)) {
                        results.failed++;
                        results.errors.push(`${normalizedEmail || 'destinatario_vazio'}: formato de email invalido`);
                        return;
                    }
                    const domainPart = normalizedEmail.split('@')[1] || '';
                    if (LIKELY_TYPO_DOMAINS.has(domainPart)) {
                        results.failed++;
                        results.errors.push(`${normalizedEmail}: dominio parece incorreto (${domainPart})`);
                        return;
                    }

                    // Remetente personalizado do cliente
                    const personalizedSender =
                        safeSender ||
                        (safeClientEmail
                            ? `"${safeClientName || safeClientEmail}" <${safeClientEmail}>`
                            : process.env.SMTP_MASTER_EMAIL || 'admin@visualdesigne.com');

                    // Identidade visivel do cliente no "From".
                    // Conta tecnica autenticada segue no envelope/sender.
                    const envelopeFrom = `"${safeClientName || 'Cliente'}" <${activeAuthUser}>`;
                    const visibleFrom = safeClientEmail ? personalizedSender : envelopeFrom;
                    const technicalSender = `"${safeClientName || 'Cliente'}" <${activeAuthUser}>`;

                    const info = await transporter.sendMail({
                        from: visibleFrom,
                        sender: technicalSender,
                        replyTo: safeClientEmail || personalizedSender,
                        envelope: {
                            from: activeAuthUser,
                            to: normalizedEmail
                        },
                        to: normalizedEmail,
                        subject: subject,
                        html: content,
                    });

                    const accepted = (info.accepted || []).map(String).map((v) => v.toLowerCase());
                    const rejected = (info.rejected || []).map(String).map((v) => v.toLowerCase());
                    const acceptedCurrent =
                        accepted.includes(normalizedEmail) ||
                        (accepted.length > 0 && rejected.length === 0);

                    if (acceptedCurrent) {
                        results.success++;
                        console.log(`Email aceite por SMTP para ${normalizedEmail} como ${visibleFrom}`);
                    } else {
                        results.failed++;
                        results.errors.push(`${normalizedEmail}: rejeitado pelo SMTP`);
                        console.error(`SMTP rejeitou ${normalizedEmail}`, { accepted, rejected, response: info.response });
                    }
                } catch (err: any) {
                    console.error(`Falha ao enviar para ${email}:`, err.message);
                    results.failed++;
                    results.errors.push(`${email}: ${err.message}`);
                }
            }));
        }

        if (results.success === 0) {
            return NextResponse.json({
                error: 'Nenhum email foi entregue.',
                details: results
            }, { status: 500 });
        }

        return NextResponse.json({ 
            success: true, 
            message: `Processamento concluído: ${results.success} enviados, ${results.failed} falhas.`,
            details: results
        });

    } catch (error: any) {
        console.error('Erro na API de MailMarketing:', error);
        return NextResponse.json({ error: error.message || 'Erro interno no servidor' }, { status: 500 });
    }
}
