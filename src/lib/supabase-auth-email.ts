import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getDefaultFrom, isSmtpConfigured, sendSmtpMail } from '@/lib/smtp-mail';

function useSiteSmtpForPasswordReset(): boolean {
  const forced = process.env.PASSWORD_RESET_USE_SITE_SMTP?.trim().toLowerCase();
  if (forced === 'true') return true;
  if (forced === 'false') return false;
  return isSmtpConfigured();
}

function siteUrl(): string {
  const fromEnv =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');
  // Nunca usar VERCEL_URL — gera links visualdesigne-*.vercel.app no email.
  return 'https://visualdesignmoz.com';
}

function recoveryRedirectTo(): string {
  return `${siteUrl()}/auth/confirm?next=/auth/reset-password`;
}

/** Link directo para /auth/confirm — evita redirect_to errado do Supabase (ex.: visualdesigne.com). */
function buildRecoveryConfirmLink(hashedToken: string): string {
  const url = new URL(recoveryRedirectTo());
  url.searchParams.set('token_hash', hashedToken);
  url.searchParams.set('type', 'recovery');
  return url.toString();
}

function resetEmailErrorMessage(error: { message?: string; status?: number }): string {
  const raw = String(error.message || '').trim();
  if (error.status === 504) {
    return 'O servidor de email não respondeu a tempo. Verifique o Brevo na Vercel.';
  }
  if (/error sending recovery email/i.test(raw)) {
    return 'O Supabase não conseguiu enviar o email. Active PASSWORD_RESET_USE_SITE_SMTP=true e Brevo na Vercel.';
  }
  const rateLimit = raw.match(/only request this after (\d+) seconds/i);
  if (rateLimit) {
    return `Aguarde ${rateLimit[1]} segundos e tente novamente.`;
  }
  if (!raw || raw === '{}') {
    return 'Não foi possível enviar o email de recuperação. Verifique Brevo e redeploy na Vercel.';
  }
  return raw;
}

async function sendRecoveryEmailViaSmtp(email: string, actionLink: string): Promise<void> {
  if (!isSmtpConfigured()) {
    throw new Error(
      'SMTP Brevo não configurado (SMTP_HOST, SMTP_USER, SMTP_PASS na Vercel).',
    );
  }

  const from = getDefaultFrom();
  const subject = 'Repor senha — Visualdesign';
  const text = [
    'Recebeu este email porque foi pedida a reposição da senha da sua conta Visualdesign.',
    '',
    actionLink,
    '',
    'Se não fez este pedido, ignore este email.',
  ].join('\n');

  await sendSmtpMail({
    from,
    to: email,
    subject,
    text,
    html: `<p>Recebeu este email porque foi pedida a reposição da senha da sua conta <strong>Visualdesign</strong>.</p>
<p><a href="${actionLink}">Repor senha</a></p>
<p>Se o botão não funcionar, copie este endereço:<br /><a href="${actionLink}">${actionLink}</a></p>
<p>Se não fez este pedido, ignore este email.</p>`,
  });
}

async function sendViaGoTrue(email: string, redirectTo: string): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error('Supabase não configurado.');

  const { error } = await admin.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) throw new Error(resetEmailErrorMessage(error));
}

async function sendViaSiteSmtp(email: string, redirectTo: string): Promise<void> {
  const admin = getSupabaseAdmin();
  if (!admin) throw new Error('Supabase não configurado.');

  const { data, error } = await admin.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo },
  });

  if (error) throw new Error(resetEmailErrorMessage(error));

  const hashedToken = data?.properties?.hashed_token?.trim();
  if (!hashedToken) {
    throw new Error('Não foi possível gerar o link. Confirme que a conta existe.');
  }

  await sendRecoveryEmailViaSmtp(email, buildRecoveryConfirmLink(hashedToken));
}

export async function requestPasswordResetEmail(email: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) throw new Error('Indique o email.');

  const redirectTo = recoveryRedirectTo();

  if (useSiteSmtpForPasswordReset()) {
    await sendViaSiteSmtp(normalized, redirectTo);
    return;
  }

  await sendViaGoTrue(normalized, redirectTo);
}

export function formatPasswordResetClientError(err: unknown): string {
  if (err instanceof Error && err.message && err.message !== '{}') {
    return err.message;
  }
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const msg = String((err as { message?: unknown }).message || '').trim();
    if (msg && msg !== '{}') return msg;
  }
  return 'Não foi possível enviar o email de recuperação. Tente mais tarde.';
}
