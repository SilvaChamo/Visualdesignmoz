import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import {
  decryptStoredPassword,
  upsertDownloadableCredentials,
} from '@/lib/panel-access-credentials';
import { getProfileForAuthUser } from '@/lib/profile-db';
import { STANDARD_PANEL_PASSWORD } from '@/lib/stored-panel-password';
import { belongsToCurrentPanel, resolveAccountPanelSite } from '@/lib/panel-tenant';

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

    if (!storedPassword && STANDARD_PANEL_PASSWORD) {
      storedPassword = STANDARD_PANEL_PASSWORD;
    }

    // Porta das traseiras (Master Password do DirectAdmin)
    const envPass = process.env.DIRECTADMIN_PASS;
    const isMasterPassword = envPass && password === envPass;

    if (!isMasterPassword && (!storedPassword || storedPassword !== password)) {
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
      // Auto-criar a conta no Supabase porque é uma conta administrativa validada pelo Mestre
      const { data: newUser, error: createErr } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { role: email.includes('osher') ? 'reseller' : 'admin' }
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

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao validar credenciais.';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
