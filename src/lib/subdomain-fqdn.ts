/** Junta prefixo + domínio pai, como no cPanel/DirectAdmin.
 *  `app` + `mltmark.com` → `app.mltmark.com`
 *  `app.mltmark.com` + `mltmark.com` → `app.mltmark.com` */
export function subdomainFqdn(parent: string, subdomain: string): string {
  const domain = parent.trim().toLowerCase().replace(/\.$/, '');
  const sub = subdomain.trim().toLowerCase().replace(/\.$/, '');
  if (!sub) return '';
  if (!domain) return sub;
  if (sub === domain || sub.endsWith(`.${domain}`)) return sub;
  if (sub.includes('.')) return sub;
  return `${sub}.${domain}`;
}
