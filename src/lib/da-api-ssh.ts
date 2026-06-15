/**
 * Chamadas API ao servidor via SSH (localhost — evita IP blacklist da Vercel).
 */

import { parseDaResponse } from '@/lib/directadmin';
import {
  resolveDirectAdminCredentials,
  type DirectAdminCredentials,
} from '@/lib/directadmin-credentials';
import { CANONICAL_DIRECTADMIN_PORT } from '@/lib/directadmin-url';
import { executeServerCommand } from '@/lib/server-ssh-exec';

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
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
    if (!raw) return { ok: false, raw: '', error: 'Ligação ao servidor indisponível' };
    const parsed = parseDaResponse(raw);
    if (parsed.error) {
      return { ok: false, raw, error: parsed.details || parsed.text || 'Pedido ao servidor falhou' };
    }
    return { ok: true, raw };
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
