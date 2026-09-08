import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/admin-api-auth';
import { autoProvisionPurchasedDomain } from '@/lib/domain-purchase-provision';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/**
 * #9: nova tentativa manual de configuração de um domínio já registado mas
 * com a zona Cloudflare/nameservers por concluir (dns_status='pending') —
 * reaproveita exactamente a mesma automação do checkout, chamada outra vez.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  try {
    const { domain } = (await req.json()) as { domain?: string };
    const domainName = (domain || '').toLowerCase().trim();
    if (!domainName) {
      return NextResponse.json({ success: false, error: 'domain é obrigatório.' }, { status: 400 });
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return NextResponse.json({ success: false, error: 'Supabase Service Role não configurado.' }, { status: 500 });
    }
    const admin = createAdminClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: renewal } = await admin
      .from('domain_renewals')
      .select('user_id, domain_name')
      .eq('domain_name', domainName)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!renewal?.user_id) {
      return NextResponse.json({ success: false, error: 'Domínio não encontrado em domain_renewals.' }, { status: 404 });
    }

    const [{ data: authUser }, { data: profile }] = await Promise.all([
      admin.auth.admin.getUserById(renewal.user_id),
      admin.from('profiles').select('*').eq('user_id', renewal.user_id).maybeSingle(),
    ]);

    const result = await autoProvisionPurchasedDomain({
      domain: domainName,
      profile: profile ?? null,
      userEmail: authUser?.user?.email || '',
      displayName: (authUser?.user?.user_metadata?.nome as string) || undefined,
    });

    const registoStep = result.steps.find((s) => s.step === 'registo');
    const zonaStep = result.steps.find((s) => s.step === 'zona-cloudflare');
    const nsStep = result.steps.find((s) => s.step === 'nameservers');
    const dnsOk = Boolean(zonaStep?.ok) && Boolean(nsStep?.ok);
    // O domínio existe mesmo no registador (passo `registo` ok) — tira-o de
    // 'pending' (ex.: .app/.dev registado à mão, ou uma compra em que o
    // registo automático tinha falhado e já foi resolvido).
    const registoOk = Boolean(registoStep?.ok);

    await admin
      .from('domain_renewals')
      .update({
        ...(registoOk ? { status: 'active' } : {}),
        dns_status: dnsOk ? 'ok' : 'pending',
        notes: dnsOk ? null : `DNS por configurar: ${result.steps.filter((s) => !s.ok).map((s) => `${s.step}: ${s.error}`).join(' | ')}`,
      })
      .eq('user_id', renewal.user_id)
      .eq('domain_name', domainName);

    if (dnsOk) {
      await admin.from('notifications').insert({
        user_id: renewal.user_id,
        title: 'Domínio configurado',
        message: `O domínio ${domainName} ficou totalmente configurado.`,
        type: 'success',
        category: 'system',
      });
    }

    return NextResponse.json({ success: true, result, dnsOk });
  } catch (error: unknown) {
    console.error('[admin/domains/reprovision] POST:', error);
    const message = error instanceof Error ? error.message : 'Erro ao reconfigurar domínio';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
