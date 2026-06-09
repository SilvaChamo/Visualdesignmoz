import { sendBrevoTransactionalEmail, isBrevoApiConfigured } from '@/lib/brevo-mail';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import {
  getDefaultFrom,
  isBrevoSmtpConfigured,
  isBrevoTransactionalConfigured,
  isDirectAdminSmtpHost,
  isSmtpConfigured,
  sendTransactionalSmtpMail,
} from '@/lib/smtp-mail';

function useSiteSmtpForPasswordReset(): boolean {
  const forced = process.env.PASSWORD_RESET_USE_SITE_SMTP?.trim().toLowerCase();
  if (forced === 'false') return false;
  // Envio pelo site via Brevo (generateLink + API/SMTP). GoTrue/Exim local não entrega para Gmail.
  return isBrevoTransactionalConfigured() || forced === 'true';
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

function passwordRecoveryRequestedAt(): string {
  return new Date().toLocaleString('pt-PT', { timeZone: 'Africa/Maputo' });
}

/** Layout premium 600px — preto/vermelho VisualDesign (restaurado do template original). */
export function generatePasswordRecoveryEmailHtml(actionLink: string): string {
  const logoUrl = `${siteUrl()}/assets/logotipoII.png`;
  const requestedAt = passwordRecoveryRequestedAt();
  const year = new Date().getFullYear();

  return `
<div style="font-family:'Inter',Arial,sans-serif;background-color:#f3f4f6;padding:24px 12px;">
  <div style="background-color:#000;color:#fff;padding:40px 40px 30px;border-radius:16px;max-width:600px;margin:0 auto;border:1px solid #333;">
    <div style="text-align:center;margin-bottom:15px;">
      <img src="${logoUrl}" alt="VisualDesign" style="height:90px;" />
    </div>
    <h1 style="color:#fff;font-size:24px;font-weight:800;text-align:center;text-transform:uppercase;letter-spacing:2px;margin:0 0 18px 0;">
      Recuperação de Acesso
    </h1>
    <p style="color:#ccc;font-size:16px;line-height:1.5;text-align:center;margin:0 0 25px 0;">
      Recebemos um pedido para redefinir a password da sua conta. Se não fez este pedido, pode ignorar este email com segurança.
    </p>
    <div style="text-align:center;margin-bottom:25px;">
      <a href="${actionLink}" style="background-color:#cc0000;color:#fff;padding:16px 32px;border-radius:8px;font-weight:700;text-decoration:none;display:inline-block;text-transform:uppercase;letter-spacing:1px;box-shadow:0 4px 15px rgba(204,0,0,0.3);">
        Redefinir Password
      </a>
    </div>
    <h3 style="color:#fff;font-size:14px;font-weight:700;text-transform:uppercase;letter-spacing:1px;text-align:center;margin:0 0 8px 0;">Detalhes de Segurança</h3>
    <p style="color:#888;font-size:13px;text-align:center;margin:0 0 30px 0;font-style:italic;">Hora do Pedido: ${requestedAt}</p>
    <div style="color:#666;font-size:12px;text-align:center;border-top:1px solid #333;padding-top:20px;">
      <p style="margin:0 0 10px 0;">Este link expira em 60 minutos por razões de segurança.</p>
      <p style="margin:0;">VisualDesign &copy; ${year}. Todos os direitos reservados.</p>
    </div>
    <div style="height:3px;background:linear-gradient(90deg,#7f0000,#cc0000,#7f0000);margin-top:20px;border-radius:2px;"></div>
  </div>
</div>`.trim();
}

function generatePasswordRecoveryEmailText(actionLink: string): string {
  return [
    'Recuperação de Acesso — VisualDesign',
    '',
    'Recebemos um pedido para redefinir a password da sua conta.',
    'Se não fez este pedido, ignore este email.',
    '',
    actionLink,
    '',
    `Hora do pedido: ${passwordRecoveryRequestedAt()}`,
    'Este link expira em 60 minutos.',
  ].join('\n');
}

function resetEmailErrorMessage(error: { message?: string; status?: number }): string {
  const raw = String(error.message || '').trim();
  if (error.status === 504) {
    return 'O servidor de email não respondeu a tempo. Verifique o Brevo na Vercel.';
  }
  if (/error sending recovery email/i.test(raw)) {
    return 'O Supabase não conseguiu enviar o email de recuperação. Verifique SMTP no servidor (Exim/porta 25).';
  }
  if (/invalid login|authentication failed|535/i.test(raw)) {
    return 'Chave SMTP Brevo inválida ou expirada. Gere uma nova em Brevo → SMTP e API e actualize SMTP_MASTER_PASSWORD na Vercel.';
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

async function sendRecoveryEmailViaBrevo(email: string, actionLink: string): Promise<void> {
  // Recuperação de senha tem de sair via Brevo — Exim no Hetzner bloqueia porta 25 (Gmail nunca recebe).
  if (!isBrevoTransactionalConfigured()) {
    if (isSmtpConfigured() && isDirectAdminSmtpHost()) {
      throw new Error(
        'SMTP aponta para o servidor DirectAdmin, que não entrega para Gmail. Configure BREVO_API_KEY ou SMTP_MASTER_PASSWORD (chave xsmtpsib) na Vercel.',
      );
    }
    throw new Error(
      'Brevo não configurado. Defina BREVO_API_KEY (xkeysib) ou SMTP_MASTER_PASSWORD (xsmtpsib) na Vercel.',
    );
  }

  const from = getDefaultFrom();
  const subject = 'Recuperação de Password - VisualDesign';
  const payload = {
    from,
    to: email,
    subject,
    text: generatePasswordRecoveryEmailText(actionLink),
    html: generatePasswordRecoveryEmailHtml(actionLink),
  };

  if (isBrevoApiConfigured()) {
    await sendBrevoTransactionalEmail(payload);
    return;
  }

  await sendTransactionalSmtpMail(payload);
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

  await sendRecoveryEmailViaBrevo(email, buildRecoveryConfirmLink(hashedToken));
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
