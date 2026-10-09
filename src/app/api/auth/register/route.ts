import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient, type SupabaseClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/utils/supabase/server';
import { PANEL_SLUG } from '@/lib/panel-tenant';
import { findProtectedEmailClaim, PROTECTED_EMAIL_MESSAGE } from '@/lib/protected-account-email';
import { ENCOMENDAS_ACCOUNT_ORIGIN } from '@/lib/panel-origin';

const EXISTING_ACCOUNT_MESSAGE = 'Já existe uma conta com este email. Use «Entrar» em vez de «Criar conta».';

async function authUserExists(admin: SupabaseClient, email: string): Promise<boolean> {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    if (data.users.some((u) => u.email?.toLowerCase() === email)) return true;
    if (data.users.length < 1000) return false;
  }
  return false;
}

export async function POST(request: NextRequest) {
  try {
    const { email, password, nome, telefone, empresa, endereco, cidade, provincia, pais, emailEmpresa, contacto, honeypot, origem } = await request.json();

    // Campo-armadilha: só bots que preenchem todos os campos do formulário
    // (incluindo os escondidos) chegam a mandar isto preenchido.
    if (honeypot) {
      return NextResponse.json({ error: 'Não foi possível concluir o registo.' }, { status: 400 });
    }

    if (!email || !password || !nome || !telefone) {
      return NextResponse.json({ error: 'Preencha nome, telefone, email e password.' }, { status: 400 });
    }

    if (String(password).length < 6) {
      return NextResponse.json({ error: 'A password deve ter no mínimo 6 caracteres.' }, { status: 400 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !serviceKey) {
      return NextResponse.json(
        { error: 'Servidor de autenticação não configurado.' },
        { status: 500 },
      );
    }

    const admin = createAdminClient(url, serviceKey);
    const normalizedEmail = String(email).toLowerCase().trim();

    // O registo confirma o email automaticamente (sem prova de posse), por isso
    // não pode aceitar emails da equipa nem de domínios alojados connosco.
    // Se a conta já existir, responde como sempre ("Já existe") — o checkout e a
    // cotação usam essa resposta para entrar com a password indicada.
    if (await findProtectedEmailClaim(normalizedEmail)) {
      if (await authUserExists(admin, normalizedEmail)) {
        return NextResponse.json({ error: EXISTING_ACCOUNT_MESSAGE }, { status: 409 });
      }
      return NextResponse.json({ error: PROTECTED_EMAIL_MESSAGE }, { status: 403 });
    }

    const { data, error } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      password: String(password),
      email_confirm: true,
      user_metadata: {
        role: 'guest',
        nome: String(nome).trim(),
        telefone: String(telefone).trim(),
        empresa: empresa ? String(empresa).trim() : '',
        endereco: endereco ? String(endereco).trim() : '',
        provincia: provincia ? String(provincia).trim() : '',
        pais: pais ? String(pais).trim() : '',
        email_empresa: emailEmpresa ? String(emailEmpresa).trim() : '',
        contacto: contacto ? String(contacto).trim() : '',
        site: PANEL_SLUG,
        // Conta criada no formulário das encomendas (/cotacao) — entra sempre
        // na lista de contas das encomendas e no painel /encomendas.
        ...(origem === ENCOMENDAS_ACCOUNT_ORIGIN ? { origem: ENCOMENDAS_ACCOUNT_ORIGIN } : {}),
      },
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
        return NextResponse.json({ error: EXISTING_ACCOUNT_MESSAGE }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    if (data.user?.id) {
      try {
        const { saveProfileForAuthUser } = await import('@/lib/profile-db');
        await saveProfileForAuthUser(admin, data.user.id, {
          email: normalizedEmail,
          role: 'guest',
          name: String(nome).trim() || normalizedEmail.split('@')[0],
          telefone: String(telefone).trim(),
          empresa: empresa ? String(empresa).trim() : undefined,
          morada: endereco ? String(endereco).trim() : undefined,
          cidade: cidade ? String(cidade).trim() : undefined,
        });
      } catch (profileError) {
        // Reverte o utilizador de Auth já criado para não deixar uma "conta fantasma"
        // (existe no Auth mas sem perfil, e uma nova tentativa falharia com "já existe").
        console.error('[auth/register] falha ao criar perfil, a reverter utilizador:', profileError);
        await admin.auth.admin.deleteUser(data.user.id).catch((cleanupError) => {
          console.error('[auth/register] falha ao reverter utilizador órfão:', cleanupError);
        });
        return NextResponse.json(
          { error: 'Não foi possível concluir o registo. Tente novamente.' },
          { status: 500 },
        );
      }
    }

    // Autentica já aqui (rota do servidor, com acesso a cookies) em vez de
    // deixar o browser fazer signInWithPassword a seguir — isso criava uma
    // corrida (o cookie de sessão demorava a propagar, e o pedido seguinte
    // ainda apanhava "sem sessão"). Ao vir já autenticado nesta resposta,
    // o próximo pedido do browser já tem sessão válida, sem espera nem sondagem.
    let sessionReady = false;
    try {
      const serverClient = await createServerClient();
      const { error: signInError } = await serverClient.auth.signInWithPassword({
        email: normalizedEmail,
        password: String(password),
      });
      sessionReady = !signInError;
    } catch (signInErr) {
      console.error('[auth/register] falha ao iniciar sessão após registo:', signInErr);
    }

    return NextResponse.json({
      success: true,
      sessionReady,
      message:
        'Conta criada com sucesso. Já pode entrar com email e password — não precisa confirmar email.',
      email: normalizedEmail,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro ao criar conta';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
