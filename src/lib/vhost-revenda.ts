import type { getDaSyncAdmin } from '@/lib/da-sync-schema';

type Registo = NonNullable<ReturnType<typeof getDaSyncAdmin>>;

/**
 * Os clientes de um revendedor: as contas do servidor criadas por ele (panel_users.parent_username = a conta dele), com o login do site
 * de cada uma (auth_user_id) e o perfil (profiles.id, o `cliente_id` dos pedidos de suporte). A própria conta do revendedor fica de fora.
 * `eu` vazio = a conta do site ainda não está ligada a uma conta do servidor (nada se vê nem se faz).
 */
export async function clientesDaRevenda(sb: Registo, authUserId: string): Promise<{ eu: string; contas: string[]; authIds: string[]; perfilIds: string[] }> {
  const [{ data: perfil }, { data: registo }] = await Promise.all([
    sb.from('profiles').select('da_username').eq('user_id', authUserId).maybeSingle(),
    sb.from('panel_users').select('username, parent_username, auth_user_id'),
  ]);
  const eu = String(perfil?.da_username || (registo || []).find((r) => r.auth_user_id === authUserId)?.username || '').toLowerCase();
  if (!eu) return { eu: '', contas: [], authIds: [], perfilIds: [] };
  const meus = (registo || []).filter((r) => String(r.parent_username || '').toLowerCase() === eu && String(r.username).toLowerCase() !== eu);
  const contas = meus.map((r) => String(r.username).toLowerCase());
  const authIds = [...new Set(meus.map((r) => r.auth_user_id).filter(Boolean).map(String))];
  const [porConta, porLogin] = await Promise.all([
    contas.length ? sb.from('profiles').select('id, user_id').in('da_username', contas) : Promise.resolve({ data: [] as { id: string; user_id: string | null }[] }),
    authIds.length ? sb.from('profiles').select('id, user_id').in('user_id', authIds) : Promise.resolve({ data: [] as { id: string; user_id: string | null }[] }),
  ]);
  const perfis = [...(porConta.data || []), ...(porLogin.data || [])];
  return {
    eu,
    contas,
    // o login do site também vem do perfil de cada conta (nem todas têm auth_user_id em panel_users)
    authIds: [...new Set([...authIds, ...perfis.map((p) => p.user_id).filter(Boolean).map(String)])],
    perfilIds: [...new Set(perfis.map((p) => String(p.id)))],
  };
}
