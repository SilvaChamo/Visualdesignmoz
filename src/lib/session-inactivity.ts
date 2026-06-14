export const GENERAL_INACTIVITY_MS = 30 * 60 * 1000
export const PANEL_INACTIVITY_MS = 30 * 60 * 1000

const PANEL_ROUTE_PREFIXES = ['/admin', '/client', '/revendedor'] as const

export function isPanelRoute(pathname: string): boolean {
  return PANEL_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  )
}

export function getInactivityConfig(pathname: string) {
  const isPanel = isPanelRoute(pathname)
  return {
    limitMs: isPanel ? PANEL_INACTIVITY_MS : GENERAL_INACTIVITY_MS,
    minutes: isPanel ? 30 : 30,
    reason: isPanel ? 'panel_inactivity' : 'inactivity',
  } as const
}
