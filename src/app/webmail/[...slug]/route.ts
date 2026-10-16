import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /webmail/[...slug] - Suporte a sub-caminhos do Webmail no Next.js
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  const url = new URL(req.url);
  const { slug } = await params;

  // Um só webmail, o da VisualDesign (Silva, 16/10/2026): serve todas as caixas de correio do servidor
  const targetHost = 'webmail.visualdesignmoz.com';

  const subPath = slug && slug.length ? slug.join('/') : '';
  const targetUrl = `https://${targetHost}/${subPath}${url.search}`;
  return NextResponse.redirect(targetUrl, 307);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string[] }> }) {
  return GET(req, ctx);
}
