export const PANEL_FROM_COOKIE = 'vd_panel_from'

/** Guardar destino pós-login. */
export function setPanelFromCookie(value: string): void {
  if (typeof document === 'undefined') return
  const secure = window.location.protocol === 'https:'
  document.cookie = `${PANEL_FROM_COOKIE}=${encodeURIComponent(value)}; path=/; max-age=600; SameSite=Lax${
    secure ? '; Secure' : ''
  }`
}

export function readPanelFromCookie(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null
  const parts = cookieHeader.split(';')
  for (const part of parts) {
    const [name, ...rest] = part.trim().split('=')
    if (name === PANEL_FROM_COOKIE && rest.length) {
      try {
        return decodeURIComponent(rest.join('='))
      } catch {
        return rest.join('=')
      }
    }
  }
  return null
}

export function clearPanelFromCookieHeader(): {
  name: string
  value: string
  options: { path: string; maxAge: number }
} {
  return {
    name: PANEL_FROM_COOKIE,
    value: '',
    options: { path: '/', maxAge: 0 },
  }
}
