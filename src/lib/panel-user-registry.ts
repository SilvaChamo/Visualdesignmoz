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
  managers: Set<string>;
  resellers: Set<string>;
  resellerDaUsernames: Set<string>;
  clients: Set<string>;
};

/** Registo automático por painel — separação total entre marcas. */
const REGISTRY_BY_PANEL: Record<string, PanelRegistry> = {
  visualdesign: {
    managers: new Set([
      'servidor@visualdesignmoz.com',
      'geral@visualdesignmoz.com',
      'admin@visualdesignmoz.com',
    ]),
    resellers: new Set(['osher@oshercollective.com']),
    resellerDaUsernames: new Set(['oshercollective']),
    clients: new Set(),
  },
  aamihe: {
    managers: new Set(),
    resellers: new Set(),
    resellerDaUsernames: new Set(),
    clients: new Set(['jtaimo55@gmail.com']),
  },
  entrecampos: {
    managers: new Set(),
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

/** DA username do revendedor registado neste painel (por email). */
export function resolveRegistryDaUsername(source: PanelRoleSource): string | null {
  const email = (source.email || '').toLowerCase().trim();
  if (!email) return null;
  const registry = currentRegistry();
  if (!registry.resellers.has(email)) return null;
  if (email === 'osher@oshercollective.com') return 'oshercollective';
  const daUser = (source.daUsername || '').toLowerCase().trim();
  if (daUser && registry.resellerDaUsernames.has(daUser)) return daUser;
  return [...registry.resellerDaUsernames][0] ?? null;
}

/** Papéis atribuídos automaticamente neste painel (nunca inclui admin). */
export function resolveRegistryPanelRole(source: PanelRoleSource): UserRole | null {
  const email = (source.email || '').toLowerCase().trim();
  const daUser = (source.daUsername || '').toLowerCase().trim();
  const registry = currentRegistry();

  if (email && registry.managers.has(email)) return 'manager';
  if (email && email.endsWith('@visualdesignmoz.com') && PANEL_SLUG === 'visualdesign') {
    return 'manager';
  }
  if (email && registry.resellers.has(email)) return 'reseller';
  if (daUser && registry.resellerDaUsernames.has(daUser)) return 'reseller';
  if (email && registry.clients.has(email)) return 'client';

  return null;
}
