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

/** Email de bootstrap ou presente no registo de papéis de qualquer painel. */
export function isRegisteredPanelEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;
  if (ADMIN_BOOTSTRAP_EMAILS.has(normalized)) return true;
  return Object.values(REGISTRY_BY_PANEL).some(
    (r) => r.managers.has(normalized) || r.resellers.has(normalized) || r.clients.has(normalized),
  );
}

/** Papéis atribuídos automaticamente neste painel (nunca inclui admin). */
export function resolveRegistryPanelRole(source: PanelRoleSource): UserRole | null {
  const email = (source.email || '').toLowerCase().trim();
  const daUser = (source.daUsername || '').toLowerCase().trim();
  const registry = currentRegistry();

  // Ter um email @visualdesignmoz.com já não dá papel de gestor: qualquer pessoa
  // podia registar-se com um endereço desses (o registo não confirma o email) e
  // entrar como gestor. Os gestores reais estão na lista acima ou têm o papel no
  // app_metadata/perfil.
  if (email && registry.managers.has(email)) return 'manager';
  if (email && registry.resellers.has(email)) return 'reseller';
  if (daUser && registry.resellerDaUsernames.has(daUser)) return 'reseller';
  if (email && registry.clients.has(email)) return 'client';

  return null;
}
