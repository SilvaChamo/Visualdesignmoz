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
  return match?.[1]?.trim() || 'VisualDesign';
}

/** Envio transaccional via API REST Brevo (alternativa ao SMTP relay). */
export async function sendBrevoTransactionalEmail(
  input: BrevoTransactionalInput,
): Promise<{ messageId?: string }> {
  const apiKey = getBrevoApiKey();
  if (!apiKey) {
    throw new Error('BREVO_API_KEY não configurada na Vercel.');
  }

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'Content-Type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify({
      sender: {
        email: parseFromEmail(input.from),
        name: parseFromName(input.from),
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
