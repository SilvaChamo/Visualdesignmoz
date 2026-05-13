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

/** Usar em links internos para redirecionar com `/api/webmail-redirect`. */
export function getDirectAdminAccessUrl(): string {
  return '/api/webmail-redirect';
}

export function getDirectAdminFileManagerUrl(_domain: string, _owner = 'admin'): string {
  return getWebmailUrl();
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

export function getSnappyMailUrl(_domain?: string): string {
  return `${getWebmailUrl()}/`;
}

export function getActivePanelUrl(): string {
  return getWebmailUrl();
}
