import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { detectDomainConfig } from '@/lib/email-autoconfig';

export async function POST(req: NextRequest) {
    try {
        const { to, subject, content, domain, sender, clientName, clientEmail } = await req.json();

        if (!to || !Array.isArray(to) || to.length === 0) {
            return NextResponse.json({ error: 'Lista de destinatários vazia' }, { status: 400 });
        }

        // Usar SMTP master (sempre a mesma configuração)
        let emailConfig = {
            smtp: '109.199.104.22',
            ports: { smtp: 465 },
            ssl: true
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

        // Tentar servidor local primeiro
        let transporter = nodemailer.createTransport({
            host: emailConfig.smtp,
            port: emailConfig.ports.smtp,
            secure: emailConfig.ports.smtp === 465,
            auth: {
                user: 'admin@visualdesigne.com',  // SMTP master
                pass: 'EmailAdmin#2425'           // Senha master
            },
            tls: { rejectUnauthorized: false },
            authMethod: 'LOGIN',
            connectionTimeout: 10000,
            socketTimeout: 15000
        });

        // Testar conexão local
        try {
            await transporter.verify();
            console.log('SMTP Connection verified successfully (LOCAL)');
        } catch (verifyError: any) {
            console.error('SMTP Local failed, tentando Gmail fallback:', verifyError.message);
            
            // Fallback para Gmail
            console.log('CONFIGURANDO GMAIL FALLBACK...');
            emailConfig = {
                smtp: 'smtp.gmail.com',
                ports: { smtp: 587 },
                ssl: false
            };
            
            transporter = nodemailer.createTransport({
                host: emailConfig.smtp,
                port: emailConfig.ports.smtp,
                secure: false,
                auth: {
                    user: 'Visualdesign.moz@gmail.com', // Email do usuário
                    pass: 'buuf daoy jdkl skvr'         // Nova App Password do usuário
                },
                tls: { rejectUnauthorized: false }
            });
            
            try {
                await transporter.verify();
                console.log('SMTP Connection verified successfully (GMAIL)');
            } catch (gmailError: any) {
                console.error('Gmail também falhou:', gmailError.message);
                return NextResponse.json({ 
                    error: 'Ambos SMTP (local e Gmail) falharam. Configure Gmail App Password.' 
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

        // Processamento em LOTES (Batches) para velocidade e segurança
        const BATCH_SIZE = 10;
        for (let i = 0; i < to.length; i += BATCH_SIZE) {
            const batch = to.slice(i, i + BATCH_SIZE);
            
            await Promise.all(batch.map(async (email) => {
                try {
                    // Remetente personalizado do cliente
                    const personalizedSender =
                        safeSender ||
                        (safeClientEmail
                            ? `"${safeClientName || safeClientEmail}" <${safeClientEmail}>`
                            : process.env.SMTP_MASTER_EMAIL || 'admin@visualdesigne.com');

                    await transporter.sendMail({
                        from: personalizedSender,  // Remetente: cliente
                        to: email,
                        subject: subject,
                        html: content,
                    });
                    results.success++;
                    console.log(`Email enviado para ${email} como ${personalizedSender}`);
                } catch (err: any) {
                    console.error(`Falha ao enviar para ${email}:`, err.message);
                    results.failed++;
                    results.errors.push(`${email}: ${err.message}`);
                }
            }));
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
