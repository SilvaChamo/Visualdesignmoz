import { NextResponse } from 'next/server';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';
import { getDaSyncAdmin } from '@/lib/da-sync-schema';
import { lerServidor } from '@/lib/vhost-servidor';
import { ligarPerfilPorEmail } from '@/lib/ligar-perfil-conta';

/**
 * Acesso de quem gere a uma conta de alojamento de um cliente (antes só em /api/vhost/cliente): o administrador vê
 * qualquer conta; o revendedor, só as contas dos seus clientes. Usado também ao "entrar como" uma conta no painel, para
 * as páginas por pessoa (Perfil, Mensagens, Suporte) mostrarem os dados do cliente e não os de quem tem a sessão.
 */
export const CONTA_OK = /^[a-z][a-z0-9_-]{2,30}$/;

export async function acessoConta(contaPedida: string) {
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return { erro: NextResponse.json({ erro: 'Sem permissão.' }, { status: auth.error.status }) };
  const sb = getDaSyncAdmin();
  if (!sb) return { erro: NextResponse.json({ erro: 'Registo do site indisponível.' }, { status: 503 }) };
  const admin = auth.user.role === 'admin';
  const conta = contaPedida.trim().toLowerCase();
  if (!CONTA_OK.test(conta)) return { erro: NextResponse.json({ erro: 'Conta inválida.' }, { status: 400 }) };
  const srv = await lerServidor();
  const x = srv.users[conta];
  if (!x) return { erro: NextResponse.json({ erro: 'Conta não encontrada no servidor.' }, { status: 404 }) };
  if ((x.ROLE || '').toLowerCase() === 'admin' && !admin) return { erro: NextResponse.json({ erro: 'Conta fora do seu painel.' }, { status: 403 }) };
  if (!admin) {
    const [{ data: perfil }, { data: registo }] = await Promise.all([
      sb.from('profiles').select('da_username').eq('user_id', auth.user.id).maybeSingle(),
      sb.from('panel_users').select('username, parent_username, auth_user_id'),
    ]);
    const eu = String(perfil?.da_username || (registo || []).find((r) => r.auth_user_id === auth.user.id)?.username || '').toLowerCase();
    const meus = new Set((registo || []).filter((r) => eu && String(r.parent_username || '').toLowerCase() === eu).map((r) => String(r.username).toLowerCase()));
    if (!eu || !meus.has(conta)) return { erro: NextResponse.json({ erro: 'Conta fora do seu painel.' }, { status: 403 }) };
  }
  return { sb, admin, conta, auth, srv };
}

/** Perfil do site ligado à conta: pelo registo (panel_users.auth_user_id) ou pelo nome da conta (profiles.da_username) */
export async function perfilDaConta(sb: NonNullable<ReturnType<typeof getDaSyncAdmin>>, conta: string) {
  const { data: pu } = await sb.from('panel_users').select('username, first_name, last_name, email, auth_user_id').eq('username', conta).maybeSingle();
  let uid = pu?.auth_user_id ? String(pu.auth_user_id) : '';
  const cols = 'id, user_id, name, email, telefone, empresa, morada, cidade, site, nuit, da_username';
  let perfil: Record<string, string | null> | null = null;
  if (uid) perfil = ((await sb.from('profiles').select(cols).eq('user_id', uid).maybeSingle()).data as Record<string, string | null> | null) || null;
  if (!perfil) {
    perfil = ((await sb.from('profiles').select(cols).eq('da_username', conta).maybeSingle()).data as Record<string, string | null> | null) || null;
    uid = perfil?.user_id ? String(perfil.user_id) : '';
  }
  // ainda sem perfil ligado: liga-se sozinha ao perfil com o mesmo e-mail (e relê-o)
  if (!uid && pu?.email) {
    const ligado = await ligarPerfilPorEmail(sb, conta, pu.email as string);
    if (ligado) {
      uid = ligado;
      perfil = ((await sb.from('profiles').select(cols).eq('user_id', uid).maybeSingle()).data as Record<string, string | null> | null) || null;
    }
  }
  return { pu, perfil, uid };
}

/** Ao "entrar como": o utilizador do site dono da conta pedida ('' se a conta não tem perfil ligado) */
type Sb = NonNullable<ReturnType<typeof getDaSyncAdmin>>;
export async function donoDaConta(
  contaPedida: string,
): Promise<{ erro: NextResponse } | { sb: Sb; conta: string; uid: string; perfil: Record<string, string | null> | null }> {
  const c = await acessoConta(contaPedida);
  if (c.erro || !c.sb || !c.conta) return { erro: c.erro || NextResponse.json({ erro: 'Sem permissão.' }, { status: 403 }) };
  const { perfil, uid } = await perfilDaConta(c.sb, c.conta);
  return { sb: c.sb, conta: c.conta, uid, perfil };
}
