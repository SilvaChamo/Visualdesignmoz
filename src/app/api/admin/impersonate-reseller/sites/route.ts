import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-api-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { readImpersonateDaUsername } from '@/lib/panel-api-context';
import { hideDomainFromPanel } from '@/lib/panel-hidden-domains';

/**
 * Cartões de site do painel Revendedor/Profissional, com o admin dentro da
 * conta (impersonação, cookie vd_impersonate_reseller). Nunca mexe no
 * servidor — site, ficheiros, email e DNS ficam como estão:
 *  - DELETE ?domain=…            esconde o cartão do painel desta conta;
 *  - PATCH { domain, targetEmail } passa os registos do produto (domínio e
 *    hospedagem) deste site para outra conta — o mesmo que o "Mover" do admin.
 */
async function requireImpersonatedOwner() {
  const auth = await requireAdmin();
  if ('error' in auth) return { error: auth.error };
  const owner = (await readImpersonateDaUsername())?.toLowerCase();
  if (!owner) {
    return {
      error: NextResponse.json(
        { success: false, error: 'Só disponível dentro da conta (Utilizadores → Entrar).' },
        { status: 403 },
      ),
    };
  }
  return { adminId: auth.user.id, owner };
}

async function ownerHasDomain(owner: string, domain: string): Promise<boolean> {
  const { listHostingDomains } = await import('@/lib/hosting-resolver');
  const sites = await listHostingDomains({ role: 'reseller', daUsername: owner });
  return sites.some((s) => s.domain.toLowerCase() === domain);
}

export async function DELETE(req: NextRequest) {
  const ctx = await requireImpersonatedOwner();
  if ('error' in ctx) return ctx.error;

  const domain = req.nextUrl.searchParams.get('domain')?.trim().toLowerCase();
  if (!domain) return NextResponse.json({ success: false, error: 'Domínio em falta.' }, { status: 400 });
  if (!(await ownerHasDomain(ctx.owner, domain))) {
    return NextResponse.json({ success: false, error: 'Este site não pertence a esta conta.' }, { status: 404 });
  }

  const result = await hideDomainFromPanel(ctx.owner, domain, ctx.adminId);
  if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function PATCH(req: NextRequest) {
  const ctx = await requireImpersonatedOwner();
  if ('error' in ctx) return ctx.error;

  const body = (await req.json().catch(() => ({}))) as { domain?: string; targetEmail?: string };
  const domain = String(body.domain || '').trim().toLowerCase();
  const targetEmail = String(body.targetEmail || '').trim().toLowerCase();
  if (!domain || !targetEmail) {
    return NextResponse.json({ success: false, error: 'Pedido inválido.' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ success: false, error: 'Serviço indisponível.' }, { status: 503 });

  // Dono (login) da conta impersonada — os registos de produto estão em nome dele.
  const [{ data: profileRows }, { data: panelUser }] = await Promise.all([
    admin.from('profiles').select('user_id').eq('da_username', ctx.owner),
    admin.from('panel_users').select('auth_user_id').eq('username', ctx.owner).maybeSingle(),
  ]);
  const ownerIds = [
    ...new Set([
      ...((profileRows || []).map((r) => r.user_id as string | null)),
      panelUser?.auth_user_id as string | null | undefined,
    ].filter((v): v is string => Boolean(v))),
  ];
  if (!ownerIds.length) {
    return NextResponse.json({ success: false, error: 'Esta conta não tem nenhum login associado.' }, { status: 404 });
  }

  let targetUserId: string | null = null;
  for (let page = 1; page <= 20 && !targetUserId; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) break;
    targetUserId = data.users.find((u) => (u.email || '').toLowerCase() === targetEmail)?.id ?? null;
    if (data.users.length < 1000) break;
  }
  if (!targetUserId) {
    return NextResponse.json({ success: false, error: `Não existe nenhuma conta com o email ${targetEmail}.` }, { status: 404 });
  }

  const [domainMove, hostingMove] = await Promise.all([
    admin.from('domain_renewals').update({ user_id: targetUserId }).eq('domain_name', domain).in('user_id', ownerIds).select('id'),
    admin.from('hosting_renewals').update({ user_id: targetUserId }).eq('domain_name', domain).in('user_id', ownerIds).select('id'),
  ]);
  const error = domainMove.error || hostingMove.error;
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  const movedCount = (domainMove.data?.length ?? 0) + (hostingMove.data?.length ?? 0);
  if (!movedCount) {
    return NextResponse.json(
      { success: false, error: 'Este site não tem registos de produto (domínio/hospedagem) nesta conta para mover.' },
      { status: 404 },
    );
  }

  await admin.from('notifications').insert([
    ...ownerIds.map((id) => ({
      user_id: id,
      title: 'Produto movido de conta',
      message: `${domain} deixou de estar associado a esta conta.`,
      type: 'info',
      category: 'system',
    })),
    {
      user_id: targetUserId,
      title: 'Produto associado à sua conta',
      message: `${domain} passou a estar associado à sua conta.`,
      type: 'success',
      category: 'system',
    },
  ]);

  return NextResponse.json({ success: true, moved: movedCount });
}
