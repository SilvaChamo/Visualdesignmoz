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
  const r = await pointDomainToServerIp(clean, getServerHost());
  if (r.ok || !/Sem zona/i.test(r.error || '')) return r;
  // Sem zona na Cloudflare: cria-a e põe tudo (registos, e-mail e, quando é possível, os nameservers), como na compra do domínio
  const { prepararDnsDaHospedagem } = await import('@/lib/dns-hospedagem');
  const feito = await prepararDnsDaHospedagem(clean);
  return { ok: feito.ok, error: feito.ok ? undefined : feito.passos.filter((x) => !x.ok).map((x) => `${x.passo}: ${x.detalhe}`).join('; ') };
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
