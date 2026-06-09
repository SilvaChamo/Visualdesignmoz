import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createAdminClient(supabaseUrl, supabaseKey);

const ALLOWED_DOMAINS = [
  'visualdesignmoz.com',
  'anap.co.mz',
  'entrecampos.co.mz',
  'aamihe.com',
];

/**
 * GET /api/get-all-contacts
 * Contactos do domínio a partir do Supabase (email_contas).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const domain = searchParams.get('domain') || 'visualdesignmoz.com';

  try {
    const contactsMap: Record<string, { email: string; source: 'supabase'; nome?: string }> = {};

    const { data: contacts, error } = await supabaseAdmin
      .from('email_contas')
      .select('email, nome, cliente_id')
      .ilike('email', `%@${domain}`)
      .eq('status', 'active');

    if (error) {
      console.error('[Contacts API] Erro Supabase:', error);
    } else if (contacts?.length) {
      for (const contact of contacts) {
        const email = contact.email?.toLowerCase();
        if (email && !shouldFilterOut(email)) {
          contactsMap[email] = {
            email,
            source: 'supabase',
            nome: contact.nome || email.split('@')[0],
          };
        }
      }
    }

    const emails = Object.keys(contactsMap).sort();

    return NextResponse.json({
      success: true,
      domain,
      emails,
      contacts: Object.values(contactsMap),
      count: emails.length,
      stats: { supabase: emails.length },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return NextResponse.json(
      { success: false, domain, emails: [], contacts: [], count: 0, error: message },
      { status: 500 },
    );
  }
}

function shouldFilterOut(email: string): boolean {
  const invalidEmails = ['geral@visualdesignmoz.com'];
  const suspiciousPatterns = ['joao', 'teste', 'exemplo', 'your-domain', 'admin@your', 'placeholder'];
  const emailDomain = email.split('@')[1];

  if (!ALLOWED_DOMAINS.includes(emailDomain)) return true;
  if (invalidEmails.some((inv) => email === inv.toLowerCase())) return true;
  if (suspiciousPatterns.some((p) => email.includes(p.toLowerCase()))) return true;
  return false;
}
