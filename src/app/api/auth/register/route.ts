import { mensagemEmailInvalido } from '@/lib/email-valido';
import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient as createServerClient } from '@/utils/supabase/server';
import { PANEL_SLUG } from '@/lib/panel-tenant';
import { findProtectedEmailClaim, PROTECTED_EMAIL_MESSAGE } from '@/lib/protected-account-email';
import { ENCOMENDAS_ACCOUNT_ORIGIN } from '@/lib/panel-origin';
import { mensagemContaExiste, temContaReal, utilizadorPorEmail } from '@/lib/conta-existe';
import { turnstileValido } from '@/lib/turnstile';


export async function POST(request: NextRequest) {
  try {
    const corpo = await request.json();
    const { email, password, nome, telefone, empresa, endereco, cidade, provincia, pais, emailEmpresa, cargo, nuit, contacto, honeypot, origem } = corpo;

    // Campo-armadilha: só bots que preenchem todos os campos do formulário
    // (incluindo os escondidos) chegam a mandar isto preenchido.
    if (honeypot) {
      return NextResponse.json({ error: 'Não foi possível concluir o registo.' }, { status: 400 });
    }

    // "Não sou um robô" (Turnstile da Cloudflare) do formulário de registo (Silva, 14/10/2026). Só esse formulário o
    // manda: o checkout e a cotação, que também criam contas por aqui, continuam sem ele.
    if ('turnstile' in corpo) {
      const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
      if (!(await turnstileValido(corpo.turnstile, ip))) {
        return NextResponse.json({ error: 'A verificação de segurança falhou ou expirou. Confirme de novo que não é um robô.' }, { status: 400 });
      }
    }

    if (!email || !password || !nome || !telefone) {
      return NextResponse.json({ error: 'Preencha nome, telefone, email e password.' }, { status: 400 });
    }

    const erroEmail = mensagemEmailInvalido(String(email), 'O e-mail');
    if (erroEmail) return NextResponse.json({ error: erroEmail }, { status: 400 });

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
      if (await utilizadorPorEmail(admin, normalizedEmail)) {
        return NextResponse.json({ error: mensagemContaExiste(normalizedEmail) }, { status: 409 });
      }
      return NextResponse.json({ error: PROTECTED_EMAIL_MESSAGE }, { status: 403 });
    }

    const metadados = {
      role: 'guest',
      nome: String(nome).trim(),
      telefone: String(telefone).trim(),
      empresa: empresa ? String(empresa).trim() : '',
      endereco: endereco ? String(endereco).trim() : '',
      provincia: provincia ? String(provincia).trim() : '',
      pais: pais ? String(pais).trim() : '',
      email_empresa: emailEmpresa ? String(emailEmpresa).trim() : '',
      cargo: cargo ? String(cargo).trim().slice(0, 80) : '',
      contacto: contacto ? String(contacto).trim() : '',
      site: PANEL_SLUG,
      // Conta criada no formulário das encomendas (/cotacao) — entra sempre
      // na lista de contas das encomendas e no painel /encomendas.
      ...(origem === ENCOMENDAS_ACCOUNT_ORIGIN ? { origem: ENCOMENDAS_ACCOUNT_ORIGIN } : {}),
    };
    let { data, error } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      password: String(password),
      email_confirm: true,
      user_metadata: metadados,
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
        // O e-mail já tinha um login. Se for uma conta a sério, quem chama entra com a palavra-passe (o checkout e a cotação fazem-no);
        // se estiver vazio (sem hospedagem nem compras: sobra de uma compra a meio), não impede nada e passa a ser desta conta
        // (Silva, 30/10/2026: «se não existe uma conta real não pode impedir criar conta»).
        const existente = await utilizadorPorEmail(admin, normalizedEmail);
        if (!existente || (await temContaReal(admin, existente))) {
          return NextResponse.json({ error: mensagemContaExiste(normalizedEmail) }, { status: 409 });
        }
        const actualizado = await admin.auth.admin.updateUserById(existente.id, {
          password: String(password),
          email_confirm: true,
          user_metadata: { ...(existente.user_metadata || {}), ...metadados },
        });
        if (actualizado.error || !actualizado.data.user) {
          return NextResponse.json({ error: actualizado.error?.message || 'Não foi possível concluir o registo.' }, { status: 400 });
        }
        data = actualizado.data;
        error = null;
      } else {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
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
          nuit: nuit && /^\d{9}$/.test(String(nuit).replace(/\s/g, '')) ? String(nuit).replace(/\s/g, '') : undefined,
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
