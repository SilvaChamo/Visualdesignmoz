import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /webmail - Redirecionamento universal para o Roundcube / Webmail.
 * Evita o erro 404 caso o servidor web (Apache/Nginx) encaminhe a rota /webmail para o Next.js.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);

  // Um só webmail, o da VisualDesign (Silva, 16/10/2026): serve todas as caixas de correio do servidor
  const targetHost = 'webmail.visualdesignmoz.com';

  // Preservar query parameters (?_user=..., ?_vhsso=..., ?_sso=..., etc.)
  const targetUrl = `https://${targetHost}/${url.search}`;
  return NextResponse.redirect(targetUrl, 307);
}

export async function POST(req: NextRequest) {
  return GET(req);
}
