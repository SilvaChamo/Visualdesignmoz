import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { triggerBrevoDomainVerification } from '@/lib/brevo-domain-auth';

// A Brevo pode demorar horas (até 48h, segundo a própria documentação) a
// confirmar a propagação do DNS de um domínio novo. A tentativa feita na
// hora da compra (3 tentativas em ~21 segundos, ver
// provisionEmailAuthForDomain) quase nunca chega a tempo — antes deste cron,
// isso obrigava sempre a alguém ir ao site da Brevo carregar em "Autenticar"
// manualmente, mesmo quando os registos DNS já estavam todos correctos.
const MIN_PENDING_AGE_MS = 10 * 60 * 1000; // 10 minutos

/**
 * Cron: reprocessa domínios cujo DNS já está confirmado (dns_status='ok')
 * mas cuja autenticação na Brevo ainda não foi confirmada
 * (brevo_verified=false). Não repete os registos DNS (já lá estão) — só
 * pede à Brevo para voltar a verificar.
 *
 * Header obrigatório: Authorization: Bearer ${CRON_SECRET}
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');

  if (!secret) {
    return NextResponse.json(
      { error: 'CRON_SECRET não configurado — retry de Brevo desactivado por segurança.' },
      { status: 503 },
    );
  }
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase Service Role não configurado.' }, { status: 500 });
  }
  const admin = createAdminClient(supabaseUrl, serviceKey);

  const results = {
    checked: 0,
    verified: 0,
    stillPending: 0,
    errors: [] as string[],
  };

  try {
    const cutoff = new Date(Date.now() - MIN_PENDING_AGE_MS).toISOString();
    const { data: pending, error } = await admin
      .from('domain_renewals')
      .select('user_id, domain_name, updated_at')
      .eq('dns_status', 'ok')
      .eq('brevo_verified', false)
      .lt('updated_at', cutoff);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    results.checked = pending?.length || 0;

    for (const row of pending || []) {
      const domainName = row.domain_name as string;
      try {
        const attempt = await triggerBrevoDomainVerification(domainName);
        if (attempt.ok) {
          results.verified += 1;
          await admin
            .from('domain_renewals')
            .update({ brevo_verified: true })
            .eq('user_id', row.user_id)
            .eq('domain_name', domainName);
          await admin.from('notifications').insert({
            user_id: row.user_id,
            title: 'Email do domínio autenticado',
            message: `O envio de email para ${domainName} ficou autenticado na Brevo (DKIM/SPF confirmados).`,
            type: 'success',
            category: 'system',
          });
        } else {
          // Normal enquanto o DNS ainda não propagou de facto — a Brevo diz
          // isto por completo até 48h depois dos registos criados. Não avisa
          // o admin a cada tentativa (só seria ruído); o cron volta a tentar
          // sozinho na próxima corrida.
          results.stillPending += 1;
        }
      } catch (itemError: unknown) {
        results.stillPending += 1;
        const message = itemError instanceof Error ? itemError.message : 'Erro desconhecido';
        results.errors.push(`${domainName}: ${message}`);
      }
    }

    return NextResponse.json({ success: true, timestamp: new Date().toISOString(), ...results });
  } catch (error: unknown) {
    console.error('[cron/brevo-retry] GET:', error);
    const message = error instanceof Error ? error.message : 'Erro interno';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
