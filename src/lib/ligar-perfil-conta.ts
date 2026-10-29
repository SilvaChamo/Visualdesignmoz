import type { getDaSyncAdmin } from '@/lib/da-sync-schema';

type Sb = NonNullable<ReturnType<typeof getDaSyncAdmin>>;

/**
 * Liga sozinho a conta de alojamento ao perfil do site que tem o mesmo e-mail (Silva, 29/10/2026: nada de ligar contas à mão).
 * Só liga quando é seguro: o e-mail pertence a um único perfil, esse perfil ainda não tem conta ligada e a conta ainda
 * não tem perfil. Devolve o utilizador do site ligado, ou null se não ligou.
 */
export async function ligarPerfilPorEmail(sb: Sb, conta: string, email: string | null | undefined): Promise<string | null> {
  const e = String(email || '').trim().toLowerCase();
  if (!e.includes('@')) return null;
  const { data: perfis } = await sb
    .from('profiles')
    .select('id, user_id, da_username')
    .ilike('email', e.replace(/[\\%_]/g, (c) => '\\' + c))
    .limit(3);
  const candidatos = (perfis || []).filter((p) => !String(p.da_username || '').trim());
  if (candidatos.length !== 1 || (perfis || []).length !== 1) return null;
  const perfil = candidatos[0];
  const uid = String(perfil.user_id || perfil.id || '');
  if (!uid) return null;
  const { data: jaTem } = await sb.from('panel_users').select('username').eq('auth_user_id', uid).limit(1);
  if (jaTem?.length) return null;
  const { error } = await sb.from('panel_users').update({ auth_user_id: uid }).eq('username', conta).is('auth_user_id', null);
  if (error) return null;
  await sb.from('profiles').update({ da_username: conta }).eq(perfil.user_id ? 'user_id' : 'id', uid);
  return uid;
}
