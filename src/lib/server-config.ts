export const DEFAULT_SERVER_IP = '37.27.17.25';

function webmailBase(): string {
  const env =
    process.env.NEXT_PUBLIC_WEBMAIL_URL || process.env.NEXT_PUBLIC_WEBMAIL_BASE_URL;
  if (env) return env.replace(/\/$/, '');
  return `https://${getServerHost()}/webmail`;
}

export function getWebmailUrl(): string {
  return webmailBase();
}

/** Compat: código legado usava este nome; corresponde ao URL público do webmail. */
export function getDirectAdminUrl(): string {
  return getWebmailUrl();
}

export function getDirectAdminFallbackUrl(): string {
  return getWebmailUrl();
}

export type DirectAdminAccessTarget = 'admin' | 'reseller';

/** Redireciona para o login do DirectAdmin — `admin` = conta admin; `reseller` = conta revenda activa. */
export function getDirectAdminAccessUrl(target: DirectAdminAccessTarget = 'admin'): string {
  return `/api/directadmin-access?as=${target}`;
}

/** Página de login DirectAdmin (sem auto-submit). */
export function getDirectAdminLoginPageUrl(): string {
  const host =
    process.env.NEXT_PUBLIC_DIRECTADMIN_HOST?.replace(/^https?:\/\//, '').replace(/:\d+$/, '') ||
    'host.visualdesignmoz.com';
  const port = process.env.NEXT_PUBLIC_DIRECTADMIN_PORT || '2026';
  const protocol = process.env.NEXT_PUBLIC_DIRECTADMIN_PROTOCOL || 'https';
  return `${protocol}://${host}:${port}`;
}

/** Gestor web para uploads grandes (FileGator, chunked até 2 GB). Login = user + password DirectAdmin. */
export function getWebFileManagerUrl(): string {
  const base =
    process.env.NEXT_PUBLIC_WEB_FILE_MANAGER_URL ||
    process.env.NEXT_PUBLIC_DIRECTADMIN_HOST ||
    'https://host.visualdesignmoz.com';
  return `${base.replace(/\/$/, '')}/files/dist/`;
}

export function getDirectAdminFileManagerUrl(_domain: string, _owner = 'admin'): string {
  return getWebFileManagerUrl();
}

export function getDirectAdminWordPressUrl(): string {
  return getWebmailUrl();
}

export function getServerHost(): string {
  const fromEnv = (process.env.NEXT_PUBLIC_SERVER_IP || '').trim();
  if (fromEnv) return fromEnv;
  // Sem IP no env, o default antigo era o Hetzner. Neste deploy Hestia/Contabo
  // isso apontava A/www para o servidor errado.
  if ((process.env.DEFAULT_HOSTING_PROVIDER || '').trim().toLowerCase() === 'hestia') {
    return '169.58.148.144';
  }
  return DEFAULT_SERVER_IP;
}

export function getCPHost(): string {
  return getServerHost();
}

export function getCPUrl(): string {
  return getWebmailUrl();
}

/** Login do painel Hestia (Contabo). Sem host configurado, não inventa um URL. */
export function getHestiaUrl(): string {
  const host = (process.env.HESTIA_HOST || process.env.NEXT_PUBLIC_HESTIA_HOST || '').trim();
  if (!host) return getWebmailUrl();
  const clean = host.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const port = (process.env.HESTIA_PORT || process.env.NEXT_PUBLIC_HESTIA_PORT || '8083').trim();
  return `https://${clean}:${port}`;
}

/** URL público do Roundcube: https://{domínio}/webmail — o subdomínio
 * webmail.{domínio} não tem registo DNS nos domínios geridos pela Cloudflare
 * (confirmado: nem visualdesignmoz.com nem provisualcorporate.co.mz o têm);
 * /webmail é o alias que o Apache do DirectAdmin já serve em qualquer
 * domínio (ver Alias /webmail em httpd-alias.conf no servidor). */
export function getWebmailUrlForDomain(domain?: string): string {
  const clean = domain?.replace(/^www\./i, '').trim();
  if (clean) return `https://${clean}/webmail`;
  return getWebmailUrl();
}

export function getSnappyMailUrl(domain?: string): string {
  return getWebmailUrlForDomain(domain);
}

export function getActivePanelUrl(): string {
  return getWebmailUrl();
}
