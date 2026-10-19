import { cookies } from 'next/headers';
import type { User } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { resolveRoleForAuthUser } from '@/lib/server-auth-role';

/**
 * Impersonação de conta de cliente (painel /encomendas) — mesmo princípio da
 * impersonação de revendedor (`panel-api-context.ts`, cookie
 * `vd_impersonate_reseller`): a sessão Supabase do admin nunca é tocada, só
 * uma cookie diz "estou a ver como o cliente X". Rotas que hoje filtram por
 * `user.id` (ex.: GET /api/cotacoes) devem usar `resolveEffectiveClientUserId`
 * em vez do id da sessão real, só quando o chamador é mesmo admin — a
 * presença da cookie sozinha nunca é suficiente (podia ser uma cookie
 * antiga a sobreviver a um logout/login de outra conta no mesmo browser).
 */
export const IMPERSONATE_CLIENT_COOKIE = 'vd_impersonate_client';

const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 60 * 60 * 8,
};

export async function readImpersonateClientUserId(): Promise<string | null> {
  const store = await cookies();
  return store.get(IMPERSONATE_CLIENT_COOKIE)?.value?.trim() || null;
}

export async function setImpersonateClientCookie(userId: string): Promise<void> {
  const store = await cookies();
  store.set(IMPERSONATE_CLIENT_COOKIE, userId, COOKIE_OPTS);
}

export async function clearImpersonateClientCookie(): Promise<void> {
  const store = await cookies();
  store.delete(IMPERSONATE_CLIENT_COOKIE);
}

/** Id efectivo a usar em rotas que filtram "as minhas encomendas" — só troca para o impersonado se `isAdmin` for verdadeiro. */
export async function resolveEffectiveClientUserId(realUserId: string, isAdmin: boolean): Promise<string> {
  if (!isAdmin) return realUserId;
  const impersonated = await readImpersonateClientUserId();
  return impersonated || realUserId;
}

export type EffectiveClientUser = {
  /** Conta cujos dados o painel /cliente mostra. */
  user: User;
  /** Verdadeiro quando é um admin a ver/gerir a conta de um cliente. */
  impersonating: boolean;
};

/**
 * Utilizador "efectivo" das rotas do painel /cliente: o cliente impersonado
 * quando quem pede é mesmo admin e tem a cookie activa; senão, o próprio
 * utilizador da sessão. A cookie sozinha nunca chega — ver o topo do ficheiro.
 */
export async function resolveEffectiveClientUser(): Promise<EffectiveClientUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const impersonatedId = await readImpersonateClientUserId();
  if (!impersonatedId || impersonatedId === user.id) return { user, impersonating: false };

  const admin = getSupabaseAdmin();
  if (!admin || (await resolveRoleForAuthUser(admin, user)) !== 'admin') {
    return { user, impersonating: false };
  }
  const { data } = await admin.auth.admin.getUserById(impersonatedId);
  if (!data?.user) return { user, impersonating: false };
  return { user: data.user, impersonating: true };
}
