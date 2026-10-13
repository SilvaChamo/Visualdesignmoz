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
   * pagar por M-Pesa/Transferência mas cuja promoção de guest
   * (`promoteBuyerAfterPurchase`) ainda não ficou reflectida (atraso de
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

/**
 * Painel de quem compra a si próprio, pelo plano (pedido do Silva, 12/10/2026 — corrige a regra de 8 out "com site =
 * Profissional"): os planos de alojamento Pro, Business e Enterprise dão o painel Profissional; o plano Básico, os
 * planos de e-mail e os domínios ficam no painel Cliente. Cada conta vê os limites do seu plano.
 */
const PROFISSIONAL_HOSTING_PLANS = new Set(['hosting-pro', 'hosting-business', 'hosting-enterprise']);
const PROFISSIONAL_PACKAGES = new Set(['vd-host-pro', 'vd-host-business', 'vd-host-enterprise']);
const CLIENT_PACKAGES = new Set(['vd-host-basico', 'vd-email-basico', 'vd-email-premium', 'vd-email-enterprise']);

/** Plano do carrinho (`hosting-pro`, …) que dá o painel Profissional. */
export function isProfissionalHostingPlan(planId: string | null | undefined): boolean {
  return PROFISSIONAL_HOSTING_PLANS.has(String(planId || '').trim().toLowerCase());
}

/** Papel de comprador pelo pacote do servidor (VD-Host-*, VD-Email-*); null para pacotes fora dos planos. */
export function buyerRoleForPackage(packageName: string | null | undefined): 'profissional' | 'client' | null {
  const key = String(packageName || '').trim().toLowerCase();
  if (PROFISSIONAL_PACKAGES.has(key)) return 'profissional';
  if (CLIENT_PACKAGES.has(key)) return 'client';
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
  // O perfil manda: corrigir uma conta para "client" no perfil tem de chegar, mesmo que o user_metadata (editável
  // pelo próprio) ainda diga "profissional".
  if (profileRole === 'profissional' || profileRole === 'client') return profileRole;
  if (!profileRole && (metaRole === 'profissional' || metaRole === 'client')) return metaRole;

  // #7: tinha de vir antes do "if guest → guest" abaixo — senão uma conta
  // marcada guest com compras confirmadas (hasPaidProducts) nunca chegava a
  // ser avaliada, ficava sempre presa em guest. É precisamente o mecanismo
  // que o botão de sincronizar utilizadores usa para reparar essas contas.
  // Só para contas antigas sem papel gravado: as compras novas gravam já o
  // papel certo pelo plano (promoteBuyerAfterPurchase), que é lido acima antes
  // de chegar aqui. Sem saber o plano, fica no painel Cliente — o Profissional
  // só com plano Pro/Business/Enterprise (antes uma conta só de e-mail caía aqui
  // em 'profissional').
  if (source.hasPaidProducts) return 'client';

  // Mesma lógica do #7 acima, mas para uma encomenda ainda pendente muito
  // recente — sem isto, uma conta cuja promoção de guest ainda não
  // propagou (ou falhou em silêncio, ver checkout-fulfillment.ts) é mandada
  // para /guest logo depois de pagar, sem nenhum sítio para anexar o
  // comprovativo. A janela curta (RECENT_PENDING_SESSION_WINDOW_MS) evita
  // que isto sirva de acesso permanente — só cobre o momento do checkout.
  if (source.hasRecentPendingSession) return 'client';

  if (profileRole === 'guest' || metaRole === 'guest') return 'guest';

  // Sem compras e sem role → visitante registado
  return 'guest';
}

/** Painel de cada papel antes do VisualHost (continuam a funcionar nestes endereços; não são o destino por defeito). */
export function getLegacyPanelPathForRole(role: UserRole): string {
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

/** Destino depois de entrar: o painel VisualHost (/vhost) para todas as contas com painel (decisão do Silva,
 *  10/10/2026 — "faça este painel o principal substituindo o antigo"); só os visitantes sem conta de alojamento
 *  continuam no /guest. */
export function getRedirectPathForRole(role: UserRole): string {
  return role === 'guest' ? '/guest' : '/host:2026';
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
