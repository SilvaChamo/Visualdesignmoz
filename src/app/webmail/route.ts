import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /webmail - Redirecionamento universal para o Roundcube / Webmail.
 * Evita o erro 404 caso o servidor web (Apache/Nginx) encaminhe a rota /webmail para o Next.js.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const host = (req.headers.get('host') || url.hostname || 'visualdesignmoz.com').toLowerCase();
  const cleanHost = host.replace(/^www\./i, '').replace(/:\d+$/, '');

  // Determinar o subdomínio correto do Webmail
  let targetHost = `webmail.${cleanHost}`;
  if (cleanHost === 'teste.visualdesignmoz.com') {
    targetHost = 'webmail.visualdesignmoz.com'; // o domínio de e-mail teste. foi apagado (Silva, 16/10/2026)
  } else if (cleanHost.endsWith('visualdesignmoz.com')) {
    targetHost = 'webmail.visualdesignmoz.com';
  }

  // Preservar query parameters (?_user=..., ?_vhsso=..., ?_sso=..., etc.)
  const targetUrl = `https://${targetHost}/${url.search}`;
  return NextResponse.redirect(targetUrl, 307);
}

export async function POST(req: NextRequest) {
  return GET(req);
}
