import 'server-only';

import { buildEmailConfigBundle } from '@/lib/email-client-config-export';
import { sendEmail } from '@/lib/email-service';

/** Envia configurações IMAP/SMTP em texto simples para a conta criada (apenas servidor). */
export async function sendPlainEmailConfigToMailbox(
  email: string,
  password: string,
  quotaMb?: number,
) {
  const bundle = buildEmailConfigBundle(email, password, quotaMb);
  await sendEmail({
    to: email,
    subject: `Configurações de e-mail — ${email}`,
    html: bundle.plainText.replace(/\n/g, '<br>'),
    text: bundle.plainText,
    category: 'transactional',
  });
  return bundle;
}
