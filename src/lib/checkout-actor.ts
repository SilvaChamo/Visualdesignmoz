import type { SupabaseClient, User } from '@supabase/supabase-js';
import { resolveRoleForAuthUser } from '@/lib/server-auth-role';
import { readImpersonateDaUsername } from '@/lib/panel-api-context';
import { readImpersonateClientUserId } from '@/lib/client-impersonation';

/**
 * Quem é, de facto, o comprador de um checkout.
 *
 * Quando um admin usa o "entrar como" (impersonar) um revendedor ou um
 * cliente, a sessão Supabase do browser continua a ser a do ADMIN — mas a
 * compra tem de correr como a conta impersonada: dono do domínio, contacto
 * WHOIS, saldo, faturação e notificações são todos da conta impersonada, não
 * do admin. Para qualquer outra pessoa (um cliente ou revendedor a comprar
 * na sua própria conta) `buyerUserId` é simplesmente o próprio utilizador e
 * nada muda.
 */
export type CheckoutActor = {
  realUserId: string;
  realEmail: string;
  buyerUserId: string;
  buyerEmail: string;
  impersonating: boolean;
  /** Rótulo da conta impersonada (username do revendedor ou email do cliente) — só para mostrar no painel. */
  impersonatedLabel: string | null;
};

async function resolveAuthUserForDaUsername(
  admin: SupabaseClient,
  daUsername: string,
): Promise<{ userId: string; email: string } | null> {
  const { data: profile } = await admin
    .from('profiles')
    .select('user_id, id, email')
    .ilike('da_username', daUsername)
    .maybeSingle();
  if (profile?.user_id) {
    return { userId: profile.user_id as string, email: String(profile.email || '').toLowerCase() };
  }

  const { data: panelUser } = await admin
    .from('panel_users')
    .select('auth_user_id, email')
    .eq('username', daUsername)
    .maybeSingle();
  if (panelUser?.auth_user_id) {
    return { userId: panelUser.auth_user_id as string, email: String(panelUser.email || '').toLowerCase() };
  }

  if (profile?.id) {
    return { userId: profile.id as string, email: String(profile.email || '').toLowerCase() };
  }
  return null;
}

/**
 * @param admin  cliente Supabase com service role (lê profiles/panel_users e o auth de outra conta).
 * @param user   utilizador real da sessão (de `supabase.auth.getUser()`).
 */
export async function resolveCheckoutActor(admin: SupabaseClient, user: User): Promise<CheckoutActor> {
  const base: CheckoutActor = {
    realUserId: user.id,
    realEmail: (user.email || '').toLowerCase(),
    buyerUserId: user.id,
    buyerEmail: (user.email || '').toLowerCase(),
    impersonating: false,
    impersonatedLabel: null,
  };

  // Só um admin consegue impersonar — a presença da cookie sozinha nunca
  // chega (podia ter sobrevivido a um logout/login de outra conta no mesmo
  // browser). Mesmo princípio de client-impersonation.ts.
  let role: string;
  try {
    role = await resolveRoleForAuthUser(admin, user);
  } catch {
    return base;
  }
  if (role !== 'admin') return base;

  // 1) Impersonação de revendedor — cookie guarda o username (DA/Hestia).
  const daUsername = (await readImpersonateDaUsername())?.trim().toLowerCase() || '';
  if (daUsername) {
    const resolved = await resolveAuthUserForDaUsername(admin, daUsername);
    if (resolved && resolved.userId && resolved.userId !== user.id) {
      return {
        ...base,
        buyerUserId: resolved.userId,
        buyerEmail: resolved.email || base.buyerEmail,
        impersonating: true,
        impersonatedLabel: daUsername,
      };
    }
  }

  // 2) Impersonação de cliente — cookie guarda directamente o auth user id.
  const clientUserId = (await readImpersonateClientUserId())?.trim() || '';
  if (clientUserId && clientUserId !== user.id) {
    const { data } = await admin.auth.admin.getUserById(clientUserId);
    const email = String(data?.user?.email || '').toLowerCase();
    return {
      ...base,
      buyerUserId: clientUserId,
      buyerEmail: email || base.buyerEmail,
      impersonating: true,
      impersonatedLabel: email || clientUserId,
    };
  }

  return base;
}
