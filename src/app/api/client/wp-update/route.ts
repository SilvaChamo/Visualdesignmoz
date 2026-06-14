import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { assertClientOwnsDomain, listClientHostingSites } from '@/lib/wp-update-client-access';
import { handleWpUpdateGet, handleWpUpdatePost } from '@/lib/wp-update-handlers';

export const maxDuration = 120;

async function requireClient() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user?.email) {
    return {
      error: NextResponse.json({ error: 'Não autorizado' }, { status: 401 }),
    } as const;
  }

  const role = user.user_metadata?.role || user.app_metadata?.role;
  if (role === 'admin' || role === 'reseller') {
    return {
      error: NextResponse.json({ error: 'Use o painel admin' }, { status: 403 }),
    } as const;
  }

  return {
    user: { id: user.id, email: user.email.toLowerCase() },
  } as const;
}

export async function GET(req: NextRequest) {
  const auth = await requireClient();
  if ('error' in auth) return auth.error;

  const domain = req.nextUrl.searchParams.get('domain')?.trim().toLowerCase() || '';
  if (domain) {
    try {
      await assertClientOwnsDomain(auth.user.id, auth.user.email, domain);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Acesso negado';
      return NextResponse.json({ success: false, error: message }, { status: 403 });
    }
  }

  try {
    const result = await handleWpUpdateGet(domain);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status ?? 404 },
      );
    }

    if (!domain && 'installs' in result && Array.isArray(result.installs)) {
      const clientSites = await listClientHostingSites(auth.user.id, auth.user.email);
      const allowed = new Set(
        clientSites.map((s) => (s.domain || '').toLowerCase()).filter(Boolean),
      );
      return NextResponse.json({
        ...result,
        installs: result.installs.filter((i) => allowed.has(i.domain.toLowerCase())),
      });
    }

    return NextResponse.json(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro ao listar plugins';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireClient();
  if ('error' in auth) return auth.error;

  let body: { domain?: string } & Parameters<typeof handleWpUpdatePost>[1];
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 });
  }

  if (body.action === 'upload' || body.action === 'install' || body.action === 'delete') {
    return NextResponse.json(
      { success: false, error: 'Operação não permitida no painel cliente' },
      { status: 403 },
    );
  }

  const domain = String(body.domain || '').trim().toLowerCase();
  if (!domain) {
    return NextResponse.json({ success: false, error: 'domain é obrigatório' }, { status: 400 });
  }

  try {
    await assertClientOwnsDomain(auth.user.id, auth.user.email, domain);
    const result = await handleWpUpdatePost(domain, body);
    if ('status' in result && result.status === 400) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 },
      );
    }
    return NextResponse.json(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro ao actualizar plugin';
    const status = message.includes('permissão') ? 403 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
