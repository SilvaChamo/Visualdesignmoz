/**
 * Chamadas API ao servidor via SSH (localhost — evita IP blacklist da Vercel).
 */

import { parseDaResponse } from '@/lib/directadmin';
import {
  resolveDirectAdminCredentials,
  type DirectAdminCredentials,
} from '@/lib/directadmin-credentials';
import { executeServerCommand } from '@/lib/server-ssh-exec';

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export async function daPostViaSsh(
  cmd: string,
  fields: Record<string, string>,
  creds?: DirectAdminCredentials,
): Promise<{ ok: boolean; error?: string }> {
  const credentials = creds ?? (await resolveDirectAdminCredentials('admin'));
  const body = Object.entries(fields)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  const url = `http://127.0.0.1:2222/${cmd}`;
  const curl = `curl -sk -u ${shellQuote(`${credentials.user}:${credentials.password}`)} -X POST ${shellQuote(url)} -d ${shellQuote(body)} 2>&1`;

  try {
    const raw = (await executeServerCommand(curl)).trim();
    if (!raw) return { ok: false, error: 'Ligação ao servidor indisponível' };
    const parsed = parseDaResponse(raw);
    if (parsed.error) {
      return { ok: false, error: parsed.details || parsed.text || 'Pedido ao servidor falhou' };
    }
    return { ok: true };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : 'Pedido ao servidor falhou' };
  }
}
