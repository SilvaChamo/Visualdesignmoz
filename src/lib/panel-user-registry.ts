import type { UserRole } from '@/lib/user-roles';
import { PANEL_SLUG } from '@/lib/panel-tenant';

/** Emails com acesso de bootstrap ao painel admin (API), sem promover papel automaticamente. */
export const ADMIN_BOOTSTRAP_EMAILS = new Set([
  'silva.chamo@gmail.com',
  'silva.chamo@visualdesignmoz.com',
  'admin@visualdesignmoz.com',
  'silvanochamo@gmail.com',
]);

type PanelRegistry = {
  resellers: Set<string>;
  resellerDaUsernames: Set<string>;
  clients: Set<string>;
};

/** Registo automático por painel — separação total entre marcas. */
const REGISTRY_BY_PANEL: Record<string, PanelRegistry> = {
  visualdesign: {
    resellers: new Set(['osher@oshercollective.com']),
    resellerDaUsernames: new Set(['oshercollective']),
    clients: new Set(),
  },
  aamihe: {
    resellers: new Set(),
    resellerDaUsernames: new Set(),
    clients: new Set(['jtaimo55@gmail.com']),
  },
  entrecampos: {
    resellers: new Set(),
    resellerDaUsernames: new Set(),
    clients: new Set(),
  },
};

function currentRegistry(): PanelRegistry {
  return REGISTRY_BY_PANEL[PANEL_SLUG] || REGISTRY_BY_PANEL.visualdesign;
}

export type PanelRoleSource = {
  email?: string | null;
  daUsername?: string | null;
};

/** Papéis atribuídos automaticamente neste painel (nunca inclui admin). */
export function resolveRegistryPanelRole(source: PanelRoleSource): UserRole | null {
  const email = (source.email || '').toLowerCase().trim();
  const daUser = (source.daUsername || '').toLowerCase().trim();
  const registry = currentRegistry();

  if (email && registry.resellers.has(email)) return 'reseller';
  if (daUser && registry.resellerDaUsernames.has(daUser)) return 'reseller';
  if (email && registry.clients.has(email)) return 'client';

  return null;
}
