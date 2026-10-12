import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';
import { getDaSyncAdmin } from '@/lib/da-sync-schema';
import { hestiaCall } from '@/lib/hestia-client';
import { esquecerLeitura, lerServidor } from '@/lib/vhost-servidor';
import { esquecerRegisto } from '@/lib/vhost-dados';

export const dynamic = 'force-dynamic';

/**
 * /api/vhost/cliente — dados de um cliente (plano VisualHost/07-plano-passar-dominios-entre-contas.md, ponto 4).
 * GET  ?conta=                       dados do perfil do site e do servidor, e se o perfil está ligado à conta
 * POST { acao: 'dados', conta, … }   nome, empresa, telefone, morada, cidade, NUIT e e-mail de contacto: grava no perfil
 *                                    do site (profiles) e, ao mesmo tempo, no Hestia (nome e e-mail da conta)
 * POST { acao: 'ligar', conta, email } liga o perfil do site com esse e-mail à conta de alojamento (só o administrador):
 *                                    ligado, o cliente vê a sua conta ao entrar no painel
 * Administrador: qualquer conta; revendedor: só as contas dos seus clientes.
 * Proteção combinada com o Silva (como em /api/vhost/acoes): sem VHOST_ACOES_TODAS=1, só contas de teste.
 * O e-mail de ENTRADA do cliente não muda aqui (é do Supabase Auth); muda o e-mail de contacto da conta.
 */
const PREFIXO_TESTE = 'teste';
const todasLiberadas = () => process.env.VHOST_ACOES_TODAS === '1';
const CONTA_OK = /^[a-z][a-z0-9_-]{2,30}$/;
const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CAMPOS = ['name', 'empresa', 'telefone', 'morada', 'cidade', 'nuit'] as const;
const limpo = (v: unknown, max: number) => String(v ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max);

async function contexto(contaPedida: string) {
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
async function perfilDaConta(sb: NonNullable<ReturnType<typeof getDaSyncAdmin>>, conta: string) {
  const { data: pu } = await sb.from('panel_users').select('username, first_name, last_name, email, auth_user_id').eq('username', conta).maybeSingle();
  let uid = pu?.auth_user_id ? String(pu.auth_user_id) : '';
  const cols = 'user_id, name, email, telefone, empresa, morada, cidade, site, nuit, da_username';
  let perfil: Record<string, string | null> | null = null;
  if (uid) perfil = ((await sb.from('profiles').select(cols).eq('user_id', uid).maybeSingle()).data as Record<string, string | null> | null) || null;
  if (!perfil) {
    perfil = ((await sb.from('profiles').select(cols).eq('da_username', conta).maybeSingle()).data as Record<string, string | null> | null) || null;
    uid = perfil?.user_id ? String(perfil.user_id) : '';
  }
  return { pu, perfil, uid };
}

export async function GET(req: NextRequest) {
  const c = await contexto(req.nextUrl.searchParams.get('conta') || '');
  if ('erro' in c) return c.erro;
  const { pu, perfil, uid } = await perfilDaConta(c.sb, c.conta);
  const h = c.srv.users[c.conta];
  return NextResponse.json(
    {
      conta: c.conta,
      ligado: !!uid,
      perfil: perfil ? Object.fromEntries([...CAMPOS, 'email'].map((k) => [k, perfil[k] ?? ''])) : null,
      servidor: { nome: h?.NAME || (pu ? [pu.first_name, pu.last_name].filter(Boolean).join(' ') : ''), email: h?.CONTACT || pu?.email || '' },
      podeLigar: c.admin,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(req: NextRequest) {
  const corpo = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const c = await contexto(String(corpo.conta || ''));
  if ('erro' in c) return c.erro;
  if (!todasLiberadas() && !c.conta.startsWith(PREFIXO_TESTE)) {
    return NextResponse.json({ erro: 'Por agora só se alteram contas de teste (nome a começar por "' + PREFIXO_TESTE + '").' }, { status: 403 });
  }

  if (corpo.acao === 'ligar') {
    if (!c.admin) return NextResponse.json({ erro: 'Só o administrador liga um perfil a uma conta.' }, { status: 403 });
    const email = limpo(corpo.email, 160).toLowerCase();
    if (!EMAIL_OK.test(email)) return NextResponse.json({ erro: 'E-mail inválido.' }, { status: 400 });
    const { uid: jaLigado } = await perfilDaConta(c.sb, c.conta);
    if (jaLigado) return NextResponse.json({ erro: 'Esta conta já tem um perfil ligado.' }, { status: 409 });
    const { data: achados } = await c.sb.from('profiles').select('user_id, da_username').ilike('email', email);
    if (!achados || achados.length !== 1) return NextResponse.json({ erro: achados?.length ? 'Há mais de um perfil com esse e-mail.' : 'Não há nenhum perfil do site com esse e-mail.' }, { status: 404 });
    const alvo = achados[0];
    if (alvo.da_username && String(alvo.da_username).toLowerCase() !== c.conta) {
      return NextResponse.json({ erro: 'Esse perfil já está ligado à conta ' + alvo.da_username + '.' }, { status: 409 });
    }
    const a = await c.sb.from('profiles').update({ da_username: c.conta, updated_at: new Date().toISOString() }).eq('user_id', alvo.user_id);
    const b = await c.sb.from('panel_users').update({ auth_user_id: alvo.user_id }).eq('username', c.conta);
    if (a.error || b.error) return NextResponse.json({ erro: 'Não foi possível ligar.' }, { status: 500 });
    esquecerRegisto();
    return NextResponse.json({ ok: true });
  }

  if (corpo.acao === 'renomear-conta') {
    if (!c.admin) return NextResponse.json({ erro: 'Só o administrador pode renomear uma conta.' }, { status: 403 });
    const novoNome = limpo(corpo.novoNome, 32).toLowerCase();
    if (!CONTA_OK.test(novoNome)) return NextResponse.json({ erro: 'O novo nome da conta deve começar por uma letra e ter entre 3 e 30 caracteres (apenas letras minúsculas, números, hífen ou sublinhado).' }, { status: 400 });
    if (novoNome === c.conta) return NextResponse.json({ erro: 'O novo nome da conta é idêntico ao atual.' }, { status: 400 });

    if (c.srv.users[novoNome]) return NextResponse.json({ erro: 'Já existe uma conta com o nome "' + novoNome + '" no servidor.' }, { status: 409 });

    const { data: jaExisteSb } = await c.sb.from('panel_users').select('username').eq('username', novoNome).maybeSingle();
    if (jaExisteSb) return NextResponse.json({ erro: 'Já existe um utilizador registado como "' + novoNome + '".' }, { status: 409 });

    const u = c.srv.users[c.conta];
    const pkg = u?.PACKAGE || 'default';
    const email = u?.CONTACT || '';
    const nomeCompleto = u?.NAME || c.conta;
    const [pNome, ...rNome] = nomeCompleto.split(/\s+/);

    const rAdd = await hestiaCall('v-add-user', [novoNome, 'Tmp#' + Math.random().toString(36).slice(2, 10), email || 'admin@' + novoNome + '.com', pkg, pNome || novoNome, rNome.join(' ') || pNome || novoNome]);
    if (!rAdd.ok) return NextResponse.json({ erro: 'Não foi possível criar a conta ' + novoNome + ' no servidor: ' + (rAdd.error || 'erro') }, { status: 502 });

    const dominiosWeb = Object.keys(c.srv.web[c.conta] || {});
    const dominiosMail = Object.keys(c.srv.mail[c.conta] || {});
    const dominiosDns = Object.keys(c.srv.dns[c.conta] || {});
    const todosDoms = [...new Set([...dominiosWeb, ...dominiosMail, ...dominiosDns])];

    for (const dom of todosDoms) {
      await hestiaCall('v-change-domain-owner', [dom, novoNome]);
    }

    const bds = Object.keys(c.srv.db[c.conta] || {});
    for (const bd of bds) {
      await hestiaCall('v-change-database-owner', [bd, novoNome]);
    }

    await hestiaCall('v-delete-user', [c.conta]);

    await c.sb.from('panel_users').update({ username: novoNome }).eq('username', c.conta);
    await c.sb.from('panel_sites').update({ owner: novoNome }).eq('owner', c.conta);
    await c.sb.from('profiles').update({ da_username: novoNome }).eq('da_username', c.conta);

    esquecerLeitura();
    esquecerRegisto();
    return NextResponse.json({ ok: true, conta: novoNome });
  }

  if (corpo.acao === 'dados') {
    const novo: Record<string, string> = {};
    for (const k of CAMPOS) if (k in corpo) novo[k] = limpo(corpo[k], k === 'morada' ? 240 : 120);
    const email = 'email' in corpo ? limpo(corpo.email, 160) : '';
    if ('name' in novo && novo.name.length < 2) return NextResponse.json({ erro: 'Escreva o nome.' }, { status: 400 });
    if (email && !EMAIL_OK.test(email)) return NextResponse.json({ erro: 'E-mail de contacto inválido.' }, { status: 400 });
    const { pu, uid } = await perfilDaConta(c.sb, c.conta);
    const feito: string[] = [];
    const avisos: string[] = [];

    // 1. servidor (Hestia): nome e e-mail de contacto da conta
    if (novo.name) {
      const [primeiro, ...resto] = novo.name.split(/\s+/);
      const r = await hestiaCall('v-change-user-name', [c.conta, primeiro, resto.join(' ') || primeiro]);
      if (r.ok) feito.push('nome no servidor');
      else return NextResponse.json({ erro: 'O servidor recusou o nome: ' + (r.error || 'erro') + '. Nada foi gravado.' }, { status: 502 });
    }
    if (email) {
      const r = await hestiaCall('v-change-user-contact', [c.conta, email]);
      if (r.ok) feito.push('e-mail de contacto no servidor');
      else avisos.push('O servidor recusou o e-mail de contacto: ' + (r.error || 'erro'));
    }

    // 2. registo do site: perfil (se estiver ligado) e utilizador do painel
    if (uid && Object.keys(novo).length) {
      const { error } = await c.sb.from('profiles').update({ ...novo, updated_at: new Date().toISOString() }).eq('user_id', uid);
      if (error) avisos.push('Não foi possível gravar o perfil do site.');
      else feito.push('perfil do site');
    } else if (!uid) avisos.push('Esta conta não tem perfil do site ligado: só se mudou o servidor. Ligue o perfil para os dados ficarem iguais.');
    const pup: Record<string, string> = {};
    if (novo.name) {
      const [primeiro, ...resto] = novo.name.split(/\s+/);
      pup.first_name = primeiro;
      pup.last_name = resto.join(' ');
    }
    if (email) pup.email = email;
    if (pu && Object.keys(pup).length) await c.sb.from('panel_users').update(pup).eq('username', c.conta);

    esquecerLeitura();
    esquecerRegisto();
    return NextResponse.json({ ok: !!feito.length, feito, avisos }, { status: feito.length ? 200 : 400 });
  }
  return NextResponse.json({ erro: 'Ação desconhecida.' }, { status: 400 });
}
