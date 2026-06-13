/**
 * Proxy DirectAdmin via SSH — contorna IP blacklist da Vercel.
 */

import { executeServerCommand } from '@/lib/server-ssh-exec';
import type { DirectAdminCredentials } from '@/lib/directadmin-credentials';

const DA_BIN = '/usr/local/directadmin/directadmin';

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function buildQuery(params: Record<string, string>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
}

export async function requestDirectAdminViaSsh(
  endpoint: string,
  method: 'GET' | 'POST',
  params: Record<string, string>,
  credentials: DirectAdminCredentials,
): Promise<string> {
  const user = shellQuote(credentials.user);
  const apiSetup = `API=$(${DA_BIN} api-url --user=${user} 2>/dev/null | tail -1)`;
  const qs = buildQuery(params);

  if (method === 'GET') {
    const ep = endpoint.replace(/^\//, '');
    const url = qs ? `"$API/${ep}?${qs}"` : `"$API/${ep}"`;
    return executeServerCommand(`${apiSetup}; curl -sk ${url}`);
  }

  const ep = endpoint.replace(/^\//, '');
  const body = buildQuery(params);
  return executeServerCommand(
    `${apiSetup}; curl -sk -X POST -d ${shellQuote(body)} "$API/${ep}"`,
  );
}

export function shouldFallbackToDaSsh(error: unknown): boolean {
  if (process.env.DA_USE_SSH_PROXY === 'true') return true;
  const message = error instanceof Error ? error.message : String(error || '');
  const m = message.toLowerCase();
  return (
    m.includes('401') ||
    m.includes('403') ||
    m.includes('blacklisted') ||
    m.includes('not logged in') ||
    m.includes('unauthorized') ||
    m.includes('access denied') ||
    m.includes('econnrefused') ||
    m.includes('etimedout') ||
    m.includes('expirou') ||
    m.includes('enotfound') ||
    m.includes('connection error')
  );
}
