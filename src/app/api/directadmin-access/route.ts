import { NextResponse } from 'next/server';
import net from 'net';
import {
  buildDirectAdminBase,
  buildDirectAdminFallbackUrl,
} from '@/lib/directadmin-url';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';
import { resolvePanelDaContext } from '@/lib/panel-api-context';
import { resolveDirectAdminCredentials } from '@/lib/directadmin-credentials';
import { loadResellerCredentialsByDaUsername } from '@/lib/da-credential-store';

function readEnv(...keys: string[]): string {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return '';
}

function probeTcp(host: string, port: number, timeoutMs = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port, timeout: timeoutMs }, () => {
      socket.destroy();
      resolve(true);
    });
    socket.on('error', () => resolve(false));
    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function resolveDirectAdminLoginUrl(): Promise<string> {
  const primary = buildDirectAdminBase({
    explicitUrl: readEnv('DIRECTADMIN_URL'),
    protocol: readEnv('DIRECTADMIN_PROTOCOL', 'NEXT_PUBLIC_DIRECTADMIN_PROTOCOL') || 'https',
    host: readEnv('DIRECTADMIN_HOST', 'NEXT_PUBLIC_DIRECTADMIN_HOST'),
    port: readEnv('DIRECTADMIN_PORT', 'NEXT_PUBLIC_DIRECTADMIN_PORT'),
  });

  const fallback = buildDirectAdminFallbackUrl(
    readEnv('DIRECTADMIN_FALLBACK_HOST', 'NEXT_PUBLIC_DIRECTADMIN_FALLBACK_HOST'),
    readEnv('DIRECTADMIN_FALLBACK_PORT', 'NEXT_PUBLIC_DIRECTADMIN_FALLBACK_PORT'),
    readEnv('DIRECTADMIN_FALLBACK_PROTOCOL', 'NEXT_PUBLIC_DIRECTADMIN_FALLBACK_PROTOCOL'),
  );

  try {
    const parsed = new URL(primary);
    const port = parsed.port
      ? Number(parsed.port)
      : parsed.protocol === 'https:'
        ? 443
        : 80;
    const reachable = await probeTcp(parsed.hostname, port);
    if (reachable) return primary;
  } catch {
    /* usa fallback */
  }

  return fallback;
}

function loginActionUrl(loginUrl: string): string {
  return `${loginUrl.replace(/\/$/, '')}/CMD_LOGIN`;
}

function resolveRedirectUrl(loginUrl: string, location: string): string {
  if (location.startsWith('http://') || location.startsWith('https://')) return location;
  const base = loginUrl.replace(/\/$/, '');
  return `${base}${location.startsWith('/') ? location : `/${location}`}`;
}

/** DirectAdmin Evolution devolve URL one-time (`/api/login/redirect?key=…`) após login válido. */
async function createOneTimeLoginUrl(
  loginUrl: string,
  username: string,
  password: string,
): Promise<string | null> {
  try {
    const res = await fetch(loginActionUrl(loginUrl), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ username, password, redirect: '/' }),
      redirect: 'manual',
    });
    const location = res.headers.get('location');
    if (!location || !location.includes('/api/login/redirect')) return null;
    return resolveRedirectUrl(loginUrl, location);
  } catch {
    return null;
  }
}

function buildAutoLoginHtml(loginUrl: string, username: string, password: string): string {
  const action = loginActionUrl(loginUrl);
  const safeUser = escapeHtml(username);
  const safePass = escapeHtml(password);

  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="utf-8">
  <title>A abrir DirectAdmin...</title>
  <style>
    body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#f9fafb;color:#111827}
    .card{text-align:center;padding:2rem;background:#fff;border-radius:12px;border:1px solid #e5e7eb;box-shadow:0 1px 3px rgba(0,0,0,0.08)}
    .spinner{width:36px;height:36px;border:3px solid #e5e7eb;border-top-color:#dc2626;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 1rem}
    @keyframes spin{to{transform:rotate(360deg)}}
    p{margin:0;color:#6b7280;font-size:0.9rem}
  </style>
</head>
<body>
  <div class="card">
    <div class="spinner"></div>
    <p>A iniciar sessão no DirectAdmin...</p>
  </div>
  <form id="daLogin" method="POST" action="${action}">
    <input type="hidden" name="username" value="${safeUser}" />
    <input type="hidden" name="password" value="${safePass}" />
    <input type="hidden" name="redirect" value="/" />
  </form>
  <script>document.getElementById('daLogin').submit();</script>
</body>
</html>`;
}

/** Abre o DirectAdmin com credenciais automáticas (mesma conta do painel). */
export async function GET() {
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return auth.error;

  const loginUrl = await resolveDirectAdminLoginUrl();

  try {
    const ctx = await resolvePanelDaContext(auth);
    let creds;

    if (auth.user.role === 'reseller') {
      creds = await resolveDirectAdminCredentials('reseller', {
        id: auth.user.id,
        email: auth.user.email,
        role: 'reseller',
      });
    } else if (ctx.impersonating) {
      const stored = await loadResellerCredentialsByDaUsername(ctx.impersonating);
      if (!stored) {
        return NextResponse.redirect(loginUrl, {
          status: 307,
          headers: { 'Cache-Control': 'no-store' },
        });
      }
      creds = { role: 'reseller' as const, user: stored.user, password: stored.password };
    } else {
      creds = await resolveDirectAdminCredentials('admin');
    }

    // Login keys exigem o nome da conta (`admin`), não o email.
    const oneTimeUrl = await createOneTimeLoginUrl(loginUrl, creds.user, creds.password);
    if (oneTimeUrl) {
      return NextResponse.redirect(oneTimeUrl, {
        status: 307,
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    const html = buildAutoLoginHtml(loginUrl, creds.user, creds.password);
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[directadmin-access]', err instanceof Error ? err.message : err);
    return NextResponse.redirect(loginUrl, {
      status: 307,
      headers: { 'Cache-Control': 'no-store' },
    });
  }
}
