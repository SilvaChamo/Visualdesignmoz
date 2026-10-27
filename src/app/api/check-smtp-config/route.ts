import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-api-auth';
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
import { isBrevoApiConfigured } from '@/lib/brevo-mail';
import { BREVO_SENDERS_OSHER, BREVO_SENDERS_VISUALDESIGN } from '@/lib/email-accounts';
import { buildEmailSpfRecord } from '@/lib/email-dns-defaults';
import { getServerHost } from '@/lib/server-config';
import {
  getBrevoSmtpUser,
  isBrevoSmtpConfigured,
  isBrevoTransactionalConfigured,
} from '@/lib/smtp-mail';

// Mostra a configuração de envio de e-mail: só administrador.
export async function GET() {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  const configured = isSmtpConfigured();
  const brevoTransactional = isBrevoTransactionalConfigured();

  return NextResponse.json({
    configured,
    brevoTransactional,
    brevoApi: isBrevoApiConfigured(),
    brevoSmtp: isBrevoSmtpConfigured(),
    provider: 'brevo',
    config: {
      host: getSmtpHost(),
      port: getSmtpPort(),
      user: getSmtpUser() ? `${getSmtpUser().slice(0, 8)}***` : null,
      brevoSmtpUser: getBrevoSmtpUser() ? `${getBrevoSmtpUser().slice(0, 8)}***` : null,
      fromAutomatic: parseFromEmail(getDefaultFrom()),
      fromMarketing: getMarketingFromEmail(),
      notifyEmail: getNotifyEmail(),
      supportEmail: getSupportEmail(),
      serverEmail: getServerEmail(),
      brevoSendersToVerify: BREVO_SENDERS_VISUALDESIGN,
      brevoOsherAppSenders: BREVO_SENDERS_OSHER,
    },
    receive: {
      provider: 'servidor-direct',
      mx: { priority: 10, host: `mail.<dominio>. (-> ${getServerHost()})` },
      spf: buildEmailSpfRecord(getServerHost()),
      mailboxes: 'DirectAdmin / IMAP / Webmail',
    },
    marketing: {
      provider: 'brevo-smtp-relay',
      from: getMarketingFromEmail(),
      route: '/api/mailmarketing-send',
    },
    message: brevoTransactional
      ? isBrevoApiConfigured()
        ? 'Brevo API configurada (envio transaccional)'
        : 'Brevo SMTP configurado (envio transaccional)'
      : configured
        ? 'SMTP geral configurado, mas Brevo transaccional em falta'
        : 'Defina BREVO_API_KEY ou SMTP_MASTER_PASSWORD (xsmtpsib) na Vercel',
  });
}
