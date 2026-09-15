import { NextRequest, NextResponse } from 'next/server';
import { requireDaAccessForDomain } from '@/lib/panel-domain-access';
import { dynadotAPI } from '@/lib/dynadot-adapter';

/** Detalhes e acções de gestão de domínio no registador (Dynadot). */
export async function GET(request: NextRequest) {
  const domain = request.nextUrl.searchParams.get('domain')?.trim().toLowerCase();
  if (!domain) {
    return NextResponse.json({ success: false, error: 'Domínio obrigatório' }, { status: 400 });
  }

  const auth = await requireDaAccessForDomain(domain);
  if ('error' in auth) return auth.error;

  const [result, dnssec] = await Promise.all([
    dynadotAPI.getDomainDetails(domain),
    dynadotAPI.getDnssecStatus(domain),
  ]);
  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    domain,
    isLocked: result.isLocked,
    autoRenew: result.autoRenew,
    expireDate: result.expireDate,
    registrationDate: result.registrationDate,
    status: result.status,
    nameservers: result.nameservers,
    privacyEnabled: result.privacyEnabled,
    dnssecEnabled: dnssec.success ? dnssec.enabled : null,
  });
}

export async function POST(request: NextRequest) {
  let body: { domain?: string; action?: string; isEnabled?: boolean; nameservers?: string[] };
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

  // unlock/auth-code/set-nameservers dão acesso efectivo a levar o domínio para outro
  // registador ou reapontá-lo para outro lado — só quem realmente é dono do domínio
  // (staff, ou o cliente confirmado dono via requireDaAccessForDomain) pode chamar isto.
  const auth = await requireDaAccessForDomain(domain);
  if ('error' in auth) return auth.error;

  if (action === 'unlock' || action === 'lock') {
    const result = await dynadotAPI.setTransferLock(domain, action === 'lock');
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({
      success: true,
      isLocked: result.isLocked,
      message: action === 'lock' ? 'Domínio bloqueado para transferência.' : 'Bloqueio de transferência removido.',
    });
  }

  if (action === 'auth-code') {
    const result = await dynadotAPI.getTransferAuthCode(domain);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({
      success: true,
      authCode: result.authCode,
      message: 'Código de transferência obtido.',
    });
  }

  if (action === 'set-nameservers') {
    const nameservers = Array.isArray(body.nameservers)
      ? body.nameservers.map((n) => String(n).trim()).filter(Boolean)
      : [];
    if (nameservers.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Indique pelo menos 2 nameservers.' },
        { status: 400 },
      );
    }
    const result = await dynadotAPI.setNameservers(domain, nameservers);
    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error }, { status: 400 });
    }
    return NextResponse.json({
      success: true,
      nameservers: result.hosts,
      message: 'Nameservers actualizados.',
    });
  }

  if (action === 'autorenew') {
    if (typeof body.isEnabled !== 'boolean') {
      return NextResponse.json({ success: false, error: 'isEnabled obrigatório' }, { status: 400 });
    }
    const result = await dynadotAPI.setAutoRenew(domain, body.isEnabled);
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
