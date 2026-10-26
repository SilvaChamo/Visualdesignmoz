import {
  getDefaultFromForDomain,
  getDomainFromEmail,
  OSHER_DOMAIN,
} from '@/lib/email-domains';
import { parseFromEmail } from '@/lib/smtp-mail';

export function getBrevoApiKey(): string {
  return (
    process.env.BREVO_API_KEY?.trim() ||
    process.env.SENDINBLUE_API_KEY?.trim() ||
    ''
  );
}

export function isBrevoApiConfigured(): boolean {
  return Boolean(getBrevoApiKey());
}

export type BrevoTransactionalInput = {
  from: string;
  to: string;
  subject: string;
  html?: string;
  text?: string;
};

function parseFromName(from: string): string {
  const trimmed = from.trim();
  const match = trimmed.match(/^([^<]+)</);
  if (match?.[1]?.trim()) return match[1].trim();
  const email = parseFromEmail(trimmed);
  if (getDomainFromEmail(email) === OSHER_DOMAIN) return 'Osher Collective';
  return 'VisualDesign';
}

/** From por defeito para um endereço @domínio (Brevo exige remetente verificado). */
export function resolveBrevoFromForRecipient(
  to: string,
  explicitFrom?: string,
): string {
  if (explicitFrom?.trim()) return explicitFrom.trim();
  const domain = getDomainFromEmail(to);
  const domainFrom = getDefaultFromForDomain(domain);
  return domainFrom || '';
}

/** Envio transaccional via API REST Brevo (alternativa ao SMTP relay). */
export async function sendBrevoTransactionalEmail(
  input: BrevoTransactionalInput,
): Promise<{ messageId?: string }> {
  const apiKey = getBrevoApiKey();
  if (!apiKey) {
    throw new Error('BREVO_API_KEY não configurada na Vercel.');
  }

  const fromHeader =
    input.from.trim() ||
    resolveBrevoFromForRecipient(input.to) ||
    'Visualdesign <noreply@visualdesignmoz.com>';

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: {
        email: parseFromEmail(fromHeader),
        name: parseFromName(fromHeader),
      },
      to: [{ email: input.to }],
      subject: input.subject,
      htmlContent: input.html,
      textContent: input.text,
    }),
  });

  const body = (await res.json().catch(() => ({}))) as {
    message?: string;
    code?: string;
    messageId?: string;
  };

  if (!res.ok) {
    const detail = body.message || body.code || `HTTP ${res.status}`;
    throw new Error(`Brevo API: ${detail}`);
  }

  return { messageId: body.messageId };
}

export type BrevoBulkInput = {
  from: string;
  bcc: string[];
  subject: string;
  html: string;
  headers?: Record<string, string>;
};

/**
 * Envio em lote (mail marketing) via API REST da Brevo — não SMTP. Um lote
 * pequeno de campanha (ex.: 50 destinatários) é um único pedido HTTP, sem
 * ligação de socket persistente para o Node manter viva; ao contrário do
 * relay SMTP (nodemailer), um erro tardio aqui não pode derrubar o processo
 * inteiro (uncaughtException) — fica contido no fetch() e é apanhado
 * normalmente. Destinatários vão em bcc (não se veem entre si), tal como o
 * envio por SMTP fazia.
 */
export async function sendBrevoBulkEmail(
  input: BrevoBulkInput,
): Promise<{ messageId?: string }> {
  const apiKey = getBrevoApiKey();
  if (!apiKey) {
    throw new Error('BREVO_API_KEY não configurada na Vercel.');
  }
  if (input.bcc.length === 0) {
    throw new Error('Sem destinatários para este lote.');
  }

  const fromHeader = input.from.trim() || 'Visualdesign <noreply@visualdesignmoz.com>';
  const senderEmail = parseFromEmail(fromHeader);

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: { email: senderEmail, name: parseFromName(fromHeader) },
      // A Brevo exige pelo menos um "to" — usa-se o próprio remetente e os
      // destinatários reais vão todos em bcc.
      to: [{ email: senderEmail }],
      bcc: input.bcc.map((email) => ({ email })),
      subject: input.subject,
      htmlContent: input.html,
      headers: input.headers,
    }),
  });

  const body = (await res.json().catch(() => ({}))) as {
    message?: string;
    code?: string;
    messageId?: string;
  };

  if (!res.ok) {
    const detail = body.message || body.code || `HTTP ${res.status}`;
    throw new Error(`Brevo API: ${detail}`);
  }

  return { messageId: body.messageId };
}
