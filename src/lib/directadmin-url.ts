export const CANONICAL_DIRECTADMIN_HOST = 'host.visualdesignmoz.com';
export const CANONICAL_DIRECTADMIN_PORT = '2026';
export const DEFAULT_DIRECTADMIN_FALLBACK_PORT = '2222';

const LEGACY_DIRECTADMIN_HOSTS = new Set([
  '109.199.104.22',
  'visualdesigne.com',
  'host.visualdesigne.com',
  'painel.visualdesigne.com',
  'visualdesignmoz.com',
  'painel.visualdesignmoz.com',
]);

function cleanRawValue(value?: string) {
  if (!value) return '';
  return value.trim().replace(/^['"]|['"]$/g, '');
}

export function normalizeDirectAdminHost(rawHost?: string) {
  const cleaned = cleanRawValue(rawHost);
  if (!cleaned) return CANONICAL_DIRECTADMIN_HOST;

  let host = cleaned;
  if (/^https?:\/\//i.test(host)) {
    try {
      host = new URL(host).hostname;
    } catch {
      host = host.replace(/^https?:\/\//i, '');
    }
  }

  host = host
    .replace(/^host:/i, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '')
    .trim()
    .toLowerCase();

  if (!host || LEGACY_DIRECTADMIN_HOSTS.has(host)) {
    return CANONICAL_DIRECTADMIN_HOST;
  }

  return host;
}

export function normalizeDirectAdminPort(rawPort?: string) {
  const cleaned = cleanRawValue(rawPort).replace(/\D/g, '');
  if (!cleaned) return CANONICAL_DIRECTADMIN_PORT;
  if (cleaned === '2222' || cleaned === '26') return CANONICAL_DIRECTADMIN_PORT;
  return cleaned;
}

export function buildDirectAdminBase(input: {
  explicitUrl?: string;
  protocol?: string;
  host?: string;
  port?: string;
}) {
  const explicitUrl = cleanRawValue(input.explicitUrl);
  const fallbackProtocol = cleanRawValue(input.protocol) || 'https';

  if (explicitUrl) {
    try {
      const parsed = new URL(explicitUrl);
      const protocol = parsed.protocol || `${fallbackProtocol}:`;
      const host = normalizeDirectAdminHost(parsed.hostname);
      const port = normalizeDirectAdminPort(parsed.port);
      return `${protocol}//${host}:${port}`.replace(/\/$/, '');
    } catch {
      // Fall through and rebuild from separated parts.
    }
  }

  const protocol = fallbackProtocol.endsWith(':') ? fallbackProtocol : `${fallbackProtocol}:`;
  const host = normalizeDirectAdminHost(input.host);
  const port = normalizeDirectAdminPort(input.port);
  return `${protocol}//${host}:${port}`.replace(/\/$/, '');
}

export function buildDirectAdminPublicUrl(host?: string, port?: string) {
  const normalizedHost = normalizeDirectAdminHost(host);
  const normalizedPort = normalizeDirectAdminPort(port);
  return `https://${normalizedHost}:${normalizedPort}`;
}

export function buildDirectAdminFallbackUrl(host?: string, port?: string, protocol?: string) {
  const normalizedHost = cleanRawValue(host) || '109.199.104.22';
  const normalizedPort = cleanRawValue(port) || DEFAULT_DIRECTADMIN_FALLBACK_PORT;
  const normalizedProtocol = (cleanRawValue(protocol) || 'http').replace(/:$/, '');
  return `${normalizedProtocol}://${normalizedHost}:${normalizedPort}`;
}
