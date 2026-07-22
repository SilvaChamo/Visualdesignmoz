import { sendEmail } from '@/lib/email-service';
import { emailHeader, emailFooter, wrapContentInFrame } from '@/lib/renewal-templates';

const SUPPORT_EMAIL = 'suporte@visualdesignmoz.com';
const SUPPORT_PHONE = '+258 85 242 5525';
const COMPANY_NAME = 'VisualDesign';

const APPROVAL_NOTICE =
  'Brevemente irá receber layouts de design para aprovação, de forma a avançarmos com a produção. ' +
  'É importante responder a esses pedidos de aprovação o mais rápido possível — atrasos nas aprovações ' +
  'podem comprometer o prazo de entrega combinado.';

function buildClientEmailHtml(params: {
  clientName: string;
  title: string;
  message: string;
}) {
  const { clientName, title, message } = params;

  const body = `
    <h2 style="margin: 0 0 12px 0; color: #111827; font-size: 18px;">${title}</h2>
    <p style="margin: 0; color: #374151; font-size: 14px; line-height: 1.6; white-space: pre-line;">${message}</p>
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
          <tr><td>${emailHeader(clientName, COMPANY_NAME)}</td></tr>
          <tr><td style="padding: 20px;">${wrapContentInFrame(body, 'low')}</td></tr>
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
 * Avisa o cliente (email) quando a equipa aprova ou rejeita a sua encomenda
 * (quotation_requests). Isolado em try/catch — uma falha de email nunca deve
 * impedir a actualização de estado no dashboard.
 */
export async function notifyQuoteClientStatusChange(params: {
  to: string;
  clientName: string;
  produto: string;
  status: 'approved' | 'rejected';
  rejectionReason?: string | null;
}) {
  const { to, clientName, produto, status, rejectionReason } = params;

  const title =
    status === 'approved'
      ? 'A sua encomenda foi aprovada'
      : 'Actualização sobre a sua encomenda';

  const message =
    status === 'approved'
      ? `A sua encomenda "${produto}" foi aprovada e a produção vai avançar.\n\n${APPROVAL_NOTICE}`
      : `A sua encomenda "${produto}" não foi aprovada neste momento.${
          rejectionReason ? `\n\nMotivo: ${rejectionReason}` : ''
        }\n\nEntre em contacto connosco se tiver dúvidas.`;

  try {
    await sendEmail({
      to,
      subject: title,
      html: buildClientEmailHtml({ clientName, title, message }),
      category: 'transactional',
    });
  } catch (err) {
    console.error('[notify-quote-client] falha ao enviar email ao cliente:', err);
  }
}
