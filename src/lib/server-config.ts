export const DEFAULT_SERVER_IP = '109.199.104.22';

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

/** Redireciona para o login do DirectAdmin (com fallback automático). */
export function getDirectAdminAccessUrl(): string {
  return '/api/directadmin-access';
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
  return process.env.NEXT_PUBLIC_SERVER_IP || DEFAULT_SERVER_IP;
}

export function getCPHost(): string {
  return getServerHost();
}

export function getCPUrl(): string {
  return getWebmailUrl();
}

export function getHestiaUrl(): string {
  return getWebmailUrl();
}

/** URL público do Roundcube: https://webmail.{domínio} */
export function getWebmailUrlForDomain(domain?: string): string {
  const clean = domain?.replace(/^www\./i, '').trim();
  if (clean) return `https://webmail.${clean}`;
  return getWebmailUrl();
}

export function getSnappyMailUrl(domain?: string): string {
  return getWebmailUrlForDomain(domain);
}

export function getActivePanelUrl(): string {
  return getWebmailUrl();
}
