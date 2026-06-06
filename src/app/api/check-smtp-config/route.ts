import { NextResponse } from 'next/server';
import {
  getDefaultFrom,
  getMarketingFromEmail,
  getNotifyEmail,
  getServerEmail,
  getSupportEmail,
  getSmtpHost,
  getSmtpPort,
  getSmtpUser,
  isSmtpConfigured,
  parseFromEmail,
} from '@/lib/smtp-mail';
import { BREVO_SENDERS_VISUALDESIGN } from '@/lib/email-accounts';

export async function GET() {
  const configured = isSmtpConfigured();

  return NextResponse.json({
    configured,
    provider: 'brevo',
    config: {
      host: getSmtpHost(),
      port: getSmtpPort(),
      user: getSmtpUser() ? `${getSmtpUser().slice(0, 8)}***` : null,
      fromAutomatic: parseFromEmail(getDefaultFrom()),
      fromMarketing: getMarketingFromEmail(),
      notifyEmail: getNotifyEmail(),
      supportEmail: getSupportEmail(),
      serverEmail: getServerEmail(),
      brevoSendersToVerify: BREVO_SENDERS_VISUALDESIGN,
    },
    message: configured
      ? 'Brevo SMTP configurado'
      : 'Defina SMTP_HOST, SMTP_USER e SMTP_PASS (ou DA_SMTP_*) na Vercel',
  });
}
