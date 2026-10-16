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

/** Let's Encrypt depois do DNS — o v-add-letsencrypt-domain imediato falha
 *  enquanto o A record ainda não propagou. */
export function scheduleHostingSslRetry(username: string, domain: string): void {
  const user = username.trim();
  const host = domain.trim().toLowerCase();
  if (!user || !host) return;
  void (async () => {
    const { issueLetsEncrypt } = await import('@/lib/hestia-adapter');
    for (const waitMs of [20_000, 60_000, 180_000]) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      const ssl = await issueLetsEncrypt(user, host);
      if (ssl.ok) return;
    }
  })().catch(() => undefined);
}
