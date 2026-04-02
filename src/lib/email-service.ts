import nodemailer from 'nodemailer';
import { resend } from './resend';

export interface EmailOptions {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
    from?: string;
}

const smtpConfig = {
    host: process.env.SMTP_HOST || '109.199.104.22',
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: process.env.SMTP_SECURE === 'true' || true,
    auth: {
        user: process.env.SMTP_MASTER_EMAIL || 'admin@visualdesigne.com',
        pass: process.env.SMTP_MASTER_PASSWORD || 'EmailAdmin#2425',
    },
};

export const sendEmail = async (options: EmailOptions) => {
    // Try SMTP first (as requested by the user's preference for SMTP in previous successes)
    try {
        const transporter = nodemailer.createTransport(smtpConfig);
        
        const mailOptions = {
            from: options.from || smtpConfig.auth.user,
            to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
            subject: options.subject,
            html: options.html,
            text: options.text,
        };

        const info = await transporter.sendMail(mailOptions);
        console.log('Email sent via SMTP:', info.messageId);
        return { success: true, method: 'smtp', messageId: info.messageId };
    } catch (error: any) {
        console.error('SMTP failed, trying Resend...', error.message);
        
        // Fallback to Resend
        try {
            const resendResult = await resend.emails.send({
                from: options.from || 'onboarding@resend.dev', // Default Resend from
                to: options.to,
                subject: options.subject,
                html: options.html,
                text: options.text,
            });
            
            console.log('Email sent via Resend:', resendResult);
            return { success: true, method: 'resend', data: resendResult };
        } catch (resendError: any) {
            console.error('All email methods failed:', resendError.message);
            throw new Error(`Failed to send email: ${resendError.message}`);
        }
    }
};

export default sendEmail;
