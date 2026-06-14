/**
 * Identificador do painel/marca desta instalação (Visual Design, AAMIHE, Entrecampos, …).
 * Cada deploy tem o seu slug — contas só aparecem no painel correspondente.
 */
export const PANEL_SLUG = (
  process.env.PANEL_SLUG ||
  process.env.NEXT_PUBLIC_PANEL_SLUG ||
  'visualdesign'
).toLowerCase().trim();

/** Domínios de e-mail claramente ligados a outro painel/marca. */
const EMAIL_DOMAIN_PANEL: Record<string, string> = {
  'aamihe.com': 'aamihe',
  'entrecampos.co.mz': 'entrecampos',
};

export function inferPanelSiteFromEmail(email?: string | null): string | null {
  if (!email?.includes('@')) return null;
  const domain = email.split('@')[1]?.toLowerCase().trim();
  if (!domain) return null;
  return EMAIL_DOMAIN_PANEL[domain] ?? null;
}

export function resolveAccountPanelSite(source: {
  userMetadata?: Record<string, unknown> | null;
  profilePanelSite?: string | null;
  email?: string | null;
}): string {
  const fromProfile = (source.profilePanelSite || '').toLowerCase().trim();
  if (fromProfile) return fromProfile;

  const fromMeta = source.userMetadata?.site;
  if (typeof fromMeta === 'string' && fromMeta.trim()) {
    return fromMeta.toLowerCase().trim();
  }

  const fromEmail = inferPanelSiteFromEmail(source.email);
  if (fromEmail) return fromEmail;

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
