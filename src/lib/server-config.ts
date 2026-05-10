
import {
  buildDirectAdminFallbackUrl,
  buildDirectAdminPublicUrl,
  CANONICAL_DIRECTADMIN_HOST,
  CANONICAL_DIRECTADMIN_PORT,
  DEFAULT_DIRECTADMIN_FALLBACK_PORT,
} from '@/lib/directadmin-url';

export const DEFAULT_SERVER_IP = '109.199.104.22';
export const DEFAULT_DIRECTADMIN_HOST = CANONICAL_DIRECTADMIN_HOST;
export const DIRECTADMIN_PORT = CANONICAL_DIRECTADMIN_PORT;

/**
 * Gets the DirectAdmin URL.
 */
export function getDirectAdminUrl(): string {
  return buildDirectAdminPublicUrl(
    process.env.NEXT_PUBLIC_DIRECTADMIN_HOST || DEFAULT_DIRECTADMIN_HOST,
    process.env.NEXT_PUBLIC_DIRECTADMIN_PORT || DIRECTADMIN_PORT
  );
}

/**
 * URL pública de fallback para quando o host principal não responder.
 */
export function getDirectAdminFallbackUrl(): string {
  const host =
    process.env.NEXT_PUBLIC_DIRECTADMIN_FALLBACK_HOST ||
    process.env.DIRECTADMIN_FALLBACK_HOST ||
    process.env.NEXT_PUBLIC_SERVER_IP ||
    DEFAULT_SERVER_IP;
  const port =
    process.env.NEXT_PUBLIC_DIRECTADMIN_FALLBACK_PORT ||
    process.env.DIRECTADMIN_FALLBACK_PORT ||
    process.env.NEXT_PUBLIC_DIRECTADMIN_LEGACY_PORT ||
    DEFAULT_DIRECTADMIN_FALLBACK_PORT;
  const protocol =
    process.env.NEXT_PUBLIC_DIRECTADMIN_FALLBACK_PROTOCOL ||
    process.env.DIRECTADMIN_FALLBACK_PROTOCOL ||
    'http';
  return buildDirectAdminFallbackUrl(host, port, protocol);
}

/**
 * URL interna que decide automaticamente entre host principal e fallback IP.
 */
export function getDirectAdminAccessUrl(): string {
  return '/api/directadmin-access';
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
