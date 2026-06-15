import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { resolveRoleForAuthUser } from '@/lib/server-auth-role';
import { ADMIN_EMAILS } from '@/lib/user-roles';
import { CANONICAL_DIRECTADMIN_HOST } from '@/lib/directadmin-url';
import { buildDirectAdminBase } from '@/lib/directadmin-url';
import { getAdminDaUsername } from '@/lib/directadmin-credentials';
import { resolveDirectAdminLoginUsernameFast } from '@/lib/directadmin-access-target';
import { daOneTimeLoginUrl } from '@/lib/da-api-ssh';
import type { DirectAdminAccessTarget } from '@/lib/server-config';
import type { PanelAuthSuccess } from '@/lib/panel-api-auth';

function readEnv(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return '';
}

function directAdminLoginPageUrl(): string {
  return (
    readEnv('DIRECTADMIN_URL') ||
    buildDirectAdminBase({
      protocol: readEnv('DIRECTADMIN_PROTOCOL', 'NEXT_PUBLIC_DIRECTADMIN_PROTOCOL') || 'https',
      host: readEnv('DIRECTADMIN_HOST', 'NEXT_PUBLIC_DIRECTADMIN_HOST') || CANONICAL_DIRECTADMIN_HOST,
      port: readEnv('DIRECTADMIN_PORT', 'NEXT_PUBLIC_DIRECTADMIN_PORT'),
    })
  );
}

function parseAccessTarget(request: NextRequest): DirectAdminAccessTarget {
  return request.nextUrl.searchParams.get('as') === 'reseller' ? 'reseller' : 'admin';
}

function staffRoleFromSession(
  user: NonNullable<Awaited<ReturnType<Awaited<ReturnType<typeof createClient>>['auth']['getSession']>>['data']['session']>['user'],
): PanelAuthSuccess | null {
  const email = (user.email || '').toLowerCase();
  const metaRole = user.user_metadata?.role || user.app_metadata?.role;

  if (ADMIN_EMAILS.has(email) || metaRole === 'admin') {
    return { user: { id: user.id, email, role: 'admin' } };
  }
  if (metaRole === 'reseller') {
    return { user: { id: user.id, email, role: 'reseller' } };
  }
  return null;
}

async function requireStaffForDaAccess(): Promise<PanelAuthSuccess | NextResponse> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const sessionUser = session?.user ?? null;
  if (sessionUser) {
    const quick = staffRoleFromSession(sessionUser);
    if (quick) return quick;
  }

  let user = sessionUser;
  if (!user) {
    const {
      data: { user: verified },
    } = await supabase.auth.getUser();
    user = verified;
  }

  if (!user) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 });
  }

  const email = (user.email || '').toLowerCase();
  const quick = staffRoleFromSession(user);
  if (quick) return quick;

  try {
    const effectiveRole = await resolveRoleForAuthUser(supabase, user);
    if (effectiveRole === 'admin') {
      return { user: { id: user.id, email, role: 'admin' } };
    }
    if (effectiveRole === 'reseller') {
      return { user: { id: user.id, email, role: 'reseller' } };
    }
  } catch {
    /* abaixo */
  }

  return NextResponse.json(
    { error: 'Acesso restrito a administradores ou revendedores' },
    { status: 403 },
  );
}

/** Abre o DirectAdmin com SSO (admin ou revenda conforme o painel). */
export async function GET(request: NextRequest) {
  const loginUrl = directAdminLoginPageUrl();
  const target = parseAccessTarget(request);

  const auth = await requireStaffForDaAccess();
  if (auth instanceof NextResponse) return auth;

  try {
    const requestedUser = request.nextUrl.searchParams.get('user')?.trim().toLowerCase();
    const daUsername = requestedUser
      ? requestedUser
      : target === 'admin'
        ? getAdminDaUsername()
        : await resolveDirectAdminLoginUsernameFast(auth, target);

    if (requestedUser && auth.user.role !== 'admin') {
      return NextResponse.json({ error: 'Acesso restrito a administradores' }, { status: 403 });
    }

    const oneTimeUrl = await daOneTimeLoginUrl(daUsername, CANONICAL_DIRECTADMIN_HOST);

    if (oneTimeUrl) {
      return NextResponse.redirect(oneTimeUrl, {
        status: 307,
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    console.warn('[directadmin-access] one-time login indisponível para', daUsername);
    return NextResponse.redirect(loginUrl, {
      status: 307,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    console.error('[directadmin-access]', err instanceof Error ? err.message : err);
    return NextResponse.redirect(loginUrl, {
      status: 307,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
