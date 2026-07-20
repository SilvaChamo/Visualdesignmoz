import type { SupabaseClient } from '@supabase/supabase-js';

export type ProfileRow = {
  id?: string;
  user_id?: string | null;
  email?: string | null;
  role?: string | null;
  name?: string | null;
  da_username?: string | null;
  da_password_encrypted?: string | null;
  da_domain?: string | null;
  da_provisioned_at?: string | null;
  reseller_tier?: string | null;
};

const PROFILE_COLUMNS =
  'id, user_id, email, role, name, da_username, da_password_encrypted, da_domain, da_provisioned_at, reseller_tier';

/** Filtro PostgREST para perfil ligado ao Auth (suporta `user_id` e legado `id`). */
export function profileAuthOrFilter(authUserId: string): string {
  return `user_id.eq.${authUserId},id.eq.${authUserId}`;
}

/** Nome legível — aceita `name` (Supabase) ou `nome` legado em metadata/UI. */
export function profileName(
  profile?: { name?: string | null; nome?: string | null } | null,
  fallback = '',
): string {
  return (profile?.name as string) || (profile?.nome as string) || fallback;
}

export async function getProfileForAuthUser(
  admin: SupabaseClient,
  authUserId: string,
  email?: string | null,
): Promise<ProfileRow | null> {
  const { data: byUserId } = await admin
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('user_id', authUserId)
    .maybeSingle();
  if (byUserId) return byUserId as ProfileRow;

  const { data: byId } = await admin
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', authUserId)
    .maybeSingle();
  if (byId) return byId as ProfileRow;

  // Fallback: perfis antigos/duplicados podem ter user_id/id desalinhados com o auth.users
  // actual — sem isto, o insert seguinte viola profiles_email_key em vez de actualizar a linha certa.
  if (email) {
    const { data: byEmail } = await admin
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('email', email)
      .maybeSingle();
    if (byEmail) return byEmail as ProfileRow;
  }

  return null;
}

export async function saveProfileForAuthUser(
  admin: SupabaseClient,
  authUserId: string,
  fields: {
    email?: string;
    role?: string;
    name?: string | null;
    /** Alias legado — grava em `name`. */
    nome?: string | null;
    da_username?: string | null;
    da_password_encrypted?: string | null;
    da_domain?: string | null;
    da_provisioned_at?: string | null;
    reseller_tier?: string | null;
  },
): Promise<void> {
  const displayName = fields.name ?? fields.nome ?? undefined;
  const existing = await getProfileForAuthUser(admin, authUserId, fields.email);
  const payload: Record<string, unknown> = { user_id: authUserId };

  if (fields.email !== undefined) payload.email = fields.email;
  if (fields.role !== undefined) payload.role = fields.role;
  if (displayName !== undefined) payload.name = displayName || fields.email?.split('@')[0] || null;
  if (fields.da_username !== undefined) payload.da_username = fields.da_username;
  if (fields.da_password_encrypted !== undefined) {
    payload.da_password_encrypted = fields.da_password_encrypted;
  }
  if (fields.da_domain !== undefined) payload.da_domain = fields.da_domain;
  if (fields.da_provisioned_at !== undefined) payload.da_provisioned_at = fields.da_provisioned_at;
  if (fields.reseller_tier !== undefined) payload.reseller_tier = fields.reseller_tier;

  if (existing?.id) {
    const { error } = await admin.from('profiles').update(payload).eq('id', existing.id);
    if (error) throw error;
    return;
  }

  const { error } = await admin.from('profiles').insert(payload);
  if (error) throw error;
}
