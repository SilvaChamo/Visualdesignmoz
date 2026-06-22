import { NextRequest, NextResponse } from 'next/server';
import { CANONICAL_DIRECTADMIN_HOST } from '@/lib/directadmin-url';
import { buildDirectAdminBase } from '@/lib/directadmin-url';
import { getAdminDaUsername } from '@/lib/directadmin-credentials';
import { resolveDirectAdminLoginUsernameFast } from '@/lib/directadmin-access-target';
import { daOneTimeLoginUrl } from '@/lib/da-api-ssh';
import type { DirectAdminAccessTarget } from '@/lib/server-config';
import { buildPanelLoginUrl } from '@/lib/panel-origin';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';

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

/** Navegação no browser (botão DirectAdmin) — redirecionar ao login em vez de JSON. */
function isBrowserNavigation(request: NextRequest): boolean {
  const accept = request.headers.get('accept') ?? '';
  if (accept.includes('text/html')) return true;
  const dest = request.headers.get('sec-fetch-dest');
  return dest === 'document' || dest === 'iframe';
}

function loginRedirect(request: NextRequest): NextResponse {
  return NextResponse.redirect(buildPanelLoginUrl(request.nextUrl.origin), {
    status: 307,
    headers: { 'Cache-Control': 'no-store' },
  });
}

/** Abre o DirectAdmin com SSO (admin ou revenda conforme o painel). */
export async function GET(request: NextRequest) {
  const loginUrl = directAdminLoginPageUrl();
  const target = parseAccessTarget(request);
  const browserNav = isBrowserNavigation(request);

  const auth = await requireAdminOrReseller();
  if ('error' in auth) {
    if (browserNav) {
      return loginRedirect(request);
    }
    return auth.error;
  }

  try {
    const requestedUser = request.nextUrl.searchParams.get('user')?.trim().toLowerCase();
    const daUsername = requestedUser
      ? requestedUser
      : target === 'admin'
        ? getAdminDaUsername()
        : await resolveDirectAdminLoginUsernameFast(auth, target);

    if (requestedUser && auth.user.role !== 'admin') {
      const forbidden = NextResponse.json(
        { error: 'Acesso restrito a administradores' },
        { status: 403 },
      );
      if (browserNav) {
        return NextResponse.redirect(
          new URL('/dashboard', request.nextUrl.origin),
          { status: 307 },
        );
      }
      return forbidden;
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
