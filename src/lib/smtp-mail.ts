import nodemailer from 'nodemailer';
import type Mail from 'nodemailer/lib/mailer';

export function getSmtpHost(): string {
  return (
    process.env.SMTP_HOST?.trim() ||
    process.env.DA_SMTP_HOST?.trim() ||
    'smtp-relay.brevo.com'
  );
}

export function getSmtpPort(): number {
  const raw = process.env.SMTP_PORT || process.env.DA_SMTP_PORT || '587';
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 587;
}

export function getSmtpUser(): string {
  return (
    process.env.SMTP_USER?.trim() ||
    process.env.DA_SMTP_USER?.trim() ||
    ''
  );
}

export function getSmtpPass(): string {
  return (
    process.env.SMTP_PASS?.trim() ||
    process.env.DA_SMTP_PASS?.trim() ||
    process.env.SMTP_MASTER_PASSWORD?.trim() ||
    ''
  );
}

import { VD_EMAIL } from '@/lib/email-accounts';

/** Remetente por defeito — automáticos (noreply). */
export function getDefaultFrom(): string {
  return (
    process.env.SITE_EMAIL_FROM?.trim() ||
    `Visualdesign <${VD_EMAIL.noreply}>`
  );
}

/** Destino — avisos gerais à equipa. */
export function getNotifyEmail(): string {
  return process.env.SITE_NOTIFY_EMAIL?.trim() || VD_EMAIL.geral;
}

/** Destino — tickets de suporte. */
export function getSupportEmail(): string {
  return process.env.SITE_SUPPORT_EMAIL?.trim() || VD_EMAIL.suporte;
}

/** Email principal do servidor (identidade técnica). */
export function getServerEmail(): string {
  return process.env.SERVER_EMAIL?.trim() || VD_EMAIL.servidor;
}

/** Remetente por defeito — mail marketing (empresa, não pessoal). */
export function getMarketingFromEmail(): string {
  return (
    process.env.SMTP_MARKETING_FROM?.trim() ||
    process.env.SITE_NOTIFY_EMAIL?.trim() ||
    VD_EMAIL.geral
  );
}

export function parseFromEmail(from: string): string {
  const trimmed = from.trim();
  const match = trimmed.match(/<([^>]+)>/);
  return (match?.[1] || trimmed).trim();
}

export function isSmtpConfigured(): boolean {
  return Boolean(getSmtpHost() && getSmtpUser() && getSmtpPass());
}

export function createSmtpTransport(): Mail {
  const port = getSmtpPort();
  const secure =
    process.env.SMTP_SECURE === 'true' ||
    process.env.SMTP_SECURE === '1' ||
    port === 465;

  return nodemailer.createTransport({
    host: getSmtpHost(),
    port,
    secure,
    requireTLS: !secure && port === 587,
    auth: {
      user: getSmtpUser(),
      pass: getSmtpPass(),
    },
    connectionTimeout: 15_000,
    greetingTimeout: 12_000,
    socketTimeout: 20_000,
  });
}

export type SendSmtpMailInput = {
  from: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: Mail.Attachment[];
};

export async function sendSmtpMail(input: SendSmtpMailInput) {
  if (!isSmtpConfigured()) {
    throw new Error(
      'SMTP não configurado. Defina SMTP_HOST, SMTP_USER e SMTP_PASS (Brevo) na Vercel.',
    );
  }

  const transport = createSmtpTransport();
  return transport.sendMail(input);
}
