import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { checkAndRegisterLoginAttempt, clearLoginAttempts, loginRateLimitKey } from '@/lib/login-rate-limit';
import { isHestiaOnlyDeploy } from '@/lib/hosting-provider';
import { createClient as clienteComCookies } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

/** Evita o botão "Entrar" ficar a girar para sempre quando Hestia/DA não respondem. */
function comTempo<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    p.then((v) => v as T | null).catch(() => null),
    new Promise<null>((r) => setTimeout(() => r(null), ms)),
  ]);
}

/**
 * POST /api/vhost/entrar  { utilizador, senha } — entrada no painel com o nome de utilizador (o mesmo do DA/Hestia,
 * guardado em profiles.da_username; pedido do Silva a 11/10: "entrar com o nome de utilizador ou e-mail").
 * Procura o e-mail desse perfil e confirma a palavra-passe; só então devolve o e-mail. Sem a palavra-passe certa
 * responde sempre o mesmo: não dá para descobrir e-mails.
 * A confirmação é a própria entrada no Supabase, e a sessão fica já aberta nos cookies desta resposta ({ sessao: true }):
 * o navegador usa-a sem voltar a entrar (antes entrava aqui, saía, e o navegador entrava outra vez — o login esperava
 * duas vezes pelo Supabase; Silva, 16/10/2026: "leva um século para autorizar entrada").
 */
export async function POST(req: NextRequest) {
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const nome = String(b.utilizador || '').trim().toLowerCase();
  const senha = String(b.senha || '');
  const falha = () => NextResponse.json({ erro: 'Utilizador ou palavra-passe errados.' }, { status: 401 });
  if (!senha || !/^[a-z0-9._-]{1,64}$/.test(nome)) return falha();

  const chave = loginRateLimitKey(req, 'utilizador:' + nome);
  const limite = await checkAndRegisterLoginAttempt(chave);
  if (!limite.allowed) {
    return NextResponse.json({ erro: 'Demasiadas tentativas. Tente novamente daqui a alguns minutos.' }, { status: 429, headers: { 'Retry-After': String(limite.retryAfterSeconds) } });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const servico = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';
  if (!url || !servico || !anon) return NextResponse.json({ erro: 'Serviço indisponível.' }, { status: 500 });
  const sem = { auth: { persistSession: false, autoRefreshToken: false } };

  // o "_" é um coringa no ilike: escapado (o nome só tem letras, números, ".", "_" e "-")
  const esc = nome.replace(/_/g, '\\_');
  const adminClient = createClient(url, servico, sem);
  let authUserId: string | null = null;
  let serverUsername: string = nome;
  let encSecret: string | null = null;

  let { data: perfis } = await adminClient
    .from('profiles')
    .select('id, user_id, email, da_username, da_password_encrypted')
    .or(`da_username.ilike.${esc},name.ilike.${esc}`)
    .limit(2);

  if (perfis && perfis.length === 1 && perfis[0]?.email) {
    authUserId = perfis[0].user_id || perfis[0].id || null;
    if (perfis[0].da_username) serverUsername = perfis[0].da_username;
    if (perfis[0].da_password_encrypted) encSecret = perfis[0].da_password_encrypted;
  }

  // Fallback: se não encontrar em profiles, procura no registo panel_users
  if (!perfis || perfis.length !== 1 || !perfis[0]?.email) {
    const { data: pu } = await adminClient
      .from('panel_users')
      .select('email, auth_user_id, username, da_password_encrypted')
      .ilike('username', esc)
      .maybeSingle();
    if (pu?.email) {
      perfis = [{ email: pu.email } as any];
      authUserId = pu.auth_user_id || null;
      if (pu.username) serverUsername = pu.username;
      if (pu.da_password_encrypted) encSecret = pu.da_password_encrypted;
    } else if (pu?.auth_user_id) {
      const { data: userAuth } = await adminClient.auth.admin.getUserById(pu.auth_user_id);
      if (userAuth?.user?.email) {
        perfis = [{ email: userAuth.user.email } as any];
        authUserId = pu.auth_user_id;
        if (pu.username) serverUsername = pu.username;
        if (pu.da_password_encrypted) encSecret = pu.da_password_encrypted;
      }
    }
  }

  if (!perfis || perfis.length !== 1 || !perfis[0]?.email) return falha();
  const email = String(perfis[0].email).trim().toLowerCase();

  // 1. Tenta autenticar diretamente no Supabase — com o cliente dos cookies: se entrar, a sessão fica gravada na resposta
  const cliente = await clienteComCookies();
  let { data, error } = await cliente.auth.signInWithPassword({ email, password: senha });

  // 2. Se a password falhou no Supabase, confirma se bate certo com o servidor / credenciais existentes
  if (error || !data?.session) {
    let senhaValida = false;

    // A) Password guardada e encriptada (da_password_encrypted)
    if (encSecret) {
      try {
        const { decryptDaSecret } = await import('@/lib/da-credential-store');
        if (decryptDaSecret(encSecret) === senha) senhaValida = true;
      } catch {}
    }

    // B) Password da tabela email_contas (senha_servidor)
    if (!senhaValida) {
      try {
        const { data: ec } = await adminClient
          .from('email_contas')
          .select('senha_servidor')
          .eq('email', email)
          .maybeSingle();
        if (ec?.senha_servidor) {
          const { decryptStoredPassword } = await import('@/lib/panel-access-credentials');
          if (decryptStoredPassword(ec.senha_servidor) === senha) senhaValida = true;
        }
      } catch {}
    }

    // C) Validação em tempo real no servidor Hestia (v-check-user-password)
    //    Com timeout: sem isto o botão Entrar ficava a girar quando a API/SSH não respondia.
    if (!senhaValida && serverUsername) {
      const hRes = await comTempo(
        (async () => {
          const { checkUserPassword } = await import('@/lib/hestia-adapter');
          return checkUserPassword(serverUsername, senha);
        })(),
        10_000,
      );
      if (hRes?.ok) senhaValida = true;
    }

    // D) DirectAdmin só no Hetzner — neste deploy Contabo/Hestia não existe DA
    //    e o pedido HTTPS ficava preso em SYN_SENT, a bloquear o login.
    if (!senhaValida && serverUsername && !isHestiaOnlyDeploy()) {
      const daRes = await comTempo(
        (async () => {
          const { daRequest } = await import('@/lib/directadmin');
          return daRequest(
            'CMD_API_SHOW_USER_CONFIG',
            'GET',
            { user: serverUsername },
            { role: 'reseller', user: serverUsername, password: senha, skipSshFallback: true },
          );
        })(),
        8_000,
      );
      if (daRes && !daRes.error && daRes.data && Object.keys(daRes.data).length > 0) senhaValida = true;
    }

    // Se confirmou no servidor ou nas credenciais guardadas, atualiza no Supabase para manter igual sem trocar
    if (senhaValida) {
      try {
        if (!authUserId) {
          const { data: uList } = await adminClient.auth.admin.listUsers();
          const found = uList?.users?.find((u) => u.email?.toLowerCase() === email);
          if (found) authUserId = found.id;
        }
        if (authUserId) {
          await adminClient.auth.admin.updateUserById(authUserId, { password: senha });
        }
        const { encryptDaSecret } = await import('@/lib/da-credential-store');
        const encNova = encryptDaSecret(senha);
        await adminClient.from('profiles').update({ da_password_encrypted: encNova }).or(`da_username.eq.${serverUsername},email.eq.${email}`);
        await adminClient.from('panel_users').update({ da_password_encrypted: encNova }).eq('username', serverUsername);
      } catch (err) {
        console.error('[vhost/entrar] Erro ao sincronizar senha com Supabase:', err);
      }

      // Tenta novamente após sincronizar — só libera se a sessão Supabase existir de facto
      const retry = await cliente.auth.signInWithPassword({ email, password: senha });
      if (retry.data?.session) {
        data = retry.data;
        error = null;
      }
    }
  }

  if (error || !data?.session) return falha();
  // limpeza do contador de tentativas: não atrasa a entrada
  void clearLoginAttempts(chave);
  return NextResponse.json({ email, sessao: true });
}
