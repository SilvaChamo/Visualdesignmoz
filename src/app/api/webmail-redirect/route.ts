import { NextResponse } from 'next/server';

/** Redirecciona para webmail configurado na app (utilizador já autenticado na sessão da app). */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const extra = searchParams.get('path')?.trim().replace(/^\/+/, '') || '';

  const baseRaw =
    process.env.NEXT_PUBLIC_WEBMAIL_URL ||
    process.env.NEXT_PUBLIC_WEBMAIL_BASE_URL ||
    '';

  if (!baseRaw) {
    return NextResponse.json(
      { error: 'Defina NEXT_PUBLIC_WEBMAIL_URL no ambiente (URL do webmail).' },
      { status: 503 }
    );
  }

  const base = baseRaw.replace(/\/$/, '');
  const target = extra ? `${base}/${extra}` : `${base}/`;

  return NextResponse.redirect(target, { status: 307, headers: { 'Cache-Control': 'no-store' } });
}
