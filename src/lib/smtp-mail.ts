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

const BREVO_SMTP_HOST = 'smtp-relay.brevo.com';
const BREVO_SMTP_USER_DEFAULT = 'ad3ca6001@smtp-brevo.com';

/** Credenciais Brevo — entrega externa (Gmail, etc.). Evita Exim/Hetzner onde a porta 25 está bloqueada. */
export function getBrevoSmtpHost(): string {
  return (
    process.env.BREVO_SMTP_HOST?.trim() ||
    process.env.TRANSACTIONAL_SMTP_HOST?.trim() ||
    BREVO_SMTP_HOST
  );
}

export function getBrevoSmtpUser(): string {
  return (
    process.env.BREVO_SMTP_USER?.trim() ||
    process.env.TRANSACTIONAL_SMTP_USER?.trim() ||
    BREVO_SMTP_USER_DEFAULT
  );
}

export function getBrevoSmtpPass(): string {
  return (
    process.env.BREVO_SMTP_PASS?.trim() ||
    process.env.TRANSACTIONAL_SMTP_PASS?.trim() ||
    process.env.SMTP_MASTER_PASSWORD?.trim() ||
    ''
  );
}

export function isBrevoSmtpConfigured(): boolean {
  return Boolean(getBrevoSmtpHost() && getBrevoSmtpUser() && getBrevoSmtpPass());
}

/** Brevo API ou SMTP relay — qualquer um permite envio transaccional externo. */
export function isBrevoTransactionalConfigured(): boolean {
  const apiKey =
    process.env.BREVO_API_KEY?.trim() ||
    process.env.SENDINBLUE_API_KEY?.trim();
  return Boolean(apiKey) || isBrevoSmtpConfigured();
}

/** True quando SMTP aponta para DirectAdmin/Exim local (aceita mas não entrega para Gmail). */
export function isDirectAdminSmtpHost(host?: string): boolean {
  const h = (host || getSmtpHost()).toLowerCase();
  return (
    h.includes('visualdesignmoz.com') ||
    h.includes('host.visualdesign') ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(h)
  );
}

export function createBrevoTransport(): Mail {
  return nodemailer.createTransport({
    host: getBrevoSmtpHost(),
    port: 587,
    secure: false,
    requireTLS: true,
    auth: {
      user: getBrevoSmtpUser(),
      pass: getBrevoSmtpPass(),
    },
    connectionTimeout: 15_000,
    greetingTimeout: 12_000,
    socketTimeout: 20_000,
  });
}

/** Envio transaccional via Brevo (recuperação de senha, confirmações). */
export async function sendTransactionalSmtpMail(input: SendSmtpMailInput) {
  if (!isBrevoSmtpConfigured()) {
    throw new Error(
      'Brevo SMTP não configurado. Defina BREVO_SMTP_PASS ou SMTP_MASTER_PASSWORD na Vercel.',
    );
  }
  const transport = createBrevoTransport();
  // O socket SMTP por vezes emite um 'error' tardio (ex.: timeout durante o
  // fecho da ligação) depois de sendMail() já ter resolvido/rejeitado — sem
  // este listener, esse evento não tem quem o apanhe e derruba o processo
  // Node inteiro (uncaughtException), levando o site abaixo para todos os
  // utilizadores a meio de outros pedidos.
  transport.on('error', (err) => console.error('[smtp] erro tardio no transporte (Brevo):', err));
  return transport.sendMail(input);
}

function smtpTlsOptions(host: string) {
  const h = host.toLowerCase();
  // Exim/DirectAdmin no Hetzner: certificado pode falhar verificação CA em Vercel/Node
  if (
    h.includes('visualdesignmoz.com') ||
    h.includes('host.visualdesign') ||
    process.env.SMTP_TLS_INSECURE === 'true'
  ) {
    return { rejectUnauthorized: false, servername: h };
  }
  return undefined;
}

export function createSmtpTransport(): Mail {
  const port = getSmtpPort();
  const host = getSmtpHost();
  const secure =
    process.env.SMTP_SECURE === 'true' ||
    process.env.SMTP_SECURE === '1' ||
    port === 465;
  const tls = smtpTlsOptions(host);

  return nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS: !secure && port === 587,
    auth: {
      user: getSmtpUser(),
      pass: getSmtpPass(),
    },
    tls,
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
  // Ver comentário equivalente em sendTransactionalSmtpMail — protege contra
  // o mesmo crash do processo por erro tardio no socket SMTP.
  transport.on('error', (err) => console.error('[smtp] erro tardio no transporte:', err));
  return transport.sendMail(input);
}
