import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/admin-api-auth';
import { IMPERSONATE_COOKIE } from '@/lib/panel-api-context';
import { getProfileForAuthUser } from '@/lib/profile-db';
import { resolveRegistryDaUsername } from '@/lib/panel-user-registry';
import { getDaSyncAdmin } from '@/lib/da-sync-schema';
import { resolvePanelApiRedirect } from '@/lib/panel-origin';
import { getRequestHostname } from '@/lib/request-host';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 8,
};

function isImpersonatableAccount(acl?: string | null): boolean {
  const normalized = String(acl || '').toLowerCase();
  return normalized === 'reseller' || normalized === 'manager';
}

function serviceClient() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

async function resolveImpersonateDaUsername(body: {
  userName?: string;
  userId?: string;
  email?: string;
}): Promise<string | null> {
  const rawName = String(body.userName || '').trim().toLowerCase();
  let userName = rawName && !rawName.includes('@') ? rawName : '';

  const admin = serviceClient();
  if (!admin) return userName || null;

  let profileEmail = String(body.email || '').trim().toLowerCase();

  if (!userName && body.userId) {
    const profile = await getProfileForAuthUser(admin, String(body.userId));
    userName = String(profile?.da_username || '').trim().toLowerCase();
    profileEmail = profileEmail || String(profile?.email || '').toLowerCase();

    if (!userName) {
      const { data: panelUser } = await admin
        .from('panel_users')
        .select('username')
        .eq('auth_user_id', String(body.userId))
        .maybeSingle();
      userName = String(panelUser?.username || '').trim().toLowerCase();
    }
  }

  if (!userName && profileEmail) {
    userName =
      resolveRegistryDaUsername({ email: profileEmail }) ||
      (await admin
        .from('panel_users')
        .select('username')
        .eq('email', profileEmail)
        .maybeSingle()
        .then((r) => String(r.data?.username || '').trim().toLowerCase()));
  }

  return userName || null;
}

async function isKnownResellerDaUsername(userName: string): Promise<boolean> {
  const syncAdmin = getDaSyncAdmin();
  if (!syncAdmin) return false;

  const { data } = await syncAdmin
    .from('panel_users')
    .select('acl')
    .eq('username', userName)
    .maybeSingle();

  return isImpersonatableAccount(data?.acl);
}

async function startImpersonate(
  userName: string,
): Promise<{ ok: true; userName: string } | { ok: false; status: number; error: string }> {
  const normalized = userName.trim().toLowerCase();
  if (!normalized) {
    return { ok: false, status: 400, error: 'Conta revendedor sem utilizador DA ligado.' };
  }

  if (!(await isKnownResellerDaUsername(normalized))) {
    return {
      ok: false,
      status: 404,
      error: 'Conta revendedor não encontrada no espelho do servidor.',
    };
  }

  // A password DA guardada era só uma pré-condição defensiva de quando toda
  // a gente estava no DirectAdmin — nunca chegou a ser usada aqui (impersonar
  // só grava o username numa cookie). Uma conta já migrada para o Hestia não
  // tem essa password (nem precisa dela) e `isKnownResellerDaUsername` acima
  // já confirma que a conta existe e é impersonável — por isso não bloquear
  // aqui. Ver [[project_da-to-hestia-migration]].

  const store = await cookies();
  store.set(IMPERSONATE_COOKIE, normalized, COOKIE_OPTS);

  return { ok: true, userName: normalized };
}

function adminListRedirect(hostname: string, error?: string): NextResponse {
  const query = error
    ? `?section=hospedagem-contas&impersonate_error=${encodeURIComponent(error)}`
    : '?section=hospedagem-contas';
  return NextResponse.redirect(resolvePanelApiRedirect(`/dashboard${query}`, hostname), { status: 307 });
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;
  const hostname = getRequestHostname(req.headers, req.url);

  if (req.nextUrl.searchParams.get('exit') === '1') {
    const store = await cookies();
    store.delete(IMPERSONATE_COOKIE);
    return adminListRedirect(hostname);
  }

  const userParam = req.nextUrl.searchParams.get('user')?.trim().toLowerCase();
  if (userParam) {
    const result = await startImpersonate(userParam);
    if (!result.ok) {
      return adminListRedirect(hostname, result.error);
    }
    // O redirect tem de ficar no MESMO domínio onde a cookie de impersonação
    // acabou de ser definida (ex.: painel.visualdesignmoz.com) — se saltar
    // para outro domínio, a cookie nunca chega ao pedido seguinte e o
    // painel do revendedor mostra sempre os dados do próprio admin.
    const target = resolvePanelApiRedirect('/revendedor?impersonate=1', hostname);
    return NextResponse.redirect(target, { status: 307 });
  }

  const store = await cookies();
  const daUsername = store.get(IMPERSONATE_COOKIE)?.value?.trim() || null;

  return NextResponse.json({
    success: true,
    active: !!daUsername,
    daUsername,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  const body = await req.json().catch(() => ({}));
  const userName = await resolveImpersonateDaUsername(body);

  if (!userName) {
    return NextResponse.json(
      { success: false, error: 'Conta revendedor sem utilizador DA ligado.' },
      { status: 400 },
    );
  }

  const result = await startImpersonate(userName);
  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    success: true,
    daUsername: result.userName,
    redirect: resolvePanelApiRedirect('/revendedor?impersonate=1', getRequestHostname(req.headers, req.url)),
  });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  const store = await cookies();
  store.delete(IMPERSONATE_COOKIE);

  return NextResponse.json({
    success: true,
    redirect: resolvePanelApiRedirect('/dashboard?section=hospedagem-contas', getRequestHostname(req.headers, req.url)),
  });
}
