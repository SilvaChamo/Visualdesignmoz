/** Host público visto pelo utilizador (Cloudflare Worker → Hetzner). */
export function getRequestHostname(
  headers: Headers,
  fallbackUrl?: string,
): string {
  const forwarded = headers.get('x-forwarded-host')
  if (forwarded) {
    return forwarded.split(',')[0].trim().split(':')[0].toLowerCase()
  }
  const host = headers.get('host')
  if (host) {
    return host.split(':')[0].toLowerCase()
  }
  if (fallbackUrl) {
    try {
      return new URL(fallbackUrl).hostname.toLowerCase()
    } catch {
      /* ignorar */
    }
  }
  return ''
}
