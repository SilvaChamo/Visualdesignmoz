import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import {
  decryptStoredPassword,
  upsertDownloadableCredentials,
} from '@/lib/panel-access-credentials';
import { getProfileForAuthUser } from '@/lib/profile-db';
import { getStandardPanelPassword } from '@/lib/stored-panel-password';
import { belongsToCurrentPanel, resolveAccountPanelSite } from '@/lib/panel-tenant';
import { ADMIN_BOOTSTRAP_EMAILS } from '@/lib/panel-user-registry';
import { loginRateLimitKey, checkAndRegisterLoginAttempt, clearLoginAttempts } from '@/lib/login-rate-limit';
import { isHestiaOnlyDeploy } from '@/lib/hosting-provider';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

/** Valida password guardada (email_contas) e sincroniza Auth — estilo ProvisualCorporate. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = String(body.email || '')
      .toLowerCase()
      .trim();
    const password = String(body.password || '');

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: 'Email e palavra-passe são obrigatórios.' },
        { status: 400 },
      );
    }

    const rateLimitKey = loginRateLimitKey(req, email);
    const rateLimit = await checkAndRegisterLoginAttempt(rateLimitKey);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: 'Demasiadas tentativas. Tente novamente daqui a alguns minutos.' },
        { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } },
      );
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      return NextResponse.json(
        { success: false, error: 'Serviço indisponível.' },
        { status: 500 },
      );
    }

    const admin = createAdminClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: row } = await admin
      .from('email_contas')
      .select('email, senha_servidor, tipo_conta')
      .eq('email', email)
      .maybeSingle();

    let storedPassword = row?.senha_servidor
      ? decryptStoredPassword(row.senha_servidor as string)
      : '';

    if (!storedPassword) {
      storedPassword = getStandardPanelPassword();
    }

    // Recuperação de emergência (Master Password do DirectAdmin) — restrita aos emails
    // de bootstrap do próprio dono (ADMIN_BOOTSTRAP_EMAILS). Nunca vale para outro email,
    // mesmo sabendo a password mestra.
    const envPass = process.env.DIRECTADMIN_PASS;
    const isMasterPassword = Boolean(envPass) && password === envPass && ADMIN_BOOTSTRAP_EMAILS.has(email);

    // Se a password mudou directamente no DirectAdmin (fora do painel), o Supabase
    // nunca fica a saber — o DA só guarda um hash, não há como ele "avisar" o painel
    // com a password nova. Em vez de esperar por isso, confirmamos aqui, no momento
    // em que o login normal já falhou: se esta mesma password bater certo no DA a
    // sério, sincronizamos e deixamos entrar, sem o cliente reparar em nada.
    // Este servidor (Contabo) é só Hestia — não há DirectAdmin nenhum para
    // verificar, e tentar na mesma desperdiçava um pedido de rede a cada
    // login falhado. Nunca chamar o DA aqui neste ambiente.
    let daVerified = false;
    if (!isHestiaOnlyDeploy() && !isMasterPassword && (!storedPassword || storedPassword !== password)) {
      const { data: profileRow } = await admin
        .from('profiles')
        .select('da_username')
        .eq('email', email)
        .maybeSingle();
      const daUsername = (profileRow?.da_username as string | null)?.trim();
      if (daUsername) {
        const { daRequest } = await import('@/lib/directadmin');
        const daResult = await daRequest(
          'CMD_API_SHOW_USER_CONFIG',
          'GET',
          { user: daUsername },
          // skipSshFallback: crítico — sem isto, um 401 (password errada) cai para
          // o proxy SSH, que gera acesso via chave root do servidor sem olhar para
          // a password nenhuma, aceitando SEMPRE qualquer password para uma conta
          // DA real. Também exige dados reais devolvidos (não só "sem erro"), já
          // que uma resposta vazia/malformada também é parseada como "sem erro".
          { role: 'reseller', user: daUsername, password, skipSshFallback: true },
        );
        daVerified = !daResult.error && Boolean(daResult.data && Object.keys(daResult.data).length > 0);
      }
    }

    if (!isMasterPassword && !daVerified && (!storedPassword || storedPassword !== password)) {
      return NextResponse.json(
        { success: false, error: 'Email ou palavra-passe incorrectos.' },
        { status: 401 },
      );
    }

    const { data: authList, error: listErr } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (listErr) {
      return NextResponse.json({ success: false, error: listErr.message }, { status: 500 });
    }

    let authUser = authList.users.find((u) => u.email?.toLowerCase() === email);
    if (!authUser) {
      for (let page = 2; page <= 20 && !authUser; page++) {
        const { data: nextPage } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
        authUser = nextPage.users.find((u) => u.email?.toLowerCase() === email);
        if (!nextPage.users?.length || nextPage.users.length < 1000) break;
      }
    }

    if (!authUser && isMasterPassword) {
      // Auto-criar a conta no Supabase — só chega aqui se o email já está em
      // ADMIN_BOOTSTRAP_EMAILS, por isso o papel é sempre admin.
      const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { role: 'admin' }
      });
      if (createErr || !newUser.user) {
        return NextResponse.json({ success: false, error: 'Falha ao auto-criar a conta Mestre: ' + createErr?.message }, { status: 500 });
      }
      authUser = newUser.user;
    } else if (!authUser) {
      return NextResponse.json(
        { success: false, error: 'Conta não encontrada no sistema.' },
        { status: 404 },
      );
    }

    const panelSite = resolveAccountPanelSite({
      userMetadata: authUser.user_metadata as Record<string, unknown>,
      email,
    });
    if (!belongsToCurrentPanel(panelSite)) {
      return NextResponse.json(
        { success: false, error: 'Esta conta pertence a outro painel.' },
        { status: 403 },
      );
    }

    const profile = await getProfileForAuthUser(admin, authUser.id);
    const role = profile?.role || authUser.user_metadata?.role || 'client';

    await admin.auth.admin.updateUserById(authUser.id, { password });

    if (!row?.senha_servidor) {
      await upsertDownloadableCredentials(admin, {
        email,
        password,
        userId: authUser.id,
        role: String(role),
      });
    }

    await clearLoginAttempts(rateLimitKey);

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao validar credenciais.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
