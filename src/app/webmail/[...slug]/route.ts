import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /webmail/[...slug] - Suporte a sub-caminhos do Webmail no Next.js
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const url = new URL(req.url);
  const host = (req.headers.get('host') || url.hostname || 'visualdesignmoz.com').toLowerCase();
  const cleanHost = host.replace(/^www\./i, '').replace(/:\d+$/, '');
  const { slug } = await params;

  let targetHost = `webmail.${cleanHost}`;
  if (cleanHost === 'teste.visualdesignmoz.com') {
    targetHost = 'webmail.visualdesignmoz.com'; // o domínio de e-mail teste. foi apagado (Silva, 16/10/2026)
  } else if (cleanHost.endsWith('visualdesignmoz.com')) {
    targetHost = 'webmail.visualdesignmoz.com';
  }

  const subPath = slug && slug.length ? slug.join('/') : '';
  const targetUrl = `https://${targetHost}/${subPath}${url.search}`;
  return NextResponse.redirect(targetUrl, 307);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string[] }> }) {
  return GET(req, ctx);
}
