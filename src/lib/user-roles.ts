export type UserRole = 'admin' | 'reseller' | 'client' | 'guest';

/** Únicos emails com acesso administrativo total */
export const ADMIN_EMAILS = new Set([
  'silva.chamo@gmail.com',
  'silva.chamo@visualdesignmoz.com',
  'admin@visualdesignmoz.com',
]);

type RoleSource = {
  email?: string | null;
  userMetadata?: Record<string, unknown> | null;
  appMetadata?: Record<string, unknown> | null;
  profileRole?: string | null;
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

  if (ADMIN_EMAILS.has(email)) return 'admin';

  const metaRole = readRole(source.userMetadata?.role) ?? readRole(source.appMetadata?.role);
  if (metaRole === 'admin') return 'admin';
  if (metaRole === 'reseller') return 'reseller';

  const profileRole = readRole(source.profileRole);
  if (profileRole === 'admin') return 'admin';
  if (profileRole === 'reseller') return 'reseller';
  if (profileRole === 'client') return 'client';
  if (profileRole === 'guest') return 'guest';

  if (metaRole === 'client') return 'client';
  if (metaRole === 'guest') return 'guest';

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
