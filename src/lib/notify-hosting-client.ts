import { sendEmail } from '@/lib/email-service';
import { buildEmailDocument, escapeHtml } from '@/lib/renewal-templates';
import { VISUALDESIGN_DEFAULT_NS } from '@/lib/visualdesign-dns';
import { getServerHost } from '@/lib/server-config';
import { isHestiaOnlyDeploy } from '@/lib/hosting-provider';

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
      `O domínio já fica apontado automaticamente. A propagação pode demorar algumas horas. Qualquer dúvida, contacte-nos.`
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
    <p style="margin: 0; color: #4b5563; font-size: 14px; line-height: 1.5; white-space: pre-line; font-family: 'Exo 2', sans-serif;">${escapeHtml(message)}</p>
    <p style="margin: 20px 0 0 0;"><a href="${SITE_URL}/vhost:2026" style="display: inline-block; padding: 8px 14px; background: #dc2626; color: #ffffff; text-decoration: none; border-radius: 2px; font-size: 12px; font-weight: bold; font-family: 'Exo 2', sans-serif;">Aceder ao painel &rarr;</a></p>
  `;

  const html = buildEmailDocument({ companyName: COMPANY_NAME, clientName, title, bodyHtml: body });

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
