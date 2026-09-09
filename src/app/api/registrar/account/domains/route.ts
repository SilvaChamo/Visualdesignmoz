import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { requirePanelBootstrapAccess } from '@/lib/panel-api-auth';
import { readImpersonateDaUsername } from '@/lib/panel-api-context';
import { resolveEffectivePanelUserId } from '@/lib/panel-reseller-context';
import { dynadotAPI } from '@/lib/dynadot-adapter';
import { classifyRegistrarDomains } from '@/lib/registrar-domain-ownership';

/**
 * Lista de domínios para a secção "Domínios" do painel.
 *
 * Admin (sem impersonar): a conta Dynadot é partilhada. A lista é cortada
 * pelos donos no Hestia/painel (vdadmin = VisualDesign; oshercollective e
 * restantes contas = clientes), para "Meus domínios" não misturar marcas.
 *
 * Qualquer outra conta (reseller/manager/profissional/client, ou admin a
 * impersonar): via `domain_renewals`, filtrado ao próprio utilizador. CORRIGIDO
 * (15 ago 2026) — antes disto devolvia sempre 403 para quem não fosse admin, o
 * que fazia um domínio comprado SOZINHO (sem hospedagem, ex: painel Profissional
 * self-service) nunca aparecer no painel de quem o comprou — só ficava visível
 * para o admin. Ver AUDITORIA_PAINEL_PLANO_CORRECAO.md, P1-6 (gap conhecido,
 * fechado agora).
 */
export async function GET(request: Request) {
  const auth = await requirePanelBootstrapAccess();
  if ('error' in auth) return auth.error;

  const impersonating =
    auth.user.role === 'admin' ? await readImpersonateDaUsername() : null;

  if (auth.user.role === 'admin' && !impersonating) {
    const result = await dynadotAPI.listAllDomains();
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Erro ao listar domínios' },
        { status: 400 },
      );
    }

    const classified = await classifyRegistrarDomains(result.domains);
    const scope = new URL(request.url).searchParams.get('scope');
    const domains =
      scope === 'clients'
        ? classified.clients
        : scope === 'all'
          ? [...classified.mine, ...classified.clients]
          : classified.mine;

    return NextResponse.json({ success: true, domains, scope: scope === 'clients' ? 'clients' : scope === 'all' ? 'all' : 'mine' });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceKey || !supabaseUrl) {
    return NextResponse.json({ success: false, error: 'Configuração do servidor em falta' }, { status: 500 });
  }
  const admin = createAdminClient(supabaseUrl, serviceKey);
  const effectiveUserId = await resolveEffectivePanelUserId({ id: auth.user.id, role: auth.user.role });

  const { data, error } = await admin
    .from('domain_renewals')
    .select('domain_name, status, expiration_date')
    .eq('user_id', effectiveUserId);
  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 400 });
  }

  const domains = (data || []).map((row) => ({
    domain: row.domain_name,
    status: row.status,
    expireDate: row.expiration_date,
  }));

  return NextResponse.json({ success: true, domains });
}
