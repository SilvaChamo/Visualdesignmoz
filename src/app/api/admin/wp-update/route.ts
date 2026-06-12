import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-api-auth';
import { handleWpUpdateGet, handleWpUpdatePost } from '@/lib/wp-update-handlers';

export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  const domain = req.nextUrl.searchParams.get('domain')?.trim().toLowerCase() || '';

  try {
    const result = await handleWpUpdateGet(domain);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status ?? 404 },
      );
    }
    return NextResponse.json(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro ao listar plugins';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin();
  if ('error' in auth) return auth.error;

  let body: { domain?: string; plugin?: string; all?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 });
  }

  const domain = String(body.domain || '').trim().toLowerCase();
  if (!domain) {
    return NextResponse.json({ success: false, error: 'domain é obrigatório' }, { status: 400 });
  }

  try {
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
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
