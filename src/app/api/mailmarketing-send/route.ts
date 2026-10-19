import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';
import { createClient } from '@supabase/supabase-js';
import {
  getDomainReputation,
} from '@/lib/warmup-service';
import { getMarketingFromEmail } from '@/lib/smtp-mail';
import { sendBrevoBulkEmail, isBrevoApiConfigured } from '@/lib/brevo-mail';
import { cacheService } from '@/lib/cache-service';

// Envio em lote via API REST da Brevo (não SMTP) — ver comentário em
// sendBrevoBulkEmail (brevo-mail.ts) para o porquê. O SMTP_* continua só
// para o diagnóstico de ligação abaixo (GET sem action=process-queue).
const MAIL_BATCH_SIZE = Math.max(10, parseInt(process.env.MAILMARKETING_BATCH_SIZE || '50'));
const MAIL_BATCH_PAUSE_MS = Math.max(0, parseInt(process.env.MAILMARKETING_BATCH_PAUSE_MS || '500'));
const MAIL_MAX_RETRIES = Math.max(1, parseInt(process.env.MAILMARKETING_MAX_RETRIES || '3'));
const PROCESS_CAMPAIGNS_LIMIT = Math.max(1, parseInt(process.env.MAILMARKETING_PROCESS_LIMIT || '10'));
const MAIL_QUEUE_SECRET = process.env.MAILMARKETING_QUEUE_SECRET || '';
const CRON_SECRET = process.env.CRON_SECRET || '';
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

type QueuePayload = {
  recipients: string[];
  domain: string;
  senderName: string;
  senderEmail: string;
  ownerEmail?: string;
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

// Nunca usar VERCEL_URL — geraria links visualdesigne-*.vercel.app no email.
const SITE_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL || 'https://visualdesignmoz.com').replace(/\/$/, '');

// O conteúdo composto no painel pode ter imagens/links por caminho relativo
// (ex.: /assets/logo.png) — resolve bem no preview do editor porque corre no
// mesmo servidor, mas um cliente de email (Gmail, Outlook...) não tem
// "origem" nenhuma para resolver isso. Torna absoluto mesmo antes de
// despachar, sem tocar em URLs já absolutos (http(s)://, //, data:, mailto:).
function absolutizeAssetUrls(html: string): string {
  return html.replace(/((?:src|href)=["'])\/(?!\/)/g, `$1${SITE_ORIGIN}/`);
}

// O placeholder "[O seu logótipo aqui]" (EmailTemplates.tsx) existe para o
// revendedor ver, no editor do painel, que ainda não enviou o seu logo — mas
// não pode sair num email real para os clientes dele. Remove o span inteiro
// (fica só o espaço vazio no cabeçalho) em vez de bloquear o envio, para não
// travar quem simplesmente ainda não configurou o logo.
function stripLogoPlaceholder(html: string): string {
  return html.replace(/<span[^>]*>\s*\[O seu logótipo aqui\]\s*<\/span>/g, '');
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
    senderName: 'VisualDesign',
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
    ownerEmail: obj.ownerEmail ? extractEmail(String(obj.ownerEmail)) : undefined,
    batchSize: Math.max(10, Number(obj.batchSize) || MAIL_BATCH_SIZE),
    retryCount: Math.max(0, Number(obj.retryCount) || 0),
    lastError: obj.lastError ? String(obj.lastError) : undefined,
  };
}

async function sendSingleBatchViaBrevo(
  to: string[],
  subject: string,
  content: string,
  fromEmail: string,
  fromName: string = 'VisualDesign'
): Promise<{ success: boolean; sent: number; failed: number; errors: string[] }> {
  if (!isBrevoApiConfigured()) {
    return { success: false, sent: 0, failed: to.length, errors: ['BREVO_API_KEY não configurada.'] };
  }
  try {
    const cleanFromEmail = extractEmail(fromEmail || getMarketingFromEmail());
    const unsubscribeDomain = cleanFromEmail.includes('@') ? cleanFromEmail.split('@')[1] : 'localhost.localdomain';
    await sendBrevoBulkEmail({
      from: `"${fromName}" <${cleanFromEmail}>`,
      bcc: to,
      subject,
      html: absolutizeAssetUrls(stripLogoPlaceholder(content)),
      headers: {
        'X-Mailer': 'VisualDesign Marketing System',
        'List-Unsubscribe': `<mailto:unsubscribe@${unsubscribeDomain}>`,
      },
    });
    return { success: true, sent: to.length, failed: 0, errors: [] };
  } catch (err: any) {
    return { success: false, sent: 0, failed: to.length, errors: [err?.message || 'Brevo batch failed'] };
  }
}

async function queueCampaign(params: {
  subject: string;
  content: string;
  recipients: string[];
  domain: string;
  senderEmail: string;
  senderName: string;
  ownerEmail: string;
}) {
  const queuePayload: QueuePayload = {
    recipients: params.recipients,
    domain: params.domain,
    senderEmail: extractEmail(params.senderEmail),
    ownerEmail: extractEmail(params.ownerEmail || params.senderEmail),
    senderName: params.senderName || 'VisualDesign',
    batchSize: MAIL_BATCH_SIZE,
    retryCount: 0,
  };

  const { data, error } = await supabaseAdmin
    .from('email_campaigns')
    .insert({
      subject: params.subject,
      content_html: params.content,
      status: 'queued',
      sender_email: queuePayload.ownerEmail || queuePayload.senderEmail,
      target_audiences: queuePayload,
      total_recipients: params.recipients.length,
      recipient_count: params.recipients.length,
      successful_sends: 0,
      failed_sends: 0,
      created_at: new Date().toISOString(),
    })
    .select('id, status, total_recipients')
    .single();

  if (error) throw error;
  cacheService.clearPattern('mailmarketing_camp_');
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
    const result = await sendSingleBatchViaBrevo(
      batch,
      String(campaign.subject || ''),
      String(campaign.content_html || ''),
      queue.senderEmail || String(campaign.sender_email || getMarketingFromEmail()),
      queue.senderName || 'VisualDesign'
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

  if (processed.length > 0) {
    cacheService.clearPattern('mailmarketing_camp_');
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

    const { getDefaultFromForDomain } = await import('@/lib/email-domains');
    const domainFrom = getDefaultFromForDomain(String(clientDomain));
    const fromEmail = extractEmail(
      String(sender || domainFrom || getMarketingFromEmail() || `marketing@${clientDomain}`),
    );
    const fromName = senderName || (domainFrom ? 'Osher Collective' : 'VisualDesign');

    console.log(`🚀 Campanha enfileirada para envio assíncrono:`, {
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
      ownerEmail: extractEmail(auth.user.email || clientEmail || fromEmail),
    });

    void processQueuedCampaigns().catch((err: unknown) => {
      console.error('[mailmarketing-send] processamento imediato falhou:', err instanceof Error ? err.message : err);
    });

    return NextResponse.json({
      success: true,
      queued: true,
      campaignId: campaign.id,
      message: `Campanha enfileirada para ${recipients.length} destinatários. O envio corre por lotes.`,
      details: {
        success: recipients.length,
        failed: 0,
        queued: recipients.length,
      },
    });

  } catch (error: any) {
    console.error('❌ [mailmarketing-send] Erro geral:', error?.message);
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
      const authHeader = req.headers.get('authorization') || '';
      const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      const authorizedBySecret =
        (!!MAIL_QUEUE_SECRET && (secret === MAIL_QUEUE_SECRET || bearer === MAIL_QUEUE_SECRET)) ||
        (!!CRON_SECRET && (secret === CRON_SECRET || bearer === CRON_SECRET));
      if (!authorizedBySecret) {
        const auth = await requireAdminOrReseller();
        if ('error' in auth) return auth.error;
      }

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

    const response: any = {
      success: true,
      brevo: {
        status: isBrevoApiConfigured() ? 'connected' : 'error',
        error: isBrevoApiConfigured() ? undefined : 'BREVO_API_KEY não configurada.',
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
