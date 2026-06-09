import { NextRequest, NextResponse } from 'next/server';
import { applyBrevoMxToAllDomains, applyBrevoMxToDomain } from '@/lib/bind-email-dns';
import { getDefaultEmailDnsRecords } from '@/lib/email-dns-defaults';
import { getServerHost } from '@/lib/server-config';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';

/** GET — registos DNS por defeito (referência UI) */
export async function GET(req: NextRequest) {
  const domain = req.nextUrl.searchParams.get('domain') || 'exemplo.com';
  return NextResponse.json({
    provider: 'brevo-inbound',
    domain,
    records: getDefaultEmailDnsRecords(domain, getServerHost()),
    webhook: '/api/webhook/brevo-inbound',
  });
}

/** POST { domain } ou { all: true } — aplica MX Brevo na zona BIND do servidor */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdminOrReseller();
    if ('error' in auth) return auth.error;

    const body = (await req.json().catch(() => ({}))) as {
      domain?: string;
      all?: boolean;
    };

    if (body.all) {
      const result = await applyBrevoMxToAllDomains();
      return NextResponse.json({ success: result.ok, ...result });
    }

    const domain = body.domain?.trim().toLowerCase();
    if (!domain) {
      return NextResponse.json({ success: false, error: 'domain ou all:true' }, { status: 400 });
    }

    const result = await applyBrevoMxToDomain(domain);
    return NextResponse.json({
      success: result.ok,
      domain,
      ...result,
    });
  } catch (e) {
    return NextResponse.json(
      { success: false, error: e instanceof Error ? e.message : 'Erro' },
      { status: 500 },
    );
  }
}
