/**
 * DNS + SSL depois de criar um site no Hestia.
 *
 * Um subdomínio (`app.mltmark.com`) vive na zona Cloudflare do domínio pai
 * (`mltmark.com`). Sem este passo o Hestia cria o vhost mas a internet não
 * resolve o hostname — o utilizador acaba em `mltmark.com/app` (404 do site pai).
 */

import { deleteHostARecord, pointDomainToServerIp } from '@/lib/cloudflare-dns';
import { getServerHost } from '@/lib/server-config';
import { subdomainFqdn } from '@/lib/subdomain-fqdn';

export { subdomainFqdn };

export async function pointHostingHostToServer(
  host: string,
): Promise<{ ok: boolean; error?: string }> {
  const clean = host.trim().toLowerCase().replace(/\.$/, '');
  if (!clean) return { ok: false, error: 'Hostname obrigatório' };
  return pointDomainToServerIp(clean, getServerHost());
}

export async function removeHostingHostDns(
  host: string,
): Promise<{ ok: boolean; error?: string }> {
  const clean = host.trim().toLowerCase().replace(/\.$/, '');
  if (!clean) return { ok: true };
  return deleteHostARecord(clean);
}

/** Let's Encrypt assim que o DNS responder (o pedido imediato falha enquanto o registo A ainda não propagou): ver ssl-automatico.ts */
export function scheduleHostingSslRetry(username: string, domain: string): void {
  void import('@/lib/ssl-automatico').then((m) => m.agendarSslImediato(username.trim(), domain.trim().toLowerCase())).catch(() => undefined);
}
