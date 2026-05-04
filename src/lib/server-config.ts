
export const DEFAULT_SERVER_IP = '109.199.104.22';
export const DIRECTADMIN_PORT = '2222';

/**
 * Gets the DirectAdmin URL.
 */
export function getDirectAdminUrl(): string {
  const host = process.env.DIRECTADMIN_HOST || DEFAULT_SERVER_IP;
  const port = process.env.DIRECTADMIN_PORT || DIRECTADMIN_PORT;
  return `https://${host}:${port}`;
}

/**
 * Gets the Server host IP/URL.
 */
export function getServerHost(): string {
  return process.env.NEXT_PUBLIC_SERVER_IP || DEFAULT_SERVER_IP;
}

/**
 * Gets the CyberPanel URL (legacy).
 */
export function getCPUrl(): string {
  const host = getServerHost();
  return `https://${host}:8090`;
}

/**
 * Gets the HestiaCP URL (new).
 */
export function getHestiaUrl(): string {
  const host = getServerHost();
  return `https://${host}:8083`;
}

/**
 * Gets the RoundCube webmail URL (DirectAdmin).
 * DirectAdmin uses RoundCube at mail.domain.com/roundcube or port 2096.
 */
export function getRoundCubeUrl(domain?: string): string {
  const host = domain ? `mail.${domain}` : `mail.visualdesigne.com`;
  return `https://${host}/roundcube/`;
}

/**
 * Gets the SSO URL for RoundCube — passes through the Next.js API
 * so logged-in admin users don't need to enter credentials.
 */
export function getRoundCubeSSOUrl(email?: string): string {
  if (email) {
    return `/api/roundcube-sso?email=${encodeURIComponent(email)}`;
  }
  return `/api/roundcube-sso`;
}

/**
 * @deprecated Use getRoundCubeUrl() instead.
 */
export function getSnappyMailUrl(domain?: string): string {
  return getRoundCubeUrl(domain);
}

/**
 * URL do painel de hosting mostrada no cabeçalho (admin/revenda).
 * `NEXT_PUBLIC_PRIMARY_PANEL`: `directadmin` (default) | `hestia` | `cyberpanel`
 */
export function getActivePanelUrl(): string {
  const panel = (process.env.NEXT_PUBLIC_PRIMARY_PANEL || 'directadmin').toLowerCase();
  if (panel === 'hestia') return getHestiaUrl();
  if (panel === 'cyberpanel') return getCPUrl();
  return getDirectAdminUrl();
}
