import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { getServerHost, getHestiaUrl } from '@/lib/server-config'

export async function POST(req: NextRequest) {
    try {
        const { userEmail, clientName, domain } = await req.json();

        if (!userEmail || !clientName) {
            return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
        }

        // Configuração SMTP master (credenciais Gmail do usuário)
        const smtpUser = 'Visualdesign.moz@gmail.com';
        const smtpPass = 'buuf daoy jdkl skvr';
        const smtpHost = 'smtp.gmail.com';
        const smtpPort = 587;

        const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: false,  // Porta 587 = STARTTLS, não SSL
            auth: {
                user: smtpUser,
                pass: smtpPass
            },
            tls: { rejectUnauthorized: false }
        });

        // Verificar conexão
        await transporter.verify();

        // Email de configuração automática
        const configEmail = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #374151;">
    <div style="background: #dc2626; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">VisualDesign</h1>
        <p style="margin: 5px 0 0; opacity: 0.9;">Configuração de Email Automática</p>
    </div>
    
    <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
        <h2 style="color: #111827; margin-top: 0;">Bem-vindo(a), ${clientName}!</h2>
        
        <p style="color: #4b5563; line-height: 1.6;">
            Seu email <strong>${userEmail}</strong> foi configurado com sucesso! 
            Abaixo estão os dados para configurar em seu cliente de email preferido.
        </p>

        <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
            <h3 style="color: #111827; margin-top: 0; font-size: 16px;">CONFIGURAÇÃO SMTP</h3>
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #6b7280; width: 120px;">Servidor:</td>
                    <td style="padding: 8px 0; font-family: monospace; color: #111827;">${smtpHost}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #6b7280;">Porta:</td>
                    <td style="padding: 8px 0; font-family: monospace; color: #111827;">${smtpPort}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #6b7280;">SSL:</td>
                    <td style="padding: 8px 0; color: #111827;">Ativo (SSL/TLS)</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #6b7280;">Usuário:</td>
                    <td style="padding: 8px 0; font-family: monospace; color: #111827;">${userEmail}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #6b7280;">Senha:</td>
                    <td style="padding: 8px 0; font-family: monospace; color: #111827;">[Sua senha do email]</td>
                </tr>
            </table>
        </div>

        <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
            <h3 style="color: #111827; margin-top: 0; font-size: 16px;">CONFIGURAÇÃO IMAP (Recebimento)</h3>
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #6b7280; width: 120px;">Servidor:</td>
                    <td style="padding: 8px 0; font-family: monospace; color: #111827;">${smtpHost}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #6b7280;">Porta:</td>
                    <td style="padding: 8px 0; font-family: monospace; color: #111827;">993</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: bold; color: #6b7280;">SSL:</td>
                    <td style="padding: 8px 0; color: #111827;">Ativo (SSL/TLS)</td>
                </tr>
            </table>
        </div>

        <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <h3 style="color: #92400e; margin-top: 0; font-size: 16px;">ACESSO WEBMAIL</h3>
            <p style="margin: 10px 0; color: #92400e;">
                <strong>URL:</strong> <a href="${getHestiaUrl()}/snappymail/" style="color: #dc2626;">${getHestiaUrl()}/snappymail/</a><br>
                <strong>Email:</strong> ${userEmail}<br>
                <strong>Senha:</strong> [Sua senha do email]
            </p>
        </div>

        <div style="margin: 30px 0;">
            <h3 style="color: #111827; font-size: 16px;">Configuração Rápida:</h3>
            <ol style="color: #4b5563; line-height: 1.8;">
                <li>Abra seu cliente de email (Outlook, Thunderbird, etc.)</li>
                <li>Adicione nova conta de email</li>
                <li>Use os dados SMTP/IMAP acima</li>
                <li>Marque "Requer autenticação" para SMTP</li>
                <li>Use "SSL/TLS" para conexão segura</li>
            </ol>
        </div>

        <div style="text-align: center; margin: 30px 0;">
            <a href="${getHestiaUrl()}/snappymail/" 
               style="background: #dc2626; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                Acessar Webmail Agora
            </a>
        </div>

        <div style="border-top: 1px solid #e5e7eb; padding-top: 20px; margin-top: 30px;">
            <p style="color: #6b7280; font-size: 14px; margin: 0;">
                Esta mensagem foi enviada automaticamente pelo sistema VisualDesign.<br>
                Se precisar de ajuda, responda a este email ou contate nosso suporte.
            </p>
        </div>
    </div>
</div>
        `;

        // Enviar email de configuração
        await transporter.sendMail({
            from: `"VisualDesign Suporte" <${smtpUser}>`,
            to: userEmail,
            subject: `Configuração de Email - ${clientName}`,
            html: configEmail
        });

        return NextResponse.json({ 
            success: true, 
            message: 'Email de configuração enviado com sucesso'
        });

    } catch (error: any) {
        console.error('Erro ao enviar configuração automática:', error);
        return NextResponse.json({ 
            error: 'Erro ao enviar email: ' + error.message 
        }, { status: 500 });
    }
}
