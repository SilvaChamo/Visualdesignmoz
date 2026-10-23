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
  created_at?: string | null;
};

// reseller_tier fica de fora aqui de propósito: a coluna profiles.reseller_tier
// nunca chegou a existir a sério na base de dados real (a migração em
// da-sync-schema.ts que devia tê-la criado não foi aplicada) — seleccioná-la
// ou escrevê-la rebentava qualquer chamada a este ficheiro com
// "column profiles.reseller_tier does not exist". A fonte real para o tier
// de revenda é panel_auth_accounts.reseller_tier (essa existe), usada em
// panel-reseller-tier.ts.
const PROFILE_COLUMNS =
  'id, user_id, email, role, name, da_username, da_password_encrypted, da_domain, da_provisioned_at, created_at';

/** Campos WHOIS obrigatórios antes de deixar comprar um domínio (ver dynadot-adapter.ts). */
const WHOIS_REQUIRED_FIELDS = ['telefone', 'morada', 'cidade'] as const;

/** Confirma que o perfil tem os dados mínimos para um registo WHOIS real (não genérico). */
export async function isProfileWhoisComplete(admin: SupabaseClient, authUserId: string): Promise<boolean> {
  const { data } = await admin
    .from('profiles')
    .select('telefone, morada, cidade')
    .or(profileAuthOrFilter(authUserId))
    .maybeSingle();
  // O telefone também pode estar só nos dados da conta (user_metadata): conta como preenchido (Silva, 23/10/2026: os dados do perfil valem em todo o sistema)
  const { data: conta } = await admin.auth.admin.getUserById(authUserId);
  const telefoneConta = String(conta?.user?.user_metadata?.telefone || '').trim();
  const linha = { ...((data || {}) as Record<string, unknown>) };
  if (!String(linha.telefone || '').trim() && telefoneConta) linha.telefone = telefoneConta;
  if (!data && !telefoneConta) return false;
  return WHOIS_REQUIRED_FIELDS.every((f) => {
    const value = linha[f];
    return typeof value === 'string' && value.trim().length > 0;
  });
}

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
  // #27: normaliza aqui para a procura por email nunca falhar por causa de
  // maiúsculas/espaços que um chamador tenha deixado passar (o insert que
  // criou a linha original também normaliza, mas não é garantido que todos
  // os chamadores façam o mesmo antes de aqui chegar).
  const normalizedEmail = email ? email.toLowerCase().trim() : email;
  const { data: byUserIdRows, error: byUserIdError } = await admin
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('user_id', authUserId);
  // Um erro aqui (ex.: falha de rede) não pode ser tratado como "não existe" —
  // isso levava o chamador a este INSERT em vez de UPDATE, duplicando o perfil
  // do utilizador (visto em produção: mesma conta com 2 linhas em profiles).
  if (byUserIdError) throw toProfileDbError('profiles.select (user_id)', byUserIdError);
  if (byUserIdRows && byUserIdRows.length > 0) {
    if (byUserIdRows.length === 1) return byUserIdRows[0] as ProfileRow;
    // Duplicado pré-existente (ver comentário acima) — não escolher ao acaso.
    // A linha "real" é a que tem dados de hospedagem; entre iguais, a mais antiga.
    const sorted = [...byUserIdRows].sort((a, b) => {
      const aHas = a.da_username ? 1 : 0;
      const bHas = b.da_username ? 1 : 0;
      if (aHas !== bHas) return bHas - aHas;
      return String(a.created_at || '').localeCompare(String(b.created_at || ''));
    });
    return sorted[0] as ProfileRow;
  }

  const { data: byId } = await admin
    .from('profiles')
    .select(PROFILE_COLUMNS)
    .eq('id', authUserId)
    .maybeSingle();
  if (byId) return byId as ProfileRow;

  // Fallback: perfis antigos/duplicados podem ter user_id/id desalinhados com o auth.users
  // actual — sem isto, o insert seguinte viola profiles_email_key em vez de actualizar a linha certa.
  if (normalizedEmail) {
    const { data: byEmail } = await admin
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('email', normalizedEmail)
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
    telefone?: string | null;
    empresa?: string | null;
    morada?: string | null;
    cidade?: string | null;
  },
): Promise<void> {
  const displayName = fields.name ?? fields.nome ?? undefined;
  const normalizedEmail = fields.email !== undefined ? fields.email.toLowerCase().trim() : undefined;
  const existing = await getProfileForAuthUser(admin, authUserId, normalizedEmail);
  const payload: Record<string, unknown> = { user_id: authUserId };

  if (normalizedEmail !== undefined) payload.email = normalizedEmail;
  if (fields.role !== undefined) payload.role = fields.role;
  if (displayName !== undefined) payload.name = displayName || fields.email?.split('@')[0] || null;
  if (fields.da_username !== undefined) payload.da_username = fields.da_username;
  if (fields.da_password_encrypted !== undefined) {
    payload.da_password_encrypted = fields.da_password_encrypted;
  }
  if (fields.da_domain !== undefined) payload.da_domain = fields.da_domain;
  if (fields.da_provisioned_at !== undefined) payload.da_provisioned_at = fields.da_provisioned_at;
  // reseller_tier NÃO vai para profiles — ver comentário em PROFILE_COLUMNS,
  // a coluna não existe na base de dados real. Quem chama isto continua a
  // poder passar o campo (não obriga a mexer nos chamadores), só que aqui
  // fica sem efeito; panel_auth_accounts.reseller_tier é que é gravado a
  // sério (ver upsertPanelAuthAccount).
  if (fields.telefone !== undefined) payload.telefone = fields.telefone;
  if (fields.empresa !== undefined) payload.empresa = fields.empresa;
  if (fields.morada !== undefined) payload.morada = fields.morada;
  if (fields.cidade !== undefined) payload.cidade = fields.cidade;

  if (existing?.id) {
    const { error } = await admin.from('profiles').update(payload).eq('id', existing.id);
    if (error) throw toProfileDbError('profiles.update', error);
    return;
  }

  const { error } = await admin.from('profiles').insert(payload);
  if (!error) return;

  // #27: se o chamador não tinha o email à mão para a procura acima (ou por
  // qualquer outra razão a linha existente não foi encontrada por user_id/id),
  // o insert acima colide com profiles_email_key em vez de rebentar em
  // silêncio — antes de desistir, tenta uma última vez actualizar a linha
  // real pelo email, que é exactamente a que a constraint está a apontar.
  if (error.code === '23505' && normalizedEmail) {
    const { data: byEmail } = await admin
      .from('profiles')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();
    if (byEmail?.id) {
      const { error: retryError } = await admin.from('profiles').update(payload).eq('id', byEmail.id);
      if (!retryError) return;
      throw toProfileDbError('profiles.update (retry)', retryError);
    }
  }

  throw toProfileDbError('profiles.insert', error);
}

/**
 * #16: PostgrestError é um objecto simples, não uma instância de Error — quem
 * apanha com `error instanceof Error` (padrão comum no projecto) descartava
 * sempre a mensagem real e mostrava um texto genérico. Normaliza aqui, na
 * origem, para todos os chamadores beneficiarem sem repetir isto em cada um.
 */
function toProfileDbError(context: string, error: { message?: string; code?: string; details?: string; hint?: string }): Error {
  const parts = [error.message, error.code && `code=${error.code}`, error.details, error.hint].filter(Boolean);
  return new Error(`${context}: ${parts.join(' | ') || 'erro desconhecido'}`);
}
