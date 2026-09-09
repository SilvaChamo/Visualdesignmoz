import { NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { requirePanelBootstrapAccess } from '@/lib/panel-api-auth';
import { readImpersonateDaUsername } from '@/lib/panel-api-context';
import { resolveEffectivePanelUserId } from '@/lib/panel-reseller-context';
import { dynadotAPI } from '@/lib/dynadot-adapter';

/**
 * Lista de domínios para a secção "Domínios" do painel.
 *
 * Admin (sem impersonar): vê a conta Dynadot inteira (conta única partilhada
 * por toda a empresa, sem coluna de posse por domínio aí) — útil para
 * vigilância geral.
 *
 * Qualquer outra conta (reseller/manager/profissional/client, ou admin a
 * impersonar): via `domain_renewals`, filtrado ao próprio utilizador. CORRIGIDO
 * (15 ago 2026) — antes disto devolvia sempre 403 para quem não fosse admin, o
 * que fazia um domínio comprado SOZINHO (sem hospedagem, ex: painel Profissional
 * self-service) nunca aparecer no painel de quem o comprou — só ficava visível
 * para o admin. Ver AUDITORIA_PAINEL_PLANO_CORRECAO.md, P1-6 (gap conhecido,
 * fechado agora).
 */
export async function GET() {
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

    // Domínios de teste criados por sessões anteriores a testar o adaptador Dynadot
    // (ex: "claude-adapter-test-1785931940279.com") ficam presos na conta partilhada:
    // a Dynadot só permite apagar via grace_delete dentro do período de carência,
    // que já expirou para estes (confirmado via API a 2026-08-11, código 409 "grace
    // period has expired"). Filtrar aqui é o único ponto único que cobre tanto
    // "Meus domínios" como "Domínios registados", sem esconder domínios reais.
    const isTestArtifact = (domain: string) => /^claude-[a-z0-9-]+-\d{10,}\.[a-z.]+$/i.test(domain);
    const domains = result.domains.filter((d) => !isTestArtifact(d.domain));

    return NextResponse.json({ success: true, domains });
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
