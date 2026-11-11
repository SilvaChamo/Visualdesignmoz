import { NextRequest, NextResponse } from 'next/server';
import { requirePanelBootstrapAccess } from '@/lib/panel-api-auth';
import { montarVhostmail, type PastaVhostmail } from '@/lib/vhostmail/montar';

export const dynamic = 'force-dynamic';

/**
 * GET /api/vhost/vhostmail?conta=<endereço>&pasta=entrada|enviados&tema=light|dark&plano=<pacote>
 * A página do VhostMail (o maquete aprovado), mostrada num iframe do painel (Contas de e-mail › Entrada / Saída / Abrir).
 * Só para quem tem sessão no painel. As mensagens vêm da caixa real da conta aberta (ver ./caixa/route.ts).
 */

const EMAIL = /^[^\s@,;:"'<>()]+@([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
const PACOTE = /^[\w .+-]{1,40}$/;
const HTML = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' };

export async function GET(req: NextRequest) {
  const auth = await requirePanelBootstrapAccess();
  if ('error' in auth) {
    return new NextResponse('<!doctype html><meta charset="utf-8"><body style="font-family:system-ui;padding:24px">Inicie sessão no painel para abrir o VhostMail.</body>', { status: auth.error.status, headers: HTML });
  }
  const sp = req.nextUrl.searchParams;
  const conta = (sp.get('conta') || '').trim().toLowerCase();
  const pasta: PastaVhostmail = sp.get('pasta') === 'enviados' ? 'sent' : 'inbox';
  const plano = (sp.get('plano') || '').trim();
  const html = montarVhostmail({
    conta: EMAIL.test(conta) ? conta : '',
    pasta,
    tema: sp.get('tema') === 'dark' ? 'dark' : 'light',
    plano: PACOTE.test(plano) ? plano : '',
  });
  return new NextResponse(html, { headers: HTML });
}
