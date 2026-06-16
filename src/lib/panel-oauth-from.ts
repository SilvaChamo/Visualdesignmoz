import { PUBLIC_PANEL_ENTRY } from '@/lib/panel-origin'

export const PANEL_FROM_COOKIE = 'vd_panel_from'

/** Guardar destino pós-login (sempre /painel). */
export function setPanelFromCookie(): void {
  if (typeof document === 'undefined') return
  const value = encodeURIComponent(PUBLIC_PANEL_ENTRY)
  const secure = window.location.protocol === 'https:'
  document.cookie = `${PANEL_FROM_COOKIE}=${value}; path=/; max-age=600; SameSite=Lax${
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
