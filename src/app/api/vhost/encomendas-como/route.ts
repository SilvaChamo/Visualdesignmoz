import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-api-auth';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { clearImpersonateClientCookie, setImpersonateClientCookie } from '@/lib/client-impersonation';

export const dynamic = 'force-dynamic';

/** Painel › "Entrar como" uma conta › Encomendas (Silva, 23/10/2026): o administrador vê e faz encomendas em nome da conta que está a ver.
 *  Põe a cookie de impersonação de cliente (src/lib/client-impersonation.ts) com o login da conta no site; só vale para administradores
 *  (a cookie sozinha nunca chega: as rotas só a usam quando quem pede é mesmo admin). DELETE tira-a ao voltar ao painel do próprio. */
export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const body = await request.json().catch(() => ({}));
  const conta = String(body?.conta || '').trim().toLowerCase();
  if (!conta) return NextResponse.json({ success: false, error: 'Conta em falta.' }, { status: 400 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ success: false, error: 'Serviço indisponível.' }, { status: 503 });
  const { data } = await admin.from('panel_users').select('auth_user_id').eq('username', conta).maybeSingle();
  const userId = data?.auth_user_id ? String(data.auth_user_id) : '';
  if (!userId) return NextResponse.json({ success: false, error: 'Esta conta ainda não tem login no site.' }, { status: 404 });
  await setImpersonateClientCookie(userId);
  return NextResponse.json({ success: true });
}

export async function DELETE() {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  await clearImpersonateClientCookie();
  return NextResponse.json({ success: true });
}
