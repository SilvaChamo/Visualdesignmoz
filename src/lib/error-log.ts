/**
 * Rastreamento de erros "caseiro" — sem serviço externo (Sentry, etc.).
 * Escreve uma notificação para o admin ver no painel sempre que algo falha
 * de forma inesperada no servidor. Reaproveitado por instrumentation.ts
 * (rede de segurança global) e disponível para qualquer rota chamar
 * directamente em pontos críticos.
 */
import { createClient } from '@supabase/supabase-js';
import { sendEmail } from '@/lib/email-service';
import { buildEmailDocument, escapeHtml } from '@/lib/renewal-templates';

// Caixa de sistema dedicada — antes ia para o email pessoal do admin
// (silva.chamo@gmail.com), o que misturava alertas de servidor com correio
// normal e passava despercebido.
const TEAM_EMAIL = 'servidor@visualdesignmoz.com';
const COMPANY_NAME = 'VisualDesign';

function buildErrorEmailHtml(context: string, message: string) {
  const body = `
    <p style="margin: 0 0 8px 0; color: #4b5563; font-size: 14px; line-height: 1.5; font-family: 'Exo 2', sans-serif;"><strong>Onde:</strong> ${escapeHtml(context)}</p>
    <pre style="margin: 0; white-space: pre-wrap; word-break: break-word; background: #f3f4f6; border: 1px solid #e5e7eb; border-radius: 2px; padding: 10px 14px; font-size: 12px; color: #4b5563;">${escapeHtml(message)}</pre>
  `;
  return buildEmailDocument({ companyName: COMPANY_NAME, clientName: 'Admin', title: 'Erro inesperado no servidor', bodyHtml: body });
}

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// Evita inundar a tabela notifications quando um erro entra em ciclo (ex.:
// uncaughtException repetido antes do pm2 conseguir reiniciar) — no máximo
// uma notificação por contexto a cada minuto. Em memória de propósito: o
// pior cenário de perder isto num restart é, no máximo, um log a mais.
const recentContexts = new Map<string, number>();
const DEDUP_WINDOW_MS = 60_000;

function shouldSkip(context: string): boolean {
  const now = Date.now();
  const last = recentContexts.get(context);
  if (last && now - last < DEDUP_WINDOW_MS) return true;
  recentContexts.set(context, now);
  if (recentContexts.size > 500) recentContexts.clear();
  return false;
}

export async function logServerError(context: string, error: unknown): Promise<void> {
  console.error(`[error-log] ${context}:`, error);

  if (shouldSkip(context)) return;

  try {
    const admin = adminClient();
    if (!admin) return;

    // #28: user_id em notifications aponta para auth.users (FK) -- profiles.id
    // é a chave própria da linha de profiles, não o login real. Usar profiles.id
    // aqui violava sempre a foreign key e a escrita falhava em silêncio (o
    // insert nunca lança excepção sozinho, só devolve `error` por ignorar).
    const { data: adminProfile } = await admin
      .from('profiles')
      .select('user_id')
      .eq('role', 'admin')
      .limit(1)
      .maybeSingle();
    if (!adminProfile?.user_id) return;

    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    const fullMessage = stack ? `${message}\n\n${stack.slice(0, 1500)}` : message;

    const { error: insertError } = await admin.from('notifications').insert({
      user_id: adminProfile.user_id,
      title: `Erro: ${context}`,
      message: fullMessage,
      type: 'error',
      category: 'system',
    });
    if (insertError) console.error('[error-log] falha ao gravar notificação:', insertError);

    // Uma notificação por si só facilmente passa despercebida — um erro
    // deste tipo é raro o suficiente para merecer sempre um email.
    await sendEmail({
      to: TEAM_EMAIL,
      subject: `Erro: ${context}`,
      html: buildErrorEmailHtml(context, fullMessage),
      category: 'transactional',
    }).catch((emailErr) => console.error('[error-log] falha ao enviar email de erro:', emailErr));
  } catch {
    /* um alerta falhado nunca deve propagar */
  }
}
