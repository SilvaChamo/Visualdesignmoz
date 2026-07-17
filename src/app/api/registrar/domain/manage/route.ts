import { NextRequest, NextResponse } from 'next/server';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';
import { spaceshipAPI } from '@/lib/spaceship-adapter';
import { porkbunAPI } from '@/lib/porkbun-adapter';

type Registrar = 'spaceship' | 'porkbun';

/** Descobre a que registador um domínio pertence, tentando os dois. */
async function resolveRegistrar(domain: string): Promise<Registrar | null> {
  const [spaceshipResult, porkbunResult] = await Promise.all([
    spaceshipAPI.getDomainDetails(domain),
    porkbunAPI.getDomainDetails(domain),
  ]);
  if (spaceshipResult.success) return 'spaceship';
  if (porkbunResult.success) return 'porkbun';
  return null;
}

/** Detalhes e acções de gestão de domínio no registador (Spaceship ou Porkbun). */
export async function GET(request: NextRequest) {
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return auth.error;

  const domain = request.nextUrl.searchParams.get('domain')?.trim().toLowerCase();
  if (!domain) {
    return NextResponse.json({ success: false, error: 'Domínio obrigatório' }, { status: 400 });
  }

  const registrar = await resolveRegistrar(domain);
  if (!registrar) {
    return NextResponse.json({ success: false, error: 'Domínio não encontrado em nenhum registador ligado.' }, { status: 400 });
  }

  const api = registrar === 'spaceship' ? spaceshipAPI : porkbunAPI;
  const result = await api.getDomainDetails(domain);
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    domain,
    registrar,
    isLocked: result.isLocked,
    autoRenew: result.autoRenew,
    expireDate: result.expireDate,
    status: result.status,
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return auth.error;

  let body: { domain?: string; action?: string; isEnabled?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 });
  }

  const domain = body.domain?.trim().toLowerCase();
  const action = body.action?.trim();

  if (!domain || !action) {
    return NextResponse.json({ success: false, error: 'Domínio e acção obrigatórios' }, { status: 400 });
  }

  const registrar = await resolveRegistrar(domain);
  if (!registrar) {
    return NextResponse.json({ success: false, error: 'Domínio não encontrado em nenhum registador ligado.' }, { status: 400 });
  }
  const api = registrar === 'spaceship' ? spaceshipAPI : porkbunAPI;

  if (action === 'unlock') {
    const result = await api.setTransferLock(domain, false);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({ success: true, isLocked: result.isLocked, message: 'Bloqueio de transferência removido.' });
  }

  if (action === 'auth-code') {
    const result = await api.getTransferAuthCode(domain);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({
      success: true,
      authCode: result.authCode,
      expires: result.expires,
      message: 'Código de transferência obtido.',
    });
  }

  if (action === 'autorenew') {
    if (typeof body.isEnabled !== 'boolean') {
      return NextResponse.json({ success: false, error: 'isEnabled obrigatório' }, { status: 400 });
    }
    const result = await api.setAutoRenew(domain, body.isEnabled);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({
      success: true,
      autoRenew: result.isEnabled,
      message: result.isEnabled ? 'Renovação automática activada.' : 'Renovação automática desactivada.',
    });
  }

  return NextResponse.json({ success: false, error: 'Acção desconhecida' }, { status: 400 });
}
