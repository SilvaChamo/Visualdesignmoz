import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';
import {
  assertPanelOwnsWpDomain,
  resolvePanelWpScope,
} from '@/lib/wp-update-panel-access';
import {
  listWpUsers,
  createWpUser,
  deleteWpUser,
  generateWpAutoLoginToken,
  updateWpUserPassword,
  updateWpUser,
  getWpUser
} from '@/lib/wp-cli-server';

export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return auth.error;

  const domain = req.nextUrl.searchParams.get('domain')?.trim().toLowerCase() || '';
  if (!domain) {
    return NextResponse.json({ success: false, error: 'Domínio é obrigatório' }, { status: 400 });
  }

  try {
    const scope = await resolvePanelWpScope(auth.user.id, auth.user.role);
    await assertPanelOwnsWpDomain(scope, domain);

    const users = await listWpUsers(domain);
    return NextResponse.json({ success: true, users });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro ao listar utilizadores';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return auth.error;

  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Pedido inválido' }, { status: 400 });
  }

  const domain = String(body.domain || '').trim().toLowerCase();
  const action = String(body.action || '').trim().toLowerCase();

  if (!domain) {
    return NextResponse.json({ success: false, error: 'Domínio é obrigatório' }, { status: 400 });
  }

  try {
    const scope = await resolvePanelWpScope(auth.user.id, auth.user.role);
    await assertPanelOwnsWpDomain(scope, domain);

    if (action === 'get') {
      const { username } = body;
      if (!username) return NextResponse.json({ success: false, error: 'Nome de utilizador é obrigatório' }, { status: 400 });
      const user = await getWpUser(domain, username);
      if (!user) return NextResponse.json({ success: false, error: 'Utilizador não encontrado' }, { status: 404 });
      return NextResponse.json({ success: true, user });
    }

    if (action === 'create') {
      const { username, email, role, password, firstName, lastName, website, displayName, bio, telefone, profissao, cargo } = body;
      if (!username || !email) {
        return NextResponse.json({ success: false, error: 'Nome de utilizador e email são obrigatórios' }, { status: 400 });
      }
      const result = await createWpUser({ domain, username, email, role, password, firstName, lastName, website, displayName, bio, telefone, profissao, cargo });
      if (!result.ok) {
        return NextResponse.json({ success: false, error: result.output }, { status: 500 });
      }
      return NextResponse.json({ success: true, output: result.output });
    }

    if (action === 'update') {
      const { username, email, role, password, firstName, lastName, website, displayName, bio, telefone, profissao, cargo } = body;
      if (!username) {
        return NextResponse.json({ success: false, error: 'Nome de utilizador é obrigatório' }, { status: 400 });
      }
      const result = await updateWpUser({ domain, username, email, role, password, firstName, lastName, website, displayName, bio, telefone, profissao, cargo });
      if (!result.ok) {
        return NextResponse.json({ success: false, error: result.output }, { status: 500 });
      }
      return NextResponse.json({ success: true, output: result.output });
    }

    if (action === 'delete') {
      const { username } = body;
      if (!username) {
        return NextResponse.json({ success: false, error: 'Nome de utilizador é obrigatório' }, { status: 400 });
      }
      const result = await deleteWpUser(domain, username);
      if (!result.ok) {
        return NextResponse.json({ success: false, error: result.output }, { status: 500 });
      }
      return NextResponse.json({ success: true, output: result.output });
    }

    if (action === 'autologin') {
      const { username } = body;
      if (!username) {
        return NextResponse.json({ success: false, error: 'Nome de utilizador é obrigatório' }, { status: 400 });
      }
      const result = await generateWpAutoLoginToken(domain, username);
      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error }, { status: 500 });
      }
      return NextResponse.json({ success: true, url: result.url });
    }

    if (action === 'update-password') {
      const { username, password } = body;
      if (!username || !password) {
        return NextResponse.json({ success: false, error: 'Nome de utilizador e nova palavra-passe são obrigatórios' }, { status: 400 });
      }
      const result = await updateWpUserPassword(domain, username, password);
      if (!result.ok) {
        return NextResponse.json({ success: false, error: result.output }, { status: 500 });
      }
      return NextResponse.json({ success: true, output: result.output });
    }

    return NextResponse.json({ success: false, error: 'Ação desconhecida' }, { status: 400 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro na operação';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
