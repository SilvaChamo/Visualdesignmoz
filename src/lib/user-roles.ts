import {
  ADMIN_BOOTSTRAP_EMAILS,
  resolveRegistryPanelRole,
} from '@/lib/panel-user-registry';

export type UserRole = 'admin' | 'reseller' | 'client' | 'guest';

/** Emails com acesso bootstrap ao painel admin (não promovem papel na listagem). */
export const ADMIN_EMAILS = ADMIN_BOOTSTRAP_EMAILS;

type RoleSource = {
  email?: string | null;
  userMetadata?: Record<string, unknown> | null;
  appMetadata?: Record<string, unknown> | null;
  profileRole?: string | null;
  daUsername?: string | null;
  hasPaidProducts?: boolean;
};

function readRole(value: unknown): UserRole | null {
  if (value === 'admin' || value === 'reseller' || value === 'client' || value === 'guest') {
    return value;
  }
  return null;
}

/** Resolve o papel efectivo do utilizador */
export function resolveUserRole(source: RoleSource): UserRole {
  const email = (source.email || '').toLowerCase();

  const metaRole = readRole(source.userMetadata?.role) ?? readRole(source.appMetadata?.role);
  const profileRole = readRole(source.profileRole);

  // Admin só por promoção manual (perfil ou metadata), nunca por email fixo.
  if (profileRole === 'admin' || metaRole === 'admin') return 'admin';

  const registryRole = resolveRegistryPanelRole({
    email,
    daUsername: source.daUsername,
  });
  if (registryRole) return registryRole;

  if (profileRole === 'reseller' || metaRole === 'reseller') return 'reseller';
  if (profileRole === 'client' || metaRole === 'client') return 'client';
  if (profileRole === 'guest' || metaRole === 'guest') return 'guest';

  // Comprou algo mas ainda marcado como guest → promove a cliente
  if (source.hasPaidProducts) return 'client';

  // Sem compras e sem role → visitante registado
  return 'guest';
}

export function getRedirectPathForRole(role: UserRole): string {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'reseller':
      return '/revendedor';
    case 'client':
      return '/client';
    case 'guest':
    default:
      return '/guest';
  }
}

export function isPanelRole(role: UserRole): boolean {
  return role === 'admin' || role === 'reseller' || role === 'client';
}
