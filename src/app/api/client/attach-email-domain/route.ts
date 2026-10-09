import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { requirePanelBootstrapAccess } from '@/lib/panel-api-auth';
import { attachDomainToEmailPlan } from '@/lib/email-plan-provision';
import { resolveEffectiveClientUser } from '@/lib/client-impersonation';

/**
 * O cliente indica, no painel, qual domínio próprio quer usar para o plano
 * de email que já comprou (sem domínio associado). Ver
 * ClientProductsHub.tsx (aviso "falta associar domínio") e
 * email-plan-provision.ts (regra de só um domínio por plano).
 */
export async function POST(request: NextRequest) {
  const auth = await requirePanelBootstrapAccess();
  if ('error' in auth) return auth.error;

  // O próprio cliente, ou um admin dentro da conta dele (impersonação).
  const effective = await resolveEffectiveClientUser();
  if (!effective || (auth.user.role !== 'client' && !effective.impersonating)) {
    return NextResponse.json({ error: 'Rota restrita a clientes.' }, { status: 403 });
  }
  const clientId = effective.user.id;
  const clientEmail = effective.user.email;

  const { domain } = await request.json();
  if (!domain || typeof domain !== 'string' || !domain.includes('.')) {
    return NextResponse.json({ error: 'Indique um domínio válido (ex.: meusite.co.mz).' }, { status: 400 });
  }

  if (!clientEmail) {
    return NextResponse.json({ error: 'Conta sem email associado.' }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Serviço indisponível.' }, { status: 500 });
  }
  const admin = createAdminClient(supabaseUrl, supabaseKey);

  const result = await attachDomainToEmailPlan(admin, clientId, domain, clientEmail);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true, domain: result.domain });
}
