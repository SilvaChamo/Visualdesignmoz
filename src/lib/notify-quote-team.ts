import { createClient as createAdminClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email-service';
import { emailHeader, emailFooter, wrapContentInFrame } from '@/lib/renewal-templates';

const TEAM_EMAIL = 'geral@visualdesignmoz.com';
const SUPPORT_EMAIL = 'suporte@visualdesignmoz.com';
const SUPPORT_PHONE = '+258 85 242 5525';
const COMPANY_NAME = 'VisualDesign';

function buildTeamEmailHtml(title: string, message: string, link?: string) {
  const body = `
    <h2 style="margin: 0 0 12px 0; color: #111827; font-size: 18px;">${title}</h2>
    <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.6; white-space: pre-line;">${message}</p>
    ${link ? `<p style="margin: 20px 0 0 0;"><a href="${link}" style="display: inline-block; padding: 10px 20px; background: #dc2626; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 14px;">Ver no painel</a></p>` : ''}
  `;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Exo 2', sans-serif; background: #f3f4f6;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0">
    <tr>
      <td align="center" style="padding: 10px 0; background: #f3f4f6;">
        <table width="600" cellpadding="0" cellspacing="0" border="0" style="max-width: 600px; width: 100%; background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.15);">
          <tr><td>${emailHeader('Equipa', COMPANY_NAME)}</td></tr>
          <tr><td style="padding: 20px;">${wrapContentInFrame(body, 'medium')}</td></tr>
          <tr><td>${emailFooter(SUPPORT_EMAIL, SUPPORT_PHONE, COMPANY_NAME)}</td></tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Avisa a equipa (email + notificação interna no dashboard) sobre eventos do
 * fluxo de cotações (/precos -> /cotacao). Isolado em try/catch — uma falha
 * de email/notificação nunca deve impedir o cliente de completar o pedido.
 */
export async function notifyQuoteTeam(params: { title: string; message: string; link?: string }) {
  const { title, message, link } = params;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  try {
    if (serviceKey && supabaseUrl) {
      const admin = createAdminClient(supabaseUrl, serviceKey);
      const { data: adminProfile } = await admin
        .from('profiles')
        .select('id')
        .eq('role', 'admin')
        .limit(1)
        .maybeSingle();

      if (adminProfile?.id) {
        await admin.from('notifications').insert({
          user_id: adminProfile.id,
          title,
          message,
          type: 'info',
          category: 'general',
          link,
          link_text: link ? 'Ver no painel' : undefined,
        });
      }
    }
  } catch (err) {
    console.error('[notify-quote-team] falha ao criar notificação interna:', err);
  }

  try {
    await sendEmail({
      to: TEAM_EMAIL,
      subject: title,
      html: buildTeamEmailHtml(title, message, link),
      category: 'transactional',
    });
  } catch (err) {
    console.error('[notify-quote-team] falha ao enviar email à equipa:', err);
  }
}
