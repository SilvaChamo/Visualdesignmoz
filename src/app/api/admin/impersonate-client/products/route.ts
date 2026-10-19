import { NextRequest, NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/admin-api-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { resolveEffectiveClientUser } from '@/lib/client-impersonation';

/**
 * Limpeza do painel de um cliente (ex.: dois cartões do mesmo plano de email,
 * um mensal e um anual): apaga só o REGISTO do produto — o cartão deixa de
 * aparecer. Nada é apagado no servidor (site, domínio de email, caixas, DNS
 * ficam como estão). Só existe para o admin dentro da conta do cliente
 * (impersonação) — o próprio cliente nunca vê nem chama isto.
 *
 * DELETE ?kind=domain|hosting&id=…  (planos de email são kind=hosting)
 */
export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  const effective = await resolveEffectiveClientUser();
  if (!effective?.impersonating) {
    return NextResponse.json(
      { success: false, error: 'Só disponível dentro da conta do cliente (Utilizadores → Entrar).' },
      { status: 403 },
    );
  }

  const kind = req.nextUrl.searchParams.get('kind');
  const id = req.nextUrl.searchParams.get('id')?.trim();
  if ((kind !== 'domain' && kind !== 'hosting') || !id) {
    return NextResponse.json({ success: false, error: 'Pedido inválido.' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ success: false, error: 'Serviço indisponível.' }, { status: 503 });

  const clientId = effective.user.id;
  const table = kind === 'domain' ? 'domain_renewals' : 'hosting_renewals';
  const { data: deleted, error } = await admin
    .from(table)
    .delete()
    .eq('id', id)
    .eq('user_id', clientId)
    .select('id');
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  // Hospedagem antiga ainda registada em site_clientes (ver fetchUserProductsSummary).
  if (!deleted?.length && kind === 'hosting') {
    const { data: legacy, error: legacyError } = await admin
      .from('site_clientes')
      .delete()
      .eq('id', id)
      .eq('cliente_id', clientId)
      .select('id');
    if (legacyError) return NextResponse.json({ success: false, error: legacyError.message }, { status: 500 });
    if (legacy?.length) return NextResponse.json({ success: true });
  }

  if (!deleted?.length) {
    return NextResponse.json({ success: false, error: 'Registo não encontrado nesta conta.' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}

async function findAuthUserIdByEmail(admin: SupabaseClient, email: string): Promise<string | null> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return null;
    const hit = data.users.find((u) => (u.email || '').toLowerCase() === email);
    if (hit) return hit.id;
    if (data.users.length < 1000) return null;
  }
  return null;
}

/**
 * Mover um produto (o cartão) para outra conta — o mesmo que o "Mover" da
 * lista de domínios do admin (/api/admin/domains/transfer-owner): muda só o
 * dono do REGISTO no painel e avisa as duas contas; não mexe no servidor
 * (site, domínio de email, caixas, DNS continuam onde estavam).
 *
 * PATCH { kind: 'domain'|'hosting', id, targetEmail }
 */
export async function PATCH(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  const effective = await resolveEffectiveClientUser();
  if (!effective?.impersonating) {
    return NextResponse.json(
      { success: false, error: 'Só disponível dentro da conta do cliente (Utilizadores → Entrar).' },
      { status: 403 },
    );
  }

  const body = (await req.json().catch(() => ({}))) as { kind?: string; id?: string; targetEmail?: string };
  const kind = body.kind;
  const id = String(body.id || '').trim();
  const targetEmail = String(body.targetEmail || '').trim().toLowerCase();
  if ((kind !== 'domain' && kind !== 'hosting') || !id || !targetEmail) {
    return NextResponse.json({ success: false, error: 'Pedido inválido.' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ success: false, error: 'Serviço indisponível.' }, { status: 503 });

  const targetUserId = await findAuthUserIdByEmail(admin, targetEmail);
  if (!targetUserId) {
    return NextResponse.json({ success: false, error: `Não existe nenhuma conta com o email ${targetEmail}.` }, { status: 404 });
  }

  const clientId = effective.user.id;
  if (targetUserId === clientId) {
    return NextResponse.json({ success: false, error: 'O produto já pertence a esta conta.' }, { status: 400 });
  }

  const table = kind === 'domain' ? 'domain_renewals' : 'hosting_renewals';
  const { data: moved, error } = await admin
    .from(table)
    .update({ user_id: targetUserId })
    .eq('id', id)
    .eq('user_id', clientId)
    .select(kind === 'domain' ? 'domain_name' : 'domain_name, package_name');
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });

  let label = (moved?.[0] as { domain_name?: string; package_name?: string } | undefined);
  if (!moved?.length && kind === 'hosting') {
    const { data: legacy, error: legacyError } = await admin
      .from('site_clientes')
      .update({ cliente_id: targetUserId })
      .eq('id', id)
      .eq('cliente_id', clientId)
      .select('dominio, plano');
    if (legacyError) return NextResponse.json({ success: false, error: legacyError.message }, { status: 500 });
    if (legacy?.length) label = { domain_name: legacy[0].dominio, package_name: legacy[0].plano };
  }
  if (!label) {
    return NextResponse.json({ success: false, error: 'Registo não encontrado nesta conta.' }, { status: 404 });
  }

  const what = [label.package_name, label.domain_name].filter(Boolean).join(' — ') || 'Um produto';
  await admin.from('notifications').insert([
    {
      user_id: clientId,
      title: 'Produto movido de conta',
      message: `${what} deixou de estar associado a esta conta.`,
      type: 'info',
      category: 'system',
    },
    {
      user_id: targetUserId,
      title: 'Produto associado à sua conta',
      message: `${what} passou a estar associado à sua conta.`,
      type: 'success',
      category: 'system',
    },
  ]);

  return NextResponse.json({ success: true });
}
