import nodemailer from 'nodemailer';
import { resend } from './resend';
import { detectDomainConfig } from './email-autoconfig';

export interface EmailOptions {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
    from?: string;
    password?: string;
    category?: 'transactional' | 'marketing';
}

/**
 * Serviço centralizado de envio de e-mail com detecção automática de domínio.
 */
export const sendEmail = async (options: EmailOptions) => {
    const from = options.from || process.env.SMTP_MASTER_EMAIL || 'admin@visualdesigne.com';
    const config = detectDomainConfig(from);
    
    // Configuração de autenticação
    const authUser = options.from || process.env.SMTP_MASTER_EMAIL || 'admin@visualdesigne.com';
    const authPass = options.password || process.env.SMTP_MASTER_PASSWORD || 'EmailAdmin#2425';

    try {
        // 1. Tentar via SMTP Dinâmico
        const transporter = nodemailer.createTransport({
            host: config.smtp,
            port: config.ports.smtp,
            secure: config.ports.smtp === 465,
            auth: {
                user: authUser,
                pass: authPass,
            },
            tls: { rejectUnauthorized: false },
            connectionTimeout: 10000,
            socketTimeout: 15000,
        });
        
        const mailOptions = {
            from: from,
            to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
            subject: options.subject,
            html: options.html,
            text: options.text,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`Email sent via SMTP (${config.smtp}):`, info.messageId);
        return { success: true, method: 'smtp', messageId: info.messageId, host: config.smtp };

    } catch (error: any) {
        console.warn(`SMTP (${config.smtp}) failed for ${from}:`, error.message);
        
        // 2. Fallback para Resend se configurado e for domínio autorizado ou transacional
        const isResendAvailable = process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 're_placeholder';
        if (isResendAvailable) {
            try {
                console.log('Attempting Resend fallback...');
                const resendResult = await resend.emails.send({
                    from: from.endsWith('@visualdesigne.com') ? from : 'noreply@visualdesigne.com',
                    to: options.to,
                    subject: options.subject,
                    html: options.html,
                    text: options.text,
                });
                
                return { success: true, method: 'resend', data: resendResult };
            } catch (resendError: any) {
                console.error('All email methods failed:', resendError.message);
                throw new Error(`Failed to send email: ${resendError.message}`);
            }
        }
        
        throw error;
    }
};

export default sendEmail;
