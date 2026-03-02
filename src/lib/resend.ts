import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;

if (!resendApiKey && process.env.NODE_ENV === 'production') {
    console.warn('RESEND_API_KEY is not defined in the environment variables');
}

export const resend = new Resend(resendApiKey || 're_placeholder');

export default resend;
