import { sendEmail } from '@/lib/email-service';
import { emailHeader, emailGreeting, emailFooter, wrapContentInFrame } from '@/lib/renewal-templates';
import { VISUALDESIGN_DEFAULT_NS } from '@/lib/visualdesign-dns';
import { getServerHost } from '@/lib/server-config';
import { isHestiaOnlyDeploy } from '@/lib/hosting-provider';

const SUPPORT_EMAIL = 'suporte@visualdesignmoz.com';
const SUPPORT_PHONE = '+258 85 242 5525';
const COMPANY_NAME = 'VisualDesign';
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://visualdesignmoz.com';
const NOREPLY_EMAIL = 'noreply@visualdesignmoz.com';

/**
 * Avisa o cliente (email) que a sua conta de hospedagem foi activada. A
 * password indicada é a MESMA do login no painel VisualDesign — a conta
 * DirectAdmin foi criada com essa password de propósito, para que dentro do
 * painel o botão "Direct Admin" entre sem pedir password (SSO) e, se for
 * preciso aceder directamente ao DirectAdmin, a mesma password funcione lá.
 */
export async function notifyHostingAccountProvisioned(params: {
  to: string;
  clientName: string;
  domain: string;
  daUsername: string;
  password: string;
}) {
  const { to, clientName, domain, daUsername, password } = params;
  const title = 'A sua hospedagem foi activada';

  const hestiaOnly = isHestiaOnlyDeploy();
  const message = hestiaOnly
    ? `A sua conta de hospedagem para o domínio "${domain}" já está activa.\n\n` +
      `Entre no painel VisualDesign para gerir o site, o DNS e o webmail.\n\n` +
      `Utilizador: ${daUsername}\n` +
      `Password: ${password} (a mesma que usa para entrar no seu painel VisualDesign)\n` +
      `IP do servidor: ${getServerHost()}\n\n` +
      `O domínio já fica apontado automaticamente (Cloudflare). A propagação pode demorar algumas horas. Qualquer dúvida, contacte-nos.`
    : `A sua conta de hospedagem para o domínio "${domain}" já está activa.\n\n` +
      `Aceda ao seu painel VisualDesign e clique em "Direct Admin" — entra directamente, sem pedir password outra vez.\n\n` +
      `Se precisar de aceder directamente ao DirectAdmin (fora do painel):\n` +
      `Utilizador: ${daUsername}\n` +
      `Password: ${password} (a mesma que usa para entrar no seu painel VisualDesign)\n` +
      `IP do servidor: ${getServerHost()}\n\n` +
      `Para o seu domínio apontar para esta hospedagem, configure os nameservers no registo do domínio:\n` +
      `${VISUALDESIGN_DEFAULT_NS.ns1}\n${VISUALDESIGN_DEFAULT_NS.ns2}\n\n` +
      `A propagação pode demorar algumas horas. Qualquer dúvida, contacte-nos.`;

  const body = `
    <h2 style="margin: 0 0 12px 0; color: #111827; font-size: 18px;">${title}</h2>
    <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.6; white-space: pre-line;">${message}</p>
    <p style="margin: 20px 0 0 0;"><a href="${SITE_URL}/dashboard" style="display: inline-block; padding: 10px 20px; background: #dc2626; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px;">Aceder ao painel</a></p>
  `;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Exo 2', sans-serif; background: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    ${emailHeader(COMPANY_NAME)}
    <tr>
      <td align="center" style="padding: 24px 12px; background: #f3f4f6;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background: #ffffff; border: 1px solid #e5e7eb;">
          <tr><td>${emailGreeting(clientName)}</td></tr>
          <tr><td style="padding: 20px 24px;">${wrapContentInFrame(body, 'low')}</td></tr>
          <tr><td>${emailFooter(SUPPORT_EMAIL, SUPPORT_PHONE, COMPANY_NAME)}</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();

  try {
    await sendEmail({
      to,
      subject: title,
      html,
      from: NOREPLY_EMAIL,
      category: 'transactional',
    });
  } catch (err) {
    console.error('[notify-hosting-client] falha ao enviar email de hospedagem activada:', err);
  }
}
