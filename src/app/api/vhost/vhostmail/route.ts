import { NextRequest, NextResponse } from 'next/server';
import { requirePanelBootstrapAccess } from '@/lib/panel-api-auth';
import { montarVhostmail, type PastaVhostmail } from '@/lib/vhostmail/montar';
import { lerServidor } from '@/lib/vhost-servidor';
import { lerRegisto, montarDados } from '@/lib/vhost-dados';

export const dynamic = 'force-dynamic';

/**
 * GET /api/vhost/vhostmail?conta=<endereço>&pasta=entrada|enviados&tema=light|dark&plano=<pacote>
 * A página do VhostMail (o maquete aprovado), mostrada num iframe do painel (Contas de e-mail › Entrada / Saída / Abrir).
 * Só para quem tem sessão no painel. As mensagens vêm da caixa real da conta aberta (ver ./caixa/route.ts).
 */

const EMAIL = /^[^\s@,;:"'<>()]+@([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
const PACOTE = /^[\w .+-]{1,40}$/;
const HTML = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' };

const MSG = (t: string, entrar = true) =>
  `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:system-ui;padding:24px;max-width:520px;margin:auto"><p>${t}</p>${entrar ? '<p><a href="/vhost:2026" style="color:#E5202E;font-weight:600">Abrir o painel</a></p>' : ''}</body>`;

/** Aberto como aplicação instalada (start_url ?app=1, sem conta): a caixa da última vez (cookie vm_conta) ou a primeira desta sessão */
async function caixaPorOmissao(req: NextRequest, auth: { user: { id: string; email?: string; role: string } }): Promise<{ conta: string; plano: string }> {
  const cookie = decodeURIComponent(req.cookies.get('vm_conta')?.value || '').trim().toLowerCase();
  const srv = await lerServidor();
  const dados = montarDados(srv, await lerRegisto(), { userId: auth.user.id, email: auth.user.email || '', role: auth.user.role });
  const todas = Object.values(dados.contas).flatMap((a) => a.mails.map((m) => ({ end: `${m.user}@${m.dom}`.toLowerCase(), plano: a.hpkg || a.pkg || '' })));
  // o cookie só vale se a caixa ainda for desta sessão (a rota da caixa confirma sempre, mas assim nem se abre uma que não é dela)
  const escolhida = todas.find((x) => x.end === cookie) || todas[0];
  return { conta: escolhida?.end || '', plano: escolhida?.plano || '' };
}

export async function GET(req: NextRequest) {
  const auth = await requirePanelBootstrapAccess();
  const sp = req.nextUrl.searchParams;
  const app = sp.get('app') === '1';
  if ('error' in auth) {
    return new NextResponse(MSG('Inicie sessão no painel para abrir o VhostMail.', app), { status: auth.error.status, headers: HTML });
  }
  let conta = (sp.get('conta') || '').trim().toLowerCase();
  let plano = (sp.get('plano') || '').trim();
  const pasta: PastaVhostmail = sp.get('pasta') === 'enviados' ? 'sent' : 'inbox';
  if (!EMAIL.test(conta) && app) {
    try {
      const x = await caixaPorOmissao(req, auth);
      conta = x.conta;
      plano = plano || x.plano;
    } catch {
      return new NextResponse(MSG('O painel está ocupado. Tente outra vez dentro de instantes.'), { status: 503, headers: HTML });
    }
    if (!conta) return new NextResponse(MSG('Esta conta ainda não tem caixas de e-mail. Crie uma em «Contas de e-mail», no painel.'), { status: 404, headers: HTML });
  }
  const html = montarVhostmail({
    conta: EMAIL.test(conta) ? conta : '',
    pasta,
    tema: sp.get('tema') === 'dark' ? 'dark' : 'light',
    lang: sp.get('lang') === 'en' ? 'en' : 'pt',
    plano: PACOTE.test(plano) ? plano : '',
  });
  return new NextResponse(html, { headers: HTML });
}
