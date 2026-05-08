
export const DEFAULT_SERVER_IP = '109.199.104.22';
export const DEFAULT_DIRECTADMIN_HOST = 'host.visualdesignmoz.com';
export const DIRECTADMIN_PORT = '2026';

/**
 * Gets the DirectAdmin URL.
 */
export function getDirectAdminUrl(): string {
  const host = process.env.NEXT_PUBLIC_DIRECTADMIN_HOST || DEFAULT_DIRECTADMIN_HOST;
  const port = process.env.NEXT_PUBLIC_DIRECTADMIN_PORT || DIRECTADMIN_PORT;
  return `https://${host}:${port}`;
}

/**
 * Gets the DirectAdmin native file manager URL.
 */
export function getDirectAdminFileManagerUrl(domain: string, owner = 'admin'): string {
  return getDirectAdminUrl();
}

/**
 * Gets the DirectAdmin WordPress manager URL.
 * Hosts usually expose either the WordPress plugin or Softaculous from here.
 */
export function getDirectAdminWordPressUrl(): string {
  return getDirectAdminUrl();
}

/**
 * Gets the Server host IP/URL.
 */
export function getServerHost(): string {
  return process.env.NEXT_PUBLIC_SERVER_IP || DEFAULT_SERVER_IP;
}

/**
 * Legacy helper kept for reseller/admin pages that still use CyberPanel naming.
 */
export function getCPHost(): string {
  return getServerHost();
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
 * Gets the SnappyMail URL.
 * Hestia typically uses /webmail/ or a subdomain.
 */
export function getSnappyMailUrl(domain?: string): string {
  const host = getServerHost();
  // Default to the new Hestia webmail if needed, or keep CyberPanel for now
  // Hestia default webmail is usually /webmail
  return `https://${host}/webmail/`;
}

// Helper for dynamic panel selection
export function getActivePanelUrl(): string {
  // For now, return Hestia since we are migrating
  return getHestiaUrl();
}
