/**
 * Gera URL one-time DirectAdmin via HTTP no servidor (mais rápido que SSH a partir da Vercel).
 */

import crypto from 'node:crypto';

function readSsoSecret(): string {
  return (
    process.env.DA_SSO_SECRET?.trim() ||
    process.env.DA_CREDENTIALS_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    ''
  );
}

function ssoEndpoint(): string {
  return (
    process.env.DA_SSO_URL?.trim() ||
    'https://matolario.visualdesignmoz.com/vd-internal/da-sso.php'
  );
}

/** Login one-time via endpoint interno Hetzner (HMAC, ~200ms vs SSH ~2s). */
export async function daOneTimeLoginUrlViaHttp(
  username: string,
  publicHost: string,
): Promise<string | null> {
  const secret = readSsoSecret();
  const user = username.trim().toLowerCase();
  if (!secret || !/^[a-z0-9._-]{1,64}$/.test(user)) return null;

  const ts = String(Math.floor(Date.now() / 1000));
  const sig = crypto.createHmac('sha256', secret).update(`${ts}.${user}`).digest('hex');

  const url = new URL(ssoEndpoint());
  url.searchParams.set('user', user);
  url.searchParams.set('ts', ts);
  url.searchParams.set('sig', sig);

  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
      headers: { Accept: 'application/json', 'User-Agent': 'VisualDesign-Panel/1' },
    });
    if (!res.ok) return null;

    const data = (await res.json()) as { url?: string };
    if (!data.url?.startsWith('http')) return null;

    const parsed = new URL(data.url);
    if (!parsed.pathname.includes('/api/login/')) return null;
    parsed.hostname = publicHost;
    return parsed.toString();
  } catch {
    return null;
  }
}
