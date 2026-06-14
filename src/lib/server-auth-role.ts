import type { User } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getProfileForAuthUser } from '@/lib/profile-db';
import { resolveUserRole, type UserRole } from '@/lib/user-roles';

/** Resolve papel efectivo no servidor (Auth metadata + tabela profiles). */
export async function resolveRoleForAuthUser(
  db: SupabaseClient,
  user: User,
): Promise<UserRole> {
  const profile = await getProfileForAuthUser(db, user.id);
  return resolveUserRole({
    email: user.email,
    userMetadata: user.user_metadata as Record<string, unknown>,
    appMetadata: user.app_metadata as Record<string, unknown>,
    profileRole: profile?.role ?? null,
    daUsername: profile?.da_username ?? null,
  });
}
