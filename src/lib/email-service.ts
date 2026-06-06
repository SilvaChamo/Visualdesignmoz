import {
  getDefaultFrom,
  getMarketingFromEmail,
  parseFromEmail,
  sendSmtpMail,
} from '@/lib/smtp-mail';

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  category?: 'transactional' | 'marketing';
}

/**
 * Envio centralizado via Brevo SMTP (relay).
 * O From (@visualdesignmoz.com) tem de estar verificado no Brevo.
 */
export const sendEmail = async (options: EmailOptions) => {
  const from =
    options.from ||
    (options.category === 'marketing'
      ? getMarketingFromEmail()
      : getDefaultFrom());

  const fromHeader = from.includes('<')
    ? from
    : `Visualdesign <${from}>`;

  const info = await sendSmtpMail({
    from: fromHeader,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
    replyTo: options.replyTo,
  });

  console.log(`Email sent via Brevo (${parseFromEmail(fromHeader)}):`, info.messageId);
  return {
    success: true,
    method: 'brevo-smtp',
    messageId: info.messageId,
    from: parseFromEmail(fromHeader),
  };
};

export default sendEmail;
