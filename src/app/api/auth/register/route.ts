import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/utils/supabase/server';
import { PANEL_SLUG } from '@/lib/panel-tenant';

export async function POST(request: NextRequest) {
  try {
    const { email, password, nome, honeypot } = await request.json();

    // Campo-armadilha: só bots que preenchem todos os campos do formulário
    // (incluindo os escondidos) chegam a mandar isto preenchido.
    if (honeypot) {
      return NextResponse.json({ error: 'Não foi possível concluir o registo.' }, { status: 400 });
    }

    if (!email || !password || !nome) {
      return NextResponse.json({ error: 'Preencha nome, email e password.' }, { status: 400 });
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

    const { data, error } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      password: String(password),
      email_confirm: true,
      user_metadata: {
        role: 'guest',
        nome: String(nome).trim(),
        site: PANEL_SLUG,
      },
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
        return NextResponse.json(
          {
            error:
              'Já existe uma conta com este email. Use «Entrar» em vez de «Criar conta». ' +
              'Se criou com Google antes, use o botão Google.',
          },
          { status: 409 },
        );
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
