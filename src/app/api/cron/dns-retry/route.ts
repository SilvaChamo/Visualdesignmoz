import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { autoProvisionPurchasedDomain } from '@/lib/domain-purchase-provision';
import { alertAdminOfTrackingFailure } from '@/lib/checkout-fulfillment';

// Domínios cujo dns_status ficou 'pending' há menos tempo do que isto não são
// tocados — evita competir com o próprio auto-provisionamento do checkout,
// que ainda pode estar a correr em background para essa mesma compra.
const MIN_PENDING_AGE_MS = 15 * 60 * 1000; // 15 minutos

/**
 * Cron: reprocessa domínios comprados cujo DNS (zona Cloudflare +
 * nameservers na Dynadot) ficou por concluir — dns_status='pending' em
 * domain_renewals. Antes disto, a única forma de recuperar era um admin
 * reparar na notificação de falha e carregar manualmente em "Reprocessar
 * Configuração DNS" (ver /api/admin/domains/reprovision). Reaproveita
 * exactamente a mesma automação (autoProvisionPurchasedDomain).
 *
 * Header obrigatório: Authorization: Bearer ${CRON_SECRET}
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization');

  if (!secret) {
    return NextResponse.json(
      { error: 'CRON_SECRET não configurado — retry de DNS desactivado por segurança.' },
      { status: 503 },
    );
  }
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'A sua sessão expirou. Entre novamente para realizar esta acção.' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Supabase Service Role não configurado.' }, { status: 500 });
  }
  const admin = createAdminClient(supabaseUrl, serviceKey);

  const results = {
    checked: 0,
    fixed: 0,
    stillPending: 0,
    errors: [] as string[],
  };

  try {
    const cutoff = new Date(Date.now() - MIN_PENDING_AGE_MS).toISOString();
    const { data: pending, error } = await admin
      .from('domain_renewals')
      .select('user_id, domain_name, updated_at')
      .eq('dns_status', 'pending')
      .lt('updated_at', cutoff);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    results.checked = pending?.length || 0;

    for (const row of pending || []) {
      const domainName = row.domain_name as string;
      try {
        const [{ data: authUser }, { data: profile }] = await Promise.all([
          admin.auth.admin.getUserById(row.user_id),
          admin.from('profiles').select('*').eq('user_id', row.user_id).maybeSingle(),
        ]);

        const result = await autoProvisionPurchasedDomain({
          domain: domainName,
          profile: profile ?? null,
          userEmail: authUser?.user?.email || '',
          displayName: (authUser?.user?.user_metadata?.nome as string) || undefined,
        });

        const zonaStep = result.steps.find((s) => s.step === 'zona-cloudflare');
        const nsStep = result.steps.find((s) => s.step === 'nameservers');
        const dnsOk = Boolean(zonaStep?.ok) && Boolean(nsStep?.ok);

        await admin
          .from('domain_renewals')
          .update({
            dns_status: dnsOk ? 'ok' : 'pending',
            notes: dnsOk ? null : `DNS por configurar: ${result.steps.filter((s) => !s.ok).map((s) => `${s.step}: ${s.error}`).join(' | ')}`,
          })
          .eq('user_id', row.user_id)
          .eq('domain_name', domainName);

        if (dnsOk) {
          results.fixed += 1;
          await admin.from('notifications').insert({
            user_id: row.user_id,
            title: 'Domínio configurado',
            message: `O domínio ${domainName} ficou totalmente configurado.`,
            type: 'success',
            category: 'system',
          });
        } else {
          results.stillPending += 1;
          const failed = result.steps.filter((s) => !s.ok).map((s) => `${s.step}: ${s.error}`).join(' | ');
          results.errors.push(`${domainName}: ${failed}`);
          // Repetido para o mesmo domínio em cada corrida do cron até resolver
          // — é sinal de que precisa de intervenção manual (ex: quota da
          // Cloudflare, domínio suspenso na Dynadot), por isso avisa sempre.
          await alertAdminOfTrackingFailure('cron dns-retry', `${domainName}: ${failed}`);
        }
      } catch (itemError: unknown) {
        results.stillPending += 1;
        const message = itemError instanceof Error ? itemError.message : 'Erro desconhecido';
        results.errors.push(`${domainName}: ${message}`);
        await alertAdminOfTrackingFailure('cron dns-retry', `${domainName}: ${message}`);
      }
    }

    return NextResponse.json({ success: true, timestamp: new Date().toISOString(), ...results });
  } catch (error: unknown) {
    console.error('[cron/dns-retry] GET:', error);
    const message = error instanceof Error ? error.message : 'Erro interno';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
