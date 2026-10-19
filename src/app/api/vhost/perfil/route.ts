import { NextRequest, NextResponse } from 'next/server';
import { requirePanelBootstrapAccess } from '@/lib/panel-api-auth';
import { getDaSyncAdmin } from '@/lib/da-sync-schema';
import { acessoConta, donoDaConta, perfilDaConta } from '@/lib/vhost-conta-cliente';

export const dynamic = 'force-dynamic';

/**
 * /api/vhost/perfil — dados pessoais e preferências de avisos da pessoa com sessão (painel → Perfil).
 * GET                       dados do perfil (profiles) + datas da conta + avisos escolhidos
 * GET ?conta=               ao "entrar como" uma conta: dados do cliente dono dela (administrador ou revendedor)
 * POST { acao: 'dados', … } nome, telefone, empresa, morada, cidade, site, NUIT
 * POST { acao: 'avisos', limite, seguranca }
 * POST { acao: 'senha', nova } nova palavra-passe de entrada da pessoa com sessão, sem pedir a antiga (Silva, 16/10/2026:
 *                           o cliente pode esquecer a antiga e não conseguir trocar; a sessão aberta já o identifica)
 * POST com conta= só o administrador pode alterar dados pessoais, e-mail de entrada e palavra-passe da conta indicada.
 * As sessões mudam-se no navegador (Supabase Auth, com a sessão da pessoa).
 */
const CAMPOS = ['name', 'telefone', 'empresa', 'morada', 'cidade', 'site', 'nuit'] as const;

async function quem(conta?: string) {
  if (conta) {
    const alvo = await acessoConta(conta);
    if ('erro' in alvo) return { erro: alvo.erro };
    if (!alvo.admin) return { erro: NextResponse.json({ erro: 'Só o administrador pode alterar o perfil de outra conta.' }, { status: 403 }) };
    const { uid } = await perfilDaConta(alvo.sb, alvo.conta);
    if (!uid) return { erro: NextResponse.json({ erro: 'Ligue primeiro o perfil do site à conta.' }, { status: 409 }) };
    return { sb: alvo.sb, uid, email: '', admin: true };
  }
  const auth = await requirePanelBootstrapAccess();
  if ('error' in auth) return { erro: NextResponse.json({ erro: 'Inicie sessão no site.' }, { status: 401 }) };
  const sb = getDaSyncAdmin();
  if (!sb) return { erro: NextResponse.json({ erro: 'Registo do site indisponível.' }, { status: 503 }) };
  return { sb, uid: auth.user.id, email: auth.user.email, admin: auth.user.role === 'admin' };
}

export async function GET(req: NextRequest) {
  const conta = req.nextUrl.searchParams.get('conta');
  const q = conta ? await donoDaConta(conta) : await quem();
  if ('erro' in q) return q.erro;
  if (!q.uid) return NextResponse.json({ perfil: {}, email: '', criada: null, ultimaEntrada: null, avisos: { limite: true, seguranca: true }, semPerfil: true }, { headers: { 'Cache-Control': 'no-store' } });
  const [{ data: p }, { data: u }] = await Promise.all([
    q.sb.from('profiles').select('name, email, telefone, empresa, morada, cidade, site, nuit, logo_url').eq('user_id', q.uid).maybeSingle(),
    q.sb.auth.admin.getUserById(q.uid),
  ]);
  const meta = (u?.user?.user_metadata || {}) as { vh_avisos?: { limite?: boolean; seguranca?: boolean } };
  return NextResponse.json(
    {
      perfil: p || {},
      email: u?.user?.email || ('email' in q ? q.email : '') || '',
      criada: u?.user?.created_at || null,
      ultimaEntrada: u?.user?.last_sign_in_at || null,
      avisos: { limite: meta.vh_avisos?.limite !== false, seguranca: meta.vh_avisos?.seguranca !== false },
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(req: NextRequest) {
  const c = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const conta = typeof c.conta === 'string' ? c.conta : '';
  if (conta && !['dados', 'email', 'senha'].includes(String(c.acao))) {
    return NextResponse.json({ erro: 'Esta acção não está disponível durante a gestão do perfil da conta.' }, { status: 403 });
  }
  const q = await quem(conta || undefined);
  if ('erro' in q) return q.erro;
  if (c.acao === 'dados') {
    const novo: Record<string, string> = {};
    for (const k of CAMPOS) if (k in c) novo[k] = String(c[k] ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, k === 'morada' ? 240 : 120);
    if ('name' in novo && novo.name.length < 2) return NextResponse.json({ erro: 'Escreva o nome.' }, { status: 400 });
    if (novo.site && !/^(https?:\/\/)?[a-z0-9.-]+\.[a-z]{2,}(\/.*)?$/i.test(novo.site)) return NextResponse.json({ erro: 'Site inválido.' }, { status: 400 });
    const { error } = conta
      ? await q.sb.from('profiles').upsert({ user_id: q.uid, ...novo, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      : await q.sb.from('profiles').update({ ...novo, updated_at: new Date().toISOString() }).eq('user_id', q.uid);
    return error ? NextResponse.json({ erro: 'Não foi possível guardar.' }, { status: 500 }) : NextResponse.json({ ok: true });
  }
  if (c.acao === 'avisos') {
    const { data: u } = await q.sb.auth.admin.getUserById(q.uid);
    const meta = { ...(u?.user?.user_metadata || {}), vh_avisos: { limite: !!c.limite, seguranca: !!c.seguranca } };
    const { error } = await q.sb.auth.admin.updateUserById(q.uid, { user_metadata: meta });
    return error ? NextResponse.json({ erro: 'Não foi possível guardar.' }, { status: 500 }) : NextResponse.json({ ok: true });
  }
  if (c.acao === 'senha') {
    const nova = typeof c.nova === 'string' ? c.nova : '';
    // as mesmas regras que o formulário mostra
    if (nova.length < 8 || nova.length > 72 || !/[a-z]/.test(nova) || !/[A-Z]/.test(nova) || !/\d/.test(nova))
      return NextResponse.json({ erro: 'A nova palavra-passe não cumpre as regras.' }, { status: 400 });
    const { error } = await q.sb.auth.admin.updateUserById(q.uid, { password: nova });
    return error ? NextResponse.json({ erro: 'Não foi possível mudar a palavra-passe.' }, { status: 500 }) : NextResponse.json({ ok: true });
  }
  if (c.acao === 'email') {
    if (!conta || !q.admin) return NextResponse.json({ erro: 'Só o administrador pode alterar o e-mail de entrada de outra conta.' }, { status: 403 });
    const novo = typeof c.novo === 'string' ? c.novo.trim().toLowerCase() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(novo)) return NextResponse.json({ erro: 'E-mail inválido.' }, { status: 400 });
    const { error } = await q.sb.auth.admin.updateUserById(q.uid, { email: novo, email_confirm: true });
    if (error) {
      console.error('[vhost/perfil] Não foi possível alterar o e-mail de entrada:', error.message);
      return NextResponse.json({ erro: 'Não foi possível alterar o e-mail de entrada.' }, { status: 400 });
    }
    const [{ error: erroPerfil }, { error: erroRegisto }] = await Promise.all([
      q.sb.from('profiles').upsert({ user_id: q.uid, email: novo, updated_at: new Date().toISOString() }, { onConflict: 'user_id' }),
      q.sb.from('panel_users').update({ email: novo }).eq('auth_user_id', q.uid),
    ]);
    if (erroPerfil || erroRegisto) {
      console.error('[vhost/perfil] O e-mail de entrada mudou, mas não foi possível sincronizar o perfil da conta:', erroPerfil?.message || erroRegisto?.message);
      return NextResponse.json({ erro: 'O e-mail de entrada mudou, mas não foi possível sincronizar os dados do perfil.' }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ erro: 'Ação desconhecida.' }, { status: 400 });
}
