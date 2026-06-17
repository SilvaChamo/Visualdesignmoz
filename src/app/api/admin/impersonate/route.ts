import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/admin-api-auth';
import { IMPERSONATE_COOKIE } from '@/lib/panel-api-context';
import { loadResellerCredentialsByDaUsername } from '@/lib/da-credential-store';
import { getProfileForAuthUser } from '@/lib/profile-db';
import { resolveRegistryDaUsername } from '@/lib/panel-user-registry';
import { getDaSyncAdmin } from '@/lib/da-sync-schema';
import { resolvePanelApiRedirect } from '@/lib/panel-origin';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 8,
};

function isResellerAccount(acl?: string | null): boolean {
  return String(acl || '').toLowerCase() === 'reseller';
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

  return isResellerAccount(data?.acl);
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

  const creds = await loadResellerCredentialsByDaUsername(normalized);
  if (!creds) {
    return {
      ok: false,
      status: 503,
      error: `Sem credenciais para "${normalized}". Sincronize ou ligue a conta no servidor primeiro.`,
    };
  }

  const store = await cookies();
  store.set(IMPERSONATE_COOKIE, normalized, COOKIE_OPTS);

  return { ok: true, userName: normalized };
}

function adminListRedirect(req: NextRequest, error?: string): NextResponse {
  const query = error
    ? `?section=hospedagem-contas&impersonate_error=${encodeURIComponent(error)}`
    : '?section=hospedagem-contas';
  return NextResponse.redirect(resolvePanelApiRedirect(`/admin${query}`, req.url), { status: 307 });
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  if (req.nextUrl.searchParams.get('exit') === '1') {
    const store = await cookies();
    store.delete(IMPERSONATE_COOKIE);
    return adminListRedirect(req);
  }

  const userParam = req.nextUrl.searchParams.get('user')?.trim().toLowerCase();
  if (userParam) {
    const result = await startImpersonate(userParam);
    if (!result.ok) {
      return adminListRedirect(req, result.error);
    }
    const target = resolvePanelApiRedirect('/revendedor?impersonate=1', req.url);
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
    redirect: resolvePanelApiRedirect('/revendedor?impersonate=1', req.url),
  });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  const store = await cookies();
  store.delete(IMPERSONATE_COOKIE);

  return NextResponse.json({
    success: true,
    redirect: resolvePanelApiRedirect('/admin?section=hospedagem-contas', req.url),
  });
}
