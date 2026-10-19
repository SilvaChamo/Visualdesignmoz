import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireAdmin } from '@/lib/admin-api-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { IMPERSONATE_COOKIE } from '@/lib/panel-api-context';
import { IMPERSONATE_CLIENT_COOKIE } from '@/lib/client-impersonation';
import { resolveRoleForAuthUser } from '@/lib/server-auth-role';
import { getProfileForAuthUser } from '@/lib/profile-db';
import { resolvePanelApiRedirect } from '@/lib/panel-origin';
import { getRequestHostname } from '@/lib/request-host';

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 8,
};

/**
 * Admin entra na conta de um cliente para ver e gerir os dados dele — mesmo
 * princípio das outras impersonações (sessão do admin nunca é tocada, só uma
 * cookie diz "a ver como X"):
 *  - 'client'       → cookie vd_impersonate_client, painel /cliente
 *    (rotas do painel usam resolveEffectiveClientUser);
 *  - 'profissional' → cookie vd_impersonate_reseller com a conta de alojamento
 *    dele, painel /profissional (mesmo contexto do revendedor, ver
 *    resolvePanelDaContext).
 * Revendedores continuam a entrar por /api/admin/impersonate.
 *
 * GET ?userId=…  entra · GET ?exit=1  sai e volta ao painel admin.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const hostname = getRequestHostname(req.headers, req.url);
  const store = await cookies();

  const backToAdmin = (error?: string) => {
    const query = error ? `?section=cp-users&impersonate_error=${encodeURIComponent(error)}` : '?section=cp-users';
    return NextResponse.redirect(resolvePanelApiRedirect(`/dashboard${query}`, hostname), { status: 307 });
  };

  if (req.nextUrl.searchParams.get('exit') === '1') {
    store.delete(IMPERSONATE_CLIENT_COOKIE);
    store.delete(IMPERSONATE_COOKIE);
    return backToAdmin();
  }

  const userId = req.nextUrl.searchParams.get('userId')?.trim();
  if (!userId) return backToAdmin('Conta inválida.');

  const admin = getSupabaseAdmin();
  if (!admin) return backToAdmin('Serviço indisponível.');
  const { data } = await admin.auth.admin.getUserById(userId);
  const target = data?.user;
  if (!target) return backToAdmin('Conta não encontrada.');

  const role = await resolveRoleForAuthUser(admin, target);

  // As duas cookies nunca ficam activas ao mesmo tempo — a do revendedor
  // muda o que o painel /dashboard mostra, a do cliente só o /cliente.
  if (role === 'client') {
    store.delete(IMPERSONATE_COOKIE);
    store.set(IMPERSONATE_CLIENT_COOKIE, target.id, COOKIE_OPTS);
    return NextResponse.redirect(resolvePanelApiRedirect('/cliente?impersonate=1', hostname), { status: 307 });
  }

  if (role === 'profissional') {
    const profile = await getProfileForAuthUser(admin, target.id, target.email);
    const daUsername = String(profile?.da_username || '').trim().toLowerCase();
    if (!daUsername) return backToAdmin('Esta conta profissional ainda não tem alojamento no servidor.');
    store.delete(IMPERSONATE_CLIENT_COOKIE);
    store.set(IMPERSONATE_COOKIE, daUsername, COOKIE_OPTS);
    return NextResponse.redirect(resolvePanelApiRedirect('/profissional?impersonate=1', hostname), { status: 307 });
  }

  return backToAdmin('Só é possível entrar em contas de cliente ou profissional por aqui.');
}
