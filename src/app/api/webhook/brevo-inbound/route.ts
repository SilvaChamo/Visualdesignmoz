import { NextRequest, NextResponse } from 'next/server';
import { injectInboundEmail } from '@/lib/bind-email-dns';
import { BREVO_INBOUND_WEBHOOK_PATH } from '@/lib/email-dns-defaults';

type BrevoInboundPayload = Record<string, unknown>;

function pickString(...vals: unknown[]): string {
  for (const v of vals) {
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

type Mailbox = { Address?: string; Name?: string; Email?: string };

function mailboxEmail(box: unknown): string {
  if (!box || typeof box !== 'object') return '';
  const m = box as Mailbox;
  return pickString(m.Address, m.Email);
}

function formatFrom(box: unknown): string {
  if (!box || typeof box !== 'object') return '';
  const m = box as Mailbox;
  const addr = mailboxEmail(m);
  if (!addr) return '';
  return m.Name?.trim() ? `${m.Name} <${addr}>` : addr;
}

function extractOne(item: BrevoInboundPayload) {
  const from =
    formatFrom(item.From) ||
    pickString(item.From, item.from) ||
    pickString((item.sender as { email?: string })?.email) ||
    '<>';

  let to = '';
  const toArr = item.To;
  if (Array.isArray(toArr) && toArr[0]) {
    to = mailboxEmail(toArr[0]);
  }
  if (!to) {
    to =
      pickString(item.To, item.to) ||
      pickString((item.Recipients as string[])?.[0]) ||
      '';
  }

  const subject = pickString(item.Subject, item.subject) || '(sem assunto)';
  const body =
    pickString(item.RawTextBody, item.TextContent, item.text, item.body) ||
    pickString(item.ExtractedMarkdownMessage) ||
    pickString(item.RawHtmlBody, item.HtmlContent, item.html) ||
    '';

  return { from, to, subject, body };
}

function extractAll(payload: BrevoInboundPayload) {
  const items = payload.items;
  if (Array.isArray(items) && items.length > 0) {
    return items
      .filter((i): i is BrevoInboundPayload => !!i && typeof i === 'object')
      .map((i) => extractOne(i))
      .filter((m) => m.to.includes('@'));
  }
  const single = extractOne(payload);
  return single.to.includes('@') ? [single] : [];
}

/**
 * Brevo inbound → injeta na caixa DirectAdmin (IMAP/Outlook).
 * Configurar no Brevo: Webhooks → inbound → inboundEmailProcessed
 * URL: https://visualdesignmoz.com/api/webhook/brevo-inbound
 */
export async function POST(req: NextRequest) {
  const secret = process.env.BREVO_INBOUND_WEBHOOK_SECRET?.trim();
  if (secret) {
    const header =
      req.headers.get('x-brevo-signature') ||
      req.headers.get('authorization') ||
      '';
    if (header !== secret && header !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  let payload: BrevoInboundPayload;
  try {
    payload = (await req.json()) as BrevoInboundPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const messages = extractAll(payload);
  if (messages.length === 0) {
    return NextResponse.json({ error: 'Destinatário em falta' }, { status: 400 });
  }

  const results: Array<{ to: string; ok: boolean; detail?: string }> = [];
  for (const msg of messages) {
    const injected = await injectInboundEmail(msg);
    results.push({
      to: msg.to,
      ok: injected.ok,
      detail: injected.ok ? undefined : injected.output,
    });
    if (!injected.ok) {
      console.error('[brevo-inbound] inject failed', msg.to, injected.output);
    }
  }

  const allOk = results.every((r) => r.ok);
  return NextResponse.json(
    { received: true, injected: allOk, results },
    { status: allOk ? 200 : 502 },
  );
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    path: BREVO_INBOUND_WEBHOOK_PATH,
    hint: 'POST inboundEmailProcessed from Brevo',
  });
}
