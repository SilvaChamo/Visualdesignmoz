import { getServerHost } from '@/lib/server-config';

/**
 * Host IMAP para caixas no servidor de hospedagem.
 * `mail.dominio.com` no DNS público pode apontar para CDN — usar sempre o IP do servidor.
 */
export function resolvePanelImapHost(): string {
  const explicit = process.env.IMAP_HOST?.trim();
  const serverIp = process.env.SERVER_IP?.trim() || getServerHost();

  if (!explicit) return serverIp;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(explicit)) return explicit;
  if (explicit === serverIp) return explicit;

  // mail.* no projecto costuma resolver fora do Hetzner (ex.: Vercel/CDN)
  if (/^mail\./i.test(explicit)) return serverIp;

  return explicit;
}
