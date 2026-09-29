import {
  ADMIN_BOOTSTRAP_EMAILS,
  resolveRegistryPanelRole,
} from '@/lib/panel-user-registry';

export type UserRole = 'admin' | 'manager' | 'reseller' | 'profissional' | 'client' | 'guest';

/** Emails com acesso bootstrap ao painel admin (não promovem papel na listagem). */
export const ADMIN_EMAILS = ADMIN_BOOTSTRAP_EMAILS;

type RoleSource = {
  email?: string | null;
  userMetadata?: Record<string, unknown> | null;
  appMetadata?: Record<string, unknown> | null;
  profileRole?: string | null;
  daUsername?: string | null;
  hasPaidProducts?: boolean;
  /** Tem uma checkout_sessions própria com status='pending' criada há pouco
   * (ver `RECENT_PENDING_SESSION_WINDOW_MS`) — cobre o cliente que acabou de
   * pagar por M-Pesa/Transferência mas cuja promoção guest→profissional
   * (`promoteGuestToProfissional`) ainda não ficou reflectida (atraso de
   * propagação, ou falhou em silêncio) no momento em que o papel é
   * recalculado a seguir ao pagamento. */
  hasRecentPendingSession?: boolean;
};

/** Janela de tolerância do fallback acima — suficiente para cobrir o passo
 * de anexar o comprovativo no checkout, nunca deve ser usada para decidir
 * acesso passadas essas primeiras compras. */
export const RECENT_PENDING_SESSION_WINDOW_MS = 5 * 60 * 1000;

function readRole(value: unknown): UserRole | null {
  if (
    value === 'admin' ||
    value === 'manager' ||
    value === 'reseller' ||
    value === 'profissional' ||
    value === 'client' ||
    value === 'guest'
  ) {
    return value;
  }
  return null;
}

/** Resolve o papel efectivo do utilizador */
export function resolveUserRole(source: RoleSource): UserRole {
  const email = (source.email || '').toLowerCase();

  // Emails de bootstrap (donos/operadores do painel) são sempre admin — evita que
  // a conta caia em "cliente"/"guest" no pós-login e só chegue ao admin ao
  // navegar manualmente para /dashboard (que já reconhecia este mesmo email).
  if (email && ADMIN_BOOTSTRAP_EMAILS.has(email)) return 'admin';

  // O user_metadata é editável pelo próprio utilizador (supabase.auth.updateUser), por
  // isso nunca pode dar papéis de staff: admin/manager/reseller só vêm do app_metadata
  // (escrito só pelo servidor), do perfil (a coluna role deixou de ser editável pelo
  // próprio — RLS de 29 set) ou do registo. Para os restantes papéis continua a contar.
  const appMetaRole = readRole(source.appMetadata?.role);
  const metaRole = readRole(source.userMetadata?.role) ?? appMetaRole;
  const profileRole = readRole(source.profileRole);

  if (profileRole === 'admin' || appMetaRole === 'admin') return 'admin';
  if (profileRole === 'manager' || appMetaRole === 'manager') return 'manager';

  const registryRole = resolveRegistryPanelRole({
    email,
    daUsername: source.daUsername,
  });
  if (registryRole) return registryRole;

  if (profileRole === 'reseller' || appMetaRole === 'reseller') return 'reseller';
  if (profileRole === 'profissional' || metaRole === 'profissional') return 'profissional';
  if (profileRole === 'client' || metaRole === 'client') return 'client';

  // #7: tinha de vir antes do "if guest → guest" abaixo — senão uma conta
  // marcada guest com compras confirmadas (hasPaidProducts) nunca chegava a
  // ser avaliada, ficava sempre presa em guest. É precisamente o mecanismo
  // que o botão de sincronizar utilizadores usa para reparar essas contas.
  // Devolve 'profissional' (não 'client') — quem compra a si próprio no
  // checkout vai para o painel Profissional (ver checkout-fulfillment.ts,
  // promoteGuestToProfissional); '/cliente' fica reservado a contas geridas
  // directamente pela VisualDesign.
  if (source.hasPaidProducts) return 'profissional';

  // Mesma lógica do #7 acima, mas para uma encomenda ainda pendente muito
  // recente — sem isto, uma conta cuja promoção guest→profissional ainda não
  // propagou (ou falhou em silêncio, ver checkout-fulfillment.ts) é mandada
  // para /guest logo depois de pagar, sem nenhum sítio para anexar o
  // comprovativo. A janela curta (RECENT_PENDING_SESSION_WINDOW_MS) evita
  // que isto sirva de acesso permanente — só cobre o momento do checkout.
  if (source.hasRecentPendingSession) return 'profissional';

  if (profileRole === 'guest' || metaRole === 'guest') return 'guest';

  // Sem compras e sem role → visitante registado
  return 'guest';
}

export function getRedirectPathForRole(role: UserRole): string {
  switch (role) {
    case 'admin':
    case 'manager':
      return '/dashboard';
    case 'reseller':
      return '/revendedor';
    case 'profissional':
      return '/profissional';
    case 'client':
      return '/cliente';
    case 'guest':
    default:
      return '/guest';
  }
}

export function isPanelRole(role: UserRole): boolean {
  return (
    role === 'admin' ||
    role === 'manager' ||
    role === 'reseller' ||
    role === 'profissional' ||
    role === 'client'
  );
}
