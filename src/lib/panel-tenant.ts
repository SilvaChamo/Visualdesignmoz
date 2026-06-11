/**
 * Identificador do painel/marca desta instalação (Visual Design, AAMIHE, Entrecampos, …).
 * Cada deploy tem o seu slug — contas só aparecem no painel correspondente.
 */
export const PANEL_SLUG = (
  process.env.PANEL_SLUG ||
  process.env.NEXT_PUBLIC_PANEL_SLUG ||
  'visualdesign'
).toLowerCase().trim();

export function resolveAccountPanelSite(source: {
  userMetadata?: Record<string, unknown> | null;
  profilePanelSite?: string | null;
}): string {
  const fromProfile = (source.profilePanelSite || '').toLowerCase().trim();
  if (fromProfile) return fromProfile;

  const fromMeta = source.userMetadata?.site;
  if (typeof fromMeta === 'string' && fromMeta.trim()) {
    return fromMeta.toLowerCase().trim();
  }

  // Legado: contas sem site pertencem ao painel Visual Design
  return 'visualdesign';
}

export function belongsToCurrentPanel(panelSite: string): boolean {
  return panelSite === PANEL_SLUG;
}

export function userBelongsToCurrentPanel(user: {
  user_metadata?: Record<string, unknown> | null;
}): boolean {
  return belongsToCurrentPanel(
    resolveAccountPanelSite({ userMetadata: user.user_metadata }),
  );
}
