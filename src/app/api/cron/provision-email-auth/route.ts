import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient } from '@/utils/supabase/server';
import { provisionEmailAuthForDomain } from '@/lib/domain-email-auth';

const CRON_SECRET = process.env.CRON_SECRET;
const ADMIN_EMAILS = ['admin@visualdesignmoz.com', 'silva.chamo@gmail.com', 'geral@visualdesignmoz.com', 'suporte@visualdesignmoz.com'];

/** Comparação em tempo constante — evita side-channel por diferença de
 * tempo de resposta a revelar o segredo carácter a carácter. */
function secretMatches(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Aplica/actualiza só a autenticação de email (MX/SPF/DMARC/A de
 * mail-ftp-pop-smtp + DKIM via Brevo) de um domínio — NUNCA mexe no A da
 * raiz/www (o site continua exactamente como está, com ou sem proxy
 * Cloudflare ligado). Feito para testar email a sério num domínio que já
 * está hospedado neste servidor, sem arriscar o DNS do site em si.
 * Idempotente — seguro correr outra vez.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const authHeader = request.headers.get('authorization') || '';
  const providedSecret = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isAdmin = Boolean(user && ADMIN_EMAILS.includes(user.email || ''));
  const secretOk = Boolean(CRON_SECRET) && secretMatches(providedSecret, CRON_SECRET!);
  if (!isAdmin && !secretOk) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const domain = (searchParams.get('domain') || '').trim().toLowerCase();
  if (!domain) {
    return NextResponse.json({ success: false, error: 'domain é obrigatório.' }, { status: 400 });
  }

  const result = await provisionEmailAuthForDomain(domain);
  return NextResponse.json({ success: true, domain, result });
}
