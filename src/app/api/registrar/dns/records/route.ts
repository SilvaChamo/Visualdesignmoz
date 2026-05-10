import { NextResponse } from 'next/server';
import { requireAdminOrReseller } from '@/lib/panel-api-auth';
import { porkbunAPI } from '@/lib/porkbun-adapter';

/** Lê os registos DNS da zona no registrador (POST /dns/retrieve). */
export async function POST(req: Request) {
  const auth = await requireAdminOrReseller();
  if ('error' in auth) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: 'JSON inválido' }, { status: 400 });
  }
  const domain = typeof body === 'object' && body && 'domain' in body ? String((body as { domain: unknown }).domain || '').trim() : '';
  if (!domain) {
    return NextResponse.json({ success: false, error: 'Indique o domínio' }, { status: 400 });
  }

  const result = await porkbunAPI.retrieveDnsRecords(domain);
  if (result.status !== 'SUCCESS') {
    return NextResponse.json(
      { success: false, error: (result as { message?: string }).message || 'Erro ao obter registos DNS' },
      { status: 400 }
    );
  }

  const raw = result as Record<string, unknown>;
  const inner = (raw.response as Record<string, unknown> | undefined) || raw;
  const records =
    (inner.records as unknown) ??
    (inner.dns as unknown) ??
    (raw.records as unknown);
  const list = Array.isArray(records) ? records : [];
  return NextResponse.json({ success: true, raw: result, records: list });
}
