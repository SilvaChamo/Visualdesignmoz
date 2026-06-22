/**
 * Chamadas API ao servidor via SSH (localhost — evita IP blacklist da Vercel).
 */

import { parseDaResponse } from '@/lib/directadmin';
import {
  resolveDirectAdminCredentials,
  type DirectAdminCredentials,
} from '@/lib/directadmin-credentials';
import { CANONICAL_DIRECTADMIN_PORT, normalizeDirectAdminHost } from '@/lib/directadmin-url';
import { executeServerCommand } from '@/lib/server-ssh-exec';

const DA_BIN = '/usr/local/directadmin/directadmin';

function readDaHost(): string {
  const raw = process.env.DIRECTADMIN_HOST || 'host.visualdesignmoz.com';
  return normalizeDirectAdminHost(raw.trim().replace(/^['"]|['"]$/g, ''));
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function isDaAuthFailure(raw: string, message?: string): boolean {
  const text = `${raw}\n${message || ''}`.toLowerCase();
  return (
    text.includes('unauthorized') ||
    text.includes('not logged in') ||
    text.includes('access denied') ||
    text.includes('invalid login')
  );
}

/** @deprecated Preferir `daPostViaSshAsDaUser` — impersonação não funciona em todos os servidores. */
export async function adminImpersonateResellerCreds(
  resellerUsername: string,
): Promise<DirectAdminCredentials> {
  const admin = await resolveDirectAdminCredentials('admin');
  return {
    role: 'admin',
    user: `${admin.user}|${resellerUsername}`,
    password: admin.password,
  };
}

function daLocalBaseUrl(cmd: string, params?: Record<string, string>) {
  const qs =
    params && Object.keys(params).length
      ? `?${Object.entries(params)
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
          .join('&')}`
      : '';
  return `https://127.0.0.1:${CANONICAL_DIRECTADMIN_PORT}/${cmd}${qs}`;
}

function parseDaRequestResult(raw: string): { ok: boolean; raw: string; error?: string } {
  if (!raw) return { ok: false, raw: '', error: 'Ligação ao servidor indisponível' };
  if (isDaAuthFailure(raw)) {
    return { ok: false, raw, error: 'Não autorizado no servidor' };
  }
  const parsed = parseDaResponse(raw);
  if (parsed.error) {
    const err = parsed.details || parsed.text || 'Pedido ao servidor falhou';
    if (isDaAuthFailure(raw, err)) {
      return { ok: false, raw, error: 'Não autorizado no servidor' };
    }
    return { ok: false, raw, error: err };
  }
  return { ok: true, raw };
}

async function daRequestViaSshAsDaUser(
  method: 'GET' | 'POST',
  cmd: string,
  fields: Record<string, string>,
  daUsername: string,
): Promise<{ ok: boolean; raw: string; error?: string }> {
  const userQ = shellQuote(daUsername);
  const host = shellQuote(readDaHost());
  const port = CANONICAL_DIRECTADMIN_PORT;
  const ep = cmd.replace(/^\//, '');
  const apiSetup = `API=$(${DA_BIN} api-url --user=${userQ} 2>/dev/null | tail -1)`;
  const authSetup = `AUTH=$(echo "$API" | sed -n 's#https://\\([^@]*\\)@.*#\\1#p')`;
  const baseUrl = shellQuote(`https://127.0.0.1:${port}/${ep}`);

  let curl: string;
  if (method === 'GET') {
    const qs = Object.entries(fields)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    const urlPath = qs
      ? `https://127.0.0.1:${port}/${ep}?${qs}`
      : `https://127.0.0.1:${port}/${ep}`;
    curl = `${apiSetup}; ${authSetup}; curl -sk -u "$AUTH" -H "Host: ${host}" ${shellQuote(urlPath)} 2>&1`;
  } else {
    const body = Object.entries(fields)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    curl = `${apiSetup}; ${authSetup}; curl -sk -u "$AUTH" -H "Host: ${host}" -X POST -d ${shellQuote(body)} ${baseUrl} 2>&1`;
  }

  try {
    const raw = (await executeServerCommand(curl)).trim();
    return parseDaRequestResult(raw);
  } catch (e: unknown) {
    return {
      ok: false,
      raw: '',
      error: e instanceof Error ? e.message : 'Pedido ao servidor falhou',
    };
  }
}

async function daRequestViaSsh(
  method: 'GET' | 'POST',
  cmd: string,
  fields: Record<string, string>,
  creds?: DirectAdminCredentials,
): Promise<{ ok: boolean; raw: string; error?: string }> {
  const credentials = creds ?? (await resolveDirectAdminCredentials('admin'));
  const auth = shellQuote(`${credentials.user}:${credentials.password}`);

  let curl: string;
  if (method === 'GET') {
    curl = `curl -sk -u ${auth} ${shellQuote(daLocalBaseUrl(cmd, fields))} 2>&1`;
  } else {
    const body = Object.entries(fields)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join('&');
    curl = `curl -sk -u ${auth} -X POST ${shellQuote(daLocalBaseUrl(cmd))} -d ${shellQuote(body)} 2>&1`;
  }

  try {
    const raw = (await executeServerCommand(curl)).trim();
    return parseDaRequestResult(raw);
  } catch (e: unknown) {
    return {
      ok: false,
      raw: '',
      error: e instanceof Error ? e.message : 'Pedido ao servidor falhou',
    };
  }
}

export async function daGetViaSsh(
  cmd: string,
  params: Record<string, string> = {},
  creds?: DirectAdminCredentials,
): Promise<{ ok: boolean; raw: string; error?: string }> {
  return daRequestViaSsh('GET', cmd, params, creds);
}

export async function daPostViaSsh(
  cmd: string,
  fields: Record<string, string>,
  creds?: DirectAdminCredentials,
): Promise<{ ok: boolean; error?: string }> {

  const result = await daRequestViaSsh('POST', cmd, fields, creds);
  return { ok: result.ok, error: result.error };
}

/** API via login-key gerada no servidor (`directadmin api-url --user=...`). */
export async function daPostViaSshAsDaUser(
  daUsername: string,
  cmd: string,
  fields: Record<string, string>,
): Promise<{ ok: boolean; error?: string }> {
  const result = await daRequestViaSshAsDaUser('POST', cmd, fields, daUsername);
  return { ok: result.ok, error: result.error };
}

/** Login one-time: HTTP interno (rápido) → SSH (fallback). */
export async function daOneTimeLoginUrl(
  username: string,
  publicHost = 'host.visualdesignmoz.com',
): Promise<string | null> {
  const { daOneTimeLoginUrlViaHttp } = await import('@/lib/da-login-url-http');
  return (
    (await daOneTimeLoginUrlViaHttp(username, publicHost)) ??
    (await daOneTimeLoginUrlViaSsh(username, publicHost))
  );
}

/** @deprecated Use `daOneTimeLoginUrl` */
export async function daOneTimeLoginUrlViaSsh(
  username: string,
  publicHost = 'host.visualdesignmoz.com',
): Promise<string | null> {
  const daBin = '/usr/local/directadmin/directadmin';
  const userQ = shellQuote(username);
  const cmd = `${daBin} login-url --user=${userQ} 2>/dev/null | tail -1`;

  try {
    const raw = (await executeServerCommand(cmd, { fast: true })).trim();
    if (!raw.startsWith('http')) return null;
    const url = new URL(raw);
    if (!url.pathname.includes('/api/login/')) return null;
    url.hostname = publicHost;
    url.port = CANONICAL_DIRECTADMIN_PORT;
    return url.toString();
  } catch {
    return null;
  }
}
