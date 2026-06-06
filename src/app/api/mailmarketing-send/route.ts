import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';
import { createClient } from '@supabase/supabase-js';
import {
  getDomainReputation,
} from '@/lib/warmup-service';
import {
  createSmtpTransport,
  getMarketingFromEmail,
  getSmtpHost,
  getSmtpPort,
  getSmtpUser,
} from '@/lib/smtp-mail';

// SMTP via Brevo (relay). Credenciais: SMTP_* ou DA_SMTP_* no .env / Vercel.
const MAIL_BATCH_SIZE = Math.max(10, parseInt(process.env.MAILMARKETING_BATCH_SIZE || '50'));
const MAIL_BATCH_PAUSE_MS = Math.max(0, parseInt(process.env.MAILMARKETING_BATCH_PAUSE_MS || '500'));
const MAIL_MAX_RETRIES = Math.max(1, parseInt(process.env.MAILMARKETING_MAX_RETRIES || '3'));
const PROCESS_CAMPAIGNS_LIMIT = Math.max(1, parseInt(process.env.MAILMARKETING_PROCESS_LIMIT || '10'));
const MAIL_QUEUE_SECRET = process.env.MAILMARKETING_QUEUE_SECRET || '';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

type QueuePayload = {
  recipients: string[];
  domain: string;
  senderName: string;
  senderEmail: string;
  batchSize: number;
  retryCount: number;
  lastError?: string;
};

function extractEmail(input: string): string {
  const trimmed = (input || '').trim();
  const match = trimmed.match(/<([^>]+)>/);
  if (match?.[1]) return match[1].trim().toLowerCase();
  return trimmed.toLowerCase();
}

function sanitizeRecipientList(to: unknown): string[] {
  if (!Array.isArray(to)) return [];
  const emails = to
    .map((email) => String(email || '').trim().toLowerCase())
    .filter((email) => email.includes('@') && email.includes('.'));
  return [...new Set(emails)];
}

function normalizeQueuePayload(raw: unknown): QueuePayload {
  const base: QueuePayload = {
    recipients: [],
    domain: '',
    senderName: 'VisualDesigne Marketing',
    senderEmail: getMarketingFromEmail(),
    batchSize: MAIL_BATCH_SIZE,
    retryCount: 0,
  };

  if (!raw || typeof raw !== 'object') return base;

  const obj = raw as Record<string, unknown>;
  if (Array.isArray(raw)) {
    return { ...base, recipients: sanitizeRecipientList(raw) };
  }

  const recipients = sanitizeRecipientList(obj.recipients);
  return {
    ...base,
    recipients,
    domain: String(obj.domain || ''),
    senderName: String(obj.senderName || base.senderName),
    senderEmail: extractEmail(String(obj.senderEmail || base.senderEmail)),
    batchSize: Math.max(10, Number(obj.batchSize) || MAIL_BATCH_SIZE),
    retryCount: Math.max(0, Number(obj.retryCount) || 0),
    lastError: obj.lastError ? String(obj.lastError) : undefined,
  };
}

function createMailTransport() {
  return createSmtpTransport();
}

async function sendSingleBatchViaDirectAdminSMTP(
  to: string[],
  subject: string,
  content: string,
  fromEmail: string,
  fromName: string = 'VisualDesigne'
): Promise<{ success: boolean; sent: number; failed: number; errors: string[] }> {
  const transport = createMailTransport();
  await transport.verify();
  try {
    const cleanFromEmail = extractEmail(fromEmail || getMarketingFromEmail());
    const unsubscribeDomain = cleanFromEmail.includes('@') ? cleanFromEmail.split('@')[1] : 'localhost.localdomain';
    await transport.sendMail({
      from: `"${fromName}" <${cleanFromEmail}>`,
      bcc: to,
      subject,
      html: content,
      headers: {
        'X-Mailer': 'VisualDesigne Marketing System',
        'List-Unsubscribe': `<mailto:unsubscribe@${unsubscribeDomain}>`,
      },
    });
    return { success: true, sent: to.length, failed: 0, errors: [] };
  } catch (err: any) {
    return { success: false, sent: 0, failed: to.length, errors: [err?.message || 'SMTP batch failed'] };
  } finally {
    transport.close();
  }
}

async function queueCampaign(params: {
  subject: string;
  content: string;
  recipients: string[];
  domain: string;
  senderEmail: string;
  senderName: string;
}) {
  const queuePayload: QueuePayload = {
    recipients: params.recipients,
    domain: params.domain,
    senderEmail: extractEmail(params.senderEmail),
    senderName: params.senderName || 'VisualDesigne Marketing',
    batchSize: MAIL_BATCH_SIZE,
    retryCount: 0,
  };

  const { data, error } = await supabaseAdmin
    .from('email_campaigns')
    .insert({
      subject: params.subject,
      content_html: params.content,
      status: 'queued',
      sender_email: queuePayload.senderEmail,
      target_audiences: queuePayload,
      total_recipients: params.recipients.length,
      successful_sends: 0,
      failed_sends: 0,
      created_at: new Date().toISOString(),
    })
    .select('id, status, total_recipients')
    .single();

  if (error) throw error;
  return data as { id: string; status: string; total_recipients: number };
}

async function processQueuedCampaigns() {
  const { data: campaigns, error } = await supabaseAdmin
    .from('email_campaigns')
    .select('id, subject, content_html, status, sender_email, target_audiences, successful_sends, failed_sends, total_recipients')
    .in('status', ['queued', 'processing', 'retry_pending'])
    .order('created_at', { ascending: true })
    .limit(PROCESS_CAMPAIGNS_LIMIT);

  if (error) throw error;

  const processed: Array<{ id: string; sent: number; failed: number; status: string }> = [];
  let sentTotal = 0;
  let failedTotal = 0;

  for (const campaign of campaigns || []) {
    const queue = normalizeQueuePayload(campaign.target_audiences);
    const totalRecipients = Number(campaign.total_recipients || queue.recipients.length || 0);
    const successfulSends = Number(campaign.successful_sends || 0);
    const failedSends = Number(campaign.failed_sends || 0);
    const cursor = successfulSends + failedSends;
    const pending = queue.recipients.slice(cursor);

    if (pending.length === 0) {
      const finalStatus = failedSends > 0 ? 'partial_failed' : 'sent';
      await supabaseAdmin
        .from('email_campaigns')
        .update({
          status: finalStatus,
          sent_at: new Date().toISOString(),
          total_recipients: totalRecipients,
        })
        .eq('id', campaign.id);
      processed.push({ id: campaign.id, sent: successfulSends, failed: failedSends, status: finalStatus });
      continue;
    }

    await supabaseAdmin.from('email_campaigns').update({ status: 'processing' }).eq('id', campaign.id);
    const batchSize = queue.batchSize || MAIL_BATCH_SIZE;
    const batch = pending.slice(0, batchSize);
    const result = await sendSingleBatchViaDirectAdminSMTP(
      batch,
      String(campaign.subject || ''),
      String(campaign.content_html || ''),
      queue.senderEmail || String(campaign.sender_email || getMarketingFromEmail()),
      queue.senderName || 'VisualDesigne Marketing'
    );

    const nextSuccess = successfulSends + result.sent;
    const nextFailed = failedSends + result.failed;
    sentTotal += result.sent;
    failedTotal += result.failed;

    const allProcessed = nextSuccess + nextFailed >= totalRecipients;
    const nextRetryCount = result.success ? 0 : (queue.retryCount || 0) + 1;
    let nextStatus: string;

    if (allProcessed) {
      nextStatus = nextFailed > 0 ? 'partial_failed' : 'sent';
    } else if (!result.success && nextRetryCount >= MAIL_MAX_RETRIES) {
      nextStatus = 'failed';
    } else if (!result.success) {
      nextStatus = 'retry_pending';
    } else {
      nextStatus = 'processing';
    }

    const updatedQueue: QueuePayload = {
      ...queue,
      retryCount: nextRetryCount,
      lastError: result.errors[0],
    };

    await supabaseAdmin
      .from('email_campaigns')
      .update({
        status: nextStatus,
        successful_sends: nextSuccess,
        failed_sends: nextFailed,
        target_audiences: updatedQueue,
        sent_at: allProcessed ? new Date().toISOString() : null,
      })
      .eq('id', campaign.id);

    processed.push({ id: campaign.id, sent: nextSuccess, failed: nextFailed, status: nextStatus });

    if (MAIL_BATCH_PAUSE_MS > 0) {
      await new Promise((resolve) => setTimeout(resolve, MAIL_BATCH_PAUSE_MS));
    }
  }

  return { processed, sentTotal, failedTotal };
}

export async function POST(req: NextRequest) {
  console.log('🚀 [mailmarketing-send] Requisição recebida');
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return auth.error;

  try {
    const body = await req.json();
    const { to, subject, content, sender, senderName, clientEmail, domain } = body;
    const recipients = sanitizeRecipientList(to);

    if (recipients.length === 0) {
      return NextResponse.json({ error: 'Lista de destinatários vazia' }, { status: 400 });
    }

    if (!subject || !content) {
      return NextResponse.json({ error: 'Assunto e conteúdo são obrigatórios' }, { status: 400 });
    }

    // Determinar o email e domínio de envio
    const clientDomain = domain || (clientEmail ? clientEmail.split('@')[1] : null);
    if (!clientDomain) {
      return NextResponse.json({
        error: 'Domínio não especificado. Envie o parâmetro "domain" ou "clientEmail".',
      }, { status: 400 });
    }

    const fromEmail = extractEmail(String(sender || getMarketingFromEmail() || `marketing@${clientDomain}`));
    const fromName = senderName || 'VisualDesigne Marketing';

    console.log(`🚀 Campanha enfileirada para envio assíncrono:`, {
      host: getSmtpHost(),
      port: getSmtpPort(),
      from: fromEmail,
      recipients: recipients.length,
    });

    const campaign = await queueCampaign({
      subject: String(subject),
      content: String(content),
      recipients,
      domain: String(clientDomain),
      senderEmail: fromEmail,
      senderName: String(fromName),
    });

    return NextResponse.json({
      success: true,
      queued: true,
      campaignId: campaign.id,
      message: `Campanha enfileirada para ${recipients.length} destinatários. O envio será processado por lotes.`,
      details: {
        success: recipients.length,
        failed: 0,
        queued: recipients.length,
      },
    });

  } catch (error: any) {
    console.error('❌ [mailmarketing-send] Erro geral:', error?.message);

    // Erro de autenticação SMTP - credenciais em falta
    if (error.code === 'EAUTH' || error.responseCode === 535) {
      return NextResponse.json({
        error: 'Erro de autenticação SMTP. Configure SMTP_USER e SMTP_PASS (Brevo) na Vercel.',
        code: 'SMTP_AUTH_ERROR',
      }, { status: 500 });
    }

    // Erro de ligação - servidor inacessível
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
      return NextResponse.json({
        error: `Não foi possível ligar ao servidor SMTP (${getSmtpHost()}:${getSmtpPort()}).`,
        code: 'SMTP_CONNECTION_ERROR',
      }, { status: 500 });
    }

    return NextResponse.json({
      error: error?.message || 'Erro interno no servidor',
      code: 'INTERNAL_ERROR',
    }, { status: 500 });
  }
}

/**
 * GET - Obter status da ligação SMTP e reputação do domínio
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const domain = searchParams.get('domain');
    if (action === 'process-queue') {
      const secret = searchParams.get('secret');
      const auth = await requireAdminOrReseller();
      const authorizedBySecret = !!MAIL_QUEUE_SECRET && secret === MAIL_QUEUE_SECRET;
      if ('error' in auth && !authorizedBySecret) return auth.error;

      const result = await processQueuedCampaigns();
      return NextResponse.json({
        success: true,
        mode: 'queue-processor',
        processed: result.processed.length,
        sent: result.sentTotal,
        failed: result.failedTotal,
        campaigns: result.processed,
      });
    }

    const auth = await requireAdminOrReseller();
    if ('error' in auth) return auth.error;

    // Testar ligação SMTP
    let smtpStatus = 'unknown';
    let smtpError = '';
    try {
      const transport = createSmtpTransport();
      await transport.verify();
      transport.close();
      smtpStatus = 'connected';
    } catch (err: any) {
      smtpStatus = 'error';
      smtpError = err.message;
    }

    const response: any = {
      success: true,
      smtp: {
        host: getSmtpHost(),
        port: getSmtpPort(),
        user: getSmtpUser() ? `${getSmtpUser().substring(0, 3)}***` : '(não configurado)',
        status: smtpStatus,
        error: smtpError || undefined,
      },
    };

    if (domain) {
      const reputation = await getDomainReputation(domain);
      response.domain = domain;
      response.reputation = reputation;
    }

    return NextResponse.json(response);

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
