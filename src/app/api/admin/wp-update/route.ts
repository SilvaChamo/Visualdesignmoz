import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';
import { handleWpUpdateGet, handleWpUpdatePost } from '@/lib/wp-update-handlers';
import {
  assertPanelOwnsWpDomain,
  filterWpInstallsForPanel,
  getAllowedPanelWpDomains,
  resolvePanelWpScope,
} from '@/lib/wp-update-panel-access';

export const maxDuration = 120;

async function parsePostBody(req: NextRequest): Promise<Record<string, unknown>> {
  const contentType = req.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData();
    const domain = String(form.get('domain') || '').trim().toLowerCase();
    const action = String(form.get('action') || 'upload');
    const file = form.get('file');
    if (!(file instanceof File)) {
      return { domain, action, error: 'file é obrigatório' };
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    return {
      domain,
      action,
      zipBase64: buffer.toString('base64'),
      filename: file.name || 'plugin.zip',
    };
  }
  return (await req.json()) as Record<string, unknown>;
}

export async function GET(req: NextRequest) {
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return auth.error;

  const domain = req.nextUrl.searchParams.get('domain')?.trim().toLowerCase() || '';

  try {
    const scope = await resolvePanelWpScope(auth.user.id, auth.user.role);
    if (domain) {
      await assertPanelOwnsWpDomain(scope, domain);
    }

    const result = await handleWpUpdateGet(domain);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status ?? 404 },
      );
    }

    if (!domain && 'installs' in result && Array.isArray(result.installs)) {
      const allowed = await getAllowedPanelWpDomains(scope);
      return NextResponse.json({
        ...result,
        installs: filterWpInstallsForPanel(result.installs, scope, allowed),
      });
    }

    return NextResponse.json(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro ao listar WordPress';
    const status = message.includes('permissão') || message.includes('DirectAdmin') ? 403 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return auth.error;

  let body: Record<string, unknown>;
  try {
    body = await parsePostBody(req);
  } catch {
    return NextResponse.json({ success: false, error: 'Pedido inválido' }, { status: 400 });
  }

  if (body.error) {
    return NextResponse.json({ success: false, error: String(body.error) }, { status: 400 });
  }

  const domain = String(body.domain || '').trim().toLowerCase();
  if (!domain) {
    return NextResponse.json({ success: false, error: 'domain é obrigatório' }, { status: 400 });
  }

  try {
    const scope = await resolvePanelWpScope(auth.user.id, auth.user.role);
    await assertPanelOwnsWpDomain(scope, domain);

    const result = await handleWpUpdatePost(domain, body as Parameters<typeof handleWpUpdatePost>[1]);
    if ('status' in result && result.status === 400) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json(result);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Erro na operação WordPress';
    const status = message.includes('permissão') || message.includes('DirectAdmin') ? 403 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
