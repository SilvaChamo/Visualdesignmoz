export const GENERAL_INACTIVITY_MS = 30 * 60 * 1000
/** Painel: só deslogar após 30 min sem actividade real */
export const PANEL_INACTIVITY_MS = 30 * 60 * 1000

export const LAST_ACTIVITY_STORAGE_KEY = 'vd_panel_last_activity_at'

const PANEL_ROUTE_PREFIXES = ['/vhost:2026', '/vhost', '/dashboard', '/cliente', '/revendedor'] as const

export function isPanelRoute(pathname: string): boolean {
  return PANEL_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

export function touchPanelActivity(): void {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(Date.now()))
}

export function getIdleMs(): number {
  if (typeof window === 'undefined') return 0
  const raw = sessionStorage.getItem(LAST_ACTIVITY_STORAGE_KEY)
  if (!raw) {
    touchPanelActivity()
    return 0
  }
  return Date.now() - Number(raw)
}

/** Terminar a sessão por inactividade (site: 30 min; painel /vhost:2026: 20 min). Esteve desligado desde 13/10/2026 enquanto se
 *  corrigia o login; religado a 24/10/2026, a pedido do Silva. No painel volta à entrada do próprio painel (VisualHostApp). */
export const SAIR_POR_INATIVIDADE_ATIVO = true

export function isIdleBeyond(limitMs: number): boolean {
  if (!SAIR_POR_INATIVIDADE_ATIVO) return false
  return getIdleMs() >= limitMs
}

export function clearPanelActivity(): void {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(LAST_ACTIVITY_STORAGE_KEY)
}

export function getInactivityConfig(pathname: string) {
  const isPanel = isPanelRoute(pathname)
  return {
    limitMs: isPanel ? PANEL_INACTIVITY_MS : GENERAL_INACTIVITY_MS,
    minutes: isPanel ? 30 : 30,
    reason: isPanel ? 'panel_inactivity' : 'inactivity',
  } as const
}
