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

function parseLegacyDaJson(raw: string): { ok: boolean; data?: Record<string, unknown>; error?: string } {
  if (!raw) return { ok: false, error: 'Resposta vazia do servidor' };
  if (isDaAuthFailure(raw)) return { ok: false, error: 'Não autorizado no servidor' };

  const trimmed = raw.trim();
  if (trimmed.includes('error=') || (trimmed.includes('&') && trimmed.includes('='))) {
    const parsed = parseDaResponse(trimmed);
    if (parsed.error) {
      return { ok: false, error: parsed.details || parsed.text || 'Pedido falhou' };
    }
    return { ok: true, data: { ...(parsed.data || {}), text: parsed.text } };
  }

  try {
    const data = JSON.parse(trimmed) as Record<string, unknown>;
    const errVal = data.error;
    const err =
      errVal === 1 ||
      errVal === '1' ||
      errVal === true ||
      data.success === false ||
      data.success === 'no';
    if (err) {
      return { ok: false, error: String(data.text || data.details || 'Pedido falhou') };
    }
    return { ok: true, data };
  } catch {
    const parsed = parseDaResponse(trimmed);
    if (parsed.error) {
      return { ok: false, error: parsed.details || parsed.text || 'Pedido falhou' };
    }
    if (trimmed.length > 0 && !trimmed.startsWith('<')) {
      return { ok: true, data: parsed.data || { text: trimmed } };
    }
    return { ok: false, error: trimmed.slice(0, 300) || 'Pedido falhou' };
  }
}

/** Legacy API (`CMD_API_*`) com `json=yes` como utilizador DA. */
export async function daLegacyRequestViaSshAsDaUser(
  daUsername: string,
  method: 'GET' | 'POST',
  cmd: string,
  fields: Record<string, string> = {},
): Promise<{ ok: boolean; data?: Record<string, unknown>; error?: string }> {
  const result = await daRequestViaSshAsDaUser(method, cmd, { json: 'yes', ...fields }, daUsername);
  if (!result.ok) return { ok: false, error: result.error };
  return parseLegacyDaJson(result.raw);
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

function buildDaJsonCurlAsUser(
  daUsername: string,
  method: string,
  endpoint: string,
  options?: {
    query?: Record<string, string | boolean | undefined>;
    body?: unknown;
  },
): string {
  const userQ = shellQuote(daUsername);
  const host = shellQuote(readDaHost());
  const port = CANONICAL_DIRECTADMIN_PORT;
  const ep = endpoint.replace(/^\//, '');
  const apiSetup = `API=$(${DA_BIN} api-url --user=${userQ} 2>/dev/null | tail -1)`;
  const authSetup = `AUTH=$(echo "$API" | sed -n 's#https://\\([^@]*\\)@.*#\\1#p')`;
  const qs = options?.query
    ? Object.entries(options.query)
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : '';
  const urlPath = qs
    ? `https://127.0.0.1:${port}/${ep}?${qs}`
    : `https://127.0.0.1:${port}/${ep}`;
  const urlQ = shellQuote(urlPath);
  const methodUp = method.toUpperCase();
  if (options?.body !== undefined) {
    const json = shellQuote(JSON.stringify(options.body));
    return `${apiSetup}; ${authSetup}; curl -sk -u "$AUTH" -H "Host: ${host}" -H "Content-Type: application/json" -X ${methodUp} -d ${json} ${urlQ} 2>&1`;
  }
  return `${apiSetup}; ${authSetup}; curl -sk -u "$AUTH" -H "Host: ${host}" -X ${methodUp} ${urlQ} 2>&1`;
}

function parseDaJsonBody(raw: string): { ok: boolean; data?: unknown; error?: string } {
  if (!raw) return { ok: false, error: 'Resposta vazia do servidor' };
  if (isDaAuthFailure(raw)) return { ok: false, error: 'Não autorizado no servidor' };
  try {
    const data = JSON.parse(raw);
    if (data && typeof data === 'object' && 'type' in data && String((data as { type?: string }).type).includes('ERROR')) {
      const msg = (data as { message?: string }).message || String((data as { type?: string }).type);
      return { ok: false, error: msg };
    }
    return { ok: true, data };
  } catch {
    const parsed = parseDaResponse(raw);
    if (parsed.error) {
      return { ok: false, error: parsed.details || parsed.text || 'Pedido ao servidor falhou' };
    }
    return { ok: false, error: raw.slice(0, 300) };
  }
}

/** Pedido JSON à API moderna do DirectAdmin (`/api/...`) como utilizador DA. */
export async function daJsonRequestViaSshAsDaUser(
  daUsername: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  endpoint: string,
  options?: {
    query?: Record<string, string | boolean | undefined>;
    body?: unknown;
  },
): Promise<{ ok: boolean; data?: unknown; error?: string; raw?: string }> {
  const curl = buildDaJsonCurlAsUser(daUsername, method, endpoint, options);
  try {
    const raw = (await executeServerCommand(curl)).trim();
    const parsed = parseDaJsonBody(raw);
    return { ...parsed, raw };
  } catch (e: unknown) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Pedido ao servidor falhou',
    };
  }
}

/** Download binário (export SQL/GZ) via API DA. */
export async function daBinaryGetViaSshAsDaUser(
  daUsername: string,
  endpoint: string,
  query?: Record<string, string | boolean | undefined>,
): Promise<{ ok: boolean; base64?: string; error?: string }> {
  const userQ = shellQuote(daUsername);
  const host = shellQuote(readDaHost());
  const port = CANONICAL_DIRECTADMIN_PORT;
  const ep = endpoint.replace(/^\//, '');
  const apiSetup = `API=$(${DA_BIN} api-url --user=${userQ} 2>/dev/null | tail -1)`;
  const authSetup = `AUTH=$(echo "$API" | sed -n 's#https://\\([^@]*\\)@.*#\\1#p')`;
  const qs = query
    ? Object.entries(query)
        .filter(([, v]) => v !== undefined && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : '';
  const urlPath = qs
    ? `https://127.0.0.1:${port}/${ep}?${qs}`
    : `https://127.0.0.1:${port}/${ep}`;
  const curl = `${apiSetup}; ${authSetup}; curl -sk -u "$AUTH" -H "Host: ${host}" ${shellQuote(urlPath)} | base64 -w0 2>&1`;
  try {
    const raw = (await executeServerCommand(curl)).trim();
    if (!raw || isDaAuthFailure(raw)) {
      return { ok: false, error: 'Não foi possível exportar a base de dados' };
    }
    return { ok: true, base64: raw };
  } catch (e: unknown) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Exportação falhou',
    };
  }
}

/** Importar backup SQL via API DA (streaming no servidor). */
export async function daImportSqlViaSshAsDaUser(
  daUsername: string,
  database: string,
  sqlBase64: string,
  clean = false,
): Promise<{ ok: boolean; error?: string }> {
  const userQ = shellQuote(daUsername);
  const host = shellQuote(readDaHost());
  const port = CANONICAL_DIRECTADMIN_PORT;
  const dbEnc = encodeURIComponent(database);
  const cleanQ = clean ? 'clean=yes' : 'clean=no';
  const b64Q = shellQuote(sqlBase64);
  const apiSetup = `API=$(${DA_BIN} api-url --user=${userQ} 2>/dev/null | tail -1)`;
  const authSetup = `AUTH=$(echo "$API" | sed -n 's#https://\\([^@]*\\)@.*#\\1#p')`;
  const url = `https://127.0.0.1:${port}/api/db-manage/databases/${dbEnc}/import?${cleanQ}`;
  const curl = `${apiSetup}; ${authSetup}; TMP=$(mktemp); echo ${b64Q} | base64 -d > "$TMP"; curl -sk -u "$AUTH" -H "Host: ${host}" -F "sqlfile=@$TMP;filename=import.sql" ${shellQuote(url)}; RC=$?; rm -f "$TMP"; exit $RC`;
  try {
    const raw = (await executeServerCommand(curl)).trim();
    const parsed = parseDaJsonBody(raw);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    return { ok: true };
  } catch (e: unknown) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : 'Importação falhou',
    };
  }
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
